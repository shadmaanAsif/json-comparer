"use client";

import type { ArrayMode } from "@/domain/comparison/types";
import type { WorkspaceStatus } from "../types";
import { ONLY_IN_LABELS } from "../constants";
import { IgnorePathSelector } from "./IgnorePathSelector";
import { InfoTooltipButton } from "./InfoTooltipButton";

export interface HighlightVisibility {
  missing: boolean;
  structure: boolean;
  differences: boolean;
}

export interface ComparisonControlsProps {
  arrayMode: ArrayMode;
  ignorePaths: string[];
  ignorePathSuggestions: string[];
  highlightVisibility: HighlightVisibility;
  isComparing: boolean;
  status: WorkspaceStatus;
  onArrayModeChange: (mode: ArrayMode) => void;
  onIgnorePathsChange: (paths: string[]) => void;
  onApplyIgnorePaths: (paths: string[]) => void;
  onHighlightVisibilityChange: (value: HighlightVisibility) => void;
}

export function ComparisonControls({
  arrayMode,
  ignorePaths,
  ignorePathSuggestions,
  highlightVisibility,
  isComparing,
  status,
  onArrayModeChange,
  onIgnorePathsChange,
  onApplyIgnorePaths,
  onHighlightVisibilityChange
}: ComparisonControlsProps) {
  const toggleHighlight = (category: keyof HighlightVisibility) => {
    onHighlightVisibilityChange({
      ...highlightVisibility,
      [category]: !highlightVisibility[category]
    });
  };

  return (
    <>
      <div className="primary-actions">
        <p className={`status ${status.tone}`} role="status" aria-live="polite">
          {status.message}
        </p>
      </div>

      <section className="options-bar" aria-labelledby="options-heading">
        <div data-tour="array-mode">
          <p className="eyebrow" id="options-heading">
            Comparison settings
          </p>
          <fieldset className="segmented">
            <legend className="visually-hidden">Array comparison mode</legend>
            <label>
              <input
                type="radio"
                name="array-mode"
                value="ordered"
                checked={arrayMode === "ordered"}
                onChange={() => onArrayModeChange("ordered")}
              />
              Ordered arrays
            </label>
            <label>
              <input
                type="radio"
                name="array-mode"
                value="unordered"
                checked={arrayMode === "unordered"}
                onChange={() => onArrayModeChange("unordered")}
              />
              Unordered arrays
            </label>
          </fieldset>
        </div>
        <div className="ignore-field" data-tour="ignore-paths">
          <label htmlFor="ignore-paths-input">
            Ignore paths{" "}
            <small>
              comma or line separated; exact includes descendants, `*` one segment, `**` subtree
            </small>
          </label>
          <IgnorePathSelector
            selectedPaths={ignorePaths}
            suggestions={ignorePathSuggestions}
            disabled={isComparing}
            onChange={onIgnorePathsChange}
            onApply={onApplyIgnorePaths}
          />
          {arrayMode === "unordered" && (
            <p className="ignore-field-note">
              In Unordered mode, ignore rules don&apos;t help two array items match — items are
              compared by their full value first, so a field you ignore can still make an
              otherwise-identical item show up as unmatched.
            </p>
          )}
        </div>
      </section>

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
    </>
  );
}
