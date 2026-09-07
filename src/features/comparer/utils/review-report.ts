import { createMarkdownReport } from "@/domain/reporting/markdown";
import { displayPath } from "@/domain/comparison/path";
import type { ArrayMode, Finding, StructureFinding } from "@/domain/comparison/types";
import type { ReviewNote } from "../types";

export function createReviewReport(
  findings: (Finding | StructureFinding)[],
  arrayMode: ArrayMode,
  notes: Record<string, ReviewNote>
) {
  const noteLines = findings
    .filter((finding) => !finding.ignored)
    .flatMap((finding) => {
      const note = notes[finding.id];
      return note
        ? [
            "### Review — " + displayPath(finding.path),
            "",
            "- Status: " + note.status,
            "- Note: " + (note.text || "None"),
            ""
          ]
        : [];
    });
  return (
    createMarkdownReport(findings, arrayMode) +
    (noteLines.length ? "\n## Review Notes\n\n" + noteLines.join("\n") : "")
  );
}
