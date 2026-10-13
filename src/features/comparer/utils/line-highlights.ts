import {
  formatAlignedForDisplay,
  type AlignedDisplayText,
  type DisplayLineMaps
} from "@/domain/comparison/display-format";
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
  exactLineMaps?: AlignedDisplayText | null
): DisplayLineMaps {
  // exactLineMaps is worker output tied to the text it was aligned against. Once the user keeps
  // typing (a live re-compare is debounced, not instant — see updateTypedInput), textA/textB can
  // shift line numbers before that recompute lands; trusting a stale map here would misplace
  // every highlight below the edit by however many lines shifted. Recomputing from the current
  // text below is the same safe fallback already used when no exact map exists at all.
  if (exactLineMaps && exactLineMaps.textA === textA && exactLineMaps.textB === textB)
    return exactLineMaps;
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
  exactLineMaps?: AlignedDisplayText | null
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
    ignored: boolean,
    dimmed = false
  ) => {
    // A dimmed entry only ever fills an empty line, so it can't mask a full-strength highlight.
    if (!line || (dimmed && target[line])) return;
    if (!target[line] || HIGHLIGHT_PRIORITY[category] > HIGHLIGHT_PRIORITY[target[line].category])
      target[line] = dimmed ? { category, ignored, dimmed } : { category, ignored };
  };
  const markStructure = (dimmed: boolean) => {
    for (const finding of projection.structureFindings) {
      if (finding.kind === "extra-in-b") {
        mark(b, nearestMappedLine(finding.pointer, lineMapB), "structure", finding.ignored, dimmed);
        mark(
          a,
          nearestMappedLine(finding.pointer, placeholderLineMapA),
          "structure",
          finding.ignored,
          dimmed
        );
      } else {
        mark(a, nearestMappedLine(finding.pointer, lineMapA), "structure", finding.ignored, dimmed);
        if (finding.kind === "missing-in-b")
          mark(
            b,
            nearestMappedLine(finding.pointer, placeholderLineMapB),
            "structure",
            finding.ignored,
            dimmed
          );
      }
    }
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
  if (toggles.structure) markStructure(false);
  if (toggles.differences)
    for (const finding of projection.differences)
      if (finding.kind === "changed" || finding.kind === "type-changed") {
        mark(a, nearestMappedLine(finding.pointer, lineMapA), "differences", finding.ignored);
        mark(b, nearestMappedLine(finding.pointer, lineMapB), "differences", finding.ignored);
      }
  // Schema changes stay on screen when their chip is off, just dimmed — placed last so every
  // enabled category keeps priority on a shared line.
  if (!toggles.structure) markStructure(true);
  return { a, b };
}

/** Whether a highlighted line is drawn dimmed: an ignored finding, or a switched-off schema one. */
export function isDimmedHighlight(highlight: LineHighlight | undefined): boolean {
  return !!highlight && (highlight.ignored || !!highlight.dimmed);
}
