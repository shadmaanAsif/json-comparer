import { isIgnored, toJsonPointer } from "./path";
import { compareStructure } from "./structure";
import type {
  ComparisonOptions,
  ComparisonResult,
  Finding,
  FindingKind,
  JsonValue,
  PathSegment
} from "./types";

const defaultOptions: ComparisonOptions = {
  arrayMode: "ordered",
  keyFields: [],
  ignorePatterns: [],
  maxDepth: 256,
  maxFindings: 100_000
};

function valueType(value: JsonValue | undefined): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function canonical(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key]!)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isJsonObject(value: JsonValue): value is Record<string, JsonValue> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPrimitiveValue(value: JsonValue): boolean {
  return value === null || typeof value !== "object";
}

// A key field is usable for keyed matching on one side only when every item is an object that
// carries the field with a primitive value, and those values are unique within the side. Any
// other shape (non-object item, missing key, object/array key value, duplicate value, or no
// items at all) makes the key unusable, and keyed matching then falls back to unordered.
function isUsableKeyField(items: JsonValue[], field: string): boolean {
  if (!items.length) return false;
  const seen = new Set<string>();
  for (const item of items) {
    if (!isJsonObject(item) || !(field in item)) return false;
    const value = item[field]!;
    if (!isPrimitiveValue(value)) return false;
    const canon = canonical(value);
    if (seen.has(canon)) return false;
    seen.add(canon);
  }
  return true;
}

function selectKeyField(
  itemsA: JsonValue[],
  itemsB: JsonValue[],
  candidates: string[]
): string | undefined {
  return candidates.find(
    (field) => isUsableKeyField(itemsA, field) && isUsableKeyField(itemsB, field)
  );
}

