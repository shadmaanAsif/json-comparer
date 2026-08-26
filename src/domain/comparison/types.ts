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
}

export interface ParsedDocument {
  value: JsonValue;
  formatted: string;
}
