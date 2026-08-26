"use client";

import type { ExportPreviewData } from "../types";

export interface ExportPreviewProps {
  preview: ExportPreviewData;
  onCopy: () => void;
  onDownload: () => void;
  onClose: () => void;
}

export function ExportPreview({ preview, onCopy, onDownload, onClose }: ExportPreviewProps) {
  return (
    <section className="export-preview" aria-labelledby="export-preview-heading">
      <div className="results-heading">
        <h2 id="export-preview-heading">Export preview — {preview.filename}</h2>
        <div className="export-actions">
          <button className="secondary-button" type="button" onClick={onCopy}>
            Copy
          </button>
          <button className="secondary-button" type="button" onClick={onDownload}>
            Download again
          </button>
          <button className="secondary-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <textarea readOnly value={preview.content} aria-label="Markdown export preview" />
    </section>
  );
}
