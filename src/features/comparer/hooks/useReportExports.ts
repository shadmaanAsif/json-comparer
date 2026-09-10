"use client";

import { useState } from "react";
import type {
  ArrayMode,
  ComparisonResult,
  Finding,
  StructureFinding
} from "@/domain/comparison/types";
import { RESULT_SECTION_LABELS, RESULT_SECTION_REPORT_NAMES } from "../constants";
import type { ExportPreviewData, ResultSectionKey, ReviewNote, WorkspaceStatus } from "../types";
import { copyText } from "../utils/clipboard";
import { downloadMarkdown } from "../utils/download";
import {
  selectSectionFindings,
  type ComparisonResultProjection
} from "../utils/result-projections";
import { createReviewReport } from "../utils/review-report";

export interface ReportExportOptions {
  result: ComparisonResult | null;
  projection: ComparisonResultProjection | null;
  arrayMode: ArrayMode;
  notes: Record<string, ReviewNote>;
  selected: ReadonlySet<string>;
  onStatus: (status: WorkspaceStatus) => void;
}

/**
 * Own the Markdown report lifecycle: build a report, download it, keep the
 * in-page preview, and report each outcome. Reports always exclude ignored
 * findings, so every entry point checks for actionable findings first.
 */
export function useReportExports({
  result,
  projection,
  arrayMode,
  notes,
  selected,
  onStatus
}: ReportExportOptions) {
  const [preview, setPreview] = useState<ExportPreviewData | null>(null);

  const publish = (filename: string, findings: (Finding | StructureFinding)[], message: string) => {
    const content = createReviewReport(findings, arrayMode, notes);
    downloadMarkdown(filename, content);
    setPreview({ filename, content });
    onStatus({ tone: "success", message });
  };

  const exportReport = (selectedOnly = false) => {
    if (!result) return;
    const findings = selectedOnly
      ? [...result.findings, ...result.structure].filter((finding) => selected.has(finding.id))
      : result.findings.filter((finding) => finding.kind === "added" || finding.kind === "removed");
    if (selectedOnly && !findings.some((finding) => !finding.ignored)) {
      onStatus({
        tone: "error",
        message:
          "No actionable findings selected. Select a finding for the report; ignored findings are excluded."
      });
      return;
    }
    publish(
      selectedOnly ? "selected-findings-report.md" : "missing-fields-report.md",
      findings,
      "Markdown report downloaded. Review it before sharing."
    );
  };

  const exportSection = (section: ResultSectionKey) => {
    if (!projection) return;
    const findings = selectSectionFindings(section, projection);
    if (!findings.some((finding) => !finding.ignored)) {
      onStatus({
        tone: "error",
        message: `No actionable findings visible in ${RESULT_SECTION_LABELS[section]}. Ignored findings are excluded from reports.`
      });
      return;
    }
    publish(
      RESULT_SECTION_REPORT_NAMES[section],
      findings,
      `Exported the visible ${RESULT_SECTION_LABELS[section]} findings. Review the report before sharing.`
    );
  };

  const copy = (text: string, copied: string, blocked: string) => {
    void copyText(text).then((outcome) =>
      onStatus(
        outcome === "copied"
          ? { tone: "success", message: copied }
          : { tone: "error", message: blocked }
      )
    );
  };

  const copyPreview = () => {
    if (!preview) return;
    copy(
      preview.content,
      "Copied to clipboard.",
      "Clipboard access was blocked — select the preview text and press Ctrl/Cmd+C to copy."
    );
  };

  const copyPaths = (pointers: string[], sectionLabel: string) =>
    copy(
      pointers.join("\n"),
      `Copied ${pointers.length} ${sectionLabel} path${pointers.length === 1 ? "" : "s"} to the clipboard.`,
      "Clipboard access was blocked — open the section and copy the paths from the rows instead."
    );

  return {
    preview,
    exportReport,
    exportSection,
    copyPreview,
    copyPaths,
    downloadPreview: () => {
      if (preview) downloadMarkdown(preview.filename, preview.content);
    },
    clearPreview: () => setPreview(null)
  };
}
