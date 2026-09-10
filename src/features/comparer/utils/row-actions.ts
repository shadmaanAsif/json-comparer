import type { ResponseSide } from "../types";
import { getIgnoreAction } from "./panel-context";
import type { ResultMenuAction, SectionFinding } from "./section-actions";

export interface RowActionOptions {
  finding: SectionFinding;
  ignorePaths: readonly string[];
  onIgnorePaths: (paths: string[]) => void;
  onManageIgnores: () => void;
  onScrollToPanel: (pointer: string, homeSide: ResponseSide, resolveCounterpart: boolean) => void;
}

/**
 * The side a finding's pointer is reliably resolvable on, and whether the opposite side has a
 * well-defined counterpart worth resolving.
 *
 * Value-level findings (added/removed/changed/type-changed) come from the engine's own
 * per-index or matched-item array alignment, so their pointer is always real on the side named
 * below. Structure findings are different: "extra-in-b" and "missing-in-b" both come from
 * comparing Baseline's single canonical schema item (index 0) against *every* Candidate item by
 * Candidate's own index — that index is only guaranteed to exist on Candidate (job.valueB's own
 * length), never on Baseline, which may be shorter, longer, or simply different at that same
 * index. Baseline-only structure findings ("inconsistent-in-a", "a-empty-array") are the mirror
 * case: their index comes from Baseline's own array, so Baseline is reliable and there is no
 * defined Candidate relationship to resolve at all.
 */
function homeSideFor(finding: SectionFinding): { side: ResponseSide; resolveCounterpart: boolean } {
  switch (finding.kind) {
    case "added":
    case "extra-in-b":
    case "missing-in-b":
      return { side: "B", resolveCounterpart: true };
    case "removed":
    case "changed":
    case "type-changed":
      return { side: "A", resolveCounterpart: true };
    default:
      return { side: "A", resolveCounterpart: false };
  }
}

/**
 * Per-row actions for one finding, reusing the same ignore eligibility PanelActions already
 * applies to per-line panel actions, so a row menu can never add a rule the panel would refuse.
 */
export function buildRowActions({
  finding,
  ignorePaths,
  onIgnorePaths,
  onManageIgnores,
  onScrollToPanel
}: RowActionOptions): ResultMenuAction[] {
  const { path, pointer } = finding;
  const ignore = getIgnoreAction(path, pointer, [...ignorePaths]);
  const home = homeSideFor(finding);
  return [
    {
      label:
        ignore.kind === "restore"
          ? "Restore ignore path"
          : ignore.kind === "manage"
            ? "Review matching ignore rules"
            : "Add to ignore path",
      disabled: ignore.kind === "unsupported",
      onSelect: () => {
        if (ignore.kind === "manage") onManageIgnores();
        else
          onIgnorePaths(
            ignore.kind === "restore"
              ? ignorePaths.filter((existing) => existing !== pointer)
              : [...ignorePaths, pointer]
          );
      }
    },
    {
      label: "Scroll to panel",
      onSelect: () => onScrollToPanel(pointer, home.side, home.resolveCounterpart)
    }
  ];
}
