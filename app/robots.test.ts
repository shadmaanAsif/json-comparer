// @vitest-environment node
import { describe, expect, it } from "vitest";
import robots from "./robots";
import { SITE_URL } from "./site-config";

describe("robots", () => {
  it("allows crawling the app while blocking the API routes and links to the sitemap", () => {
    const result = robots();
    expect(result.rules).toEqual({ userAgent: "*", allow: "/", disallow: "/api/" });
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});
