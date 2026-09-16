"use client";

import { useState } from "react";
import type { ArrayMode } from "@/domain/comparison/types";
import type { WorkspaceStatus } from "../types";
import { ONLY_IN_LABELS } from "../constants";
import { IgnorePathSelector } from "./IgnorePathSelector";
import { InfoTooltipButton } from "./InfoTooltipButton";

function parseKeyFields(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((field) => field.trim())
    .filter(Boolean);
}

export interface HighlightVisibility {
  missing: boolean;
  structure: boolean;
  differences: boolean;
}

export interface ComparisonControlsProps {
  arrayMode: ArrayMode;
  keyFields: string[];
  ignorePaths: string[];
  ignorePathSuggestions: string[];
  highlightVisibility: HighlightVisibility;
  isComparing: boolean;
  status: WorkspaceStatus;
  onArrayModeChange: (mode: ArrayMode) => void;
  onKeyFieldsChange: (fields: string[]) => void;
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
  keyFields,
  ignorePaths,
  ignorePathSuggestions,
  highlightVisibility,
  isComparing,
  status,
  onArrayModeChange,
  onKeyFieldsChange,
  onIgnorePathsChange,
  onApplyIgnorePaths,
  onHighlightVisibilityChange,
  onCompare,
  onCancel,
  onLoadSample,
  onClear
}: ComparisonControlsProps) {
  const [keyFieldsText, setKeyFieldsText] = useState(keyFields.join(", "));
  const toggleHighlight = (category: keyof HighlightVisibility) => {
    onHighlightVisibilityChange({
      ...highlightVisibility,
      [category]: !highlightVisibility[category]
    });
  };

  return (
    <>
      <div className="primary-actions" data-tour="primary-actions">
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
            <label>
              <input
                type="radio"
                name="array-mode"
                value="keyed"
                checked={arrayMode === "keyed"}
                onChange={() => onArrayModeChange("keyed")}
              />
              Keyed arrays
            </label>
          </fieldset>
          {arrayMode === "keyed" && (
            <div className="key-field">
              <label htmlFor="key-fields-input">
                Key fields{" "}
                <small>comma or space separated; the first usable key pairs array items</small>
              </label>
              <input
                id="key-fields-input"
                type="text"
                className="key-field-input"
                value={keyFieldsText}
                placeholder="id, uuid, key"
                disabled={isComparing}
                onChange={(event) => {
                  setKeyFieldsText(event.target.value);
                  onKeyFieldsChange(parseKeyFields(event.target.value));
                }}
              />
              <p className="ignore-field-note">
                Object arrays are paired by the first key field present with a unique value on every
                item of each side. Arrays without a usable key fall back to Unordered matching.
              </p>
            </div>
          )}
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
