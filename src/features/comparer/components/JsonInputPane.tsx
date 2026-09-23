"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { MAX_DOCUMENT_BYTES, SIDE_LABELS } from "../constants";
import { usePanelEditorActions } from "../hooks/usePanelEditorActions";
import { useMeasuredLineOffsets } from "../hooks/useMeasuredLineOffsets";
import type { PanelActionRequest, PanelNavigation } from "../hooks/usePanelInteractions";
import type { PanelIndex } from "../utils/panel-context";
import type { HighlightCategory, LineHighlight, ResponseSide } from "../types";
import {
  DEFAULT_EDITOR_VIEWPORT_METRICS,
  minimapMarkerPercent,
  scrollOffsetForLine,
  visibleLineRange,
  type EditorViewportMetrics
} from "../utils/editor-navigation";
import { getJsonSyntaxIssue } from "../utils/json-validation";
import { CategoryDots } from "./FindingNavigation";
import { InfoTooltipButton } from "./InfoTooltipButton";
import { JsonTree } from "./JsonTree";
import { JsonLineGutter } from "./JsonLineGutter";

export interface JsonInputPaneProps {
  side: ResponseSide;
  value: string;
  onChange: (value: string) => void;
  onPaste: (value: string) => void;
  onFileLoad: (value: string) => void;
  onAdd: () => void;
  onPrettify: () => void;
  curlCommand: string | null;
  onCurlCommandChange: (value: string) => void;
  onCurlRun: () => void;
  onCurlClose: () => void;
  isFetching: boolean;
  lineHighlights: Record<number, LineHighlight>;
  registerEditor: (side: ResponseSide, editor: HTMLTextAreaElement | null) => void;
  synchronizeScroll: (side: ResponseSide, editor: HTMLTextAreaElement) => void;
  panelIndex?: PanelIndex | null;
  panelNavigation?: PanelNavigation;
  onOpenActions?: (request: PanelActionRequest) => void;
  /** The partner panel's current line, mirrored here at the same line number so aligned
   *  panels show a "same row" cue even though this panel's own selection is untouched. */
  mirroredLine?: number | null;
  /** Reports this panel's own current line up so the partner panel can mirror it. */
  onActiveLineChange?: (line: number | null) => void;
  /** Reports a line jumped to via this panel's own controls (the offscreen-finding chip, a
   *  minimap marker) so the shared finding-nav cursor can stay in sync with Previous/Next. */
  onJumpToLine?: (line: number) => void;
  /** Shared JSON/Tree mode: when the workspace supplies both, switching one panel switches the
   *  other. Optional so the pane still works standalone with its own local view. */
  view?: "json" | "tree";
  onViewChange?: (view: "json" | "tree") => void;
}

