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
 * The side a finding's pointer is actually populated on, and whether the opposite side has a
 * well-defined counterpart worth resolving. Structure findings scoped entirely to Baseline
 * ("inconsistent-in-a", "a-empty-array") describe no relationship to Candidate's content, so
 * scrolling only highlights the home side rather than guessing at an unrelated Candidate field.
 */
function homeSideFor(finding: SectionFinding): { side: ResponseSide; resolveCounterpart: boolean } {
  if (finding.kind === "added" || finding.kind === "extra-in-b")
    return { side: "B", resolveCounterpart: true };
  if (finding.kind === "removed" || finding.kind === "missing-in-b")
    return { side: "A", resolveCounterpart: true };
  return { side: "A", resolveCounterpart: false };
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
