// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
afterEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  vi.resetModules();
});

describe("site-config", () => {
  it("falls back to the local dev origin when NEXT_PUBLIC_SITE_URL is unset", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const { SITE_URL } = await import("./site-config");
    expect(SITE_URL).toBe("http://localhost:3001");
  });

  it("falls back to the local dev origin when NEXT_PUBLIC_SITE_URL is malformed", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "not-a-url";
    vi.resetModules();
    const { SITE_URL } = await import("./site-config");
    expect(SITE_URL).toBe("http://localhost:3001");
  });

  it("normalizes a configured production URL to its origin", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com/some/path?x=1";
    vi.resetModules();
    const { SITE_URL } = await import("./site-config");
    expect(SITE_URL).toBe("https://example.com");
  });
});
