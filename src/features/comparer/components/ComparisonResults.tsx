"use client";

import { displayPath } from "@/domain/comparison/path";
import type { ComparisonResult, Finding, StructureFinding } from "@/domain/comparison/types";
import { ONLY_IN_LABELS, RESULT_SECTION_LABELS, SIDE_LABELS } from "../constants";
import type { ResponseSide, ReviewNote } from "../types";
import { FindingReview } from "./FindingReview";
import {
  formatComparisonOutcome,
  type ComparisonProjectionCounts
} from "../utils/result-projections";
import { buildRowActions } from "../utils/row-actions";
import { buildSectionActions, type SectionFinding } from "../utils/section-actions";
import { ResultSectionMenu } from "./ResultSectionMenu";
import { RowActionMenu } from "./RowActionMenu";
import { ValueCell } from "./ValueCell";

export interface ResultFilters {
  path: string;
  showOnlyInA: boolean;
  showOnlyInB: boolean;
  showIgnored: boolean;
}

export interface ResultSectionState {
  missing: boolean;
  structure: boolean;
  differences: boolean;
}

export type ResultSectionKey = keyof ResultSectionState;

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
  ignorePaths: string[];
  onFiltersChange: (patch: Partial<ResultFilters>) => void;
  onSectionsChange: (patch: Partial<ResultSectionState>) => void;
  onToggleAllSections: () => void;
  onExport: (selectedOnly: boolean) => void;
  onExportSection: (section: ResultSectionKey) => void;
  onToggleSelected: (findingId: string) => void;
  onSelectFindings: (findingIds: string[], selected: boolean) => void;
  onCopyPaths: (pointers: string[], sectionLabel: string) => void;
  onIgnorePaths: (paths: string[]) => void;
  onManageIgnores: () => void;
  onScrollToPanel: (pointer: string, homeSide: ResponseSide, resolveCounterpart: boolean) => void;
  onNoteChange: (findingId: string, patch: Partial<ReviewNote>) => void;
}

function findingLabel(finding: Finding) {
  if (finding.kind === "added") return ONLY_IN_LABELS.B;
  if (finding.kind === "removed") return ONLY_IN_LABELS.A;
  return "Modified";
}

function structureLabel(kind: StructureFinding["kind"]) {
  if (kind === "extra-in-b") return ONLY_IN_LABELS.B;
  if (kind === "missing-in-b") return ONLY_IN_LABELS.A;
  if (kind === "inconsistent-in-a") return "Inconsistent in Baseline";
  return "Baseline has no schema item";
}

