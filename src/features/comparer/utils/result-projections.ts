import { displayPath, toJsonPointer } from "@/domain/comparison/path";
import type { ComparisonResult, Finding, StructureFinding } from "@/domain/comparison/types";
import type { ResultSectionKey } from "../types";

export interface ComparisonResultFilters {
  path: string;
  showOnlyInA: boolean;
  showOnlyInB: boolean;
  showIgnored: boolean;
}

export interface ComparisonResultProjection {
  displayedFindings: Finding[];
  onlyInA: Finding[];
  onlyInB: Finding[];
  differences: Finding[];
  structureFindings: StructureFinding[];
  /** Schema findings the Differences section lists after the value rows — every one that is not
   *  already shown there as a missing-field row. */
  schemaDifferences: StructureFinding[];
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

/** The findings one result disclosure currently displays, in row order. */
export function selectSectionFindings(
  section: ResultSectionKey,
  projection: ComparisonResultProjection
): (Finding | StructureFinding)[] {
  if (section === "structure") return projection.structureFindings;
  if (section === "missing") return [...projection.onlyInA, ...projection.onlyInB];
  return [...projection.differences, ...projection.schemaDifferences];
}

export function formatComparisonOutcome(
  count: VisibleTotalCount,
  ignored: VisibleTotalCount,
  comparisonDurationMs: number
): string {
  const ignoredClause = ignored.visible > 0 ? ` (${ignored.visible} ignored)` : "";
  return `Showing ${count.visible} of ${count.total} differences${ignoredClause} in ${Math.round(comparisonDurationMs)} ms.`;
}

function matchesPath(path: Array<string | number>, query: string): boolean {
  if (query.startsWith("/")) {
    const pointer = toJsonPointer(path);
    return pointer === query || pointer.startsWith(query + "/");
  }
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
  if (finding.kind === "extra-in-b") return filters.showOnlyInB;
  if (finding.kind === "missing-in-b") return filters.showOnlyInA;
  return true;
}

/**
 * Schema findings that add something to the Differences list. A baseline-only or candidate-only
 * field is already a removed/added value row at the same pointer, so its schema twin is dropped
 * there instead of being listed twice.
 */
function schemaFindingsBeyondMissing(
  structure: StructureFinding[],
  findings: Finding[]
): StructureFinding[] {
  const removed = new Set<string>();
  const added = new Set<string>();
  for (const finding of findings) {
    if (finding.kind === "removed") removed.add(finding.pointer);
    else if (finding.kind === "added") added.add(finding.pointer);
  }
  return structure.filter((finding) => {
    if (finding.kind === "missing-in-b") return !removed.has(finding.pointer);
    if (finding.kind === "extra-in-b") return !added.has(finding.pointer);
    return true;
  });
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
  const schemaDifferences = schemaFindingsBeyondMissing(structureFindings, result.findings);
  const allSchemaDifferences = schemaFindingsBeyondMissing(result.structure, result.findings);

  return {
    displayedFindings,
    onlyInA,
    onlyInB,
    differences: [...onlyInA, ...onlyInB, ...modified],
    structureFindings,
    schemaDifferences,
    counts: {
      differences: {
        visible: displayedFindings.length + schemaDifferences.length,
        total: result.findings.length + allSchemaDifferences.length
      },
      missing: { visible: onlyInA.length + onlyInB.length, total: allMissing.length },
      structure: { visible: structureFindings.length, total: result.structure.length },
      onlyInA: { visible: onlyInA.length, total: allOnlyInA.length },
      onlyInB: { visible: onlyInB.length, total: allOnlyInB.length },
      modified: { visible: modified.length, total: allModified.length },
      ignored: {
        visible:
          displayedFindings.filter((finding) => finding.ignored).length +
          schemaDifferences.filter((finding) => finding.ignored).length,
        total:
          result.findings.filter((finding) => finding.ignored).length +
          allSchemaDifferences.filter((finding) => finding.ignored).length
      }
    }
  };
}
