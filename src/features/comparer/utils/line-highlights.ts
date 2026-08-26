import { formatAlignedForDisplay } from "@/domain/comparison/display-format";
import { buildLineMap, nearestMappedLine } from "@/domain/comparison/line-map";
import type { ComparisonResult, JsonValue } from "@/domain/comparison/types";
import type { HighlightCategory } from "../types";

export interface HighlightToggles {
  missing: boolean;
  structure: boolean;
  differences: boolean;
}

export interface LineHighlights {
  a: Record<number, HighlightCategory>;
  b: Record<number, HighlightCategory>;
}

interface DisplayLineMaps {
  lineMapA: Record<string, number>;
  lineMapB: Record<string, number>;
  placeholderLineMapA: Record<string, number>;
  placeholderLineMapB: Record<string, number>;
}

function displayLineMaps(textA: string, textB: string): DisplayLineMaps {
  const fallback = {
    lineMapA: buildLineMap(textA),
    lineMapB: buildLineMap(textB),
    placeholderLineMapA: {},
    placeholderLineMapB: {}
  };
  try {
    const aligned = formatAlignedForDisplay(
      JSON.parse(textA) as JsonValue,
      JSON.parse(textB) as JsonValue
    );
    return aligned.textA === textA && aligned.textB === textB ? aligned : fallback;
  } catch {
    return fallback;
  }
}

export function createLineHighlights(
  result: ComparisonResult | null,
  textA: string,
  textB: string,
  toggles: HighlightToggles
): LineHighlights {
  const a: Record<number, HighlightCategory> = {};
  const b: Record<number, HighlightCategory> = {};
  if (!result) return { a, b };

  const { lineMapA, lineMapB, placeholderLineMapA, placeholderLineMapB } = displayLineMaps(
    textA,
    textB
  );
  const mark = (
    target: Record<number, HighlightCategory>,
    line: number | undefined,
    category: HighlightCategory
  ) => {
    if (line && !target[line]) target[line] = category;
  };

  if (toggles.missing)
    for (const finding of result.findings)
      if (!finding.ignored) {
        if (finding.kind === "removed") {
          mark(a, nearestMappedLine(finding.pointer, lineMapA), "missing");
          mark(b, nearestMappedLine(finding.pointer, placeholderLineMapB), "missing");
        }
        if (finding.kind === "added") {
          mark(b, nearestMappedLine(finding.pointer, lineMapB), "missing");
          mark(a, nearestMappedLine(finding.pointer, placeholderLineMapA), "missing");
        }
      }
  if (toggles.structure)
    for (const finding of result.structure)
      if (!finding.ignored) {
        if (finding.kind === "extra-in-b") {
          mark(b, nearestMappedLine(finding.pointer, lineMapB), "structure");
          mark(a, nearestMappedLine(finding.pointer, placeholderLineMapA), "structure");
        } else {
          mark(a, nearestMappedLine(finding.pointer, lineMapA), "structure");
          if (finding.kind === "missing-in-b")
            mark(b, nearestMappedLine(finding.pointer, placeholderLineMapB), "structure");
        }
      }
  if (toggles.differences)
    for (const finding of result.findings)
      if (!finding.ignored && (finding.kind === "changed" || finding.kind === "type-changed")) {
        mark(a, nearestMappedLine(finding.pointer, lineMapA), "differences");
        mark(b, nearestMappedLine(finding.pointer, lineMapB), "differences");
      }
  return { a, b };
}
