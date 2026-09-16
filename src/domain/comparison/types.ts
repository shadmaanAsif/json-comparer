export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type PathSegment = string | number;
export type ArrayMode = "ordered" | "unordered" | "keyed";
export type FindingKind = "added" | "removed" | "changed" | "type-changed";
export type StructureFindingKind =
  "missing-in-b" | "extra-in-b" | "inconsistent-in-a" | "a-empty-array";

export interface ComparisonOptions {
  arrayMode: ArrayMode;
  /**
   * Candidate key field names, in preference order, consulted only when arrayMode is "keyed".
   * For each array of objects, the first candidate present with a primitive value on every
   * item and unique within each side is used to pair items. Arrays that cannot be keyed
   * unambiguously fall back to "unordered" matching.
   */
  keyFields: string[];
  ignorePatterns: string[];
  maxDepth: number;
  maxFindings: number;
}

export interface Finding {
  id: string;
  kind: FindingKind;
  path: PathSegment[];
  pointer: string;
  valueA?: JsonValue;
  valueB?: JsonValue;
  ignored: boolean;
}

export interface StructureFinding {
  id: string;
  kind: StructureFindingKind;
  path: PathSegment[];
  pointer: string;
  detail: string;
  ignored: boolean;
}

export interface ComparisonResult {
  findings: Finding[];
  counts: Record<FindingKind, number>;
  ignoredCount: number;
  structure: StructureFinding[];
  truncated: boolean;
  /**
   * The JSON Pointer of each Response A array item that matched a Response B item, mapped to
   * that B item's own JSON Pointer. In "unordered" mode items match by exact canonical
   * equality; in "keyed" mode they match by their key field value. Absent for items the engine
   * did not match (those remain genuinely ambiguous — see Article II.3).
   */
  arrayMatches: Record<string, string>;
}

export interface ParsedDocument {
  value: JsonValue;
  formatted: string;
}
