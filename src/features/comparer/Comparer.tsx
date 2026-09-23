"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AlignedDisplayText } from "@/domain/comparison/display-format";
import { displayPath } from "@/domain/comparison/path";
import type { ArrayMode, ComparisonOptions, ComparisonResult } from "@/domain/comparison/types";
import { PanelActions } from "./components/PanelActions";
import { usePanelInteractions, type ReviewFinding } from "./hooks/usePanelInteractions";
import type { WorkerRequest, WorkerResponse } from "@/workers/comparison.worker";
import { AddDataModal } from "./components/AddDataModal";
import { ComparisonControls } from "./components/ComparisonControls";
import { ComparisonResults } from "./components/ComparisonResults";
import { ExportPreview } from "./components/ExportPreview";
import { WorkspaceFindingNav } from "./components/FindingNavigation";
import { HighlightControls } from "./components/HighlightControls";
import { JsonInputPane } from "./components/JsonInputPane";
import { OnboardingTour } from "./components/OnboardingTour";
import {
  APP_AUTHOR,
  LIVE_COMPARE_DEBOUNCE_MS,
  MAX_DOCUMENT_BYTES,
  SAMPLE_A,
  SAMPLE_B,
  SIDE_LABELS,
  TOUR_DEMO_A,
  TOUR_DEMO_B
} from "./constants";
import { fetchRemoteResponse } from "./services/remote-fetch";
import { useReportExports } from "./hooks/useReportExports";
import { useSynchronizedEditors } from "./hooks/useSynchronizedEditors";
import type { ResponseSide, ReviewNote, WorkspaceStatus } from "./types";
import { alignValidInputText } from "./utils/display-alignment";
import { createLineHighlights } from "./utils/line-highlights";
import { formatComparisonOutcome, projectComparisonResult } from "./utils/result-projections";

interface ComparerProps {
  author?: string;
}

