"use client";

import { displayPath } from "@/domain/comparison/path";
import type { ComparisonResult, Finding, StructureFinding } from "@/domain/comparison/types";
import type { ReviewNote, ReviewNoteStatus } from "../types";
import {
  formatComparisonOutcome,
  type ComparisonProjectionCounts
} from "../utils/result-projections";
import { ValueCell } from "./ValueCell";

export interface ResultFilters {
  path: string;
  showOnlyInA: boolean;
  showOnlyInB: boolean;
  showIgnored: boolean;
  showStructureOnlyInA: boolean;
  showStructureOnlyInB: boolean;
}

export interface ResultSectionState {
  missing: boolean;
  structure: boolean;
  differences: boolean;
}

export interface ComparisonResultsProps {
  result: ComparisonResult;
  counts: ComparisonProjectionCounts;
  comparisonDurationMs: number;
  onlyInA: Finding[];
  onlyInB: Finding[];
  differences: Finding[];
  structureFindings: StructureFinding[];
  selectedFindingIds: ReadonlySet<string>;
  notesByFindingId: Record<string, ReviewNote>;
  filters: ResultFilters;
  sections: ResultSectionState;
  onFiltersChange: (patch: Partial<ResultFilters>) => void;
  onSectionsChange: (patch: Partial<ResultSectionState>) => void;
  onToggleAllSections: () => void;
  onExport: (selectedOnly: boolean) => void;
  onToggleSelected: (findingId: string) => void;
  onNoteChange: (findingId: string, patch: Partial<ReviewNote>) => void;
}

function findingLabel(finding: Finding) {
  if (finding.kind === "added") return "Only in B";
  if (finding.kind === "removed") return "Only in A";
  return "Modified";
}

function structureLabel(kind: StructureFinding["kind"]) {
  if (kind === "extra-in-b") return "Only in B";
  if (kind === "missing-in-b") return "Only in A";
  if (kind === "inconsistent-in-a") return "Inconsistent in A";
  return "A has no schema item";
}

const REVIEW_STATUS_OPTIONS: ReadonlyArray<{
  value: ReviewNoteStatus;
  label: string;
}> = [
  { value: "not-reviewed", label: "Not reviewed" },
  { value: "reviewed", label: "Reviewed" },
  { value: "needed", label: "Needed" }
];

