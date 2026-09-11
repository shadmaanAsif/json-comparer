import { formatAlignedForDisplay, type DisplayLineMaps } from "@/domain/comparison/display-format";
import { buildLineMap, nearestMappedLine } from "@/domain/comparison/line-map";
import type { JsonValue } from "@/domain/comparison/types";
import type { HighlightCategory, LineHighlight } from "../types";
import type { ComparisonResultProjection } from "./result-projections";

export interface HighlightToggles {
  missing: boolean;
  structure: boolean;
  differences: boolean;
}

export interface LineHighlights {
  a: Record<number, LineHighlight>;
  b: Record<number, LineHighlight>;
}

const HIGHLIGHT_PRIORITY: Record<HighlightCategory, number> = {
  invalid: 4,
  structure: 3,
  differences: 2,
  missing: 1
};

function resolveDisplayLineMaps(
  textA: string,
  textB: string,
  exactLineMaps?: DisplayLineMaps | null
): DisplayLineMaps {
  if (exactLineMaps) return exactLineMaps;
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
  projection: ComparisonResultProjection | null,
  textA: string,
  textB: string,
  toggles: HighlightToggles,
  exactLineMaps?: DisplayLineMaps | null
): LineHighlights {
  const a: Record<number, LineHighlight> = {};
  const b: Record<number, LineHighlight> = {};
  if (!projection) return { a, b };

  const { lineMapA, lineMapB, placeholderLineMapA, placeholderLineMapB } = resolveDisplayLineMaps(
    textA,
    textB,
    exactLineMaps
  );
  const mark = (
    target: Record<number, LineHighlight>,
    line: number | undefined,
    category: HighlightCategory,
    ignored: boolean
  ) => {
    if (
      line &&
      (!target[line] || HIGHLIGHT_PRIORITY[category] > HIGHLIGHT_PRIORITY[target[line].category])
    )
      target[line] = { category, ignored };
  };

  if (toggles.missing)
    for (const finding of [...projection.onlyInA, ...projection.onlyInB]) {
      if (finding.kind === "removed") {
        mark(a, nearestMappedLine(finding.pointer, lineMapA), "missing", finding.ignored);
        mark(
          b,
          nearestMappedLine(finding.pointer, placeholderLineMapB),
          "missing",
          finding.ignored
        );
      }
      if (finding.kind === "added") {
        mark(b, nearestMappedLine(finding.pointer, lineMapB), "missing", finding.ignored);
        mark(
          a,
          nearestMappedLine(finding.pointer, placeholderLineMapA),
          "missing",
          finding.ignored
        );
      }
    }
  if (toggles.structure)
    for (const finding of projection.structureFindings) {
      if (finding.kind === "extra-in-b") {
        mark(b, nearestMappedLine(finding.pointer, lineMapB), "structure", finding.ignored);
        mark(
          a,
          nearestMappedLine(finding.pointer, placeholderLineMapA),
          "structure",
          finding.ignored
        );
      } else {
        mark(a, nearestMappedLine(finding.pointer, lineMapA), "structure", finding.ignored);
        if (finding.kind === "missing-in-b")
          mark(
            b,
            nearestMappedLine(finding.pointer, placeholderLineMapB),
            "structure",
            finding.ignored
          );
      }
    }
  if (toggles.differences)
    for (const finding of projection.differences)
      if (finding.kind === "changed" || finding.kind === "type-changed") {
        mark(a, nearestMappedLine(finding.pointer, lineMapA), "differences", finding.ignored);
        mark(b, nearestMappedLine(finding.pointer, lineMapB), "differences", finding.ignored);
      }
  return { a, b };
}
