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

  it("uses ordered index comparison by default", () => {
    const result = compareJson([1, 2], [2, 1]);
    expect(result.counts.changed).toBe(2);
  });

  it("matches unordered arrays as multisets including duplicates", () => {
    expect(compareJson([1, 2, 1], [2, 1, 1], { arrayMode: "unordered" }).findings).toHaveLength(0);
    const result = compareJson([1, 1], [1], { arrayMode: "unordered" });
    expect(result.counts.removed).toBe(1);
  });

  it("flags a consistent, later-index occurrence as the surplus on either side", () => {
    const bSurplus = compareJson([1], [1, 1, 1], { arrayMode: "unordered" });
    expect(bSurplus.findings.every((finding) => finding.kind === "added")).toBe(true);
    expect(bSurplus.findings.map((finding) => finding.pointer).sort()).toEqual(["/1", "/2"]);

    const aSurplus = compareJson([1, 1, 1], [1], { arrayMode: "unordered" });
    expect(aSurplus.findings.every((finding) => finding.kind === "removed")).toBe(true);
    expect(aSurplus.findings.map((finding) => finding.pointer).sort()).toEqual(["/1", "/2"]);
  });

  it("canonicalizes object keys when matching unordered object arrays", () => {
    const result = compareJson([{ id: 1, name: "A" }], [{ name: "A", id: 1 }], {
      arrayMode: "unordered"
    });
    expect(result.findings).toHaveLength(0);
  });

  it("exposes matched item pointers for unordered arrays, even when reordered", () => {
    const result = compareJson(
      { items: [{ id: 1 }, { id: 2 }] },
      { items: [{ id: 2 }, { id: 1 }] },
      { arrayMode: "unordered" }
    );
    expect(result.arrayMatches).toEqual({
      "/items/0": "/items/1",
      "/items/1": "/items/0"
    });
  });

  it("omits unmatched items from arrayMatches", () => {
    const result = compareJson(
      { items: [{ id: 1 }, { id: 2 }] },
      { items: [{ id: 1 }, { id: 3 }] },
      { arrayMode: "unordered" }
    );
    expect(result.arrayMatches).toEqual({ "/items/0": "/items/0" });
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
      { arrayMode: "ordered", ignorePatterns: ["items.*.secret", "meta.**"] }
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
        ["extra-in-b", "/items/0/extra"]
      ])
    );
    // Candidate's own item 0 carries "name" too, so item 1 lacking it matches Baseline's own
    // item 1 lacking it — not a genuine Candidate schema gap.
    expect(result.structure.map((finding) => finding.kind)).not.toContain("missing-in-b");
  });

  it("names the concrete item indexes in an inconsistent-in-a detail message", () => {
    const result = compareJson(
      { items: [{ id: 1 }, { id: 2, extra: true }] },
      {
        items: [{ id: 1 }, { id: 2, extra: true }]
      }
    );
    expect(result.structure).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "inconsistent-in-a",
          pointer: "/items/1/extra",
          detail: "Baseline item 1 has a field Baseline item 0 does not have."
        })
      ])
    );
  });

  it("compares ordered array item schemas against every Baseline item, not just the first", () => {
    const result = compareJson(
      { items: [{ id: 1 }, { id: 2, extra: true }] },
      { items: [{ id: 1 }, { id: 2, extra: true }] },
      { arrayMode: "ordered" }
    );
    // "extra" exists on Baseline's own second item; a first-item-only baseline would wrongly
    // report it as extra-in-b just because item 0 doesn't carry it, even though A and B match.
    expect(result.structure.map((finding) => finding.kind)).not.toContain("extra-in-b");
    expect(result.structure).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "inconsistent-in-a", pointer: "/items/1/extra" })
      ])
    );
  });

  it("does not report missing-in-b for a field Candidate carries on a different item", () => {
    const result = compareJson(
      { items: [{ id: 1, phone: "A" }, { id: 2 }] },
      { items: [{ id: 1 }, { id: 2, phone: "B" }] },
      { arrayMode: "ordered" }
    );
    // "phone" exists on Candidate's own second item; comparing only against Baseline's item 0
    // per Candidate index would wrongly report it missing from Candidate's first item, even
    // though Candidate's schema clearly supports the field.
    expect(result.structure.map((finding) => finding.kind)).not.toContain("missing-in-b");
    expect(result.structure.map((finding) => finding.kind)).not.toContain("extra-in-b");
    expect(result.structure).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "inconsistent-in-a", pointer: "/items/1/phone" })
      ])
    );
  });

  it("compares unordered array item schemas as unions instead of a fragile single baseline", () => {
    const result = compareJson(
      { items: [{ id: 2 }, { id: 1, extra: true }] },
      { items: [{ id: 1, extra: true }, { id: 2 }] },
      { arrayMode: "unordered" }
    );
    // "extra" exists somewhere on both sides; a single-item baseline would wrongly report
    // it as extra-in-b just because it lands on a different item than Response A's first.
    expect(result.structure.map((finding) => finding.kind)).not.toContain("extra-in-b");
    expect(result.structure).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "inconsistent-in-a", pointer: "/items/1/extra" })
      ])
    );
  });

  it("still reports a field genuinely absent from every unordered B item", () => {
    const result = compareJson(
      { items: [{ id: 1, amount: 100 }] },
      { items: [{ id: 1 }] },
      { arrayMode: "unordered" }
    );
    expect(result.structure).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "missing-in-b", pointer: "/items/0/amount" })
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
      { data: { config: { countries: [{ code: "AE", phone: "+971" }] } } },
      { arrayMode: "ordered" }
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

