"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ResponseSide } from "../types";

export function proportionalScrollOffset(
  sourceOffset: number,
  sourceScrollSize: number,
  sourceClientSize: number,
  targetScrollSize: number,
  targetClientSize: number
) {
  const sourceRange = Math.max(0, sourceScrollSize - sourceClientSize);
  const targetRange = Math.max(0, targetScrollSize - targetClientSize);
  if (!sourceRange || !targetRange) return 0;
  return Math.min(targetRange, Math.max(0, (sourceOffset / sourceRange) * targetRange));
}

export function alignedVerticalScrollOffset(
  sourceOffset: number,
  sourceScrollSize: number,
  sourceClientSize: number,
  targetScrollSize: number,
  targetClientSize: number
) {
  const targetRange = Math.max(0, targetScrollSize - targetClientSize);
  if (Math.abs(sourceScrollSize - targetScrollSize) <= 1) {
    return Math.min(targetRange, Math.max(0, sourceOffset));
  }
  return proportionalScrollOffset(
    sourceOffset,
    sourceScrollSize,
    sourceClientSize,
    targetScrollSize,
    targetClientSize
  );
}

export function useSynchronizedEditors() {
  const editors = useRef<Partial<Record<ResponseSide, HTMLTextAreaElement>>>({});
  const programmaticSide = useRef<ResponseSide | null>(null);
  const clearFrame = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (clearFrame.current !== null) cancelAnimationFrame(clearFrame.current);
    },
    []
  );

  const registerEditor = useCallback((side: ResponseSide, editor: HTMLTextAreaElement | null) => {
    if (editor) editors.current[side] = editor;
    else delete editors.current[side];
  }, []);

  const synchronizeScroll = useCallback((side: ResponseSide, source: HTMLTextAreaElement) => {
    if (programmaticSide.current === side) {
      programmaticSide.current = null;
      return;
    }
    const targetSide: ResponseSide = side === "A" ? "B" : "A";
    const target = editors.current[targetSide];
    if (!target) return;

    const nextTop = alignedVerticalScrollOffset(
      source.scrollTop,
      source.scrollHeight,
      source.clientHeight,
      target.scrollHeight,
      target.clientHeight
    );
    const nextLeft = proportionalScrollOffset(
      source.scrollLeft,
      source.scrollWidth,
      source.clientWidth,
      target.scrollWidth,
      target.clientWidth
    );
    if (Math.abs(target.scrollTop - nextTop) < 0.5 && Math.abs(target.scrollLeft - nextLeft) < 0.5)
      return;

    programmaticSide.current = targetSide;
    target.scrollTop = nextTop;
    target.scrollLeft = nextLeft;
    if (clearFrame.current !== null) cancelAnimationFrame(clearFrame.current);
    clearFrame.current = requestAnimationFrame(() => {
      programmaticSide.current = null;
      clearFrame.current = null;
    });
  }, []);

  return { registerEditor, synchronizeScroll };
}