export function compareJson(
  valueA: JsonValue,
  valueB: JsonValue,
  partial: Partial<ComparisonOptions> = {}
): ComparisonResult {
  const options = { ...defaultOptions, ...partial };
  const findings: Finding[] = [];
  const arrayMatches: Record<string, string> = {};
  let truncated = false;

  const add = (kind: FindingKind, path: PathSegment[], a?: JsonValue, b?: JsonValue) => {
    if (findings.length >= options.maxFindings) {
      truncated = true;
      return;
    }
    const pointer = toJsonPointer(path);
    findings.push({
      id: `${kind}:${pointer}`,
      kind,
      path: [...path],
      pointer,
      ...(a !== undefined ? { valueA: a } : {}),
      ...(b !== undefined ? { valueB: b } : {}),
      ignored: isIgnored(path, options.ignorePatterns)
    });
  };

  type Job = {
    a: JsonValue | undefined;
    b: JsonValue | undefined;
    path: PathSegment[];
    depth: number;
  };
  const jobs: Job[] = [{ a: valueA, b: valueB, path: [], depth: 0 }];

  const queuePresenceLeaves = (
    value: JsonValue,
    path: PathSegment[],
    depth: number,
    side: "a" | "b"
  ) => {
    const children: Array<{ value: JsonValue; segment: PathSegment }> = Array.isArray(value)
      ? value.map((child, index) => ({ value: child, segment: index }))
      : isJsonObject(value)
        ? Object.keys(value)
            .sort()
            .map((key) => ({ value: value[key]!, segment: key }))
        : [];
    if (!children.length) return false;
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index]!;
      jobs.push({
        a: side === "a" ? child.value : undefined,
        b: side === "b" ? child.value : undefined,
        path: [...path, child.segment],
        depth: depth + 1
      });
    }
    return true;
  };

  // Unordered multiset matching by exact canonical equality. Matched items are canonically
  // equal, so they need no further diff; only the A→B pointer pairing is recorded.
  const matchUnordered = (itemsA: JsonValue[], itemsB: JsonValue[], basePath: PathSegment[]) => {
    const buckets = new Map<string, Array<{ value: JsonValue; index: number }>>();
    itemsB.forEach((value, index) => {
      const key = canonical(value);
      buckets.set(key, [...(buckets.get(key) ?? []), { value, index }]);
    });
    itemsA.forEach((value, index) => {
      const key = canonical(value);
      const matches = buckets.get(key);
      const consumed = matches?.length ? matches.shift() : undefined;
      if (consumed) {
        arrayMatches[toJsonPointer([...basePath, index])] = toJsonPointer([
          ...basePath,
          consumed.index
        ]);
      } else {
        add("removed", [...basePath, index], value);
      }
    });
    for (const matches of buckets.values()) {
      for (const match of matches) add("added", [...basePath, match.index], undefined, match.value);
    }
  };

  // Keyed matching pairs items by their key field value, then diffs each pair through the
  // normal engine (so a one-field difference surfaces as a field-level `changed`, not a
  // whole-object removed+added). Uniqueness is guaranteed by selectKeyField, so each key
  // value maps to at most one item per side.
  const matchKeyed = (
    itemsA: JsonValue[],
    itemsB: JsonValue[],
    basePath: PathSegment[],
    depth: number,
    field: string
  ) => {
    const bByKey = new Map<string, { item: JsonValue; index: number }>();
    itemsB.forEach((item, index) => {
      bByKey.set(canonical((item as Record<string, JsonValue>)[field]!), { item, index });
    });
    const matchedB = new Set<number>();
    itemsA.forEach((item, index) => {
      const key = canonical((item as Record<string, JsonValue>)[field]!);
      const match = bByKey.get(key);
      if (match) {
        matchedB.add(match.index);
        arrayMatches[toJsonPointer([...basePath, index])] = toJsonPointer([
          ...basePath,
          match.index
        ]);
        jobs.push({ a: item, b: match.item, path: [...basePath, index], depth: depth + 1 });
      } else {
        add("removed", [...basePath, index], item);
      }
    });
    itemsB.forEach((item, index) => {
      if (!matchedB.has(index)) add("added", [...basePath, index], undefined, item);
    });
  };

  while (jobs.length > 0 && !truncated) {
    const job = jobs.pop()!;
    if (job.depth > options.maxDepth)
      throw new Error(
        `Maximum JSON depth of ${options.maxDepth} exceeded at ${toJsonPointer(job.path) || "/"}`
      );
    if (job.a === undefined) {
      if (!queuePresenceLeaves(job.b!, job.path, job.depth, "b"))
        add("added", job.path, undefined, job.b);
      continue;
    }
    if (job.b === undefined) {
      if (!queuePresenceLeaves(job.a, job.path, job.depth, "a")) add("removed", job.path, job.a);
      continue;
    }

    const typeA = valueType(job.a);
    const typeB = valueType(job.b);
    if (typeA !== typeB) {
      add("type-changed", job.path, job.a, job.b);
      continue;
    }

    if (Array.isArray(job.a) && Array.isArray(job.b)) {
      if (options.arrayMode === "keyed") {
        const field = selectKeyField(job.a, job.b, options.keyFields);
        if (field !== undefined) {
          matchKeyed(job.a, job.b, job.path, job.depth, field);
        } else {
          matchUnordered(job.a, job.b, job.path);
        }
      } else if (options.arrayMode === "unordered") {
        matchUnordered(job.a, job.b, job.path);
      } else {
        const length = Math.max(job.a.length, job.b.length);
        for (let index = length - 1; index >= 0; index -= 1) {
          jobs.push({
            a: job.a[index],
            b: job.b[index],
            path: [...job.path, index],
            depth: job.depth + 1
          });
        }
      }
      continue;
    }

    if (
      job.a !== null &&
      job.b !== null &&
      typeof job.a === "object" &&
      typeof job.b === "object"
    ) {
      const objectA = job.a as Record<string, JsonValue>;
      const objectB = job.b as Record<string, JsonValue>;
      const keys = [...new Set([...Object.keys(objectA), ...Object.keys(objectB)])]
        .sort()
        .reverse();
      for (const key of keys) {
        jobs.push({
          a: objectA[key],
          b: objectB[key],
          path: [...job.path, key],
          depth: job.depth + 1
        });
      }
      continue;
    }

    if (!Object.is(job.a, job.b)) add("changed", job.path, job.a, job.b);
  }

  const counts: ComparisonResult["counts"] = {
    added: 0,
    removed: 0,
    changed: 0,
    "type-changed": 0
  };
  let ignoredCount = 0;
  for (const finding of findings) {
    if (finding.ignored) ignoredCount += 1;
    else counts[finding.kind] += 1;
  }
  const structure = compareStructure(
    valueA,
    valueB,
    options.arrayMode,
    options.ignorePatterns,
    options.maxDepth,
    options.maxFindings
  );
  return {
    findings,
    counts,
    ignoredCount,
    structure,
    arrayMatches,
    truncated: truncated || structure.length >= options.maxFindings
  };
}

export { compareStructure } from "./structure";
