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
export interface TargetResolutionOptions {
  allowLocalhost?: boolean;
  resolver?: Resolver;
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "");
}

export function isLoopbackAddress(address: string): boolean {
  const normalized = normalizeHostname(address).split("%")[0]!;
  if (normalized === "::1") return true;
  if (normalized.startsWith("::ffff:")) return isLoopbackAddress(normalized.slice(7));
  const parts = normalized.split(".").map(Number);
  return (
    parts.length === 4 &&
    parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) &&
    parts[0] === 127
  );
}

export function isLocalhostTarget(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function isBlockedIPv4(address: string): boolean {
  const parts = address.split(".").map(Number);
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

function ipv4ToHexGroups(address: string): string | null {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255))
    return null;
  const [a, b, c, d] = parts as [number, number, number, number];
  return `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
}

// Fully expands "::" shorthand into 8 numeric groups, first rewriting any embedded
// dotted-decimal IPv4 tail (e.g. "::ffff:127.0.0.1") into pure hex groups. This lets every
// alternate textual encoding of the same address (compressed, expanded, embedded-IPv4) be
// compared numerically instead of by string prefix, which is what a fixed-string/prefix
// check like the previous "::ffff:"/"fc"/"fe8" matching can never fully cover.
function expandIPv6Groups(address: string): number[] | null {
  let text = address;
  if (text.includes(".")) {
    const lastColon = text.lastIndexOf(":");
    const hexTail = lastColon === -1 ? null : ipv4ToHexGroups(text.slice(lastColon + 1));
    if (!hexTail) return null;
    text = text.slice(0, lastColon + 1) + hexTail;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const splitGroups = (segment: string) => (segment.length ? segment.split(":") : []);
  const head = splitGroups(halves[0] ?? "");
  const tail = halves.length === 2 ? splitGroups(halves[1] ?? "") : [];
  if (halves.length === 1 && head.length !== 8) return null;
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 && missing < 0) return null;
  const groupStrings = halves.length === 2 ? [...head, ...Array(missing).fill("0"), ...tail] : head;
  if (groupStrings.length !== 8) return null;
  const groups = groupStrings.map((group) => parseInt(group, 16));
  return groups.some((value) => !Number.isInteger(value) || value < 0 || value > 0xffff)
    ? null
    : groups;
}

function ipv4FromGroups(groups: number[]): string {
  const high = groups[6]!;
  const low = groups[7]!;
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
}

export function isBlockedAddress(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0]!;
  if (isIP(normalized) === 4) return isBlockedIPv4(normalized);
  const groups = expandIPv6Groups(normalized);
  if (!groups) return true;
  const [g0, g1, g2, g3, g4, g5] = groups as [number, number, number, number, number, number];
  if (groups.every((value) => value === 0)) return true; // "::" (unspecified)
  if (
    g0 === 0 &&
    g1 === 0 &&
    g2 === 0 &&
    g3 === 0 &&
    g4 === 0 &&
    g5 === 0 &&
    groups[6] === 0 &&
    groups[7] === 1
  )
    return true; // "::1" (loopback)
  // Embedded IPv4: IPv4-compatible (deprecated "::a.b.c.d"), IPv4-mapped ("::ffff:a.b.c.d"),
  // or NAT64 ("64:ff9b::a.b.c.d") — check the real embedded IPv4 address, not the shell.
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && (g5 === 0 || g5 === 0xffff))
    return isBlockedIPv4(ipv4FromGroups(groups));
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0)
    return isBlockedIPv4(ipv4FromGroups(groups));
  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 (unique local)
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 (link-local)
  if ((g0 & 0xff00) === 0xff00) return true; // ff00::/8 (multicast)
  return false;
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
  options: TargetResolutionOptions = {}
): Promise<ResolvedTarget> {
  const resolver: Resolver =
    options.resolver ?? (async (hostname) => lookup(hostname, { all: true, verbatim: true }));
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ProxyError("invalid_request", "Enter a valid absolute HTTPS URL.");
  }
  const hostname = normalizeHostname(url.hostname);
  const localhostTarget = options.allowLocalhost === true && isLocalhostTarget(hostname);
  if (url.protocol !== "https:" && !(localhostTarget && url.protocol === "http:"))
    throw new ProxyError(
      "blocked_target",
      "Only HTTPS targets are allowed. Localhost HTTP requires the development-only server setting."
    );
  if (url.username || url.password)
    throw new ProxyError("blocked_target", "Credentials in URLs are not allowed.");
  if (!localhostTarget && url.port && url.port !== "443")
    throw new ProxyError("blocked_target", "Only HTTPS port 443 is allowed.");
  if (!localhostTarget && !allowlist.length)
    throw new ProxyError(
      "blocked_target",
      "Remote fetch is disabled until FETCH_PROXY_ALLOWLIST is configured.",
      503
    );
  if (
    !localhostTarget &&
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
  if (localhostTarget) {
    if (!records.length || records.some((record) => !isLoopbackAddress(record.address)))
      throw new ProxyError(
        "blocked_target",
        "The localhost target did not resolve exclusively to a loopback network address.",
        403
      );
  } else if (!records.length || records.some((record) => isBlockedAddress(record.address)))
    throw new ProxyError(
      "blocked_target",
      "The target resolved to a restricted network address.",
      403
    );
  const chosen =
    localhostTarget && hostname === "localhost"
      ? (records.find((record) => record.family === 4 && isLoopbackAddress(record.address)) ??
        records[0]!)
      : records[0]!;
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
