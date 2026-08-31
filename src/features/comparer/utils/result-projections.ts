import { displayPath } from "@/domain/comparison/path";
import type { ComparisonResult, Finding, StructureFinding } from "@/domain/comparison/types";

export interface ComparisonResultFilters {
  path: string;
  showOnlyInA: boolean;
  showOnlyInB: boolean;
  showIgnored: boolean;
  showStructureOnlyInA: boolean;
  showStructureOnlyInB: boolean;
}

export interface ComparisonResultProjection {
  displayedFindings: Finding[];
  onlyInA: Finding[];
  onlyInB: Finding[];
  differences: Finding[];
  structureFindings: StructureFinding[];
  counts: ComparisonProjectionCounts;
}

export interface VisibleTotalCount {
  visible: number;
  total: number;
}

export interface ComparisonProjectionCounts {
  differences: VisibleTotalCount;
  missing: VisibleTotalCount;
  structure: VisibleTotalCount;
  onlyInA: VisibleTotalCount;
  onlyInB: VisibleTotalCount;
  modified: VisibleTotalCount;
  ignored: VisibleTotalCount;
}

export function formatComparisonOutcome(
  count: VisibleTotalCount,
  comparisonDurationMs: number
): string {
  return `${count.visible} of ${count.total} differences shown in ${Math.round(comparisonDurationMs)} ms.`;
}

function matchesPath(path: Array<string | number>, query: string): boolean {
  return !query || displayPath(path).toLowerCase().includes(query.trim().toLowerCase());
}

function matchesFindingSource(finding: Finding, filters: ComparisonResultFilters): boolean {
  if (finding.kind === "added") return filters.showOnlyInB;
  if (finding.kind === "removed") return filters.showOnlyInA;
  return true;
}

function matchesStructureSource(
  finding: StructureFinding,
  filters: ComparisonResultFilters
): boolean {
  if (finding.kind === "extra-in-b") return filters.showStructureOnlyInB;
  if (finding.kind === "missing-in-b") return filters.showStructureOnlyInA;
  return true;
}

export function projectComparisonResult(
  result: ComparisonResult,
  filters: ComparisonResultFilters
): ComparisonResultProjection {
  const displayedFindings = result.findings.filter(
    (finding) =>
      (filters.showIgnored || !finding.ignored) &&
      matchesPath(finding.path, filters.path) &&
      matchesFindingSource(finding, filters)
  );
  const onlyInA = displayedFindings.filter((finding) => finding.kind === "removed");
  const onlyInB = displayedFindings.filter((finding) => finding.kind === "added");
  const modified = displayedFindings.filter(
    (finding) => finding.kind === "changed" || finding.kind === "type-changed"
  );
  const structureFindings = result.structure.filter(
    (finding) =>
      (filters.showIgnored || !finding.ignored) &&
      matchesPath(finding.path, filters.path) &&
      matchesStructureSource(finding, filters)
  );
  const allOnlyInA = result.findings.filter((finding) => finding.kind === "removed");
  const allOnlyInB = result.findings.filter((finding) => finding.kind === "added");
  const allModified = result.findings.filter(
    (finding) => finding.kind === "changed" || finding.kind === "type-changed"
  );
  const allMissing = [...allOnlyInA, ...allOnlyInB];

  return {
    displayedFindings,
    onlyInA,
    onlyInB,
    differences: [...onlyInA, ...onlyInB, ...modified],
    structureFindings,
    counts: {
      differences: { visible: displayedFindings.length, total: result.findings.length },
      missing: { visible: onlyInA.length + onlyInB.length, total: allMissing.length },
      structure: { visible: structureFindings.length, total: result.structure.length },
      onlyInA: { visible: onlyInA.length, total: allOnlyInA.length },
      onlyInB: { visible: onlyInB.length, total: allOnlyInB.length },
      modified: { visible: modified.length, total: allModified.length },
      ignored: {
        visible: displayedFindings.filter((finding) => finding.ignored).length,
        total: result.findings.filter((finding) => finding.ignored).length
      }
    }
  };
}
