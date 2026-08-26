export type ResponseSide = "A" | "B";
export type HighlightCategory = "missing" | "structure" | "differences" | "invalid";
export type WorkspaceStatus = { tone: "idle" | "error" | "success"; message: string };
export type ReviewNoteStatus = "not-reviewed" | "reviewed" | "needed";
export type ReviewNote = { status: ReviewNoteStatus; text: string };
export type ExportPreviewData = { filename: string; content: string };

/** @deprecated Use WorkspaceStatus. */
export type Status = WorkspaceStatus;
/** @deprecated Use ReviewNoteStatus. */
export type NoteStatus = ReviewNoteStatus;
/** @deprecated Use ReviewNote. */
export type Note = ReviewNote;