export function ComparisonResults({
  result,
  counts,
  comparisonDurationMs,
  onlyInA,
  onlyInB,
  differences,
  structureFindings,
  selectedFindingIds,
  notesByFindingId,
  filters,
  sections,
  onFiltersChange,
  onSectionsChange,
  onToggleAllSections,
  onExport,
  onToggleSelected,
  onNoteChange
}: ComparisonResultsProps) {
  const missingFindings = [...onlyInA, ...onlyInB];
  const allSectionsExpanded = Object.values(sections).every(Boolean);

  return (
    <section className="results" aria-labelledby="results-heading">
      <div className="results-heading">
        <div>
          <p className="eyebrow">Comparison output</p>
          <h2 id="results-heading">Results</h2>
        </div>
        <div className="export-actions">
          <button
            className="secondary-button expand-results-button"
            type="button"
            aria-expanded={allSectionsExpanded}
            onClick={onToggleAllSections}
          >
            {allSectionsExpanded ? "Collapse all" : "Expand all"}
          </button>
          <button className="secondary-button" type="button" onClick={() => onExport(false)}>
            Export Missing Fields (.md)
          </button>
          <button className="secondary-button" type="button" onClick={() => onExport(true)}>
            Export Selected ({selectedFindingIds.size})
          </button>
        </div>
      </div>

      <div className="summary-row" aria-label="Comparison summary">
        <span className="summary-chip removed">
          <span>
            {counts.onlyInA.visible} / {counts.onlyInA.total}
          </span>{" "}
          Only in A
        </span>
        <span className="summary-chip added">
          <span>
            {counts.onlyInB.visible} / {counts.onlyInB.total}
          </span>{" "}
          Only in B
        </span>
        <span className="summary-chip changed">
          <span>
            {counts.modified.visible} / {counts.modified.total}
          </span>{" "}
          changed
        </span>
        <span className="summary-chip type-changed">
          <span>
            {counts.structure.visible} / {counts.structure.total}
          </span>{" "}
          structure
        </span>
        {counts.ignored.total > 0 && (
          <span className="ignored-summary">
            {counts.ignored.visible} / {counts.ignored.total} ignored
          </span>
        )}
      </div>

      <p className="comparison-outcome" role="status" aria-live="polite">
        {formatComparisonOutcome(counts.differences, comparisonDurationMs)}
      </p>

      <div className="results-toolbar">
        <label className="path-filter">
          <span>Filter by path</span>
          <input
            type="search"
            value={filters.path}
            onChange={(event) => onFiltersChange({ path: event.target.value })}
            placeholder="data.amount"
          />
        </label>
        <div className="filter-chip-row">
          <div className="filter-chip-group" role="group" aria-label="Result filters">
            <FilterChip
              className="only-a-chip"
              pressed={filters.showOnlyInA}
              onClick={() => onFiltersChange({ showOnlyInA: !filters.showOnlyInA })}
            >
              Only in A
            </FilterChip>
            <FilterChip
              className="only-b-chip"
              pressed={filters.showOnlyInB}
              onClick={() => onFiltersChange({ showOnlyInB: !filters.showOnlyInB })}
            >
              Only in B
            </FilterChip>
            <FilterChip
              className="ignored-chip"
              pressed={filters.showIgnored}
              onClick={() => onFiltersChange({ showIgnored: !filters.showIgnored })}
            >
              Show ignored
            </FilterChip>
          </div>
          <span className="shown-count">
            {counts.differences.visible} / {counts.differences.total} differences
          </span>
        </div>
      </div>

      <details
        className="result-section"
        open={sections.structure}
        onToggle={(event) => {
          const open = event.currentTarget.open;
          onSectionsChange({ structure: open });
        }}
      >
        <summary>
          <span className="result-section-title">
            <ResultSectionArrow />
            Structure Schema Compare
          </span>
          <small>
            {counts.structure.visible} / {counts.structure.total}
          </small>
        </summary>
        <div className="structure-filter-bar">
          <span>Show schema differences</span>
          <div className="filter-chip-group" role="group" aria-label="Structure schema filters">
            <FilterChip
              className="structure-only-a-chip"
              pressed={filters.showStructureOnlyInA}
              onClick={() =>
                onFiltersChange({
                  showStructureOnlyInA: !filters.showStructureOnlyInA
                })
              }
            >
              Only in A
            </FilterChip>
            <FilterChip
              className="structure-only-b-chip"
              pressed={filters.showStructureOnlyInB}
              onClick={() =>
                onFiltersChange({
                  showStructureOnlyInB: !filters.showStructureOnlyInB
                })
              }
            >
              Only in B
            </FilterChip>
          </div>
        </div>
        {structureFindings.length === 0 ? (
          <EmptyResult title="No structure issues">
            No structure findings match the active source and path filters.
          </EmptyResult>
        ) : (
          <div className="table-scroll">
            <table>
              <caption className="visually-hidden">Structure schema findings</caption>
              <thead>
                <tr>
                  <th scope="col">Field path</th>
                  <th scope="col">Issue</th>
                  <th scope="col">Detail</th>
                </tr>
              </thead>
              <tbody>
                {structureFindings.map((finding) => (
                  <tr key={finding.id} className={finding.ignored ? "ignored-row" : ""}>
                    <td>
                      <FindingPath finding={finding} />
                    </td>
                    <td>
                      <span className="kind-pill type-changed">{structureLabel(finding.kind)}</span>
                    </td>
                    <td>{finding.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>

      <details
        className="result-section"
        open={sections.missing}
        onToggle={(event) => {
          const open = event.currentTarget.open;
          onSectionsChange({ missing: open });
        }}
      >
        <summary>
          <span className="result-section-title">
            <ResultSectionArrow />
            Missing Fields
          </span>
          <small>
            {counts.missing.visible} / {counts.missing.total} · {selectedFindingIds.size} selected
          </small>
        </summary>
        {missingFindings.length === 0 ? (
          <EmptyResult title="No missing fields">
            No matching missing-field rows under the active filters.
          </EmptyResult>
        ) : (
          <div className="table-scroll">
            <table>
              <caption className="visually-hidden">Missing fields grouped by response</caption>
              <thead>
                <tr>
                  <th scope="col">Select</th>
                  <th scope="col">Field path</th>
                  <th scope="col">Source A</th>
                  <th scope="col">Target B</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                <MissingFindingGroup
                  label="Only in A"
                  findings={onlyInA}
                  selectedFindingIds={selectedFindingIds}
                  notesByFindingId={notesByFindingId}
                  onToggleSelected={onToggleSelected}
                  onNoteChange={onNoteChange}
                />
                <MissingFindingGroup
                  label="Only in B"
                  findings={onlyInB}
                  selectedFindingIds={selectedFindingIds}
                  notesByFindingId={notesByFindingId}
                  onToggleSelected={onToggleSelected}
                  onNoteChange={onNoteChange}
                />
              </tbody>
            </table>
          </div>
        )}
      </details>

      <details
        className="result-section"
        open={sections.differences}
        onToggle={(event) => {
          const open = event.currentTarget.open;
          onSectionsChange({ differences: open });
        }}
      >
        <summary>
          <span className="result-section-title">
            <ResultSectionArrow />
            Differences
          </span>
          <small>
            {counts.differences.visible} / {counts.differences.total}
          </small>
        </summary>
        {differences.length === 0 ? (
          <EmptyResult title="No differences">
            The visible fields, values, and types match.
          </EmptyResult>
        ) : (
          <div className="table-scroll">
            <table>
              <caption className="visually-hidden">
                Exact missing, added, and modified values
              </caption>
              <thead>
                <tr>
                  <th scope="col">Exact changed path</th>
                  <th scope="col">Change</th>
                  <th scope="col">Source A</th>
                  <th scope="col">Target B</th>
                </tr>
              </thead>
              <tbody>
                {differences.map((finding) => (
                  <tr key={finding.id} className={finding.ignored ? "ignored-row" : ""}>
                    <td>
                      <FindingPath finding={finding} />
                    </td>
                    <td>
                      <span className={`kind-pill ${finding.kind}`}>{findingLabel(finding)}</span>
                    </td>
                    <td>
                      <ValueCell value={finding.valueA} />
                    </td>
                    <td>
                      <ValueCell value={finding.valueB} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
      {result.truncated && (
        <p className="warning" role="alert">
          The finding limit was reached; this result is incomplete.
        </p>
      )}
    </section>
  );
}

function ResultSectionArrow() {
  return (
    <span className="result-section-arrow" aria-hidden="true">
      <svg viewBox="0 0 20 20" focusable="false">
        <path d="m7 4 6 6-6 6" />
      </svg>
    </span>
  );
}

function FilterChip({
  className,
  pressed,
  onClick,
  children
}: {
  className: string;
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`select-chip ${className}`}
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
    >
      <i aria-hidden="true" />
      {children}
    </button>
  );
}

function FindingPath({ finding }: { finding: Finding | StructureFinding }) {
  return (
    <>
      <strong>{displayPath(finding.path)}</strong>
      <code>{finding.pointer || "/"}</code>
      {finding.ignored && <span className="ignored-pill">Ignored</span>}
    </>
  );
}

function MissingFindingGroup({
  label,
  findings,
  selectedFindingIds,
  notesByFindingId,
  onToggleSelected,
  onNoteChange
}: {
  label: string;
  findings: Finding[];
  selectedFindingIds: ReadonlySet<string>;
  notesByFindingId: Record<string, ReviewNote>;
  onToggleSelected: (findingId: string) => void;
  onNoteChange: (findingId: string, patch: Partial<ReviewNote>) => void;
}) {
  if (!findings.length) return null;
  return (
    <>
      <tr className="finding-group">
        <th scope="rowgroup" colSpan={5}>
          {label} <small>{findings.length}</small>
        </th>
      </tr>
      {findings.map((finding) => {
        const note = notesByFindingId[finding.id] ?? { status: "not-reviewed", text: "" };
        return (
          <tr key={finding.id} className={finding.ignored ? "ignored-row" : ""}>
            <td>
              <input
                type="checkbox"
                aria-label={`Select ${displayPath(finding.path)}`}
                checked={selectedFindingIds.has(finding.id)}
                onChange={() => onToggleSelected(finding.id)}
              />
            </td>
            <td>
              <FindingPath finding={finding} />
              <span className={`kind-pill ${finding.kind}`}>{findingLabel(finding)}</span>
            </td>
            <td>
              <ValueCell value={finding.valueA} />
            </td>
            <td>
              <ValueCell value={finding.valueB} />
            </td>
            <td>
              <div className="note-editor">
                <fieldset className="review-status-group">
                  <legend className="visually-hidden">
                    Review status for {displayPath(finding.path)}
                  </legend>
                  <div className="review-status-options">
                    {REVIEW_STATUS_OPTIONS.map((option) => (
                      <label className="review-status-option" key={option.value}>
                        <input
                          type="radio"
                          name={`review-status-${finding.id}`}
                          value={option.value}
                          checked={note.status === option.value}
                          onChange={() =>
                            onNoteChange(finding.id, {
                              status: option.value
                            })
                          }
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label>
                  <span className="visually-hidden">Note for {displayPath(finding.path)}</span>
                  <input
                    type="text"
                    value={note.text}
                    onChange={(event) => onNoteChange(finding.id, { text: event.target.value })}
                    placeholder="Add note"
                  />
                </label>
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

function EmptyResult({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