export function JsonInputPane({
  side,
  value,
  onChange,
  onPaste,
  onFileLoad,
  onAdd,
  onPrettify,
  curlCommand,
  onCurlCommandChange,
  onCurlRun,
  onCurlClose,
  isFetching,
  lineHighlights,
  registerEditor,
  synchronizeScroll,
  panelIndex,
  panelNavigation,
  onOpenActions,
  mirroredLine = null,
  onActiveLineChange,
  onJumpToLine,
  view,
  onViewChange
}: JsonInputPaneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const paneRef = useRef<HTMLElement>(null);
  const dragDepthRef = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);
  // Local view state kept in sync with the optional shared `view`, so the pane works both
  // standalone and as one of two panels the workspace keeps on the same mode. Adjusted during
  // render (React's documented alternative to an effect) rather than after a commit.
  const [activeView, setActiveViewLocal] = useState<"json" | "tree">(view ?? "json");
  const [prevView, setPrevView] = useState(view);
  if (view !== undefined && view !== prevView) {
    setPrevView(view);
    setActiveViewLocal(view);
  }
  const setActiveView = (next: "json" | "tree") => {
    setActiveViewLocal(next);
    onViewChange?.(next);
  };
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findText, setFindText] = useState("");
  const [findIndex, setFindIndex] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [activeNavigationLine, setActiveNavigationLine] = useState<number | null>(null);
  const [editorMetrics, setEditorMetrics] = useState<EditorViewportMetrics>(
    DEFAULT_EDITOR_VIEWPORT_METRICS
  );
  const panelActions = usePanelEditorActions({
    value,
    index: panelIndex,
    navigation: panelNavigation,
    editorRef,
    paneRef,
    metrics: editorMetrics,
    activeView,
    setActiveView,
    setScrollTop,
    onOpenActions
  });
  useEffect(() => {
    onActiveLineChange?.(panelActions.selectedLine);
  }, [panelActions.selectedLine, onActiveLineChange]);
  const jsonIssue = useMemo(() => getJsonSyntaxIssue(value), [value]);
  const jsonError = jsonIssue?.message ?? null;
  const showsJsonError = jsonIssue !== null && activeView === "json";
  const effectiveLineHighlights = useMemo(
    () =>
      jsonIssue
        ? ({
            ...lineHighlights,
            [jsonIssue.line]: { category: "invalid", ignored: false }
          } satisfies Record<number, LineHighlight>)
        : lineHighlights,
    [jsonIssue, lineHighlights]
  );

  useEffect(() => {
    registerEditor(side, editorRef.current);
    return () => registerEditor(side, null);
  }, [activeView, registerEditor, side]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const updateMetrics = () => {
      const styles = window.getComputedStyle(editor);
      const lineHeight = Number.parseFloat(styles.lineHeight);
      const paddingTop = Number.parseFloat(styles.paddingTop);
      const paddingBottom = Number.parseFloat(styles.paddingBottom);
      const nextMetrics: EditorViewportMetrics = {
        clientHeight: editor.clientHeight || DEFAULT_EDITOR_VIEWPORT_METRICS.clientHeight,
        lineHeight: Number.isFinite(lineHeight)
          ? lineHeight
          : DEFAULT_EDITOR_VIEWPORT_METRICS.lineHeight,
        paddingTop: Number.isFinite(paddingTop)
          ? paddingTop
          : DEFAULT_EDITOR_VIEWPORT_METRICS.paddingTop,
        paddingBottom: Number.isFinite(paddingBottom)
          ? paddingBottom
          : DEFAULT_EDITOR_VIEWPORT_METRICS.paddingBottom
      };

      setEditorMetrics((currentMetrics) =>
        Object.keys(nextMetrics).every(
          (key) =>
            Math.abs(
              currentMetrics[key as keyof EditorViewportMetrics] -
                nextMetrics[key as keyof EditorViewportMetrics]
            ) < 0.01
        )
          ? currentMetrics
          : nextMetrics
      );
    };

    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateMetrics);
    observer?.observe(editor);
    window.addEventListener("resize", updateMetrics);
    updateMetrics();
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateMetrics);
    };
  }, [activeView]);

  const showsEmptyHint = !value.trim() && !isDragOver;

  const lines = value.split("\n");
  const totalLines = Math.max(1, lines.length);
  const lineOffsets = useMeasuredLineOffsets(editorRef, value, editorMetrics);
  const highlightedLines = useMemo(
    () =>
      Object.keys(effectiveLineHighlights)
        .map(Number)
        .sort((lineA, lineB) => lineA - lineB),
    [effectiveLineHighlights]
  );
  const selectedNavigationLine =
    activeNavigationLine !== null && effectiveLineHighlights[activeNavigationLine]
      ? activeNavigationLine
      : null;
  const { first: firstVisibleLine, last: lastVisibleLine } = visibleLineRange(
    scrollTop,
    totalLines,
    editorMetrics
  );
  const highlightsAbove = highlightedLines.filter((line) => line < firstVisibleLine);
  const highlightsBelow = highlightedLines.filter((line) => line > lastVisibleLine);

  const jumpToLine = (line: number, placement: "center" | "upper" = "center") => {
    const editor = editorRef.current;
    if (!editor) return;

    // A line already fully visible (e.g. one the finding-nav toolbar just centered) is left
    // alone: re-scrolling it to `placement` regardless — the gutter's click handler asks for
    // "upper" on every click, including one made right after Previous/Next already centered this
    // exact line — visibly relocated the value the instant its "..." actions were opened.
    if (line < firstVisibleLine || line > lastVisibleLine) {
      const nextScrollTop = scrollOffsetForLine(line, editor.scrollHeight, editorMetrics, placement);
      editor.scrollTop = nextScrollTop;
      setScrollTop(editor.scrollTop);
    }
    setActiveNavigationLine(effectiveLineHighlights[line] ? line : null);
    editor.focus({ preventScroll: true });
    synchronizeScroll(side, editor);
    onJumpToLine?.(line);
  };

  const categoriesFor = (targetLines: number[]) =>
    (["missing", "structure", "differences", "invalid"] as const).filter((category) =>
      targetLines.some((line) => effectiveLineHighlights[line]?.category === category)
    );
  const previousError =
    highlightedLines.filter((line) => line < firstVisibleLine).at(-1) ?? highlightedLines.at(-1);
  const nextError = highlightedLines.find((line) => line > lastVisibleLine) ?? highlightedLines[0];

  const matches = useMemo(() => {
    const output: number[] = [];
    if (!findText) return output;
    const source = value.toLowerCase();
    const needle = findText.toLowerCase();
    let start = 0;
    while ((start = source.indexOf(needle, start)) >= 0) {
      output.push(start);
      start += Math.max(1, needle.length);
    }
    return output;
  }, [findText, value]);

  const jumpFind = (direction: 1 | -1) => {
    if (!matches.length) return;
    const next = (findIndex + direction + matches.length) % matches.length;
    setFindIndex(next);
    const start = matches[next]!;
    editorRef.current?.focus();
    editorRef.current?.setSelectionRange(start, start + findText.length);
  };

  const loadFile = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_DOCUMENT_BYTES) {
      window.alert(
        `The selected file exceeds the ${MAX_DOCUMENT_BYTES.toLocaleString()} byte limit.`
      );
      return;
    }
    onFileLoad(await file.text());
  };

  // dataTransfer.types is only a hint, and its "Files" entry is unreliable across browsers
  // (absent during dragenter/dragover in some, and — per a real report — sometimes absent even
  // at drop). dataTransfer.items carries file-kind metadata during the whole drag without
  // exposing file content, so prefer it and fall back to types only when items is unavailable.
  const isFileDrag = (event: DragEvent<HTMLElement>) => {
    const { dataTransfer } = event;
    if (dataTransfer.items && dataTransfer.items.length > 0) {
      return Array.from(dataTransfer.items).some((item) => item.kind === "file");
    }
    return Array.from(dataTransfer.types).includes("Files");
  };

  const fileFromDrop = (event: DragEvent<HTMLElement>) =>
    event.dataTransfer.files[0] ??
    Array.from(event.dataTransfer.items ?? [])
      .find((item) => item.kind === "file")
      ?.getAsFile() ??
    undefined;

  // Some browsers don't populate dataTransfer.types with "Files" until the drop itself, so
  // dragenter/dragover must always claim the drop zone rather than gating on isFileDrag here —
  // otherwise the browser falls back to its native text-field default of inserting the dropped
  // file's name instead of letting our onDrop read its content.
  const handleDragEnter = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    dragDepthRef.current += 1;
    if (isFileDrag(event)) setIsDragOver(true);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (isFileDrag(event)) event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = () => {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragOver(false);
  };

  // Gate on the actual file (dataTransfer.files / .items), not the .types hint: a real report
  // showed dataTransfer.types omitting "Files" even at drop in stock Chrome, which skipped
  // preventDefault() and let the browser navigate the tab to the dropped file
  // ("about:blank#blocked") instead of reading its content. Only preventDefault when a file is
  // actually found, so dragging plain text still inserts natively.
  const handleDrop = (event: DragEvent<HTMLElement>) => {
    dragDepthRef.current = 0;
    setIsDragOver(false);
    const file = fileFromDrop(event);
    if (!file) return;
    event.preventDefault();
    void loadFile(file);
  };

  return (
    <section
      ref={paneRef}
      className={`input-panel${showsJsonError ? " has-json-error" : ""}${
        isDragOver ? " is-drag-over" : ""
      }`}
      data-side={side}
      data-json-state={jsonError ? "invalid" : value.trim() ? "valid" : "empty"}
      data-tour={side === "A" ? "panel-actions" : undefined}
      aria-labelledby={`response-${side}-heading`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="drop-zone-overlay" aria-hidden="true">
          <span>Drop JSON file to load into {SIDE_LABELS[side]}</span>
        </div>
      )}
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            {side === "A" ? "Expected response" : "Response under test"}
          </span>
          <div className="panel-title-row">
            <h2 id={`response-${side}-heading`}>{SIDE_LABELS[side]}</h2>
            <InfoTooltipButton
              label={`How to load data into ${SIDE_LABELS[side]}`}
              detail="Drag and drop a JSON file anywhere on this panel, or use Add to load a URL, cURL command, or file."
            />
          </div>
          {showsJsonError && (
            <span
              id={`response-${side}-json-error`}
              className="json-error-badge"
              title={jsonError ?? undefined}
            >
              Invalid JSON
            </span>
          )}
        </div>
        <div className="compact-actions">
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept=".json,.txt,application/json,text/plain"
            onChange={(event) => void loadFile(event.target.files?.[0])}
          />
          <button className="text-button" type="button" onClick={onAdd}>
            Add
          </button>
          <button className="text-button" type="button" onClick={onPrettify}>
            Prettify
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setActiveView("json");
              setIsFindOpen(true);
            }}
          >
            Find
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            Quick upload
          </button>
          <button className="text-button" type="button" onClick={() => onChange("")}>
            Clear
          </button>
        </div>
      </div>

      <div className="panel-tabs" role="tablist" aria-label={`${SIDE_LABELS[side]} view`}>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "json"}
          onClick={() => setActiveView("json")}
        >
          JSON
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "tree"}
          onClick={() => setActiveView("tree")}
        >
          Tree
        </button>
      </div>

      {isFindOpen && activeView === "json" && (
        <div className="find-bar">
          <label>
            <span className="visually-hidden">Find in {SIDE_LABELS[side]}</span>
            <input
              autoFocus
              value={findText}
              onChange={(event) => {
                setFindText(event.target.value);
                setFindIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") setIsFindOpen(false);
                else if (event.key === "Enter") {
                  event.preventDefault();
                  jumpFind(event.shiftKey ? -1 : 1);
                }
              }}
              placeholder="Find in JSON"
            />
          </label>
          <span>
            {matches.length
              ? `${Math.min(findIndex + 1, matches.length)}/${matches.length}`
              : "0/0"}
          </span>
          <button type="button" className="text-button" onClick={() => jumpFind(-1)}>
            Previous
          </button>
          <button type="button" className="text-button" onClick={() => jumpFind(1)}>
            Next
          </button>
          <button
            type="button"
            className="text-button"
            aria-label="Close find"
            onClick={() => setIsFindOpen(false)}
          >
            ×
          </button>
        </div>
      )}

      <label className="visually-hidden" htmlFor={`response-${side}`}>
        JSON for {SIDE_LABELS[side]}
      </label>
      {activeView === "json" ? (
        <div
          className={"editor-with-gutter" + (panelIndex ? " has-line-actions" : "")}
          onMouseLeave={() => panelActions.hoverLine(null)}
        >
          <JsonLineGutter
            side={side}
            totalLines={totalLines}
            scrollTop={scrollTop}
            lineTop={lineOffsets.lineTop}
            highlights={effectiveLineHighlights}
            activeLine={panelActions.selectedLine ?? selectedNavigationLine}
            hoveredLine={panelActions.hoveredLine}
            panelIndex={panelIndex}
            onHoverLine={panelActions.hoverLine}
            onNavigate={(line) => jumpToLine(line, "upper")}
            onOpenLine={panelActions.openLine}
          />
          <div className="editor-main">
            {showsEmptyHint && (
              <div className="editor-empty-hint" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <rect className="empty-hint-frame" x="3" y="3" width="18" height="18" rx="4" />
                  <path className="empty-hint-arrow" d="M12 8v7m0 0-3-3m3 3 3-3" />
                </svg>
                <span className="editor-empty-hint-title">No JSON loaded</span>
                <span className="editor-empty-hint-detail">
                  Type or paste JSON, drag and drop a file, or use Add / Quick upload above.
                </span>
              </div>
            )}
            <div className="line-highlight-layer" aria-hidden="true">
              {panelActions.hoveredLine !== null && (
                <span
                  className="full-line-highlight line-action-hover"
                  style={{
                    top: lineOffsets.lineTop(panelActions.hoveredLine) - scrollTop,
                    height: editorMetrics.lineHeight
                  }}
                />
              )}
              {panelActions.selectedLine !== null && (
                <span
                  className="full-line-highlight line-context"
                  style={{
                    top: lineOffsets.lineTop(panelActions.selectedLine) - scrollTop,
                    height: editorMetrics.lineHeight
                  }}
                />
              )}
              {mirroredLine !== null && mirroredLine <= totalLines && (
                <span
                  className="full-line-highlight line-context line-mirror"
                  style={{
                    top: `${lineOffsets.lineTop(mirroredLine) - scrollTop}px`,
                    height: `${editorMetrics.lineHeight}px`
                  }}
                />
              )}
              {highlightedLines.map((line) => (
                <span
                  key={line}
                  className={`full-line-highlight line-${effectiveLineHighlights[line]!.category}${
                    effectiveLineHighlights[line]!.ignored ? " is-ignored" : ""
                  }${selectedNavigationLine === line ? " is-active" : ""}`}
                  style={{
                    top: `${lineOffsets.lineTop(line) - scrollTop}px`,
                    height: `${editorMetrics.lineHeight}px`
                  }}
                />
              ))}
            </div>
            <textarea
              ref={editorRef}
              id={`response-${side}`}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onSelect={(event) =>
                panelActions.selectLine(panelActions.caretLine(event.currentTarget))
              }
              onMouseMove={(event) => {
                if (panelIndex)
                  panelActions.hoverLine(
                    panelActions.lineAtPointer(event.currentTarget, event.clientY)
                  );
              }}
              onContextMenu={(event) => {
                if (!panelIndex) return;
                const line = panelActions.lineAtPointer(event.currentTarget, event.clientY);
                if (!panelIndex.byLine.has(line)) return;
                event.preventDefault();
                panelActions.openLine(line, { x: event.clientX, y: event.clientY });
              }}
              onKeyDown={(event) => {
                if (
                  !panelIndex ||
                  !(event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))
                )
                  return;
                event.preventDefault();
                const rect = event.currentTarget.getBoundingClientRect();
                panelActions.openLine(panelActions.caretLine(event.currentTarget), {
                  x: rect.left + 48,
                  y: rect.top + 48
                });
              }}
              onPaste={(event) => {
                event.preventDefault();
                const start = event.currentTarget.selectionStart;
                const end = event.currentTarget.selectionEnd;
                const pasted = event.clipboardData.getData("text");
                onPaste(`${value.slice(0, start)}${pasted}${value.slice(end)}`);
              }}
              placeholder="Paste or drop JSON here"
              aria-invalid={jsonError ? "true" : "false"}
              aria-describedby={jsonError ? `response-${side}-json-error` : undefined}
              spellCheck={false}
              wrap="off"
              onScroll={(event) => {
                panelActions.hoverLine(null);
                setScrollTop(event.currentTarget.scrollTop);
                synchronizeScroll(side, event.currentTarget);
              }}
            />
            <div className="line-text-dim-layer" aria-hidden="true">
              {highlightedLines
                .filter((line) => effectiveLineHighlights[line]!.ignored)
                .map((line) => (
                  <span
                    key={line}
                    className="line-text-dim"
                    style={{
                      top: `${lineOffsets.lineTop(line) - scrollTop}px`,
                      height: `${editorMetrics.lineHeight}px`
                    }}
                  />
                ))}
            </div>
            {highlightsAbove.length > 0 && (
              <OffscreenFindingChip
                direction="above"
                lines={highlightsAbove}
                categories={categoriesFor(highlightsAbove)}
                onClick={() => previousError && jumpToLine(previousError)}
              />
            )}
            {highlightsBelow.length > 0 && (
              <OffscreenFindingChip
                direction="below"
                lines={highlightsBelow}
                categories={categoriesFor(highlightsBelow)}
                onClick={() => nextError && jumpToLine(nextError)}
              />
            )}
          </div>
          <aside className="json-minimap" aria-label={`${SIDE_LABELS[side]} highlighted lines`}>
            {highlightedLines.map((line) => (
              <button
                key={line}
                type="button"
                className={`minimap-marker line-${effectiveLineHighlights[line]!.category}${
                  effectiveLineHighlights[line]!.ignored ? " is-ignored" : ""
                }${selectedNavigationLine === line ? " is-active" : ""}`}
                style={{
                  top: `${minimapMarkerPercent(lineOffsets.lineTop(line), scrollTop, editorMetrics.clientHeight)}%`
                }}
                aria-label={`Go to highlighted line ${line}`}
                title={`Line ${line} — ${effectiveLineHighlights[line]!.category}${
                  effectiveLineHighlights[line]!.ignored ? " (ignored)" : ""
                }`}
                onClick={() => jumpToLine(line)}
              />
            ))}
          </aside>
        </div>
      ) : (
        <JsonTree
          side={side}
          raw={value}
          lineHighlights={effectiveLineHighlights}
          mirroredLine={mirroredLine}
          collapsedPointers={panelActions.collapsed}
          onExpandedChange={panelActions.onTreeToggle}
          parentRequest={panelActions.treeRequest}
          navigation={panelActions.treeNavigation}
          actions={{
            index: panelIndex,
            selectedPointer: panelActions.selectedPointer,
            onSelect: panelActions.selectPointer,
            onOpen: panelActions.openPointer
          }}
        />
      )}

      <div className="input-meta">
        <span>{new Blob([value]).size.toLocaleString()} bytes</span>
        <span className={jsonError ? "input-validity error" : "input-validity"}>
          {jsonError ? "Fix JSON syntax to compare" : "Processed locally"}
        </span>
      </div>
      {curlCommand !== null && (
        <div className="inline-curl">
          <label htmlFor={`curl-${side}`}>URL or cURL for {SIDE_LABELS[side]}</label>
          <div>
            <textarea
              id={`curl-${side}`}
              value={curlCommand}
              onChange={(event) => onCurlCommandChange(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  onCurlRun();
                }
              }}
            />
            <button
              className="secondary-button"
              type="button"
              disabled={isFetching}
              onClick={onCurlRun}
            >
              {isFetching ? "Fetching…" : "Run"}
            </button>
            <button
              className="text-button"
              type="button"
              aria-label={`Hide cURL bar for ${SIDE_LABELS[side]}`}
              onClick={onCurlClose}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function OffscreenFindingChip({
  direction,
  lines,
  categories,
  onClick
}: {
  direction: "above" | "below";
  lines: number[];
  categories: HighlightCategory[];
  onClick: () => void;
}) {
  const isAbove = direction === "above";
  return (
    <button
      type="button"
      className={`offscreen-chip chip-${direction}`}
      onClick={onClick}
      aria-label={`${lines.length} highlighted findings ${direction}. Go to ${isAbove ? "previous" : "next"} finding.`}
    >
      <CategoryDots categories={categories} />
      <span aria-hidden="true">{isAbove ? "↑" : "↓"}</span> {lines.length} more {direction}
    </button>
  );
}
