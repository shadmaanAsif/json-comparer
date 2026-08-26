"use client";

import type { ArrayMode } from "@/domain/comparison/types";
import type { WorkspaceStatus } from "../types";

export interface HighlightVisibility {
  missing: boolean;
  structure: boolean;
  differences: boolean;
}

export interface ComparisonControlsProps {
  arrayMode: ArrayMode;
  ignorePathsText: string;
  highlightVisibility: HighlightVisibility;
  isComparing: boolean;
  status: WorkspaceStatus;
  onArrayModeChange: (mode: ArrayMode) => void;
  onIgnorePathsTextChange: (value: string) => void;
  onApplyIgnorePaths: () => void;
  onHighlightVisibilityChange: (value: HighlightVisibility) => void;
  onCompare: () => void;
  onCancel: () => void;
  onLoadSample: () => void;
  onClear: () => void;
}

export function ComparisonControls({
  arrayMode,
  ignorePathsText,
  highlightVisibility,
  isComparing,
  status,
  onArrayModeChange,
  onIgnorePathsTextChange,
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
          <div className="ignore-field-controls">
            <input
              id="ignore-paths-input"
              value={ignorePathsText}
              onChange={(event) => onIgnorePathsTextChange(event.target.value)}
              placeholder="config.partnerConfig.MOT_config, items.*.internalId"
            />
            <button
              className="secondary-button"
              type="button"
              disabled={isComparing}
              onClick={onApplyIgnorePaths}
            >
              Apply
            </button>
          </div>
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
            <i className="legend-a" />A only <i className="legend-b" />B only
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
