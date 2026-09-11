export type ResponseSide = "A" | "B";
export type HighlightCategory = "missing" | "structure" | "differences" | "invalid";
/** One rendered line/field's highlight: its category, and whether it's an ignored finding
 *  shown only because "Show ignored" is on — rendered dimmed rather than at full strength. */
export type LineHighlight = { category: HighlightCategory; ignored: boolean };
export type WorkspaceStatus = {
  tone: "idle" | "error" | "success";
  message: string;
  source?: "comparison";
};
export type ReviewNoteStatus = "not-reviewed" | "reviewed" | "needed";
export type ReviewNote = { status: ReviewNoteStatus; text: string };
export type ExportPreviewData = { filename: string; content: string };
/** The three result disclosures, in the order they are presented. */
export type ResultSectionKey = "structure" | "missing" | "differences";

/** @deprecated Use WorkspaceStatus. */
export type Status = WorkspaceStatus;
/** @deprecated Use ReviewNoteStatus. */
export type NoteStatus = ReviewNoteStatus;
/** @deprecated Use ReviewNote. */
export type Note = ReviewNote;
