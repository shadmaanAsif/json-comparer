"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { displayPath, parseIgnorePatterns } from "@/domain/comparison/path";
import type { ArrayMode, ComparisonOptions, ComparisonResult } from "@/domain/comparison/types";
import { createMarkdownReport } from "@/domain/reporting/markdown";
import type { WorkerRequest, WorkerResponse } from "@/workers/comparison.worker";
import { AddDataModal } from "./components/AddDataModal";
import { ComparisonControls } from "./components/ComparisonControls";
import { ComparisonResults } from "./components/ComparisonResults";
import { ExportPreview } from "./components/ExportPreview";
import { JsonInputPane } from "./components/JsonInputPane";
import { MAX_DOCUMENT_BYTES, SAMPLE_A, SAMPLE_B } from "./constants";
import { fetchRemoteResponse } from "./services/remote-fetch";
import { useSynchronizedEditors } from "./hooks/useSynchronizedEditors";
import type { ExportPreviewData, ResponseSide, ReviewNote, WorkspaceStatus } from "./types";
import { alignValidInputText } from "./utils/display-alignment";
import { downloadMarkdown } from "./utils/download";
import { createLineHighlights } from "./utils/line-highlights";

export function Comparer() {
  const [textA, setTextA] = useState("");
  const [textB, setTextB] = useState("");
  const [arrayMode, setArrayMode] = useState<ArrayMode>("ordered");
  const [ignoreText, setIgnoreText] = useState("");
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [status, setStatus] = useState<WorkspaceStatus>({
    tone: "idle",
    message: "Ready to compare."
  });
  const [busy, setBusy] = useState(false);
  const [pathFilter, setPathFilter] = useState("");
  const [showIgnored, setShowIgnored] = useState(false);
  const [showOnlyA, setShowOnlyA] = useState(true);
  const [showOnlyB, setShowOnlyB] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalSide, setModalSide] = useState<ResponseSide | null>(null);
  const [curlA, setCurlA] = useState<string | null>(null);
  const [curlB, setCurlB] = useState<string | null>(null);
  const [fetchingSide, setFetchingSide] = useState<ResponseSide | null>(null);
  const [notes, setNotes] = useState<Record<string, ReviewNote>>({});
  const [exportPreview, setExportPreview] = useState<ExportPreviewData | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [jsonPanelsExpanded, setJsonPanelsExpanded] = useState(false);
  const [highlightToggles, setHighlightToggles] = useState({
    missing: true,
    structure: true,
    differences: true
  });
  const [expandedSections, setExpandedSections] = useState({
    missing: true,
    structure: false,
    differences: false
  });
  const workerRef = useRef<Worker | null>(null);
  const activeJobRef = useRef<string | null>(null);
  const { registerEditor, synchronizeScroll } = useSynchronizedEditors();
  const allResultsExpanded = Object.values(expandedSections).every(Boolean);
  const toggleAllResultSections = () => {
    const next = !allResultsExpanded;
    setExpandedSections({ missing: next, structure: next, differences: next });
  };
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const options: ComparisonOptions = useMemo(
    () => ({
      arrayMode,
      ignorePatterns: parseIgnorePatterns(ignoreText),
      maxDepth: 256,
      maxFindings: 100_000
    }),
    [arrayMode, ignoreText]
  );

  const updateImportedInput = (side: ResponseSide, raw: string) => {
    const nextA = side === "A" ? raw : textA;
    const nextB = side === "B" ? raw : textB;
    const aligned = alignValidInputText(nextA, nextB);
    setTextA(aligned?.textA ?? nextA);
    setTextB(aligned?.textB ?? nextB);
    setResult(null);
  };

  const updateTypedInput = (side: ResponseSide, raw: string) => {
    if (side === "A") setTextA(raw);
    else setTextB(raw);
    setResult(null);
  };

  const visibleFindings = useMemo(
    () =>
      (result?.findings ?? []).filter((finding) => {
        if (!showIgnored && finding.ignored) return false;
        if (
          pathFilter &&
          !displayPath(finding.path).toLowerCase().includes(pathFilter.toLowerCase())
        )
          return false;
        return true;
      }),
    [pathFilter, result, showIgnored]
  );
  const missingInA = visibleFindings.filter((finding) => finding.kind === "added" && showOnlyB);
  const missingInB = visibleFindings.filter((finding) => finding.kind === "removed" && showOnlyA);
  const modifiedFindings = visibleFindings.filter(
    (finding) => finding.kind === "changed" || finding.kind === "type-changed"
  );
  const differenceFindings = [...missingInA, ...missingInB, ...modifiedFindings];
  const structureFindings = (result?.structure ?? []).filter(
    (finding) =>
      (showIgnored || !finding.ignored) &&
      (!pathFilter || displayPath(finding.path).toLowerCase().includes(pathFilter.toLowerCase()))
  );
  const lineHighlights = useMemo(
    () => createLineHighlights(result, textA, textB, highlightToggles),
    [highlightToggles, result, textA, textB]
  );

  const stopWorker = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    activeJobRef.current = null;
    setBusy(false);
  };

  const runComparison = () => {
    stopWorker();
    const jobId = crypto.randomUUID();
    activeJobRef.current = jobId;
    setBusy(true);
    setStatus({ tone: "idle", message: "Comparing responses…" });
    setSelected(new Set());
    const worker = new Worker(new URL("../../workers/comparison.worker.ts", import.meta.url));
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.jobId !== activeJobRef.current) return;
      setBusy(false);
      worker.terminate();
      workerRef.current = null;
      activeJobRef.current = null;
      if (!event.data.ok) {
        setResult(null);
        setStatus({ tone: "error", message: event.data.error });
        return;
      }
      setTextA(event.data.formattedA);
      setTextB(event.data.formattedB);
      setResult(event.data.result);
      const actionable = event.data.result.findings.length - event.data.result.ignoredCount;
      setStatus({
        tone: "success",
        message: `${actionable} actionable difference${actionable === 1 ? "" : "s"} found in ${event.data.durationMs.toFixed(1)} ms.`
      });
    };
    worker.onerror = () => {
      stopWorker();
      setResult(null);
      setStatus({
        tone: "error",
        message: "The comparison worker stopped unexpectedly. Your inputs are still available."
      });
    };
    worker.postMessage({
      jobId,
      textA,
      textB,
      options,
      maxBytes: MAX_DOCUMENT_BYTES
    } satisfies WorkerRequest);
  };

  const clearWorkspace = () => {
    stopWorker();
    setTextA("");
    setTextB("");
    setResult(null);
    setSelected(new Set());
    setNotes({});
    setCurlA(null);
    setCurlB(null);
    setStatus({ tone: "idle", message: "Workspace cleared." });
  };

  const prettify = (side: ResponseSide) => {
    const raw = side === "A" ? textA : textB;
    if (!raw.trim()) return;
    try {
      const formatted = JSON.stringify(JSON.parse(raw), null, 2);
      if (side === "A") setTextA(formatted);
      else setTextB(formatted);
      setStatus({ tone: "success", message: `Response ${side} prettified.` });
    } catch (error) {
      setStatus({
        tone: "error",
        message: `Response ${side}: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  };

  const loadFileInto = async (side: ResponseSide, file?: File) => {
    if (!file) return;
    if (file.size > MAX_DOCUMENT_BYTES)
      throw new Error(
        `The selected file exceeds the ${MAX_DOCUMENT_BYTES.toLocaleString()} byte limit.`
      );
    const raw = await file.text();
    updateImportedInput(side, raw);
    setStatus({
      tone: "success",
      message: `Loaded ${file.name} into Response ${side}.`
    });
    setModalSide(null);
  };

  const runRemote = async (side: ResponseSide, command: string): Promise<boolean> => {
    setFetchingSide(side);
    setStatus({ tone: "idle", message: `Fetching into Response ${side}…` });
    try {
      const { formattedBody, response } = await fetchRemoteResponse(command);
      updateImportedInput(side, formattedBody);
      if (side === "A") setCurlA(command);
      else setCurlB(command);
      setStatus({
        tone: response.status >= 200 && response.status < 300 ? "success" : "error",
        message:
          response.status >= 200 && response.status < 300
            ? `Fetched ${response.status} ${response.statusText} into Response ${side}.`
            : `Server responded ${response.status} ${response.statusText} — body loaded into Response ${side} anyway.`
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "The secure fetch failed.";
      setStatus({ tone: "error", message: `Fetch failed: ${message}` });
      throw new Error(message);
    } finally {
      setFetchingSide(null);
    }
  };

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportReport = (selectedOnly = false) => {
    if (!result) return;
    const missing = result.findings.filter(
      (finding) => finding.kind === "added" || finding.kind === "removed"
    );
    const findings = selectedOnly ? missing.filter((finding) => selected.has(finding.id)) : missing;
    if (selectedOnly && findings.length === 0) {
      setStatus({
        tone: "error",
        message:
          "No fields selected — check the boxes next to the fields you want to export, then click this again."
      });
      return;
    }
    const filename = selectedOnly
      ? "missing-fields-selected-report.md"
      : "missing-fields-report.md";
    const base = createMarkdownReport(findings, arrayMode);
    const noteLines = findings.flatMap((finding) => {
      const note = notes[finding.id];
      return note
        ? [
            `### Review — ${displayPath(finding.path)}`,
            "",
            `- Status: ${note.status}`,
            `- Note: ${note.text || "None"}`,
            ""
          ]
        : [];
    });
    const content = `${base}${noteLines.length ? `\n## Review Notes\n\n${noteLines.join("\n")}` : ""}`;
    downloadMarkdown(filename, content);
    setExportPreview({ filename, content });
    setStatus({
      tone: "success",
      message: "Markdown report downloaded. Review it before sharing."
    });
  };

  const updateNote = (id: string, patch: Partial<ReviewNote>) =>
    setNotes((current) => ({
      ...current,
      [id]: {
        status: current[id]?.status ?? "not-reviewed",
        text: current[id]?.text ?? "",
        ...patch
      }
    }));

  const loadSample = () => {
    const aligned = alignValidInputText(SAMPLE_A, SAMPLE_B);
    setTextA(aligned?.textA ?? SAMPLE_A);
    setTextB(aligned?.textB ?? SAMPLE_B);
    setResult(null);
    setStatus({
      tone: "idle",
      message: "Sample loaded and aligned. Choose an array mode and compare."
    });
  };

  const cancelComparison = () => {
    stopWorker();
    setStatus({ tone: "idle", message: "Comparison cancelled." });
  };

  const copyExportPreview = () => {
    if (!exportPreview) return;
    void navigator.clipboard
      .writeText(exportPreview.content)
      .then(() => setStatus({ tone: "success", message: "Copied to clipboard." }))
      .catch(() =>
        setStatus({
          tone: "error",
          message:
            "Clipboard access was blocked — select the preview text and press Ctrl/Cmd+C to copy."
        })
      );
  };

  return (
    <main>
      <header className="hero">
        <div>
          <span className="brand-mark" aria-hidden="true">{`{ }`}</span>
          <p className="eyebrow">Developer utility</p>
          <h1>JSON Comparer</h1>
          <p>
            Inspect contract drift without uploading your payloads. Compare fields, values, and
            types directly in your browser.
          </p>
        </div>
        <div className="hero-actions">
          <div className="privacy-badge">
            <span aria-hidden="true">●</span> Local processing
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? "Light" : "Dark"} theme
          </button>
        </div>
      </header>

      <section className="workspace" aria-label="JSON comparison workspace">
        <div className="panel-layout-toolbar">
          <span>JSON response panels</span>
          <button
            className="secondary-button"
            type="button"
            aria-expanded={jsonPanelsExpanded}
            aria-controls="json-input-panels"
            onClick={() => setJsonPanelsExpanded((current) => !current)}
          >
            {jsonPanelsExpanded ? "Collapse panels" : "Expand panels"}
          </button>
        </div>
        <div
          id="json-input-panels"
          className={`input-grid${jsonPanelsExpanded ? " panels-expanded" : ""}`}
          aria-label="JSON response inputs"
        >
          <JsonInputPane
            side="A"
            value={textA}
            onChange={(raw) => updateTypedInput("A", raw)}
            onPaste={(raw) => updateImportedInput("A", raw)}
            onFileLoad={(raw) => updateImportedInput("A", raw)}
            onAdd={() => setModalSide("A")}
            onPrettify={() => prettify("A")}
            curlCommand={curlA}
            onCurlCommandChange={setCurlA}
            onCurlRun={() => void runRemote("A", curlA ?? "").catch(() => undefined)}
            onCurlClose={() => setCurlA(null)}
            isFetching={fetchingSide === "A"}
            lineHighlights={lineHighlights.a}
            registerEditor={registerEditor}
            synchronizeScroll={synchronizeScroll}
          />
          <JsonInputPane
            side="B"
            value={textB}
            onChange={(raw) => updateTypedInput("B", raw)}
            onPaste={(raw) => updateImportedInput("B", raw)}
            onFileLoad={(raw) => updateImportedInput("B", raw)}
            onAdd={() => setModalSide("B")}
            onPrettify={() => prettify("B")}
            curlCommand={curlB}
            onCurlCommandChange={setCurlB}
            onCurlRun={() => void runRemote("B", curlB ?? "").catch(() => undefined)}
            onCurlClose={() => setCurlB(null)}
            isFetching={fetchingSide === "B"}
            lineHighlights={lineHighlights.b}
            registerEditor={registerEditor}
            synchronizeScroll={synchronizeScroll}
          />
        </div>

        <ComparisonControls
          arrayMode={arrayMode}
          ignorePathsText={ignoreText}
          highlightVisibility={highlightToggles}
          isComparing={busy}
          status={status}
          onArrayModeChange={setArrayMode}
          onIgnorePathsTextChange={setIgnoreText}
          onApplyIgnorePaths={runComparison}
          onHighlightVisibilityChange={setHighlightToggles}
          onCompare={runComparison}
          onCancel={cancelComparison}
          onLoadSample={loadSample}
          onClear={clearWorkspace}
        />
      </section>

      {result && (
        <ComparisonResults
          result={result}
          visibleFindingCount={visibleFindings.length}
          missingInA={missingInA}
          missingInB={missingInB}
          differences={differenceFindings}
          structureFindings={structureFindings}
          selectedFindingIds={selected}
          notesByFindingId={notes}
          filters={{ path: pathFilter, showOnlyA, showOnlyB, showIgnored }}
          sections={expandedSections}
          onFiltersChange={(patch) => {
            if (patch.path !== undefined) setPathFilter(patch.path);
            if (patch.showOnlyA !== undefined) setShowOnlyA(patch.showOnlyA);
            if (patch.showOnlyB !== undefined) setShowOnlyB(patch.showOnlyB);
            if (patch.showIgnored !== undefined) setShowIgnored(patch.showIgnored);
          }}
          onSectionsChange={(patch) => setExpandedSections((current) => ({ ...current, ...patch }))}
          onToggleAllSections={toggleAllResultSections}
          onExport={exportReport}
          onToggleSelected={toggleSelected}
          onNoteChange={updateNote}
        />
      )}

      {exportPreview && (
        <ExportPreview
          preview={exportPreview}
          onCopy={copyExportPreview}
          onDownload={() => downloadMarkdown(exportPreview.filename, exportPreview.content)}
          onClose={() => setExportPreview(null)}
        />
      )}

      {modalSide && (
        <AddDataModal
          side={modalSide}
          initialCommand={(modalSide === "A" ? curlA : curlB) ?? ""}
          busy={fetchingSide === modalSide}
          onClose={() => setModalSide(null)}
          onFile={(file) => loadFileInto(modalSide, file)}
          onFetch={(command) => runRemote(modalSide, command)}
        />
      )}

      <footer>
        <p>
          Remote URL and cURL import uses the server&apos;s HTTPS allowlist and SSRF protection.
          Credentials are stripped unless explicitly enabled by the administrator.
        </p>
      </footer>
      {showScrollTop && (
        <button
          className="scroll-top"
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          Back to top
        </button>
      )}
    </main>
  );
}
