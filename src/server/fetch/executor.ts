import { request as httpsRequest } from "node:https";
import type { IncomingHttpHeaders } from "node:http";
import type { LookupFunction } from "node:net";
import type { RemoteFetchRequest } from "@/domain/fetch/curl";
import { ProxyError, resolveSafeTarget, sanitizeHeaders, type Resolver } from "./security";

export interface ProxyFetchResult {
  status: number;
  statusText: string;
  bodyText: string;
  isJson: boolean;
}
export interface RawResponse {
  status: number;
  statusText: string;
  headers: IncomingHttpHeaders;
  bodyText: string;
}
export interface FetchPolicy {
  allowlist: string[];
  allowCredentials: boolean;
  timeoutMs: number;
  maxResponseBytes: number;
  maxRedirects: number;
  resolver?: Resolver;
  requester?: (
    request: RemoteFetchRequest,
    target: Awaited<ReturnType<typeof resolveSafeTarget>>,
    policy: FetchPolicy
  ) => Promise<RawResponse>;
}

export function createPinnedLookup(address: string, family: 4 | 6): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) callback(null, [{ address, family }]);
    else callback(null, address, family);
  };
}

function executePinnedRequest(
  request: RemoteFetchRequest,
  target: Awaited<ReturnType<typeof resolveSafeTarget>>,
  policy: FetchPolicy
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const headers = sanitizeHeaders(request.headers, policy.allowCredentials);
    const body = ["GET", "HEAD"].includes(request.method) ? null : request.body;
    if (body !== null) headers["Content-Length"] = String(Buffer.byteLength(body));
    const outgoing = httpsRequest(
      target.url,
      {
        method: request.method,
        headers,
        servername: target.url.hostname,
        lookup: createPinnedLookup(target.address, target.family)
      },
      (response) => {
        if (
          response.headers["content-encoding"] &&
          response.headers["content-encoding"] !== "identity"
        ) {
          response.destroy();
          reject(
            new ProxyError(
              "network_error",
              "The target returned unsupported compressed content.",
              502
            )
          );
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > policy.maxResponseBytes) {
            response.destroy(
              new ProxyError("too_large", "The response exceeded the configured size limit.", 413)
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 502,
            statusText: response.statusMessage ?? "",
            headers: response.headers,
            bodyText: Buffer.concat(chunks).toString("utf8")
          })
        );
        response.on("error", reject);
      }
    );
    outgoing.setTimeout(policy.timeoutMs, () =>
      outgoing.destroy(
        new ProxyError("timeout", "The target did not respond before the timeout.", 504)
      )
    );
    outgoing.on("error", (error) =>
      reject(
        error instanceof ProxyError
          ? error
          : new ProxyError("network_error", "The target request failed.", 502)
      )
    );
    if (body !== null) outgoing.write(body);
    outgoing.end();
  });
}

export async function executeSecureFetch(
  input: RemoteFetchRequest,
  policy: FetchPolicy
): Promise<ProxyFetchResult> {
  let current = input.url;
  for (let redirects = 0; redirects <= policy.maxRedirects; redirects += 1) {
    const target = await resolveSafeTarget(current, policy.allowlist, policy.resolver);
    const response = await (policy.requester ?? executePinnedRequest)(input, target, policy);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.location;
      if (!location)
        throw new ProxyError("network_error", "The target returned an invalid redirect.", 502);
      if (redirects === policy.maxRedirects)
        throw new ProxyError("network_error", "The target exceeded the redirect limit.", 502);
      current = new URL(location, target.url).toString();
      continue;
    }
    let isJson = true;
    try {
      JSON.parse(response.bodyText);
    } catch {
      isJson = false;
    }
    return {
      status: response.status,
      statusText: response.statusText,
      bodyText: response.bodyText,
      isJson
    };
  }
  throw new ProxyError("network_error", "The target exceeded the redirect limit.", 502);
}
