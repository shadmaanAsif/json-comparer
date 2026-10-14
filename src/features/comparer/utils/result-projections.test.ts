import { describe, expect, it } from "vitest";
import type { ComparisonResult, Finding, StructureFinding } from "@/domain/comparison/types";
import { projectComparisonResult, type ComparisonResultFilters } from "./result-projections";

const finding = (kind: Finding["kind"], path: string, ignored = false): Finding => ({
  id: `${kind}:/${path}`,
  kind,
  path: [path],
  pointer: `/${path}`,
  ignored
});

const structureFinding = (
  kind: StructureFinding["kind"],
  path: string,
  ignored = false
): StructureFinding => ({
  id: `structure:${kind}:/${path}`,
  kind,
  path: [path],
  pointer: `/${path}`,
  detail: kind,
  ignored
});

const result: ComparisonResult = {
  findings: [
    finding("added", "candidateOnly"),
    finding("removed", "baselineOnly"),
    finding("changed", "changed"),
    finding("type-changed", "ignored", true)
  ],
  counts: { added: 1, removed: 1, changed: 1, "type-changed": 1 },
  ignoredCount: 1,
  structure: [
    structureFinding("extra-in-b", "candidateShape"),
    structureFinding("missing-in-b", "baselineShape"),
    structureFinding("inconsistent-in-a", "internalShape"),
    structureFinding("extra-in-b", "ignoredShape", true)
  ],
  arrayMatches: {},
  truncated: false
};

const filters: ComparisonResultFilters = {
  path: "",
  showOnlyInA: true,
  showOnlyInB: true,
  showIgnored: false
};

describe("projectComparisonResult", () => {
  it("uses canonical pointer boundaries and case for panel path filters", () => {
    const nested: Finding = {
      ...finding("changed", "a"),
      path: ["a", "child"],
      pointer: "/a/child"
    };
    const scoped = {
      ...result,
      findings: [
        finding("changed", "a"),
        nested,
        finding("changed", "ab"),
        finding("changed", "A"),
        { ...finding("changed", "a/b"), pointer: "/a~1b" }
      ]
    };
    expect(
      projectComparisonResult(scoped, { ...filters, path: "/a" }).differences.map(
        (item) => item.pointer
      )
    ).toEqual(["/a", "/a/child"]);
    expect(projectComparisonResult(scoped, { ...filters, path: "/a~1b" }).differences).toHaveLength(
      1
    );
    expect(projectComparisonResult(scoped, { ...filters, path: "a" }).differences).toHaveLength(5);
  });

  it("computes every visible-versus-total count from the filtered section findings", () => {
    const projection = projectComparisonResult(result, filters);

    expect(projection.counts).toEqual({
      // Value findings plus the schema findings that are not already a missing-field row.
      differences: { visible: 6, total: 8 },
      missing: { visible: 2, total: 2 },
      structure: { visible: 3, total: 4 },
      onlyInA: { visible: 1, total: 1 },
      onlyInB: { visible: 1, total: 1 },
      modified: { visible: 1, total: 2 },
      ignored: { visible: 0, total: 2 }
    });
    expect(projection.differences).toHaveLength(3);
    expect(projection.schemaDifferences).toHaveLength(3);
  });

  it("lists schema findings in Differences, except twins of a missing-field row at the same path", () => {
    const withTwins: ComparisonResult = {
      ...result,
      findings: [finding("removed", "gone"), finding("added", "fresh"), finding("changed", "price")],
      structure: [
        structureFinding("missing-in-b", "gone"),
        structureFinding("extra-in-b", "fresh"),
        // Same pointer, opposite direction: a different fact, so it is kept.
        structureFinding("extra-in-b", "gone"),
        structureFinding("inconsistent-in-a", "shape"),
        structureFinding("a-empty-array", "list")
      ]
    };
    const projection = projectComparisonResult(withTwins, filters);

    expect(projection.schemaDifferences.map((item) => item.id)).toEqual([
      "structure:extra-in-b:/gone",
      "structure:inconsistent-in-a:/shape",
      "structure:a-empty-array:/list"
    ]);
    // The Structure section itself still lists every schema finding.
    expect(projection.structureFindings).toHaveLength(5);
    // 3 value rows (removed, added, changed) + 3 schema rows; each one-sided field counts once.
    expect(projection.counts.differences).toEqual({ visible: 6, total: 6 });
  });

  it("filters structure findings by the same only-in-A/B source filter as other findings", () => {
    const onlyInB = projectComparisonResult(result, {
      ...filters,
      showOnlyInA: false
    });
    expect(onlyInB.structureFindings.map((item) => item.kind)).toEqual([
      "extra-in-b",
      "inconsistent-in-a"
    ]);

    const onlyInA = projectComparisonResult(result, {
      ...filters,
      showOnlyInB: false
    });
    expect(onlyInA.structureFindings.map((item) => item.kind)).toEqual([
      "missing-in-b",
      "inconsistent-in-a"
    ]);

    const both = projectComparisonResult(result, filters);
    expect(both.structureFindings).toHaveLength(3);
  });

  it("includes ignored findings in every section only while Show ignored is enabled", () => {
    const withIgnored = projectComparisonResult(result, {
      ...filters,
      showIgnored: true
    });

    expect(withIgnored.displayedFindings).toHaveLength(4);
    expect(withIgnored.structureFindings).toHaveLength(4);
    expect(withIgnored.counts.differences).toEqual({ visible: 8, total: 8 });
    expect(withIgnored.counts.structure).toEqual({ visible: 4, total: 4 });
    expect(withIgnored.counts.ignored).toEqual({ visible: 2, total: 2 });

    const withoutIgnored = projectComparisonResult(result, filters);
    expect(withoutIgnored.displayedFindings.every((item) => !item.ignored)).toBe(true);
    expect(withoutIgnored.structureFindings.every((item) => !item.ignored)).toBe(true);
    expect(withoutIgnored.schemaDifferences.every((item) => !item.ignored)).toBe(true);
  });

  it("updates zero, partial, and fully visible counts for combined source and path filters", () => {
    const partial = projectComparisonResult(result, {
      ...filters,
      showOnlyInA: false
    });
    expect(partial.counts.differences).toEqual({ visible: 4, total: 8 });
    expect(partial.counts.missing).toEqual({ visible: 1, total: 2 });
    expect(partial.counts.structure).toEqual({ visible: 2, total: 4 });

    const zero = projectComparisonResult(result, {
      ...filters,
      path: "does-not-exist"
    });
    expect(zero.counts.differences).toEqual({ visible: 0, total: 8 });
    expect(zero.counts.missing).toEqual({ visible: 0, total: 2 });
    expect(zero.counts.structure).toEqual({ visible: 0, total: 4 });

    const all = projectComparisonResult(result, {
      ...filters,
      showIgnored: true
    });
    expect(all.counts.differences.visible).toBe(all.counts.differences.total);
    expect(all.counts.structure.visible).toBe(all.counts.structure.total);
  });
});
