import type { Finding, StructureFinding } from "@/domain/comparison/types";
import { getIgnoreAction } from "./panel-context";

export type SectionFinding = Finding | StructureFinding;

export interface SectionAction {
  label: string;
  disabled?: boolean;
  onSelect: () => void;
}

export interface SectionActionHandlers {
  onCopyPaths: (pointers: string[], sectionLabel: string) => void;
  onExportSection: () => void;
  onSelectFindings: (findingIds: string[], selected: boolean) => void;
  onIgnorePaths: (paths: string[]) => void;
}

export interface SectionActionOptions {
  sectionLabel: string;
  findings: readonly SectionFinding[];
  selectedFindingIds: ReadonlySet<string>;
  ignorePaths: readonly string[];
  /** Findings the section renders a report checkbox for; defaults to all of them. */
  isSelectable?: (finding: SectionFinding) => boolean;
  handlers: SectionActionHandlers;
}

export interface SectionActionPlan {
  /** Visible pointers in row order, de-duplicated, for clipboard export. */
  pointers: string[];
  /** Findings a report would actually contain; reports exclude ignored findings. */
  actionableCount: number;
  /** Findings in this section that expose a report checkbox. */
  selectableIds: string[];
  allSelected: boolean;
  /** Pointers that are safe to add as exact ignore rules. */
  ignorePointers: string[];
  /** Exact ignore rules covering this section that can be removed again. */
  restorePointers: string[];
}

/**
 * Describe the bulk actions a result section can offer for its currently visible
 * findings. Ignore eligibility reuses {@link getIgnoreAction} so a section menu
 * can never add a rule the per-line panel would refuse.
 */
export function planSectionActions(
  findings: readonly SectionFinding[],
  selectedFindingIds: ReadonlySet<string>,
  ignorePaths: readonly string[],
  isSelectable: (finding: SectionFinding) => boolean = () => true
): SectionActionPlan {
  const pointers = new Set<string>();
  const selectableIds: string[] = [];
  const ignorePointers = new Set<string>();
  const restorePointers = new Set<string>();
  const patterns = [...ignorePaths];
  let actionableCount = 0;

  findings.forEach((finding) => {
    pointers.add(finding.pointer);
    if (!finding.ignored) actionableCount += 1;
    if (isSelectable(finding)) selectableIds.push(finding.id);
    const action = getIgnoreAction(finding.path, finding.pointer, patterns);
    if (action.kind === "ignore") ignorePointers.add(finding.pointer);
    if (action.kind === "restore") restorePointers.add(finding.pointer);
  });

  return {
    pointers: [...pointers],
    actionableCount,
    selectableIds,
    allSelected:
      selectableIds.length > 0 && selectableIds.every((id) => selectedFindingIds.has(id)),
    ignorePointers: [...ignorePointers],
    restorePointers: [...restorePointers]
  };
}

/** Bulk actions offered by one result section's header menu, in menu order. */
export function buildSectionActions({
  sectionLabel,
  findings,
  selectedFindingIds,
  ignorePaths,
  isSelectable,
  handlers
}: SectionActionOptions): SectionAction[] {
  const plan = planSectionActions(findings, selectedFindingIds, ignorePaths, isSelectable);
  // Offer restoring only once nothing in the section can still be ignored.
  const restoring = plan.ignorePointers.length === 0 && plan.restorePointers.length > 0;
  const ignoreCount = restoring ? plan.restorePointers.length : plan.ignorePointers.length;
  return [
    {
      label: `Copy visible paths (${plan.pointers.length})`,
      disabled: plan.pointers.length === 0,
      onSelect: () => handlers.onCopyPaths(plan.pointers, sectionLabel)
    },
    {
      label: "Export this section (.md)",
      disabled: plan.actionableCount === 0,
      onSelect: handlers.onExportSection
    },
    {
      label: plan.allSelected
        ? `Clear selection (${plan.selectableIds.length})`
        : `Select all for report (${plan.selectableIds.length})`,
      disabled: plan.selectableIds.length === 0,
      onSelect: () => handlers.onSelectFindings(plan.selectableIds, !plan.allSelected)
    },
    {
      label: restoring
        ? `Restore ignored paths (${ignoreCount})`
        : `Ignore visible paths (${ignoreCount})`,
      disabled: ignoreCount === 0,
      onSelect: () =>
        handlers.onIgnorePaths(
          restoring
            ? ignorePaths.filter((path) => !plan.restorePointers.includes(path))
            : [...ignorePaths, ...plan.ignorePointers]
        )
    }
  ];
}
