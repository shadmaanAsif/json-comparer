// @vitest-environment node
import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";
import { SITE_URL } from "./site-config";

describe("sitemap", () => {
  it("lists the home page at the configured site URL", () => {
    const result = sitemap();
    expect(result[0]).toMatchObject({ url: SITE_URL, changeFrequency: "monthly", priority: 1 });
    expect(result[0]?.lastModified).toBeInstanceOf(Date);
  });

  it("lists the about and docs pages", () => {
    const result = sitemap();
    expect(result).toHaveLength(3);
    expect(result[1]).toMatchObject({
      url: `${SITE_URL}/about`,
      changeFrequency: "monthly",
      priority: 0.6
    });
    expect(result[2]).toMatchObject({
      url: `${SITE_URL}/docs`,
      changeFrequency: "monthly",
      priority: 0.8
    });
  });
});
