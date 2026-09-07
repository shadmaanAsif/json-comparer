"use client";

import { useId } from "react";
import type { ReviewNote, ReviewNoteStatus } from "../types";

const OPTIONS: ReadonlyArray<{ value: ReviewNoteStatus; label: string }> = [
  { value: "not-reviewed", label: "Not reviewed" },
  { value: "reviewed", label: "Reviewed" },
  { value: "needed", label: "Needed" }
];

export function FindingReview({
  label,
  note = { status: "not-reviewed", text: "" },
  onChange
}: {
  label: string;
  note?: ReviewNote;
  onChange: (patch: Partial<ReviewNote>) => void;
}) {
  const id = useId();
  return (
    <div className="note-editor">
      <fieldset className="review-status-group">
        <legend className="visually-hidden">Review status for {label}</legend>
        <div className="review-status-options">
          {OPTIONS.map((option) => (
            <label className="review-status-option" key={option.value}>
              <input
                type="radio"
                name={id}
                value={option.value}
                checked={note.status === option.value}
                onChange={() => onChange({ status: option.value })}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        <span className="visually-hidden">Note for {label}</span>
        <input
          type="text"
          value={note.text}
          onChange={(event) => onChange({ text: event.target.value })}
          placeholder="Add note"
        />
      </label>
    </div>
  );
}
