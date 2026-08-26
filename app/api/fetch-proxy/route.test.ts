// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";
import { resetRateLimitsForTests } from "@/server/fetch/rate-limit";

const originalAllowlist = process.env.FETCH_PROXY_ALLOWLIST;
afterEach(() => {
  process.env.FETCH_PROXY_ALLOWLIST = originalAllowlist;
  resetRateLimitsForTests();
});
const call = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/fetch-proxy", {
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
});
