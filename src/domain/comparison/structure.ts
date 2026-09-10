import { isIgnored, toJsonPointer } from "./path";
import type {
  ArrayMode,
  JsonValue,
  PathSegment,
  StructureFinding,
  StructureFindingKind
} from "./types";

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
  arrayMode: ArrayMode = "ordered",
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
          "Baseline has no first item to use as the schema reference."
        );
      }
      if (arrayMode === "unordered") {
        if (job.valueA.length) {
          compareArrayItemUnion(job.valueA, job.valueB, job.path, addFinding);
        }
        continue;
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
        // A key carried by any Baseline item — not just item 0, used below as the
        // structural reference for recursion — is still part of Baseline's own schema and
        // must never be reported as extra-in-b just because item 0 doesn't happen to carry it.
        // Symmetrically, a key carried by any Candidate item is part of Candidate's schema too,
        // so one particular Candidate item lacking it isn't "missing" relative to Baseline —
        // only a key absent from every Candidate item is.
        const baselineKeys = collectUnionKeys(job.valueA);
        const candidateKeys = collectUnionKeys(job.valueB);
        for (let index = 0; index < job.valueB.length; index += 1) {
          compareObjectKeys(
            baseline,
            job.valueB[index]!,
            [...job.path, index],
            "missing-in-b",
            addFinding,
            jobs,
            job.depth,
            true,
            baselineKeys,
            candidateKeys
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
  reportExtras = false,
  /** Keys already known to exist somewhere in Baseline's own items; never "extra" in B. */
  extraExclusions?: ReadonlyMap<string, number>,
  /** Keys already known to exist somewhere in Candidate's own items; never "missing" in B. */
  missingExclusions?: ReadonlyMap<string, number>
) {
  if (!isJsonObject(valueA) || !isJsonObject(valueB)) return;
  const keysA = new Set(Object.keys(valueA));
  const keysB = new Set(Object.keys(valueB));
  // Only the direct per-array-item comparison uses "inconsistent-in-a" (never the recursive
  // jobs queue, which always re-enters as "missing-in-b"), so path's last segment is reliably
  // this item's own array index whenever this branch applies.
  const itemIndex = missingKind === "inconsistent-in-a" ? path.at(-1) : undefined;
  for (const key of keysA) {
    if (!keysB.has(key)) {
      if (missingKind === "missing-in-b" && missingExclusions?.has(key)) continue;
      const detail =
        missingKind === "inconsistent-in-a"
          ? `Baseline item ${itemIndex} is missing a field Baseline item 0 has.`
          : "Field is only in Baseline relative to the Candidate schema.";
      addStructureLeaves(valueA[key]!, [...path, key], missingKind, detail, addFinding);
    }
  }
  if (reportExtras || missingKind === "inconsistent-in-a") {
    for (const key of keysB) {
      if (!keysA.has(key)) {
        if (extraExclusions?.has(key)) continue;
        const kind = missingKind === "inconsistent-in-a" ? missingKind : "extra-in-b";
        const detail =
          missingKind === "inconsistent-in-a"
            ? `Baseline item ${itemIndex} has a field Baseline item 0 does not have.`
            : "Field is only in Candidate relative to the Baseline schema.";
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

// Unordered arrays have no meaningful per-index correspondence between A and B (Article
// II.3: matching must not invent pairing between items). Schema shape is instead inferred
// as the union of keys observed anywhere in each side's items, so findings never depend on
// item order. Each key is anchored at the first item observed to carry it, purely as an
// illustrative example location — not a claim that item corresponds to anything on the
// other side. Nested structure under a shared key is not recursed into for unordered
// arrays: picking one representative item per key would itself be an arbitrary choice.
function collectUnionKeys(items: JsonValue[]): Map<string, number> {
  const firstIndexByKey = new Map<string, number>();
  items.forEach((item, index) => {
    if (!isJsonObject(item)) return;
    for (const key of Object.keys(item)) {
      if (!firstIndexByKey.has(key)) firstIndexByKey.set(key, index);
    }
  });
  return firstIndexByKey;
}

function compareArrayItemUnion(
  itemsA: JsonValue[],
  itemsB: JsonValue[],
  path: PathSegment[],
  addFinding: AddStructureFinding
) {
  const unionA = collectUnionKeys(itemsA);
  const unionB = collectUnionKeys(itemsB);

  for (const [key, index] of unionA) {
    const presentOnEveryItem = itemsA.every((item) => isJsonObject(item) && key in item);
    if (!presentOnEveryItem) {
      addFinding(
        "inconsistent-in-a",
        [...path, index, key],
        "This field is not present on every Baseline item."
      );
    }
  }
  for (const [key, index] of unionA) {
    if (!unionB.has(key)) {
      addFinding(
        "missing-in-b",
        [...path, index, key],
        "Field is only in Baseline relative to the Candidate schema."
      );
    }
  }
  for (const [key, index] of unionB) {
    if (!unionA.has(key)) {
      addFinding(
        "extra-in-b",
        [...path, index, key],
        "Field is only in Candidate relative to the Baseline schema."
      );
    }
  }
}
