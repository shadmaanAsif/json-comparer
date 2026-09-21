"use client";

import { ONLY_IN_LABELS } from "../constants";
import { InfoTooltipButton } from "./InfoTooltipButton";

export interface HighlightVisibility {
  missing: boolean;
  structure: boolean;
  differences: boolean;
}

export interface HighlightControlsProps {
  highlightVisibility: HighlightVisibility;
  onHighlightVisibilityChange: (value: HighlightVisibility) => void;
}

export function HighlightControls({
  highlightVisibility,
  onHighlightVisibilityChange
}: HighlightControlsProps) {
  const toggleHighlight = (category: keyof HighlightVisibility) => {
    onHighlightVisibilityChange({
      ...highlightVisibility,
      [category]: !highlightVisibility[category]
    });
  };

  return (
    <fieldset className="highlight-controls" data-tour="highlight-controls">
      <legend>Highlight in JSON panels</legend>
      <span className="select-chip missing-chip">
        <button
          className="chip-toggle"
          type="button"
          aria-pressed={highlightVisibility.missing}
          onClick={() => toggleHighlight("missing")}
        >
          <span className="legend-pair" aria-hidden="true">
            <i className="legend-a" />
            <i className="legend-b" />
          </span>
          Missing fields
        </button>
        <InfoTooltipButton
          label="Missing-fields highlight colors"
          detail={`${ONLY_IN_LABELS.A} is highlighted in red, ${ONLY_IN_LABELS.B} in green.`}
        />
      </span>
      <button
        className="select-chip structure-chip"
        type="button"
        aria-pressed={highlightVisibility.structure}
        onClick={() => toggleHighlight("structure")}
      >
        <i className="legend-structure" />
        Structure schema
      </button>
      <button
        className="select-chip difference-chip"
        type="button"
        aria-pressed={highlightVisibility.differences}
        onClick={() => toggleHighlight("differences")}
      >
        <i className="legend-difference" />
        Differences
      </button>
    </fieldset>
  );
}
