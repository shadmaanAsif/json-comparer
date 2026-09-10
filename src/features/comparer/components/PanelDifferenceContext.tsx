"use client";

import { useEffect, useId, useRef, useState } from "react";
import { displayPath } from "@/domain/comparison/path";
import type { ReviewFinding } from "../hooks/usePanelInteractions";

const differenceLabels: Record<ReviewFinding["kind"], string> = {
  added: "Added in Candidate",
  removed: "Removed from Candidate",
  changed: "Value changed",
  "type-changed": "Value type changed",
  "missing-in-b": "Structure: field missing from Candidate",
  "extra-in-b": "Structure: extra field in Candidate",
  "inconsistent-in-a": "Structure: inconsistent in Baseline",
  "a-empty-array": "Structure: empty reference array in Baseline"
};

interface PanelDifferenceContextProps {
  pointer: string;
  findings: ReviewFinding[];
  finding?: ReviewFinding;
  onChange: (id: string) => void;
  subject?: "line" | "field";
}

export function PanelDifferenceContext({
  pointer,
  findings,
  finding,
  onChange,
  subject = "line"
}: PanelDifferenceContextProps) {
  const id = useId();
  const infoRef = useRef<HTMLButtonElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    if (!helpOpen) return;
    const dialog = infoRef.current?.closest("dialog");
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setHelpOpen(false);
    };
    // Hover does not move focus, so Escape must also work from elsewhere in the dialog.
    dialog?.addEventListener("keydown", dismiss);
    return () => dialog?.removeEventListener("keydown", dismiss);
  }, [helpOpen]);
  const title = findings.length > 1 ? "Difference to act on" : `Difference for this ${subject}`;
  const explanation = !finding
    ? "No directly linked difference. Review, notes and report selection need a specific difference."
    : findings.length > 1
      ? `This ${subject} has multiple differences. Choose which one to open in results, mark for review, add notes to, or select for your report.`
      : "Review, notes and report selection apply to this difference.";
  const parentExplanation =
    finding && finding.pointer !== pointer
      ? `This ${subject} is part of the change at ${displayPath(finding.path)}. Review, notes and report selection apply to that whole change.`
      : "";
  const helpText = [explanation, parentExplanation].filter(Boolean).join(" ");

  return (
    <div
      className="panel-difference-context"
      role="group"
      aria-labelledby={id + "-title"}
      onMouseLeave={() => {
        if (document.activeElement !== infoRef.current) setHelpOpen(false);
      }}
    >
      <div className="panel-difference-heading">
        <h3 id={id + "-title"}>{title}</h3>
        <button
          ref={infoRef}
          type="button"
          className="panel-difference-info"
          aria-label="About this difference"
          aria-describedby={id + "-help"}
          title={helpOpen ? undefined : helpText}
          onMouseEnter={() => setHelpOpen(true)}
          onFocus={() => setHelpOpen(true)}
          onBlur={() => setHelpOpen(false)}
          onClick={() => setHelpOpen(true)}
        >
          <span aria-hidden="true">i</span>
        </button>
      </div>
      <div id={id + "-help"} role="tooltip" className="panel-difference-tooltip" hidden={!helpOpen}>
        <p>{explanation}</p>
        {parentExplanation && <p>{parentExplanation}</p>}
      </div>
      {findings.length > 1 ? (
        <select
          className="panel-finding-choice"
          aria-labelledby={id + "-title"}
          aria-describedby={id + "-help"}
          value={finding?.id}
          onChange={(event) => onChange(event.target.value)}
        >
          {findings.map((item) => (
            <option key={item.id} value={item.id}>
              {differenceLabels[item.kind]} · {displayPath(item.path)}
            </option>
          ))}
        </select>
      ) : (
        <p className="panel-difference-summary">
          {finding
            ? `${differenceLabels[finding.kind]} · ${displayPath(finding.path)}`
            : "No linked difference"}
        </p>
      )}
    </div>
  );
}
