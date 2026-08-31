// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { resetRateLimitsForTests } from "@/server/fetch/rate-limit";

const originalAllowlist = process.env.FETCH_PROXY_ALLOWLIST;
const originalAllowLocalhost = process.env.FETCH_PROXY_ALLOW_LOCALHOST;
afterEach(() => {
  process.env.FETCH_PROXY_ALLOWLIST = originalAllowlist;
  process.env.FETCH_PROXY_ALLOW_LOCALHOST = originalAllowLocalhost;
  vi.unstubAllEnvs();
  resetRateLimitsForTests();
});
const call = (
  body: unknown,
  headers: Record<string, string> = {},
  requestUrl = "http://localhost/api/fetch-proxy"
) =>
  POST(
    new Request(requestUrl, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body)
    })
  );

describe("fetch proxy route", () => {
  it("rejects unsupported methods and extra fields", async () => {
    expect(
      (await call({ url: "https://example.com", method: "TRACE", headers: {}, body: null })).status
    ).toBe(400);
    expect(
      (
        await call({
          url: "https://example.com",
          method: "GET",
          headers: {},
          body: null,
          surprise: true
        })
      ).status
    ).toBe(400);
  });
  it("fails closed when no allowlist is configured", async () => {
    process.env.FETCH_PROXY_ALLOWLIST = "";
    const response = await call({
      url: "https://example.com",
      method: "GET",
      headers: {},
      body: null
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "blocked_target" });
  });
  it("applies the request size guard before parsing", async () => {
    const response = await call({}, { "content-length": String(300 * 1024) });
    expect(response.status).toBe(413);
  });
  it("rejects the localhost exception when the application origin is not loopback", async () => {
    process.env.FETCH_PROXY_ALLOWLIST = "*";
    process.env.FETCH_PROXY_ALLOW_LOCALHOST = "true";
    const response = await call(
      {
        url: "http://localhost:8080/api",
        method: "GET",
        headers: {},
        body: null
      },
      {},
      "https://comparer.example/api/fetch-proxy"
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "blocked_target" });
  });
  it("rejects the localhost exception in production even from a loopback origin", async () => {
    process.env.FETCH_PROXY_ALLOWLIST = "api.example.com";
    process.env.FETCH_PROXY_ALLOW_LOCALHOST = "true";
    vi.stubEnv("NODE_ENV", "production");
    const response = await call({
      url: "http://localhost:8080/api",
      method: "GET",
      headers: {},
      body: null
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "blocked_target" });
  });
});