function rowClassName(
  finding: Finding | StructureFinding,
  selectedFindingIds: ReadonlySet<string>
) {
  return [
    finding.ignored ? "ignored-row" : "",
    selectedFindingIds.has(finding.id) ? "selected-row" : ""
  ]
    .filter(Boolean)
    .join(" ");
}

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
  ignorePaths,
  onFiltersChange,
  onSectionsChange,
  onToggleAllSections,
  onExport,
  onExportSection,
  onToggleSelected,
  onSelectFindings,
  onCopyPaths,
  onIgnorePaths,
  onManageIgnores,
  onScrollToPanel,
  onNoteChange
}: ComparisonResultsProps) {
  const missingFindings = [...onlyInA, ...onlyInB];
  const selectedMissingCount = result.findings.filter(
    (finding) =>
      (finding.kind === "added" || finding.kind === "removed") && selectedFindingIds.has(finding.id)
  ).length;
  const allSectionsExpanded = Object.values(sections).every(Boolean);

  const sectionActions = (
    section: ResultSectionKey,
    findings: SectionFinding[],
    isSelectable?: (finding: SectionFinding) => boolean
  ) =>
    buildSectionActions({
      sectionLabel: RESULT_SECTION_LABELS[section],
      findings,
      selectedFindingIds,
      ignorePaths,
      isSelectable,
      handlers: {
        onCopyPaths,
        onExportSection: () => onExportSection(section),
        onSelectFindings,
        onIgnorePaths
      }
    });

  return (
    <section className="results" aria-labelledby="results-heading">
      {/* Anchored to this overview block, not the whole (often page-length) section, so the
          tour popover has somewhere sane to render — and it stretches down through the
          filter row since that's where the counts/chips the popover describes actually live. */}
      <div data-tour="results">
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
            {ONLY_IN_LABELS.A}
          </span>
          <span className="summary-chip added">
            <span>
              {counts.onlyInB.visible} / {counts.onlyInB.total}
            </span>{" "}
            {ONLY_IN_LABELS.B}
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
          <div className="path-filter-block">
            <label className="path-filter">
              <span>Filter by path</span>
              <input
                id="results-path-filter"
                type="search"
                value={filters.path}
                onChange={(event) => onFiltersChange({ path: event.target.value })}
                placeholder="data.amount or /data/amount"
              />
            </label>
            {filters.path && (
              <button
                type="button"
                className="text-button"
                onClick={() => onFiltersChange({ path: "" })}
              >
                Clear path filter
              </button>
            )}
          </div>
          <div className="filter-chip-row">
            <div className="filter-chip-group" role="group" aria-label="Result filters">
              <FilterChip
                className="only-a-chip"
                pressed={filters.showOnlyInA}
                onClick={() => onFiltersChange({ showOnlyInA: !filters.showOnlyInA })}
              >
                {ONLY_IN_LABELS.A}
              </FilterChip>
              <FilterChip
                className="only-b-chip"
                pressed={filters.showOnlyInB}
                onClick={() => onFiltersChange({ showOnlyInB: !filters.showOnlyInB })}
              >
                {ONLY_IN_LABELS.B}
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
      </div>

      <details
        className="result-section"
        data-tour="result-structure"
        open={sections.structure}
        onToggle={(event) => {
          const open = event.currentTarget.open;
          onSectionsChange({ structure: open });
        }}
      >
        <summary>
          <span className="result-section-title">
            <ResultSectionArrow />
            {RESULT_SECTION_LABELS.structure}
          </span>
          <span className="result-section-meta">
            <small>
              {counts.structure.visible} / {counts.structure.total}
            </small>
            <ResultSectionMenu
              sectionLabel={RESULT_SECTION_LABELS.structure}
              actions={sectionActions("structure", structureFindings)}
            />
          </span>
        </summary>
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
                  <th scope="col" className="select-column">
                    Select
                  </th>
                  <th scope="col" className="row-actions-column">
                    Actions
                  </th>
                  <th scope="col">Field path</th>
                  <th scope="col">Issue</th>
                  <th scope="col">Detail</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {structureFindings.map((finding) => (
                  <tr
                    key={finding.id}
                    id={"finding-structure-" + finding.id}
                    tabIndex={-1}
                    className={rowClassName(finding, selectedFindingIds)}
                  >
                    <SelectFindingCell
                      findingId={finding.id}
                      label={`structure ${displayPath(finding.path)}`}
                      selected={selectedFindingIds.has(finding.id)}
                      onSelect={onToggleSelected}
                    />
                    <td className="row-actions-cell">
                      <RowActionMenu
                        label={`Row actions for ${displayPath(finding.path)}`}
                        actions={buildRowActions({
                          finding,
                          ignorePaths,
                          onIgnorePaths,
                          onManageIgnores,
                          onScrollToPanel
                        })}
                      />
                    </td>
                    <td>
                      <FindingPath finding={finding} />
                    </td>
                    <td>
                      <span className="kind-pill type-changed">{structureLabel(finding.kind)}</span>
                    </td>
                    <td>{finding.detail}</td>
                    <td>
                      <FindingReview
                        label={`structure ${displayPath(finding.path)}`}
                        note={notesByFindingId[finding.id]}
                        onChange={(patch) => onNoteChange(finding.id, patch)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>

      <details
        className="result-section"
        data-tour="result-missing"
        open={sections.missing}
        onToggle={(event) => {
          const open = event.currentTarget.open;
          onSectionsChange({ missing: open });
        }}
      >
        <summary>
          <span className="result-section-title">
            <ResultSectionArrow />
            {RESULT_SECTION_LABELS.missing}
          </span>
          <span className="result-section-meta">
            <small>
              {counts.missing.visible} / {counts.missing.total}
              {" · "}
              {selectedMissingCount} selected
            </small>
            <ResultSectionMenu
              sectionLabel={RESULT_SECTION_LABELS.missing}
              actions={sectionActions("missing", missingFindings)}
            />
          </span>
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
                  <th scope="col" className="select-column">
                    Select
                  </th>
                  <th scope="col" className="row-actions-column">
                    Actions
                  </th>
                  <th scope="col">Field path</th>
                  <th scope="col">{SIDE_LABELS.A}</th>
                  <th scope="col">{SIDE_LABELS.B}</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                <MissingFindingGroup
                  label={ONLY_IN_LABELS.A}
                  findings={onlyInA}
                  selectedFindingIds={selectedFindingIds}
                  notesByFindingId={notesByFindingId}
                  ignorePaths={ignorePaths}
                  onToggleSelected={onToggleSelected}
                  onNoteChange={onNoteChange}
                  onIgnorePaths={onIgnorePaths}
                  onManageIgnores={onManageIgnores}
                  onScrollToPanel={onScrollToPanel}
                />
                <MissingFindingGroup
                  label={ONLY_IN_LABELS.B}
                  findings={onlyInB}
                  selectedFindingIds={selectedFindingIds}
                  notesByFindingId={notesByFindingId}
                  ignorePaths={ignorePaths}
                  onToggleSelected={onToggleSelected}
                  onNoteChange={onNoteChange}
                  onIgnorePaths={onIgnorePaths}
                  onManageIgnores={onManageIgnores}
                  onScrollToPanel={onScrollToPanel}
                />
              </tbody>
            </table>
          </div>
        )}
      </details>

      <details
        className="result-section"
        data-tour="result-differences"
        open={sections.differences}
        onToggle={(event) => {
          const open = event.currentTarget.open;
          onSectionsChange({ differences: open });
        }}
      >
        <summary>
          <span className="result-section-title">
            <ResultSectionArrow />
            {RESULT_SECTION_LABELS.differences}
          </span>
          <span className="result-section-meta">
            <small>
              {counts.differences.visible} / {counts.differences.total}
            </small>
            <ResultSectionMenu
              sectionLabel={RESULT_SECTION_LABELS.differences}
              actions={sectionActions(
                "differences",
                differences,
                // Added/removed rows delegate review to Missing Fields, so they
                // expose no report checkbox here.
                (finding) => finding.kind !== "added" && finding.kind !== "removed"
              )}
            />
          </span>
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
                  <th scope="col" className="select-column">
                    Select
                  </th>
                  <th scope="col" className="row-actions-column">
                    Actions
                  </th>
                  <th scope="col">Exact changed path</th>
                  <th scope="col">Change</th>
                  <th scope="col">{SIDE_LABELS.A}</th>
                  <th scope="col">{SIDE_LABELS.B}</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {differences.map((finding) => {
                  const reviewable = finding.kind !== "added" && finding.kind !== "removed";
                  return (
                    <tr
                      key={finding.id}
                      id={"finding-differences-" + finding.id}
                      tabIndex={-1}
                      className={rowClassName(finding, selectedFindingIds)}
                    >
                      {reviewable ? (
                        <SelectFindingCell
                          findingId={finding.id}
                          label={displayPath(finding.path)}
                          selected={selectedFindingIds.has(finding.id)}
                          onSelect={onToggleSelected}
                        />
                      ) : (
                        <td className="select-cell" />
                      )}
                      <td className="row-actions-cell">
                        <RowActionMenu
                          label={`Row actions for ${displayPath(finding.path)}`}
                          actions={buildRowActions({
                            finding,
                            ignorePaths,
                            onIgnorePaths,
                            onManageIgnores,
                            onScrollToPanel
                          })}
                        />
                      </td>
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
                      <td>
                        {reviewable ? (
                          <FindingReview
                            label={displayPath(finding.path)}
                            note={notesByFindingId[finding.id]}
                            onChange={(patch) => onNoteChange(finding.id, patch)}
                          />
                        ) : (
                          <small>Review in Missing Fields</small>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
      <code>{finding.pointer || "(root — empty pointer)"}</code>
      {finding.ignored && <span className="ignored-pill">Ignored</span>}
    </>
  );
}

function MissingFindingGroup({
  label,
  findings,
  selectedFindingIds,
  notesByFindingId,
  ignorePaths,
  onToggleSelected,
  onNoteChange,
  onIgnorePaths,
  onManageIgnores,
  onScrollToPanel
}: {
  label: string;
  findings: Finding[];
  selectedFindingIds: ReadonlySet<string>;
  notesByFindingId: Record<string, ReviewNote>;
  ignorePaths: string[];
  onToggleSelected: (findingId: string) => void;
  onNoteChange: (findingId: string, patch: Partial<ReviewNote>) => void;
  onIgnorePaths: (paths: string[]) => void;
  onManageIgnores: () => void;
  onScrollToPanel: (pointer: string, homeSide: ResponseSide, resolveCounterpart: boolean) => void;
}) {
  if (!findings.length) return null;
  return (
    <>
      <tr className="finding-group">
        <th scope="rowgroup" colSpan={6}>
          {label} <small>{findings.length}</small>
        </th>
      </tr>
      {findings.map((finding) => {
        const note = notesByFindingId[finding.id] ?? { status: "not-reviewed", text: "" };
        return (
          <tr
            key={finding.id}
            id={"finding-missing-" + finding.id}
            tabIndex={-1}
            className={rowClassName(finding, selectedFindingIds)}
          >
            <SelectFindingCell
              findingId={finding.id}
              label={displayPath(finding.path)}
              selected={selectedFindingIds.has(finding.id)}
              onSelect={onToggleSelected}
            />
            <td className="row-actions-cell">
              <RowActionMenu
                label={`Row actions for ${displayPath(finding.path)} (${label})`}
                actions={buildRowActions({
                  finding,
                  ignorePaths,
                  onIgnorePaths,
                  onManageIgnores,
                  onScrollToPanel
                })}
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
              <FindingReview
                label={displayPath(finding.path)}
                note={note}
                onChange={(patch) => onNoteChange(finding.id, patch)}
              />
            </td>
          </tr>
        );
      })}
    </>
  );
}

function SelectFindingCell({
  findingId,
  label,
  selected,
  onSelect
}: {
  findingId: string;
  label: string;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <td className="select-cell">
      <input
        type="checkbox"
        aria-label={`Select ${label}`}
        checked={selected}
        onChange={() => onSelect(findingId)}
      />
    </td>
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
