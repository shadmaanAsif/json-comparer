import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type ProxyErrorCode =
  "invalid_request" | "blocked_target" | "rate_limited" | "timeout" | "too_large" | "network_error";
export class ProxyError extends Error {
  constructor(
    public readonly code: ProxyErrorCode,
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

export interface ResolvedTarget {
  url: URL;
  address: string;
  family: 4 | 6;
}
export type Resolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

export function isBlockedAddress(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0]!;
  if (normalized === "::" || normalized === "::1" || normalized === "0.0.0.0") return true;
  if (normalized.startsWith("::ffff:")) return isBlockedAddress(normalized.slice(7));
  if (
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff")
  )
    return true;
  if (isIP(normalized) === 6) return false;
  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255))
    return true;
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

export function configuredAllowlist(): string[] {
  return (process.env.FETCH_PROXY_ALLOWLIST ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export async function resolveSafeTarget(
  rawUrl: string,
  allowlist: string[],
  resolver: Resolver = async (hostname) => lookup(hostname, { all: true, verbatim: true })
): Promise<ResolvedTarget> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ProxyError("invalid_request", "Enter a valid absolute HTTPS URL.");
  }
  if (url.protocol !== "https:")
    throw new ProxyError("blocked_target", "Only HTTPS targets are allowed.");
  if (url.username || url.password)
    throw new ProxyError("blocked_target", "Credentials in URLs are not allowed.");
  if (url.port && url.port !== "443")
    throw new ProxyError("blocked_target", "Only HTTPS port 443 is allowed.");
  const hostname = url.hostname.toLowerCase();
  if (!allowlist.length)
    throw new ProxyError(
      "blocked_target",
      "Remote fetch is disabled until FETCH_PROXY_ALLOWLIST is configured.",
      503
    );
  if (
    !allowlist.some(
      (entry) =>
        entry === "*" ||
        hostname === entry ||
        (entry.startsWith("*.") && hostname.endsWith(entry.slice(1)) && hostname !== entry.slice(2))
    )
  )
    throw new ProxyError(
      "blocked_target",
      "This hostname is not approved by the server administrator.",
      403
    );
  const records = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await resolver(hostname);
  if (!records.length || records.some((record) => isBlockedAddress(record.address)))
    throw new ProxyError(
      "blocked_target",
      "The target resolved to a restricted network address.",
      403
    );
  const chosen = records[0]!;
  return { url, address: chosen.address, family: chosen.family === 6 ? 6 : 4 };
}

const allowedHeaders = new Set([
  "accept",
  "content-type",
  "if-match",
  "if-none-match",
  "x-api-key"
]);
export function sanitizeHeaders(
  input: Record<string, string>,
  allowCredentials: boolean
): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [name, value] of Object.entries(input)) {
    const lower = name.toLowerCase();
    if ((lower === "authorization" || lower === "cookie") && allowCredentials) output[name] = value;
    else if (allowedHeaders.has(lower)) output[name] = value;
  }
  output["Accept-Encoding"] = "identity";
  return output;
}
