"use client";

import type { ArrayMode } from "@/domain/comparison/types";
import type { WorkspaceStatus } from "../types";
import { IgnorePathSelector } from "./IgnorePathSelector";

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
  onCompare: () => void;
  onCancel: () => void;
  onLoadSample: () => void;
  onClear: () => void;
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
  onHighlightVisibilityChange,
  onCompare,
  onCancel,
  onLoadSample,
  onClear
}: ComparisonControlsProps) {
  const toggleHighlight = (category: keyof HighlightVisibility) => {
    onHighlightVisibilityChange({
      ...highlightVisibility,
      [category]: !highlightVisibility[category]
    });
  };

  return (
    <>
      <section className="options-bar" aria-labelledby="options-heading">
        <div>
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
        <div className="ignore-field">
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
        </div>
      </section>

      <fieldset className="highlight-controls">
        <legend>Highlight in JSON panels</legend>
        <button
          className="select-chip missing-chip"
          type="button"
          aria-pressed={highlightVisibility.missing}
          onClick={() => toggleHighlight("missing")}
        >
          <span className="legend-pair">
            <i className="legend-a" />
            Only in A <i className="legend-b" />
            Only in B
          </span>{" "}
          Missing fields
        </button>
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

      <div className="primary-actions">
        <button className="primary-button" type="button" disabled={isComparing} onClick={onCompare}>
          {isComparing ? "Comparing…" : "Compare responses"}
        </button>
        {isComparing && (
          <button className="secondary-button" type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button className="secondary-button" type="button" onClick={onLoadSample}>
          Load sample
        </button>
        <button className="secondary-button" type="button" onClick={onClear}>
          Clear all
        </button>
        <p className={`status ${status.tone}`} role="status" aria-live="polite">
          {status.message}
        </p>
      </div>
    </>
  );
}
