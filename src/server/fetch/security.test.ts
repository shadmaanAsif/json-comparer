// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isBlockedAddress, resolveSafeTarget, sanitizeHeaders } from "./security";

describe("fetch proxy security", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "::1",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1"
  ])("blocks restricted address %s", (address) => expect(isBlockedAddress(address)).toBe(true));
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("allows public address %s", (address) =>
    expect(isBlockedAddress(address)).toBe(false)
  );
  it("requires HTTPS, port 443, and an allowlisted hostname", async () => {
    const resolver = async () => [{ address: "1.1.1.1", family: 4 }];
    await expect(
      resolveSafeTarget("http://api.example.com", ["api.example.com"], resolver)
    ).rejects.toThrow("HTTPS");
    await expect(
      resolveSafeTarget("https://api.example.com:444", ["api.example.com"], resolver)
    ).rejects.toThrow("port 443");
    await expect(
      resolveSafeTarget("https://evil.example", ["api.example.com"], resolver)
    ).rejects.toThrow("not approved");
    await expect(
      resolveSafeTarget("https://api.example.com", ["api.example.com"], async () => [
        { address: "127.0.0.1", family: 4 }
      ])
    ).rejects.toThrow("restricted");
  });
  it("pins an approved public address and supports explicit subdomain wildcards", async () =>
    expect(
      resolveSafeTarget("https://v1.api.example.com/x", ["*.api.example.com"], async () => [
        { address: "1.1.1.1", family: 4 }
      ])
    ).resolves.toMatchObject({ address: "1.1.1.1", family: 4 }));
  it("allows any public host with the explicit development wildcard", async () =>
    expect(
      resolveSafeTarget("https://public.example/x", ["*"], async () => [
        { address: "1.1.1.1", family: 4 }
      ])
    ).resolves.toMatchObject({ address: "1.1.1.1" }));
  it("still blocks private addresses when the wildcard is enabled", async () =>
    expect(
      resolveSafeTarget("https://public.example/x", ["*"], async () => [
        { address: "169.254.169.254", family: 4 }
      ])
    ).rejects.toThrow("restricted network address"));
  it("strips credentials and unsafe forwarding headers by default", () =>
    expect(
      sanitizeHeaders(
        {
          Authorization: "secret",
          Cookie: "sid=1",
          Host: "evil",
          Accept: "application/json",
          "X-Api-Key": "key"
        },
        false
      )
    ).toEqual({ Accept: "application/json", "X-Api-Key": "key", "Accept-Encoding": "identity" }));
});
