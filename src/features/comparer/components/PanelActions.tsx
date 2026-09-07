"use client";

import { useRef, useState } from "react";
import { displayPath } from "@/domain/comparison/path";
import type { PanelActionRequest, ReviewFinding } from "../hooks/usePanelInteractions";
import { useAnchoredPanelDialog } from "../hooks/useAnchoredPanelDialog";
import type { ResponseSide, ReviewNote } from "../types";
import { getIgnoreAction, type PanelField } from "../utils/panel-context";
import { FindingReview } from "./FindingReview";
import { PanelDifferenceContext } from "./PanelDifferenceContext";

export interface PanelActionsProps {
  request: PanelActionRequest & { side: ResponseSide };
  valueText: string | null;
  counterpart?: PanelField;
  parent?: PanelField;
  findings: ReviewFinding[];
  ignorePaths: string[];
  selected: ReadonlySet<string>;
  notes: Record<string, ReviewNote>;
  onClose: () => void;
  onIgnore: (paths: string[]) => void;
  onManageIgnores: () => void;
  onJump: () => void;
  onReveal: (finding: ReviewFinding) => void;
  onFilter: () => void;
  onSelect: (id: string) => void;
  onNote: (id: string, patch: Partial<ReviewNote>) => void;
}

export function PanelActions({
  request,
  valueText,
  counterpart,
  parent,
  findings,
  ignorePaths,
  selected,
  notes,
  onClose,
  onIgnore,
  onManageIgnores,
  onJump,
  onReveal,
  onFilter,
  onSelect,
  onNote
}: PanelActionsProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [findingId, setFindingId] = useState(findings[0]?.id ?? "");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const finding = findings.find((item) => item.id === findingId) ?? findings[0];
  const isTree = request.view === "tree";
  const foldBranch = isTree && !!request.field.hasChildren && !!request.onToggleBranch;
  const foldExpanded = foldBranch ? request.branchExpanded : request.parentExpanded;
  const ignore = getIgnoreAction(request.field.segments, request.field.pointer, ignorePaths);
  const close = () => {
    dialogRef.current?.close();
    onClose();
  };
  const leave = (action: () => void) => {
    close();
    action();
  };
  useAnchoredPanelDialog(dialogRef, request, onClose);
  const copy = async (text: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setMessage("Copied to clipboard.");
      setCopyFallback(null);
    } catch {
      setMessage("Clipboard access was blocked. Select the text below and press Ctrl/Cmd+C.");
      setCopyFallback(text);
    }
  };
  return (
    <dialog
      ref={dialogRef}
      className="panel-actions-dialog"
      aria-labelledby="panel-actions-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="panel-actions-content">
        <header className="panel-actions-heading">
          <div>
            <h2 id="panel-actions-title">
              {isTree ? "Field" : "Line"} actions · Response {request.side}
            </h2>
            <code>{request.field.pointer || "(root — empty JSON Pointer)"}</code>
            <small>
              {isTree ? "JSON line " : "Line "}
              {request.field.line}
              {request.field.placeholder ? " · absent on this side" : ""}
            </small>
          </div>
          <button
            type="button"
            className="text-button"
            aria-label={`Close ${isTree ? "field" : "line"} actions`}
            onClick={close}
          >
            ×
          </button>
        </header>
        <PanelDifferenceContext
          pointer={request.field.pointer}
          findings={findings}
          finding={finding}
          subject={isTree ? "field" : "line"}
          onChange={(id) => {
            setFindingId(id);
            setReviewOpen(false);
          }}
        />
        <section aria-labelledby="panel-actions-list-title">
          <h3 id="panel-actions-list-title" className="panel-actions-section-title">
            Actions
          </h3>
          <div className="panel-copy-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void copy(request.field.pointer)}
            >
              Copy path
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={valueText === null}
              onClick={() => valueText !== null && void copy(valueText)}
            >
              Copy value
            </button>
          </div>
          <button
            type="button"
            className="panel-action"
            disabled={ignore.kind === "unsupported"}
            onClick={() =>
              leave(() => {
                if (ignore.kind === "manage") onManageIgnores();
                else
                  onIgnore(
                    ignore.kind === "restore"
                      ? ignorePaths.filter((path) => path !== request.field.pointer)
                      : [...ignorePaths, request.field.pointer]
                  );
              })
            }
          >
            {ignore.kind === "restore"
              ? "Restore path"
              : ignore.kind === "manage"
                ? "Review matching ignore rules"
                : "Ignore path"}
          </button>
          {ignore.kind === "manage" && (
            <p className="panel-action-help">
              Covered by {ignore.matching.join(", ")}. Broader rules will not be removed
              automatically.
            </p>
          )}
          {ignore.kind === "unsupported" && (
            <p className="panel-action-help">
              This path cannot be safely added as an exact ignore rule. Use Ignore Paths to choose a
              broader rule.
            </p>
          )}
          <button
            type="button"
            className="panel-action"
            onClick={() => leave(() => (finding ? onReveal(finding) : onFilter()))}
          >
            {finding ? "Show difference in results" : "Show differences under this path"}
          </button>
          <button
            type="button"
            className="panel-action"
            disabled={!counterpart}
            onClick={() => leave(onJump)}
          >
            {counterpart?.placeholder
              ? "Show missing field location"
              : "Jump to corresponding field"}
          </button>
          {!counterpart && (
            <p className="panel-action-help">
              No safe counterpart mapping. Unordered array records are not paired by identity.
            </p>
          )}
          {counterpart?.placeholder && (
            <p className="panel-action-help">
              Not present in Response {request.side === "A" ? "B" : "A"}. Shows its JSON gap or
              nearest existing Tree parent.
            </p>
          )}
          <button
            type="button"
            className="panel-action"
            disabled={foldBranch ? false : !parent?.hasChildren}
            onClick={() => leave(foldBranch ? request.onToggleBranch! : request.onToggleParent)}
          >
            {foldExpanded ? "Collapse" : "Expand"}{" "}
            {foldBranch ? "this branch" : isTree ? "parent" : "parent in Tree"}
          </button>
          <div className="panel-action-group">
            <button
              type="button"
              className="panel-action"
              disabled={!finding}
              onClick={() => {
                if (!finding) return;
                onNote(finding.id, { status: "needed" });
                setReviewOpen(true);
                setMessage("Marked as Needed.");
              }}
            >
              Mark for review
            </button>
            <button
              type="button"
              className="panel-action"
              disabled={!finding}
              onClick={() => setReviewOpen(true)}
            >
              Add a note
            </button>
            {reviewOpen && finding && (
              <FindingReview
                label={"panel " + displayPath(finding.path)}
                note={notes[finding.id]}
                onChange={(patch) => onNote(finding.id, patch)}
              />
            )}
          </div>
          <details className="panel-action-more">
            <summary>More actions</summary>
            <button type="button" className="panel-action" onClick={() => leave(onFilter)}>
              Filter results to this path
            </button>
            <button
              type="button"
              className="panel-action"
              disabled={!finding}
              onClick={() => {
                if (finding) {
                  onSelect(finding.id);
                  setMessage(
                    selected.has(finding.id)
                      ? "Removed from report selection."
                      : "Selected for report."
                  );
                }
              }}
            >
              {finding && selected.has(finding.id)
                ? "Remove from report selection"
                : "Select for report"}
            </button>
          </details>
        </section>
        <p className="panel-action-help" role="status">
          {message}
        </p>
        {copyFallback !== null && (
          <label className="panel-copy-fallback">
            Copy text
            <textarea
              readOnly
              value={copyFallback}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
        )}
      </div>
    </dialog>
  );
}
