import { describe, expect, it } from "vitest";
import { compareJson } from "./engine";

describe("compareJson", () => {
  it("ignores object key order", () => {
    const result = compareJson({ a: 1, b: 2 }, { b: 2, a: 1 });
    expect(result.findings).toHaveLength(0);
  });

  it("classifies additions, removals, value changes and type changes", () => {
    const result = compareJson(
      { removed: true, changed: 1, typed: 2 },
      { added: true, changed: 2, typed: "2" }
    );
    expect(result.counts).toEqual({ added: 1, removed: 1, changed: 1, "type-changed": 1 });
  });

  it("treats array order as significant in ordered mode", () => {
    const result = compareJson([1, 2], [2, 1], { arrayMode: "ordered" });
    expect(result.counts.changed).toBe(2);
  });

  it("matches unordered arrays as multisets including duplicates", () => {
    expect(compareJson([1, 2, 1], [2, 1, 1], { arrayMode: "unordered" }).findings).toHaveLength(0);
    const result = compareJson([1, 1], [1], { arrayMode: "unordered" });
    expect(result.counts.removed).toBe(1);
  });

  it("canonicalizes object keys when matching unordered object arrays", () => {
    const result = compareJson([{ id: 1, name: "A" }], [{ name: "A", id: 1 }], {
      arrayMode: "unordered"
    });
    expect(result.findings).toHaveLength(0);
  });

  it("uses unambiguous JSON Pointer paths and ignore patterns", () => {
    const result = compareJson(
      { "a/b": { "~x": 1 } },
      { "a/b": { "~x": 2 } },
      { ignorePatterns: ["/a~1b/~0x"] }
    );
    expect(result.findings[0]).toMatchObject({ pointer: "/a~1b/~0x", ignored: true });
    expect(result.ignoredCount).toBe(1);
  });

  it("supports wildcard and subtree ignore patterns", () => {
    const result = compareJson(
      { items: [{ id: 1, secret: "a" }], meta: { stamp: 1 } },
      { items: [{ id: 1, secret: "b" }], meta: { stamp: 2 } },
      { ignorePatterns: ["items.*.secret", "meta.**"] }
    );
    expect(result.findings.every((finding) => finding.ignored)).toBe(true);
  });

  it("applies an exact object ignore rule to descendant findings", () => {
    const result = compareJson(
      {
        config: { partnerConfig: { MOT_config: { enabled: true, nested: { code: "A" } } } }
      },
      {
        config: { partnerConfig: { MOT_config: { enabled: false, nested: { code: "B" } } } }
      },
      { ignorePatterns: ["config.partnerConfig.MOT_config"] }
    );

    expect(result.findings).toHaveLength(2);
    expect(result.findings.every((finding) => finding.ignored)).toBe(true);
    expect(result.ignoredCount).toBe(2);
    expect(result.counts.changed).toBe(0);
  });

  it("truncates findings at the configured limit", () => {
    const result = compareJson({ a: 1, b: 2 }, { a: 2, b: 3 }, { maxFindings: 1 });
    expect(result.findings).toHaveLength(1);
    expect(result.truncated).toBe(true);
  });

  it("reports dedicated structure findings against Response A", () => {
    const result = compareJson(
      { items: [{ id: 1, name: "one" }, { id: 2 }] },
      { items: [{ id: 1, name: "one", extra: true }, { id: 2 }] }
    );
    expect(result.structure.map((finding) => [finding.kind, finding.pointer])).toEqual(
      expect.arrayContaining([
        ["inconsistent-in-a", "/items/1/name"],
        ["extra-in-b", "/items/0/extra"],
        ["missing-in-b", "/items/1/name"]
      ])
    );
  });

  it("reports an empty A array against a populated B array", () => {
    expect(compareJson({ items: [] }, { items: [{ id: 1 }] }).structure).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "a-empty-array", pointer: "/items" })
      ])
    );
  });

  it("reports a deeply nested field only in B at its exact leaf path", () => {
    const result = compareJson(
      { data: { config: { countries: [{ code: "AE" }] } } },
      { data: { config: { countries: [{ code: "AE", phone: "+971" }] } } }
    );

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "added",
          pointer: "/data/config/countries/0/phone",
          valueB: "+971"
        })
      ])
    );
    expect(result.structure).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "extra-in-b", pointer: "/data/config/countries/0/phone" })
      ])
    );
    expect(result.findings.some((finding) => finding.pointer === "/data/config/countries/0")).toBe(
      false
    );
  });

  it("expands added and removed containers to their smallest meaningful leaves", () => {
    const result = compareJson(
      { removed: { nested: { value: 1 } } },
      { added: { nested: { value: 2 } } }
    );

    expect(result.findings.map((finding) => [finding.kind, finding.pointer])).toEqual(
      expect.arrayContaining([
        ["removed", "/removed/nested/value"],
        ["added", "/added/nested/value"]
      ])
    );
    expect(result.structure.map((finding) => [finding.kind, finding.pointer])).toEqual(
      expect.arrayContaining([
        ["missing-in-b", "/removed/nested/value"],
        ["extra-in-b", "/added/nested/value"]
      ])
    );
  });
});
