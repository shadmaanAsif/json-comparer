"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_DOCUMENT_BYTES } from "../constants";
import type { HighlightCategory, ResponseSide } from "../types";
import {
  DEFAULT_EDITOR_VIEWPORT_METRICS,
  navigationTargetLine,
  scrollOffsetForLine,
  visibleLineRange,
  type EditorViewportMetrics
} from "../utils/editor-navigation";
import { getJsonSyntaxIssue } from "../utils/json-validation";
import { JsonTree } from "./JsonTree";

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
  lineHighlights: Record<number, HighlightCategory>;
  registerEditor: (side: ResponseSide, editor: HTMLTextAreaElement | null) => void;
  synchronizeScroll: (side: ResponseSide, editor: HTMLTextAreaElement) => void;
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
  synchronizeScroll
}: JsonInputPaneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [activeView, setActiveView] = useState<"json" | "tree">("json");
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findText, setFindText] = useState("");
  const [findIndex, setFindIndex] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [activeNavigationLine, setActiveNavigationLine] = useState<number | null>(null);
  const [editorMetrics, setEditorMetrics] = useState<EditorViewportMetrics>(
    DEFAULT_EDITOR_VIEWPORT_METRICS
  );
  const jsonIssue = useMemo(() => getJsonSyntaxIssue(value), [value]);
  const jsonError = jsonIssue?.message ?? null;
  const showsJsonError = jsonIssue !== null && activeView === "json";
  const effectiveLineHighlights = useMemo(
    () =>
      jsonIssue
        ? ({ ...lineHighlights, [jsonIssue.line]: "invalid" } satisfies Record<
            number,
            HighlightCategory
          >)
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

  const lines = value.split("\n");
  const totalLines = Math.max(1, lines.length);
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
  const activeNavigationIndex =
    selectedNavigationLine === null ? -1 : highlightedLines.indexOf(selectedNavigationLine);
  const safeNavigationIndex = activeNavigationIndex >= 0 ? activeNavigationIndex : 0;
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

    const nextScrollTop = scrollOffsetForLine(line, editor.scrollHeight, editorMetrics, placement);
    editor.scrollTop = nextScrollTop;
    setScrollTop(editor.scrollTop);
    setActiveNavigationLine(effectiveLineHighlights[line] ? line : null);
    editor.focus({ preventScroll: true });
    synchronizeScroll(side, editor);
  };

  const categoriesFor = (targetLines: number[]) =>
    (["missing", "structure", "differences", "invalid"] as const).filter((category) =>
      targetLines.some((line) => effectiveLineHighlights[line] === category)
    );
  const previousError =
    highlightedLines.filter((line) => line < firstVisibleLine).at(-1) ?? highlightedLines.at(-1);
  const nextError = highlightedLines.find((line) => line > lastVisibleLine) ?? highlightedLines[0];

  const navigateError = (direction: 1 | -1) => {
    const targetLine = navigationTargetLine(highlightedLines, direction, selectedNavigationLine, {
      first: firstVisibleLine,
      last: lastVisibleLine
    });
    if (targetLine !== null) jumpToLine(targetLine);
  };

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

  return (
    <section
      className={`input-panel${showsJsonError ? " has-json-error" : ""}`}
      data-side={side}
      data-json-state={jsonError ? "invalid" : value.trim() ? "valid" : "empty"}
      aria-labelledby={`response-${side}-heading`}
    >
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Response {side}</span>
          <h2 id={`response-${side}-heading`}>{side === "A" ? "Baseline" : "Candidate"}</h2>
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

      <div className="panel-tabs" role="tablist" aria-label={`Response ${side} view`}>
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
            <span className="visually-hidden">Find in Response {side}</span>
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
        JSON for Response {side}
      </label>
      {activeView === "json" ? (
        <div className="editor-with-gutter">
          <div className="line-gutter" aria-hidden="true">
            <div style={{ transform: `translateY(-${scrollTop}px)` }}>
              {lines.map((_, index) => {
                const line = index + 1;
                return (
                  <button
                    tabIndex={-1}
                    type="button"
                    key={line}
                    className={`${
                      effectiveLineHighlights[line] ? `line-${effectiveLineHighlights[line]}` : ""
                    }${selectedNavigationLine === line ? " is-active" : ""}`}
                    onClick={() => jumpToLine(line, "upper")}
                  >
                    {line}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="editor-main">
            <div className="line-highlight-layer" aria-hidden="true">
              {highlightedLines.map((line) => (
                <span
                  key={line}
                  className={`full-line-highlight line-${effectiveLineHighlights[line]}${
                    selectedNavigationLine === line ? " is-active" : ""
                  }`}
                  style={{
                    top: `${editorMetrics.paddingTop + (line - 1) * editorMetrics.lineHeight - scrollTop}px`,
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
              onPaste={(event) => {
                event.preventDefault();
                const start = event.currentTarget.selectionStart;
                const end = event.currentTarget.selectionEnd;
                const pasted = event.clipboardData.getData("text");
                onPaste(`${value.slice(0, start)}${pasted}${value.slice(end)}`);
              }}
              placeholder={
                side === "A" ? '{"status":"ok","amount":100}' : '{"status":"ok","amount":150}'
              }
              aria-invalid={jsonError ? "true" : "false"}
              aria-describedby={jsonError ? `response-${side}-json-error` : undefined}
              spellCheck={false}
              wrap="off"
              onScroll={(event) => {
                setScrollTop(event.currentTarget.scrollTop);
                synchronizeScroll(side, event.currentTarget);
              }}
            />
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
            {highlightedLines.length > 0 && (
              <div className="error-stepper" aria-label={`Response ${side} finding navigation`}>
                <CategoryDots categories={categoriesFor(highlightedLines)} />
                <button
                  type="button"
                  onClick={() => navigateError(-1)}
                  aria-label="Previous highlighted finding"
                  title="Previous finding"
                >
                  ↑
                </button>
                <span aria-live="polite">
                  {safeNavigationIndex + 1}/{highlightedLines.length}
                </span>
                <button
                  type="button"
                  onClick={() => navigateError(1)}
                  aria-label="Next highlighted finding"
                  title="Next finding"
                >
                  ↓
                </button>
              </div>
            )}
          </div>
          <aside className="json-minimap" aria-label={`Response ${side} highlighted lines`}>
            {highlightedLines.map((line) => (
              <button
                key={line}
                type="button"
                className={`minimap-marker line-${effectiveLineHighlights[line]}${
                  selectedNavigationLine === line ? " is-active" : ""
                }`}
                style={{ top: `${totalLines === 1 ? 0 : ((line - 1) / (totalLines - 1)) * 100}%` }}
                aria-label={`Go to highlighted line ${line}`}
                title={`Line ${line} — ${effectiveLineHighlights[line]}`}
                onClick={() => jumpToLine(line)}
              />
            ))}
          </aside>
        </div>
      ) : (
        <JsonTree raw={value} />
      )}

      <div className="input-meta">
        <span>{new Blob([value]).size.toLocaleString()} bytes</span>
        <span className={jsonError ? "input-validity error" : "input-validity"}>
          {jsonError ? "Fix JSON syntax to compare" : "Processed locally"}
        </span>
      </div>
      {curlCommand !== null && (
        <div className="inline-curl">
          <label htmlFor={`curl-${side}`}>URL or cURL for Response {side}</label>
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
              aria-label={`Hide cURL bar for Response ${side}`}
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

function CategoryDots({ categories }: { categories: HighlightCategory[] }) {
  return (
    <span className="chip-dots" aria-hidden="true">
      {categories.map((category) => (
        <i key={category} className={`dot-${category}`} />
      ))}
    </span>
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
