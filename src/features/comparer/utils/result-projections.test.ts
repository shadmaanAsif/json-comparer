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
  truncated: false
};

const filters: ComparisonResultFilters = {
  path: "",
  showOnlyInA: true,
  showOnlyInB: true,
  showIgnored: false,
  showStructureOnlyInA: true,
  showStructureOnlyInB: true
};

describe("projectComparisonResult", () => {
  it("computes every visible-versus-total count from the filtered section findings", () => {
    const projection = projectComparisonResult(result, filters);

    expect(projection.counts).toEqual({
      differences: { visible: 3, total: 4 },
      missing: { visible: 2, total: 2 },
      structure: { visible: 3, total: 4 },
      onlyInA: { visible: 1, total: 1 },
      onlyInB: { visible: 1, total: 1 },
      modified: { visible: 1, total: 2 },
      ignored: { visible: 0, total: 1 }
    });
    expect(projection.differences).toHaveLength(3);
  });

  it("filters structure findings by either source or both while preserving internal A issues", () => {
    const onlyInB = projectComparisonResult(result, {
      ...filters,
      showStructureOnlyInA: false
    });
    expect(onlyInB.structureFindings.map((item) => item.kind)).toEqual([
      "extra-in-b",
      "inconsistent-in-a"
    ]);

    const onlyInA = projectComparisonResult(result, {
      ...filters,
      showStructureOnlyInB: false
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
    expect(withIgnored.counts.differences).toEqual({ visible: 4, total: 4 });
    expect(withIgnored.counts.structure).toEqual({ visible: 4, total: 4 });
    expect(withIgnored.counts.ignored).toEqual({ visible: 1, total: 1 });

    const withoutIgnored = projectComparisonResult(result, filters);
    expect(withoutIgnored.displayedFindings.every((item) => !item.ignored)).toBe(true);
    expect(withoutIgnored.structureFindings.every((item) => !item.ignored)).toBe(true);
  });

  it("updates zero, partial, and fully visible counts for combined source and path filters", () => {
    const partial = projectComparisonResult(result, {
      ...filters,
      showOnlyInA: false,
      showStructureOnlyInB: false
    });
    expect(partial.counts.differences).toEqual({ visible: 2, total: 4 });
    expect(partial.counts.missing).toEqual({ visible: 1, total: 2 });
    expect(partial.counts.structure).toEqual({ visible: 2, total: 4 });

    const zero = projectComparisonResult(result, {
      ...filters,
      path: "does-not-exist"
    });
    expect(zero.counts.differences).toEqual({ visible: 0, total: 4 });
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
