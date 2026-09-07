export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type PathSegment = string | number;
export type ArrayMode = "ordered" | "unordered";
export type FindingKind = "added" | "removed" | "changed" | "type-changed";
export type StructureFindingKind =
  "missing-in-b" | "extra-in-b" | "inconsistent-in-a" | "a-empty-array";

export interface ComparisonOptions {
  arrayMode: ArrayMode;
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
   * For unordered arrays, the JSON Pointer of each Response A item that matched a Response B
   * item by exact canonical equality, mapped to that B item's own JSON Pointer. Absent for
   * items the engine did not match (those remain genuinely ambiguous — see Article II.3).
   */
  arrayMatches: Record<string, string>;
}

export interface ParsedDocument {
  value: JsonValue;
  formatted: string;
}
