// @vitest-environment node
import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";
import { SITE_URL } from "./site-config";

describe("sitemap", () => {
  it("lists the home page at the configured site URL", () => {
    const result = sitemap();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ url: SITE_URL, changeFrequency: "monthly", priority: 1 });
    expect(result[0]?.lastModified).toBeInstanceOf(Date);
  });
});
