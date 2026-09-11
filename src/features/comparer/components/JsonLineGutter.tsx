"use client";

import { useMemo, useRef, useState } from "react";
import { SIDE_LABELS } from "../constants";
import type { LineHighlight, ResponseSide } from "../types";
import type { PanelIndex } from "../utils/panel-context";

export function JsonLineGutter({
  side,
  totalLines,
  scrollTop,
  highlights,
  activeLine,
  hoveredLine,
  panelIndex,
  onHoverLine,
  onNavigate,
  onOpenLine
}: {
  side: ResponseSide;
  totalLines: number;
  scrollTop: number;
  highlights: Record<number, LineHighlight>;
  activeLine: number | null;
  hoveredLine: number | null;
  panelIndex?: PanelIndex | null;
  onHoverLine: (line: number | null) => void;
  onNavigate: (line: number) => void;
  onOpenLine: (line: number, anchor: { x: number; y: number }) => void;
}) {
  const [focusedLine, setFocusedLine] = useState(1);
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const actionableLines = useMemo(
    () => (panelIndex ? [...panelIndex.byLine.keys()].sort((a, b) => a - b) : []),
    [panelIndex]
  );
  const tabStop = panelIndex?.byLine.has(focusedLine) ? focusedLine : actionableLines[0];
  return (
    <div
      className="line-gutter"
      role={panelIndex ? "toolbar" : undefined}
      aria-label={panelIndex ? SIDE_LABELS[side] + " line actions" : undefined}
      aria-orientation={panelIndex ? "vertical" : undefined}
      aria-hidden={panelIndex ? undefined : true}
      onKeyDown={(event) => {
        if (!actionableLines.length) return;
        const current = actionableLines.indexOf(focusedLine);
        const target =
          event.key === "ArrowDown"
            ? actionableLines[Math.min(current + 1, actionableLines.length - 1)]
            : event.key === "ArrowUp"
              ? actionableLines[Math.max(0, current - 1)]
              : event.key === "Home"
                ? actionableLines[0]
                : event.key === "End"
                  ? actionableLines.at(-1)
                  : undefined;
        if (target === undefined) return;
        event.preventDefault();
        onNavigate(target);
        buttons.current.get(target)?.focus({ preventScroll: true });
      }}
    >
      <div style={{ transform: "translateY(-" + scrollTop + "px)" }}>
        {Array.from({ length: totalLines }, (_, index) => {
          const line = index + 1;
          const actionable = !!panelIndex?.byLine.has(line);
          const classes = [
            highlights[line] ? "line-" + highlights[line].category : "",
            highlights[line]?.ignored ? "is-ignored" : "",
            activeLine === line ? "is-active" : "",
            actionable ? "line-action-trigger" : "",
            actionable && hoveredLine === line ? "is-hovered" : ""
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={line}
              type="button"
              className={classes}
              ref={(node) => {
                if (node) buttons.current.set(line, node);
                else buttons.current.delete(line);
              }}
              tabIndex={actionable && tabStop === line ? 0 : -1}
              aria-label={actionable ? "Actions for line " + line : "Go to line " + line}
              aria-haspopup={actionable ? "dialog" : undefined}
              title={
                actionable
                  ? "Line " + line + " actions · click to copy, ignore, review and more"
                  : "Go to line " + line
              }
              onFocus={() => {
                setFocusedLine(line);
                onHoverLine(line);
              }}
              onBlur={() => onHoverLine(null)}
              onMouseEnter={() => onHoverLine(line)}
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                onNavigate(line);
                if (actionable) event.currentTarget.focus({ preventScroll: true });
                onOpenLine(line, { x: rect.right + 8, y: rect.top });
              }}
            >
              <span className="line-number">{line}</span>
              {actionable && (
                <span className="line-action-icon" aria-hidden="true">
                  ⋯
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
