import { describe, expect, it } from "vitest";
import { displayPath, matchesIgnorePattern, parseIgnorePatterns, toJsonPointer } from "./path";

describe("path utilities", () => {
  it("encodes JSON Pointer reserved characters", () => {
    expect(toJsonPointer(["a/b", "~value", 0])).toBe("/a~1b/~0value/0");
  });

  it("renders simple and ambiguous display paths", () => {
    expect(displayPath(["data", "items", 0, "id"])).toBe("data.items[0].id");
    expect(displayPath(["a.b"])).toBe('["a.b"]');
  });

  it("parses comma and newline separated rules", () => {
    expect(parseIgnorePatterns("a.b, c.*\nmeta.**")).toEqual(["a.b", "c.*", "meta.**"]);
  });

  it("matches exact, wildcard, and subtree rules", () => {
    expect(matchesIgnorePattern(["items", 0, "id"], "items.*.id")).toBe(true);
    expect(matchesIgnorePattern(["meta", "nested", "stamp"], "meta.**")).toBe(true);
    expect(matchesIgnorePattern(["meta"], "meta.**")).toBe(true);
    expect(matchesIgnorePattern(["other", "stamp"], "meta.**")).toBe(false);
  });

  it("treats exact object paths and terminal wildcards as implicit subtrees", () => {
    expect(
      matchesIgnorePattern(
        ["config", "partnerConfig", "MOT_config", "nested", "code"],
        "config.partnerConfig.MOT_config"
      )
    ).toBe(true);
    expect(
      matchesIgnorePattern(
        ["config", "partnerConfig", "discoversaudi", "enabled"],
        "config.partnerConfig.discoversaudi"
      )
    ).toBe(true);
    expect(
      matchesIgnorePattern(
        ["config", "partnerConfig", "MOT_config", "nested", "code"],
        "config.partnerConfig.*."
      )
    ).toBe(true);
    expect(
      matchesIgnorePattern(
        ["config", "otherConfig", "MOT_config", "nested", "code"],
        "config.partnerConfig.MOT_config"
      )
    ).toBe(false);
  });
});
