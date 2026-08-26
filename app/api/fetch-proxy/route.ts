import { NextResponse } from "next/server";
import { z } from "zod";
import { executeSecureFetch } from "@/server/fetch/executor";
import { checkRateLimit } from "@/server/fetch/rate-limit";
import { configuredAllowlist, ProxyError } from "@/server/fetch/security";

export const runtime = "nodejs";
const MAX_REQUEST_BYTES = 256 * 1024;
const schema = z
  .object({
    url: z.string().min(1).max(4096),
    method: z.enum(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]),
    headers: z
      .record(z.string().max(128), z.string().max(8192))
      .refine((headers) => Object.keys(headers).length <= 32, "Too many headers"),
    body: z
      .string()
      .max(128 * 1024)
      .nullable()
  })
  .strict();

function numberEnv(name: string, fallback: number, minimum: number, maximum: number): number {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
}

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_REQUEST_BYTES)
    return NextResponse.json(
      { error: "invalid_request", message: "The proxy request is too large." },
      { status: 413 }
    );
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(client, numberEnv("FETCH_PROXY_RATE_LIMIT", 20, 1, 1000), 60_000))
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "Too many fetch requests. Try again shortly."
      },
      { status: 429 }
    );
  try {
    const input = schema.parse(await request.json());
    const allowlist = configuredAllowlist();
    if (allowlist.includes("*")) {
      const inboundHost = new URL(request.url).hostname;
      if (
        process.env.NODE_ENV === "production" ||
        !["localhost", "127.0.0.1", "::1"].includes(inboundHost)
      )
        throw new ProxyError(
          "blocked_target",
          "Wildcard remote fetch is available only from a local development server.",
          403
        );
    }
    const result = await executeSecureFetch(input, {
      allowlist,
      allowCredentials: process.env.FETCH_PROXY_ALLOW_CREDENTIALS === "true",
      timeoutMs: numberEnv("FETCH_PROXY_TIMEOUT_MS", 10_000, 1000, 30_000),
      maxResponseBytes: numberEnv(
        "FETCH_PROXY_MAX_RESPONSE_BYTES",
        5 * 1024 * 1024,
        1024,
        10 * 1024 * 1024
      ),
      maxRedirects: numberEnv("FETCH_PROXY_MAX_REDIRECTS", 3, 0, 5)
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    const safe =
      error instanceof ProxyError
        ? error
        : error instanceof z.ZodError
          ? new ProxyError("invalid_request", "The proxy request is invalid.", 400)
          : new ProxyError("network_error", "The remote request could not be completed.", 502);
    return NextResponse.json(
      { error: safe.code, message: safe.message },
      { status: safe.status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