export function Comparer({ author = APP_AUTHOR }: ComparerProps) {
  // const displayAuthor = author.trim();
  // const authorInitials = displayAuthor
  //   .split(/\s+/)
  //   .slice(0, 2)
  //   .map((name) => name.charAt(0))
  //   .join("")
  //   .toUpperCase();
  const [textA, setTextA] = useState("");
  const [textB, setTextB] = useState("");
  const [arrayMode, setArrayMode] = useState<ArrayMode>("ordered");
  const [ignorePaths, setIgnorePaths] = useState<string[]>([]);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [displayLineMaps, setDisplayLineMaps] = useState<AlignedDisplayText | null>(null);
  const [comparisonDurationMs, setComparisonDurationMs] = useState<number | null>(null);
  const [status, setStatus] = useState<WorkspaceStatus>({
    tone: "idle",
    message: "Ready to compare."
  });
  const [busy, setBusy] = useState(false);
  const [pathFilter, setPathFilter] = useState("");
  const [showIgnored, setShowIgnored] = useState(true);
  const [showOnlyInA, setShowOnlyInA] = useState(true);
  const [showOnlyInB, setShowOnlyInB] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalSide, setModalSide] = useState<ResponseSide | null>(null);
  const [curlA, setCurlA] = useState<string | null>(null);
  const [curlB, setCurlB] = useState<string | null>(null);
  const [fetchingSide, setFetchingSide] = useState<ResponseSide | null>(null);
  const [notes, setNotes] = useState<Record<string, ReviewNote>>({});
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [jsonPanelsExpanded, setJsonPanelsExpanded] = useState(true);
  // JSON/Tree view is shared so both panels always show the same mode (switching one switches both).
  const [panelView, setPanelView] = useState<"json" | "tree">("json");
  const [highlightToggles, setHighlightToggles] = useState({
    missing: true,
    structure: true,
    differences: true
  });
  // Hidden until a comparison has actually run, so the legend never explains highlights that
  // aren't on screen yet. Stays visible through live re-compares and errors once shown; only
  // Clear all hides it again.
  const [highlightControlsVisible, setHighlightControlsVisible] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    missing: true,
    structure: true,
    differences: true
  });
  const workerRef = useRef<Worker | null>(null);
  const activeJobRef = useRef<string | null>(null);
  useEffect(
    () => () => {
      workerRef.current?.terminate();
      activeJobRef.current = null;
    },
    []
  );
  // Mirrors textA/textB after every commit so an in-flight worker's onmessage (a stale closure)
  // can tell whether the user has typed more since this job was sent — see runComparison.
  const latestTextRef = useRef({ a: textA, b: textB });
  useEffect(() => {
    latestTextRef.current = { a: textA, b: textB };
  }, [textA, textB]);
  const { registerEditor, synchronizeScroll } = useSynchronizedEditors();
  const panels = usePanelInteractions({
    textA,
    textB,
    lineMaps: displayLineMaps,
    result,
    arrayMode,
    enabled: !busy
  });
  // The current line, mirrored onto the aligned panel at the same line number. Owned here
  // (not inside either panel) since it's the one piece of state both panels need to read.
  // Stable callback identities (empty deps) matter: JsonInputPane re-reports on every change
  // to this prop, so an unstable callback here would re-trigger itself every render.
  const [activeLine, setActiveLine] = useState<{ side: ResponseSide; line: number } | null>(null);
  const onActiveLineChangeA = useCallback((line: number | null) => {
    setActiveLine((current) => {
      if (line === null) return current?.side === "A" ? null : current;
      if (current?.side === "A" && current.line === line) return current;
      return { side: "A", line };
    });
  }, []);
  const onActiveLineChangeB = useCallback((line: number | null) => {
    setActiveLine((current) => {
      if (line === null) return current?.side === "B" ? null : current;
      if (current?.side === "B" && current.line === line) return current;
      return { side: "B", line };
    });
  }, []);
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
      ignorePatterns: ignorePaths,
      maxDepth: 256,
      maxFindings: 100_000
    }),
    [arrayMode, ignorePaths]
  );

  const updateImportedInput = (side: ResponseSide, raw: string) => {
    const nextA = side === "A" ? raw : textA;
    const nextB = side === "B" ? raw : textB;
    const aligned = alignValidInputText(nextA, nextB);
    setTextA(aligned?.textA ?? nextA);
    setTextB(aligned?.textB ?? nextB);
    invalidateComparison();
  };

  // Once a comparison has run, further typing re-compares live after a short pause instead of
  // requiring another manual click — isActivelyComparing survives a transient parse error mid-edit
  // (which nulls `result`) so live retries keep working while the user finishes typing valid JSON.
  const [isActivelyComparing, setIsActivelyComparing] = useState(false);
  const liveCompareTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (liveCompareTimerRef.current !== null) window.clearTimeout(liveCompareTimerRef.current);
    },
    []
  );

  const updateTypedInput = (side: ResponseSide, raw: string) => {
    const nextTextA = side === "A" ? raw : textA;
    const nextTextB = side === "B" ? raw : textB;
    if (side === "A") setTextA(raw);
    else setTextB(raw);
    if (!isActivelyComparing) {
      invalidateComparison();
      return;
    }
    if (liveCompareTimerRef.current !== null) window.clearTimeout(liveCompareTimerRef.current);
    liveCompareTimerRef.current = window.setTimeout(() => {
      liveCompareTimerRef.current = null;
      runComparison(undefined, nextTextA, nextTextB);
    }, LIVE_COMPARE_DEBOUNCE_MS);
  };

  const resultProjection = useMemo(
    () =>
      result
        ? projectComparisonResult(result, {
            path: pathFilter,
            showOnlyInA,
            showOnlyInB,
            showIgnored
          })
        : null,
    [pathFilter, result, showIgnored, showOnlyInA, showOnlyInB]
  );
  const ignorePathSuggestions = useMemo(
    () =>
      [...new Set((result?.findings ?? []).map((finding) => displayPath(finding.path)))].filter(
        (path) => path !== "(root)"
      ),
    [result]
  );
  const lineHighlights = useMemo(
    () => createLineHighlights(resultProjection, textA, textB, highlightToggles, displayLineMaps),
    [displayLineMaps, highlightToggles, resultProjection, textA, textB]
  );
  // One finding navigator shared by both panels. The panels are line-aligned, so a single
  // ordered list of every highlighted line across both sides drives navigation for both.
  const findingLines = useMemo(() => {
    const lines = new Set<number>();
    for (const key of Object.keys(lineHighlights.a)) lines.add(Number(key));
    for (const key of Object.keys(lineHighlights.b)) lines.add(Number(key));
    return [...lines].sort((first, second) => first - second);
  }, [lineHighlights]);
  const findingCategories = useMemo(() => {
    const present = new Set<string>();
    for (const highlight of Object.values(lineHighlights.a)) present.add(highlight.category);
    for (const highlight of Object.values(lineHighlights.b)) present.add(highlight.category);
    return (["missing", "structure", "differences", "invalid"] as const).filter((category) =>
      present.has(category)
    );
  }, [lineHighlights]);
  const [findingCursor, setFindingCursor] = useState(0);
  // Reset the cursor when the finding list itself changes, adjusted during render (React's
  // documented alternative to an effect) rather than after a commit, avoiding an extra render.
  const [findingLinesForCursor, setFindingLinesForCursor] = useState(findingLines);
  if (findingLines !== findingLinesForCursor) {
    setFindingLinesForCursor(findingLines);
    setFindingCursor(0);
  }
  const stepFinding = (direction: 1 | -1) => {
    if (!findingLines.length) return;
    const nextCursor = (findingCursor + direction + findingLines.length) % findingLines.length;
    setFindingCursor(nextCursor);
    const line = findingLines[nextCursor]!;
    const pointerA = panels.indexes?.A?.byLine.get(line)?.pointer;
    const pointerB = panels.indexes?.B?.byLine.get(line)?.pointer;
    if (pointerA !== undefined) panels.navigate("A", pointerA);
    if (pointerB !== undefined) panels.navigate("B", pointerB);
  };
  // A panel's own offscreen-finding chip or minimap marker (JsonInputPane's jumpToLine) can
  // move the editors without going through stepFinding, leaving findingCursor stuck at its old
  // index — the next Previous/Next click would then jump from that stale position instead of
  // from the line the user is actually looking at. Re-sync whenever such a jump lands on a line
  // stepFinding also knows about.
  const onFindingLineJump = (line: number) => {
    const index = findingLines.indexOf(line);
    if (index !== -1) setFindingCursor(index);
  };
  const scrollToComparisonOutput = () =>
    document
      .getElementById("comparison-output")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollToHighlightControls = () => {
    const target = document.getElementById("workspace-highlight-controls");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    target?.focus({ preventScroll: true });
  };
  const displayedStatus = useMemo<WorkspaceStatus>(
    () =>
      status.source === "comparison" && resultProjection && comparisonDurationMs !== null
        ? {
            tone: "success",
            source: "comparison",
            message: formatComparisonOutcome(
              resultProjection.counts.differences,
              resultProjection.counts.ignored,
              comparisonDurationMs
            )
          }
        : status,
    [comparisonDurationMs, resultProjection, status]
  );
  const reports = useReportExports({
    result,
    projection: resultProjection,
    arrayMode,
    notes,
    selected,
    onStatus: setStatus
  });

  const stopWorker = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    activeJobRef.current = null;
    setBusy(false);
  };

  const invalidateComparison = () => {
    stopWorker();
    if (liveCompareTimerRef.current !== null) {
      window.clearTimeout(liveCompareTimerRef.current);
      liveCompareTimerRef.current = null;
    }
    setIsActivelyComparing(false);
    setResult(null);
    setDisplayLineMaps(null);
    setComparisonDurationMs(null);
    setSelected(new Set());
    setNotes({});
    reports.clearPreview();
    panels.closeActions();
    setStatus({ tone: "idle", message: "Inputs changed. Compare again to enable line actions." });
  };

  const runComparison = (
    overrideIgnorePaths?: string[],
    overrideTextA?: string,
    overrideTextB?: string,
    overrideArrayMode?: ArrayMode
  ) => {
    stopWorker();
    setIsActivelyComparing(true);
    setHighlightControlsVisible(true);
    const jobId = crypto.randomUUID();
    activeJobRef.current = jobId;
    const sentTextA = overrideTextA ?? textA;
    const sentTextB = overrideTextB ?? textB;
    setBusy(true);
    setStatus({ tone: "idle", message: "Comparing responses…" });
    reports.clearPreview();
    panels.closeActions();
    const worker = new Worker(new URL("../../workers/comparison.worker.ts", import.meta.url));
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.jobId !== activeJobRef.current) return;
      setBusy(false);
      worker.terminate();
      workerRef.current = null;
      activeJobRef.current = null;
      // A live re-compare can still be catching up to typing that continued after this job was
      // sent — a newer debounced run is already queued, so drop this stale response rather than
      // clobbering what the user has typed since.
      const isStale =
        latestTextRef.current.a !== sentTextA || latestTextRef.current.b !== sentTextB;
      if (isStale) return;
      if (!event.data.ok) {
        setResult(null);
        setDisplayLineMaps(null);
        setStatus({
          tone: "error",
          message: event.data.side
            ? `${SIDE_LABELS[event.data.side]}: ${event.data.error}`
            : event.data.error
        });
        return;
      }
      setTextA(event.data.formattedA);
      setTextB(event.data.formattedB);
      setResult(event.data.result);
      setDisplayLineMaps(event.data.lineMaps);
      setComparisonDurationMs(event.data.durationMs);
      setStatus({ tone: "success", source: "comparison", message: "Comparison complete." });
    };
    worker.onerror = () => {
      if (activeJobRef.current !== jobId) return;
      stopWorker();
      setResult(null);
      setDisplayLineMaps(null);
      setStatus({
        tone: "error",
        message: "The comparison worker stopped unexpectedly. Your inputs are still available."
      });
    };
    worker.postMessage({
      jobId,
      textA: sentTextA,
      textB: sentTextB,
      options:
        overrideIgnorePaths || overrideArrayMode
          ? {
              ...options,
              ...(overrideIgnorePaths ? { ignorePatterns: overrideIgnorePaths } : {}),
              ...(overrideArrayMode ? { arrayMode: overrideArrayMode } : {})
            }
          : options,
      maxBytes: MAX_DOCUMENT_BYTES
    } satisfies WorkerRequest);
  };

  const clearWorkspace = () => {
    invalidateComparison();
    setHighlightControlsVisible(false);
    setTextA("");
    setTextB("");
    setCurlA(null);
    setCurlB(null);
    setStatus({ tone: "idle", message: "Workspace cleared." });
  };

  const prettify = (side: ResponseSide) => {
    const raw = side === "A" ? textA : textB;
    if (!raw.trim()) return;
    try {
      const formatted = JSON.stringify(JSON.parse(raw), null, 2);
      updateImportedInput(side, formatted);
      setStatus({ tone: "success", message: `${SIDE_LABELS[side]} prettified.` });
    } catch (error) {
      setStatus({
        tone: "error",
        message: `${SIDE_LABELS[side]}: ${error instanceof Error ? error.message : String(error)}`
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
      message: `Loaded ${file.name} into ${SIDE_LABELS[side]}.`
    });
    setModalSide(null);
  };

  const runRemote = async (side: ResponseSide, command: string): Promise<boolean> => {
    setFetchingSide(side);
    setStatus({ tone: "idle", message: `Fetching into ${SIDE_LABELS[side]}…` });
    try {
      const { formattedBody, response } = await fetchRemoteResponse(command);
      updateImportedInput(side, formattedBody);
      if (side === "A") setCurlA(command);
      else setCurlB(command);
      setStatus({
        tone: response.status >= 200 && response.status < 300 ? "success" : "error",
        message:
          response.status >= 200 && response.status < 300
            ? `Fetched ${response.status} ${response.statusText} into ${SIDE_LABELS[side]}.`
            : `Server responded ${response.status} ${response.statusText} — body loaded into ${SIDE_LABELS[side]} anyway.`
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

  const setFindingsSelected = (ids: string[], nextSelected: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      ids.forEach((id) => {
        if (nextSelected) next.add(id);
        else next.delete(id);
      });
      return next;
    });
    setStatus({
      tone: "success",
      message: `${nextSelected ? "Selected" : "Cleared"} ${ids.length} finding${
        ids.length === 1 ? "" : "s"
      } ${nextSelected ? "for the report." : "from the report selection."}`
    });
  };

  const applyIgnorePaths = (paths: string[]) => {
    setIgnorePaths(paths);
    runComparison(paths);
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
    invalidateComparison();
    const aligned = alignValidInputText(SAMPLE_A, SAMPLE_B);
    setTextA(aligned?.textA ?? SAMPLE_A);
    setTextB(aligned?.textB ?? SAMPLE_B);
    setStatus({
      tone: "idle",
      message: "Sample loaded and aligned. Choose an array mode and compare."
    });
  };

  const loadTourDemo = () => {
    invalidateComparison();
    const aligned = alignValidInputText(TOUR_DEMO_A, TOUR_DEMO_B);
    setTextA(aligned?.textA ?? TOUR_DEMO_A);
    setTextB(aligned?.textB ?? TOUR_DEMO_B);
  };

  const cancelComparison = () => {
    stopWorker();
    setStatus({ tone: "idle", message: "Comparison cancelled." });
  };

  const focusElement = (id: string) =>
    requestAnimationFrame(() => {
      const element = document.getElementById(id);
      element?.focus({ preventScroll: true });
      element?.scrollIntoView({ block: "center" });
    });
  const manageIgnores = () => focusElement("ignore-paths-input");
  const scrollToPanel = (pointer: string, homeSide: ResponseSide, resolveCounterpart: boolean) => {
    panels.navigate(homeSide, pointer);
    const otherSide: ResponseSide = homeSide === "A" ? "B" : "A";
    const counterpartPointer = resolveCounterpart
      ? panels.resolveCounterpartPointer(homeSide, pointer)
      : undefined;
    if (counterpartPointer) panels.navigate(otherSide, counterpartPointer);
    setStatus({
      tone: "success",
      message:
        resolveCounterpart && !counterpartPointer
          ? `Highlighted the field in ${SIDE_LABELS[homeSide]}. No safe counterpart mapping in ${SIDE_LABELS[otherSide]}.`
          : "Highlighted the corresponding field in the JSON panels."
    });
  };
  const revealFinding = (finding: ReviewFinding) => {
    const section =
      "detail" in finding
        ? "structure"
        : finding.kind === "added" || finding.kind === "removed"
          ? "missing"
          : "differences";
    setPathFilter("");
    setShowOnlyInA(true);
    setShowOnlyInB(true);
    if (finding.ignored) setShowIgnored(true);
    setExpandedSections((current) => ({ ...current, [section]: true }));
    focusElement("finding-" + section + "-" + finding.id);
  };
  const filterPanelPath = () => {
    if (!panels.selection) return;
    setPathFilter(panels.selection.field.pointer);
    setShowOnlyInA(true);
    setShowOnlyInB(true);
    setExpandedSections({ missing: true, structure: true, differences: true });
    focusElement("results-path-filter");
  };

  const isWorkspaceEmpty = !textA.trim() && !textB.trim();

  return (
    <main>
      <header className="hero">
        <div>
          <span className="brand-mark" aria-hidden="true">{`{ }`}</span>
          <p className="eyebrow">Developer utility</p>
          <div className="hero-title-row">
            <h1>Compare JSON Files</h1>
            {/* {displayAuthor && (
              <div className="author-byline">
                <span className="author-avatar" aria-hidden="true">
                  {authorInitials}
                </span>
                <span className="author-identity">
                  <span>Crafted by</span>
                  <strong>{displayAuthor}</strong>
                </span>
                <span className="author-spark" aria-hidden="true">
                  ✦
                </span>
              </div>
            )} */}
          </div>
          <p>
            Inspect contract drift without uploading your payloads. Compare fields, values, and
            types directly in your browser.
          </p>
        </div>
        <div className="hero-actions">
          <div className="privacy-badge" data-tour="privacy">
            <span aria-hidden="true">●</span> Local processing
          </div>
          <OnboardingTour
            hasResults={result !== null}
            isWorkspaceEmpty={isWorkspaceEmpty}
            onLoadDemoData={loadTourDemo}
            onRunComparison={() => runComparison()}
            onClearWorkspace={clearWorkspace}
          />
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
        <div className="panel-toolbar-actions" data-tour="primary-actions">
          <span>JSON response panels</span>
          {highlightControlsVisible && (
            <HighlightControls
              highlightVisibility={highlightToggles}
              onHighlightVisibilityChange={setHighlightToggles}
            />
          )}
          <button
            className="primary-button"
            type="button"
            disabled={busy}
            onClick={() => runComparison()}
          >
            {busy ? "Comparing…" : "Compare responses"}
          </button>
          {busy && (
            <button className="secondary-button" type="button" onClick={cancelComparison}>
              Cancel
            </button>
          )}
          <button className="secondary-button" type="button" onClick={loadSample}>
            Load sample
          </button>
          <button className="secondary-button" type="button" onClick={clearWorkspace}>
            Clear all
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={isWorkspaceEmpty}
            aria-expanded={jsonPanelsExpanded}
            aria-controls="json-input-panels"
            onClick={() => setJsonPanelsExpanded((current) => !current)}
          >
            {jsonPanelsExpanded ? "Collapse panels" : "Expand panels"}
          </button>
        </div>

        <div
          id="json-input-panels"
          className={`input-grid${jsonPanelsExpanded ? " panels-expanded" : ""}${
            highlightControlsVisible ? " has-side-panel" : ""
          }${isWorkspaceEmpty ? " panels-empty" : ""}`}
          aria-label="JSON response inputs"
          data-tour="json-inputs"
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
            panelIndex={panels.indexes?.A}
            panelNavigation={panels.navigation.A}
            onOpenActions={(request) => panels.openActions("A", request)}
            mirroredLine={activeLine?.side === "B" ? activeLine.line : null}
            onActiveLineChange={onActiveLineChangeA}
            onJumpToLine={onFindingLineJump}
            view={panelView}
            onViewChange={setPanelView}
          />

          {highlightControlsVisible && (
            <div className="workspace-side-panel">
              <button
                type="button"
                className="highlight-scroll-button"
                onClick={scrollToHighlightControls}
              >
                Highlight Controls <span aria-hidden="true">⤒</span>
              </button>
              <WorkspaceFindingNav
                categories={findingCategories}
                current={findingCursor + 1}
                total={findingLines.length}
                onPrevious={() => stepFinding(-1)}
                onNext={() => stepFinding(1)}
                onScrollToOutput={scrollToComparisonOutput}
              />
            </div>
          )}

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
            panelIndex={panels.indexes?.B}
            panelNavigation={panels.navigation.B}
            onOpenActions={(request) => panels.openActions("B", request)}
            mirroredLine={activeLine?.side === "A" ? activeLine.line : null}
            onActiveLineChange={onActiveLineChangeB}
            onJumpToLine={onFindingLineJump}
            view={panelView}
            onViewChange={setPanelView}
          />
        </div>

        <ComparisonControls
          arrayMode={arrayMode}
          ignorePaths={ignorePaths}
          ignorePathSuggestions={ignorePathSuggestions}
          isComparing={busy}
          status={displayedStatus}
          onArrayModeChange={(mode) => {
            setArrayMode(mode);
            runComparison(undefined, undefined, undefined, mode);
          }}
          onIgnorePathsChange={setIgnorePaths}
          onApplyIgnorePaths={(paths) => runComparison(paths)}
        />
      </section>

      {result && resultProjection && comparisonDurationMs !== null && (
        <ComparisonResults
          result={result}
          counts={resultProjection.counts}
          comparisonDurationMs={comparisonDurationMs}
          onlyInA={resultProjection.onlyInA}
          onlyInB={resultProjection.onlyInB}
          differences={resultProjection.differences}
          structureFindings={resultProjection.structureFindings}
          selectedFindingIds={selected}
          notesByFindingId={notes}
          filters={{
            path: pathFilter,
            showOnlyInA,
            showOnlyInB,
            showIgnored
          }}
          sections={expandedSections}
          ignorePaths={ignorePaths}
          onFiltersChange={(patch) => {
            if (patch.path !== undefined) setPathFilter(patch.path);
            if (patch.showOnlyInA !== undefined) setShowOnlyInA(patch.showOnlyInA);
            if (patch.showOnlyInB !== undefined) setShowOnlyInB(patch.showOnlyInB);
            if (patch.showIgnored !== undefined) setShowIgnored(patch.showIgnored);
          }}
          onSectionsChange={(patch) => setExpandedSections((current) => ({ ...current, ...patch }))}
          onToggleAllSections={toggleAllResultSections}
          onExport={reports.exportReport}
          onExportSection={reports.exportSection}
          onToggleSelected={toggleSelected}
          onSelectFindings={setFindingsSelected}
          onCopyPaths={reports.copyPaths}
          onIgnorePaths={applyIgnorePaths}
          onManageIgnores={manageIgnores}
          onScrollToPanel={scrollToPanel}
          onNoteChange={updateNote}
        />
      )}

      {reports.preview && (
        <ExportPreview
          preview={reports.preview}
          onCopy={reports.copyPreview}
          onDownload={reports.downloadPreview}
          onClose={reports.clearPreview}
        />
      )}

      {panels.selection && (
        <PanelActions
          request={panels.selection}
          valueText={
            panels.selection.field.placeholder
              ? null
              : (panels.selection.side === "A" ? textA : textB).slice(
                  panels.selection.field.valueStart,
                  panels.selection.field.valueEnd
                )
          }
          counterpart={panels.counterpart}
          parent={panels.parent}
          findings={panels.related}
          ignorePaths={ignorePaths}
          selected={selected}
          notes={notes}
          onClose={panels.closeActions}
          onIgnore={applyIgnorePaths}
          onManageIgnores={manageIgnores}
          onJump={() => {
            if (panels.counterpart) panels.navigate(panels.otherSide, panels.counterpart.pointer);
            setStatus({
              tone: "success",
              message: panels.counterpart?.placeholder
                ? `Not present in ${SIDE_LABELS[panels.otherSide]}. Showing its missing-field location.`
                : "Highlighted the corresponding field."
            });
          }}
          onReveal={revealFinding}
          onFilter={filterPanelPath}
          onSelect={toggleSelected}
          onNote={updateNote}
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
          URL and cURL import uses server-side target restrictions and SSRF protection. Public
          targets require HTTPS; localhost requires the explicit development setting. Credentials
          are stripped unless enabled by the administrator.
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
