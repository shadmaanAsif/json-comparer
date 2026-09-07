import { matchesIgnorePattern } from "@/domain/comparison/path";
import type { ArrayMode } from "@/domain/comparison/types";

export interface PanelField {
  pointer: string;
  segments: string[];
  parentPointer: string | null;
  line: number;
  endLine: number;
  valueStart: number;
  valueEnd: number;
  placeholder: boolean;
  containerKind?: "object" | "array";
  hasChildren?: boolean;
  withinArray: boolean;
}

export interface PanelIndex {
  byLine: Map<number, PanelField>;
  byPointer: Map<string, PanelField>;
}

/** Index only worker-validated, formatted display text. Never parse editable input here. */
export function buildPanelIndex(
  text: string,
  actual: Record<string, number>,
  placeholders: Record<string, number>
): PanelIndex {
  const byLine = new Map<number, PanelField>();
  const byPointer = new Map<string, PanelField>();
  const add = (pointer: string, line: number, placeholder: boolean) => {
    const field: PanelField = {
      pointer,
      segments: pointer
        ? pointer
            .slice(1)
            .split("/")
            .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
        : [],
      parentPointer: pointer ? pointer.slice(0, pointer.lastIndexOf("/")) : null,
      line,
      endLine: line,
      valueStart: 0,
      valueEnd: 0,
      placeholder,
      withinArray: false
    };
    byPointer.set(pointer, field);
    byLine.set(line, field);
  };
  Object.entries(placeholders).forEach(([pointer, line]) => add(pointer, line, true));
  Object.entries(actual).forEach(([pointer, line]) => add(pointer, line, false));

  const stack: PanelField[] = [];
  let offset = 0;
  text.split("\n").forEach((raw, index) => {
    const line = index + 1;
    const trimmed = raw.trim().replace(/,$/, "");
    const field = byLine.get(line);
    if (field && !field.placeholder) {
      const parent = stack.at(-1);
      if (parent) parent.hasChildren = true;
      const propertyPrefix = raw.match(/^\s*"(?:\\.|[^"])*"\s*:\s*/)?.[0];
      const prefixLength = propertyPrefix?.length ?? raw.length - raw.trimStart().length;
      const value = raw.slice(prefixLength).trimEnd().replace(/,$/, "");
      field.valueStart = offset + prefixLength;
      field.valueEnd = field.valueStart + value.length;
      field.withinArray = stack.some((parent) => parent.containerKind === "array");
      if (value.startsWith("{")) field.containerKind = "object";
      if (value.startsWith("[")) field.containerKind = "array";
      if (value === "{" || value === "[") stack.push(field);
    } else if (trimmed === "}" || trimmed === "]") {
      const parent = stack.pop();
      if (parent) {
        parent.endLine = line;
        parent.valueEnd = offset + raw.trimEnd().replace(/,$/, "").length;
        byLine.set(line, parent);
      }
    }
    offset += raw.length + 1;
  });
  return { byLine, byPointer };
}

/**
 * Resolve `pointer` through the engine's matched-item pointer map (own array-item pointer ->
 * corresponding other-side array-item pointer) by finding the longest matched-item ancestor
 * and substituting it. Returns undefined when `pointer` isn't nested under a matched item.
 */
function resolveMatchedPointer(
  pointer: string,
  matchedPointers: Record<string, string>
): string | undefined {
  let best: string | undefined;
  for (const key of Object.keys(matchedPointers)) {
    if (pointer !== key && !pointer.startsWith(`${key}/`)) continue;
    if (!best || key.length > best.length) best = key;
  }
  return best === undefined ? undefined : matchedPointers[best] + pointer.slice(best.length);
}

export function getCounterpart(
  field: PanelField,
  other: PanelIndex,
  own: PanelIndex,
  arrayMode: ArrayMode,
  matchedPointers: Record<string, string> = {}
): PanelField | undefined {
  const counterpart = other.byPointer.get(field.pointer);
  if (
    arrayMode === "unordered" &&
    (own.byPointer.get(field.pointer)?.withinArray || counterpart?.withinArray)
  ) {
    const matched = resolveMatchedPointer(field.pointer, matchedPointers);
    return matched === undefined ? undefined : other.byPointer.get(matched);
  }
  return counterpart;
}

export function getIgnoreAction(segments: string[], pointer: string, patterns: string[]) {
  const matching = patterns.filter((pattern) => matchesIgnorePattern(segments, pattern));
  const hasLiteralWildcard = segments.some((segment) => segment === "*" || segment === "**");
  if (matching.some((pattern) => pattern !== pointer) || (matching.length && hasLiteralWildcard))
    return { kind: "manage" as const, matching };
  if (matching.length) return { kind: "restore" as const, matching };
  if (!pointer || hasLiteralWildcard || pointer.trim() !== pointer)
    return { kind: "unsupported" as const, matching };
  return { kind: "ignore" as const, matching };
}
