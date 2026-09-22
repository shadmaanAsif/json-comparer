"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { EditorViewportMetrics } from "../utils/editor-navigation";

/**
 * A `<textarea>` exposes no API for "where does line N actually paint" — every gutter number,
 * highlight bar, and minimap marker in this editor previously assumed every line is exactly
 * `metrics.lineHeight` tall, computed from `paddingTop + (line - 1) * lineHeight`. This mirrors
 * the textarea's exact text and box styles into a hidden, unwrapped DOM twin and reads each
 * line's real `offsetTop` from it instead, so all three stay pinned to what the browser actually
 * rendered rather than to an assumption about it.
 */
export function useMeasuredLineOffsets(
  editorRef: RefObject<HTMLTextAreaElement | null>,
  value: string,
  metrics: Pick<EditorViewportMetrics, "paddingTop" | "lineHeight">
) {
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const lineElementsRef = useRef<HTMLDivElement[]>([]);
  const [, forceRemeasure] = useState(0);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    let mirror = mirrorRef.current;
    if (!mirror) {
      mirror = document.createElement("div");
      mirror.setAttribute("aria-hidden", "true");
      Object.assign(mirror.style, {
        position: "fixed",
        top: "0",
        left: "-99999px",
        margin: "0",
        visibility: "hidden",
        pointerEvents: "none",
        whiteSpace: "pre"
      });
      document.body.appendChild(mirror);
      mirrorRef.current = mirror;
    }

    const styles = window.getComputedStyle(editor);
    mirror.style.font = styles.font;
    mirror.style.letterSpacing = styles.letterSpacing;
    mirror.style.tabSize = styles.tabSize;
    mirror.style.boxSizing = styles.boxSizing;
    mirror.style.paddingTop = styles.paddingTop;
    mirror.style.paddingLeft = styles.paddingLeft;
    mirror.style.paddingRight = styles.paddingRight;

    const fragment = document.createDocumentFragment();
    const lineElements = value.split("\n").map((line) => {
      const lineElement = document.createElement("div");
      lineElement.textContent = line.length ? line : "​";
      fragment.appendChild(lineElement);
      return lineElement;
    });
    mirror.replaceChildren(fragment);
    lineElementsRef.current = lineElements;
    forceRemeasure((count) => count + 1);
  }, [editorRef, value, metrics.paddingTop, metrics.lineHeight]);

  useEffect(
    () => () => {
      mirrorRef.current?.remove();
      mirrorRef.current = null;
    },
    []
  );

  return {
    lineTop(line: number): number {
      const safeLine = Math.max(1, line);
      const formulaTop = metrics.paddingTop + (safeLine - 1) * metrics.lineHeight;
      const element = lineElementsRef.current[safeLine - 1];
      if (!element) return formulaTop;
      const measured = element.offsetTop;
      // A line past the first can never really render at pixel 0 — it would have to sit above
      // line 1. Seeing that means this environment isn't laying out text at all (no layout
      // engine, e.g. tests, or the mirror hasn't painted yet), so the measurement is meaningless
      // here rather than merely imprecise; fall back to the formula instead of collapsing every
      // line to the top.
      return measured === 0 && safeLine > 1 ? formulaTop : measured;
    }
  };
}
