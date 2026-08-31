// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  createPinnedLookup,
  executeSecureFetch,
  type FetchPolicy,
  type RawResponse
} from "./executor";

const publicResolver = async (hostname: string) => [
  { address: hostname === "private.example.com" ? "127.0.0.1" : "1.1.1.1", family: 4 }
];
const basePolicy = {
  allowlist: ["*.example.com"],
  allowLocalhost: false,
  allowCredentials: false,
  timeoutMs: 1000,
  maxResponseBytes: 1024,
  maxRedirects: 2,
  resolver: publicResolver
};

describe("executeSecureFetch", () => {
  it("returns the callback shape requested by modern Node DNS lookup options", async () => {
    const lookup = createPinnedLookup("1.1.1.1", 4);
    await expect(
      new Promise((resolve, reject) =>
        lookup("example.com", { all: true }, (error, address) =>
          error ? reject(error) : resolve(address)
        )
      )
    ).resolves.toEqual([{ address: "1.1.1.1", family: 4 }]);
    await expect(
      new Promise((resolve, reject) =>
        lookup("example.com", { all: false }, (error, address, family) =>
          error ? reject(error) : resolve({ address, family })
        )
      )
    ).resolves.toEqual({ address: "1.1.1.1", family: 4 });
  });
  it("revalidates and blocks a redirect to a restricted address before a second request", async () => {
    const requester = vi.fn(async (): Promise<RawResponse> => ({
      status: 302,
      statusText: "Found",
      headers: { location: "https://private.example.com/secret" },
      bodyText: ""
    }));
    await expect(
      executeSecureFetch(
        { url: "https://api.example.com", method: "GET", headers: {}, body: null },
        { ...basePolicy, requester }
      )
    ).rejects.toThrow("restricted network address");
    expect(requester).toHaveBeenCalledTimes(1);
  });
  it("revalidates and blocks redirects outside the allowlist", async () => {
    const requester = vi.fn(async (): Promise<RawResponse> => ({
      status: 302,
      statusText: "Found",
      headers: { location: "https://evil.test" },
      bodyText: ""
    }));
    await expect(
      executeSecureFetch(
        { url: "https://api.example.com", method: "GET", headers: {}, body: null },
        { ...basePolicy, requester }
      )
    ).rejects.toThrow("not approved");
  });
  it("allows a revalidated redirect to loopback only under the localhost policy", async () => {
    const requester = vi
      .fn<NonNullable<FetchPolicy["requester"]>>()
      .mockResolvedValueOnce({
        status: 302,
        statusText: "Found",
        headers: { location: "http://localhost:8080/result" },
        bodyText: ""
      })
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        bodyText: '{"local":true}'
      });
    const resolver = async (hostname: string) => [
      { address: hostname === "localhost" ? "127.0.0.1" : "1.1.1.1", family: 4 }
    ];

    await expect(
      executeSecureFetch(
        { url: "https://api.example.com", method: "GET", headers: {}, body: null },
        { ...basePolicy, allowLocalhost: true, resolver, requester }
      )
    ).resolves.toMatchObject({ bodyText: '{"local":true}', isJson: true });
    expect(requester).toHaveBeenCalledTimes(2);
    expect(requester.mock.calls[1]?.[1].url.toString()).toBe("http://localhost:8080/result");
  });
  it("returns non-2xx bodies and detects JSON by parsing", async () => {
    const requester = async (): Promise<RawResponse> => ({
      status: 422,
      statusText: "Unprocessable Entity",
      headers: {},
      bodyText: '{"error":true}'
    });
    await expect(
      executeSecureFetch(
        { url: "https://api.example.com", method: "POST", headers: {}, body: "{}" },
        { ...basePolicy, requester }
      )
    ).resolves.toEqual({
      status: 422,
      statusText: "Unprocessable Entity",
      bodyText: '{"error":true}',
      isJson: true
    });
  });
  it("enforces the redirect limit", async () => {
    const requester = async (): Promise<RawResponse> => ({
      status: 302,
      statusText: "Found",
      headers: { location: "/again" },
      bodyText: ""
    });
    await expect(
      executeSecureFetch(
        { url: "https://api.example.com", method: "GET", headers: {}, body: null },
        { ...basePolicy, maxRedirects: 1, requester }
      )
    ).rejects.toThrow("redirect limit");
  });
});