describe("compareJson keyed arrays", () => {
  it("pairs reordered items by key and surfaces a one-field difference as a single change", () => {
    const result = compareJson(
      {
        users: [
          { id: 1, role: "admin" },
          { id: 2, role: "editor" }
        ]
      },
      {
        users: [
          { id: 2, role: "viewer" },
          { id: 1, role: "admin" }
        ]
      },
      { arrayMode: "keyed", keyFields: ["id"] }
    );
    expect(result.counts).toEqual({ added: 0, removed: 0, changed: 1, "type-changed": 0 });
    // Anchored at Response A's index for the id:2 item (A index 1), not B's position.
    expect(result.findings).toEqual([
      expect.objectContaining({
        kind: "changed",
        pointer: "/users/1/role",
        valueA: "editor",
        valueB: "viewer"
      })
    ]);
  });

  it("reports a key present on only one side as removed or added", () => {
    const result = compareJson(
      { users: [{ id: 1 }, { id: 2 }] },
      { users: [{ id: 2 }, { id: 3 }] },
      { arrayMode: "keyed", keyFields: ["id"] }
    );
    expect(result.findings).toHaveLength(2);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "removed", pointer: "/users/0", valueA: { id: 1 } }),
        expect.objectContaining({ kind: "added", pointer: "/users/1", valueB: { id: 3 } })
      ])
    );
  });

  it("exposes matched item pointers by key, even when reordered", () => {
    const result = compareJson(
      {
        items: [
          { id: 1, v: "a" },
          { id: 2, v: "b" }
        ]
      },
      {
        items: [
          { id: 2, v: "b" },
          { id: 1, v: "a" }
        ]
      },
      { arrayMode: "keyed", keyFields: ["id"] }
    );
    expect(result.findings).toHaveLength(0);
    expect(result.arrayMatches).toEqual({ "/items/0": "/items/1", "/items/1": "/items/0" });
  });

  it("uses the first usable candidate key in preference order", () => {
    const result = compareJson(
      { rows: [{ uuid: "x", n: 1 }] },
      { rows: [{ uuid: "x", n: 2 }] },
      { arrayMode: "keyed", keyFields: ["id", "uuid"] }
    );
    expect(result.counts.changed).toBe(1);
    expect(result.findings).toEqual([
      expect.objectContaining({ kind: "changed", pointer: "/rows/0/n" })
    ]);
  });

  it("recurses into nested keyed arrays", () => {
    const result = compareJson(
      { groups: [{ id: 1, members: [{ id: 10, role: "a" }] }] },
      { groups: [{ id: 1, members: [{ id: 10, role: "b" }] }] },
      { arrayMode: "keyed", keyFields: ["id"] }
    );
    expect(result.counts.changed).toBe(1);
    expect(result.findings).toEqual([
      expect.objectContaining({
        kind: "changed",
        pointer: "/groups/0/members/0/role",
        valueA: "a",
        valueB: "b"
      })
    ]);
  });

  it("produces identical findings regardless of Candidate item order", () => {
    const a = {
      users: [
        { id: 1, role: "admin" },
        { id: 2, role: "editor" },
        { id: 3, role: "x" }
      ]
    };
    const inOrder = compareJson(
      a,
      {
        users: [
          { id: 1, role: "admin" },
          { id: 2, role: "manager" },
          { id: 3, role: "x" }
        ]
      },
      { arrayMode: "keyed", keyFields: ["id"] }
    );
    const shuffled = compareJson(
      a,
      {
        users: [
          { id: 3, role: "x" },
          { id: 2, role: "manager" },
          { id: 1, role: "admin" }
        ]
      },
      { arrayMode: "keyed", keyFields: ["id"] }
    );
    const normalize = (findings: typeof inOrder.findings) =>
      findings.map((finding) => [finding.kind, finding.pointer]).sort();
    expect(normalize(inOrder.findings)).toEqual([["changed", "/users/1/role"]]);
    expect(normalize(shuffled.findings)).toEqual(normalize(inOrder.findings));
    expect(shuffled.counts).toEqual(inOrder.counts);
  });

  it("falls back to unordered matching when the key value is duplicated on a side", () => {
    const result = compareJson(
      {
        items: [
          { id: 1, v: "a" },
          { id: 1, v: "b" }
        ]
      },
      {
        items: [
          { id: 1, v: "a" },
          { id: 1, v: "c" }
        ]
      },
      { arrayMode: "keyed", keyFields: ["id"] }
    );
    // No field-level change: the ambiguous item is reported as a whole-object removed + added,
    // exactly as unordered mode would, and only the canonically-equal item matches.
    expect(result.counts).toMatchObject({ changed: 0, removed: 1, added: 1 });
    expect(result.arrayMatches).toEqual({ "/items/0": "/items/0" });
  });

  it("falls back to unordered matching when items are not objects", () => {
    const result = compareJson(
      { tags: ["a", "b"] },
      { tags: ["b", "c"] },
      { arrayMode: "keyed", keyFields: ["id"] }
    );
    expect(result.counts).toMatchObject({ changed: 0, removed: 1, added: 1 });
  });

  it("falls back to unordered matching when the key is missing on some items", () => {
    const result = compareJson(
      { items: [{ id: 1, v: 1 }, { v: 2 }] },
      { items: [{ id: 1, v: 9 }, { v: 2 }] },
      { arrayMode: "keyed", keyFields: ["id"] }
    );
    // A usable key requires the field on every item; the keyless second item forces fallback,
    // so the id:1 value difference shows as removed + added rather than a change.
    expect(result.counts).toMatchObject({ changed: 0, removed: 1, added: 1 });
  });

  it("falls back to unordered matching when the key value is not a primitive", () => {
    const result = compareJson(
      { items: [{ id: { n: 1 }, v: 1 }] },
      { items: [{ id: { n: 1 }, v: 2 }] },
      { arrayMode: "keyed", keyFields: ["id"] }
    );
    expect(result.counts).toMatchObject({ changed: 0, removed: 1, added: 1 });
  });
});
