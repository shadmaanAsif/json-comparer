"use client";

import type { ArrayMode } from "@/domain/comparison/types";
import type { WorkspaceStatus } from "../types";
import { IgnorePathSelector } from "./IgnorePathSelector";

export interface ComparisonControlsProps {
  arrayMode: ArrayMode;
  ignorePaths: string[];
  ignorePathSuggestions: string[];
  isComparing: boolean;
  status: WorkspaceStatus;
  onArrayModeChange: (mode: ArrayMode) => void;
  onIgnorePathsChange: (paths: string[]) => void;
  onApplyIgnorePaths: (paths: string[]) => void;
}

export function ComparisonControls({
  arrayMode,
  ignorePaths,
  ignorePathSuggestions,
  isComparing,
  status,
  onArrayModeChange,
  onIgnorePathsChange,
  onApplyIgnorePaths
}: ComparisonControlsProps) {
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
    </>
  );
}
