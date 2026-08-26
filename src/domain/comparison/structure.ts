import { isIgnored, toJsonPointer } from "./path";
import type { JsonValue, PathSegment, StructureFinding, StructureFindingKind } from "./types";

type StructureJob = {
  valueA: JsonValue;
  valueB: JsonValue;
  path: PathSegment[];
  depth: number;
};

type AddStructureFinding = (
  kind: StructureFindingKind,
  path: PathSegment[],
  detail: string
) => void;

function isJsonObject(value: JsonValue): value is Record<string, JsonValue> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function compareStructure(
  valueA: JsonValue,
  valueB: JsonValue,
  ignorePatterns: string[] = [],
  maxDepth = 256,
  maxFindings = 100_000
): StructureFinding[] {
  const findings: StructureFinding[] = [];
  const addFinding: AddStructureFinding = (kind, path, detail) => {
    if (findings.length >= maxFindings) return;
    const pointer = toJsonPointer(path);
    findings.push({
      id: `structure:${kind}:${pointer}`,
      kind,
      path: [...path],
      pointer,
      detail,
      ignored: isIgnored(path, ignorePatterns)
    });
  };
  const jobs: StructureJob[] = [{ valueA, valueB, path: [], depth: 0 }];

  while (jobs.length && findings.length < maxFindings) {
    const job = jobs.pop()!;
    if (job.depth > maxDepth) {
      throw new Error(
        `Maximum JSON depth of ${maxDepth} exceeded at ${toJsonPointer(job.path) || "/"}`
      );
    }
    if (Array.isArray(job.valueA) && Array.isArray(job.valueB)) {
      if (!job.valueA.length && job.valueB.length) {
        addFinding(
          "a-empty-array",
          job.path,
          "Response A has no first item to use as the schema baseline."
        );
      }
      const baseline = job.valueA[0];
      if (baseline !== undefined) {
        for (let index = 1; index < job.valueA.length; index += 1) {
          compareObjectKeys(
            baseline,
            job.valueA[index]!,
            [...job.path, index],
            "inconsistent-in-a",
            addFinding,
            jobs,
            job.depth
          );
        }
        for (let index = 0; index < job.valueB.length; index += 1) {
          compareObjectKeys(
            baseline,
            job.valueB[index]!,
            [...job.path, index],
            "missing-in-b",
            addFinding,
            jobs,
            job.depth,
            true
          );
        }
      }
      continue;
    }
    compareObjectKeys(
      job.valueA,
      job.valueB,
      job.path,
      "missing-in-b",
      addFinding,
      jobs,
      job.depth,
      true
    );
  }
  return findings;
}

function addStructureLeaves(
  value: JsonValue,
  path: PathSegment[],
  kind: StructureFindingKind,
  detail: string,
  addFinding: AddStructureFinding
) {
  const pending: Array<{ value: JsonValue; path: PathSegment[] }> = [{ value, path }];
  while (pending.length) {
    const current = pending.pop()!;
    const record = isJsonObject(current.value) ? current.value : null;
    const children: Array<{ value: JsonValue; segment: PathSegment }> = Array.isArray(current.value)
      ? current.value.map((child, index) => ({ value: child, segment: index }))
      : record
        ? Object.keys(record)
            .sort()
            .map((key) => ({ value: record[key]!, segment: key }))
        : [];
    if (!children.length) {
      addFinding(kind, current.path, detail);
      continue;
    }
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index]!;
      pending.push({ value: child.value, path: [...current.path, child.segment] });
    }
  }
}

function compareObjectKeys(
  valueA: JsonValue,
  valueB: JsonValue,
  path: PathSegment[],
  missingKind: "missing-in-b" | "inconsistent-in-a",
  addFinding: AddStructureFinding,
  jobs: StructureJob[],
  depth: number,
  reportExtras = false
) {
  if (!isJsonObject(valueA) || !isJsonObject(valueB)) return;
  const keysA = new Set(Object.keys(valueA));
  const keysB = new Set(Object.keys(valueB));
  for (const key of keysA) {
    if (!keysB.has(key)) {
      const detail =
        missingKind === "inconsistent-in-a"
          ? "This Response A item differs from the first A item."
          : "Field exists in the Response A schema baseline but is missing here.";
      addStructureLeaves(valueA[key]!, [...path, key], missingKind, detail, addFinding);
    }
  }
  if (reportExtras || missingKind === "inconsistent-in-a") {
    for (const key of keysB) {
      if (!keysA.has(key)) {
        const kind = missingKind === "inconsistent-in-a" ? missingKind : "extra-in-b";
        const detail =
          missingKind === "inconsistent-in-a"
            ? "This Response A item differs from the first A item."
            : "Field is extra relative to the Response A schema baseline.";
        addStructureLeaves(valueB[key]!, [...path, key], kind, detail, addFinding);
      }
    }
  }
  for (const key of keysA) {
    if (keysB.has(key)) {
      jobs.push({
        valueA: valueA[key]!,
        valueB: valueB[key]!,
        path: [...path, key],
        depth: depth + 1
      });
    }
  }
}
