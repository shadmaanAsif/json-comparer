import { SIDE_LABELS } from "../constants";
import { InfoTooltipButton } from "./InfoTooltipButton";

const MISSING_FIELD_DETAIL: Record<"added" | "removed", string> = {
  removed: `This field exists only in ${SIDE_LABELS.A} — it has no counterpart in ${SIDE_LABELS.B}.`,
  added: `This field exists only in ${SIDE_LABELS.B} — it has no counterpart in ${SIDE_LABELS.A}.`
};

/**
 * Replaces the old full-text "Only in Baseline"/"Only in Candidate" pill, which duplicated
 * the group heading directly above every row. The detail still says which side, just on
 * hover/focus instead of by default.
 */
export function MissingFieldBadge({ kind }: { kind: "added" | "removed" }) {
  return (
    <span className="kind-pill missing">
      Missing
      <InfoTooltipButton label="Why this field is missing" detail={MISSING_FIELD_DETAIL[kind]} />
    </span>
  );
}
