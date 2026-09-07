"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { ResponseSide } from "../types";
import { scrollOffsetForLine, type EditorViewportMetrics } from "../utils/editor-navigation";
import type { PanelField, PanelIndex } from "../utils/panel-context";
import { createPanelAnchor } from "../utils/panel-anchor";
import type { PanelActionRequest, PanelNavigation } from "./usePanelInteractions";

export interface TreeParentRequest {
  pointer: string;
  expanded: boolean;
  token: number;
}
export interface TreeNavigationRequest {
  pointer: string;
  placeholder: boolean;
  token: number;
}

export function usePanelEditorActions({
  side,
  value,
  index,
  navigation,
  editorRef,
  paneRef,
  metrics,
  activeView,
  setActiveView,
  setScrollTop,
  synchronizeScroll,
  onOpenActions
}: {
  side: ResponseSide;
  value: string;
  index?: PanelIndex | null;
  navigation?: PanelNavigation;
  editorRef: RefObject<HTMLTextAreaElement | null>;
  paneRef: RefObject<HTMLElement | null>;
  metrics: EditorViewportMetrics;
  activeView: "json" | "tree";
  setActiveView: (view: "json" | "tree") => void;
  setScrollTop: (top: number) => void;
  synchronizeScroll: (side: ResponseSide, editor: HTMLTextAreaElement) => void;
  onOpenActions?: (request: PanelActionRequest) => void;
}) {
  const [selection, setSelection] = useState<{
    line: number;
    pointer: string;
    text: string;
  } | null>(null);
  const [hover, setHover] = useState<{ line: number; index: PanelIndex } | null>(null);
  const hoveredLine = hover?.index === index ? (hover?.line ?? null) : null;
  const hoverLine = (line: number | null) => {
    const next = line !== null && index?.byLine.has(line) ? { line, index } : null;
    setHover((current) =>
      current?.line === next?.line && current?.index === next?.index ? current : next
    );
  };
  const lineAtPointer = (editor: HTMLTextAreaElement, clientY: number) =>
    Math.max(
      1,
      Math.floor(
        (clientY - editor.getBoundingClientRect().top + editor.scrollTop - metrics.paddingTop) /
          metrics.lineHeight
      ) + 1
    );
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [treeRequest, setTreeRequest] = useState<TreeParentRequest & { text: string }>();
  const [treeNavigation, setTreeNavigation] = useState<
    TreeNavigationRequest & { index: PanelIndex }
  >();
  const lastNavigation = useRef<PanelNavigation | undefined>(undefined);
  const selectedLine = index && selection?.text === value ? selection.line : null;
  const selectedPointer = index && selection?.text === value ? selection.pointer : null;
  const caretLine = (editor: HTMLTextAreaElement) =>
    value.slice(0, editor.selectionStart).split("\n").length;
  const selectLine = (line: number) => {
    const field = index?.byLine.get(line);
    if (field) setSelection({ line, pointer: field.pointer, text: value });
  };
  const selectPointer = (pointer: string) => {
    const field = index?.byPointer.get(pointer);
    if (field) setSelection({ line: field.line, pointer, text: value });
  };
  const toggleBranch = (pointer: string, expanded: boolean) => {
    setTreeRequest((current) => ({
      pointer,
      text: value,
      expanded,
      token: (current?.token ?? 0) + 1
    }));
    setActiveView("tree");
  };
  const openField = (
    field: PanelField | undefined,
    anchor: { x: number; y: number },
    view: "json" | "tree",
    line = field?.line
  ) => {
    if (!field || !onOpenActions) return;
    selectPointer(field.pointer);
    const parentExpanded = field.parentPointer === null || !collapsed.has(field.parentPointer);
    onOpenActions({
      view,
      field,
      anchor,
      getAnchor: createPanelAnchor(paneRef.current, view, field, line),
      parentExpanded,
      onToggleParent: () => {
        if (field.parentPointer === null) return;
        toggleBranch(field.parentPointer, !parentExpanded);
      },
      branchExpanded: !collapsed.has(field.pointer),
      onToggleBranch: field.hasChildren
        ? () => toggleBranch(field.pointer, collapsed.has(field.pointer))
        : undefined
    });
  };
  const openLine = (line: number, anchor: { x: number; y: number }) => {
    openField(index?.byLine.get(line), anchor, "json", line);
    selectLine(line);
  };
  const openPointer = (pointer: string, anchor: { x: number; y: number }) =>
    openField(index?.byPointer.get(pointer), anchor, "tree");
  const openSelected = (anchor: { x: number; y: number }) => {
    if (activeView === "json") {
      openLine(selectedLine ?? (editorRef.current ? caretLine(editorRef.current) : 1), anchor);
      return;
    }
    let field = index?.byPointer.get(selectedPointer ?? "");
    while (field?.placeholder && field.parentPointer !== null)
      field = index?.byPointer.get(field.parentPointer);
    openField(field, anchor, "tree");
  };
  const onTreeToggle = (pointer: string, expanded: boolean) =>
    setCollapsed((current) => {
      if (current.has(pointer) === !expanded) return current;
      const next = new Set(current);
      if (expanded) next.delete(pointer);
      else next.add(pointer);
      return next;
    });
  useEffect(() => {
    if (!navigation || navigation.index !== index || lastNavigation.current === navigation) return;
    // Navigate in the destination's current view, without switching tabs.
    const frame = requestAnimationFrame(() => {
      if (activeView === "tree") {
        lastNavigation.current = navigation;
        setTreeNavigation({
          pointer: navigation.field.pointer,
          placeholder: navigation.field.placeholder,
          token: navigation.token,
          index: navigation.index
        });
        return;
      }
      const editor = editorRef.current;
      if (!editor) return;
      lastNavigation.current = navigation;
      setSelection({ line: navigation.field.line, pointer: navigation.field.pointer, text: value });
      const start = value
        .split("\n")
        .slice(0, navigation.field.line - 1)
        .reduce((n, line) => n + line.length + 1, 0);
      editor.focus({ preventScroll: true });
      editor.setSelectionRange(
        start,
        start + (value.split("\n")[navigation.field.line - 1]?.length ?? 0)
      );
      editor.scrollTop = scrollOffsetForLine(
        navigation.field.line,
        editor.scrollHeight,
        metrics,
        "center"
      );
      setScrollTop(editor.scrollTop);
      synchronizeScroll(side, editor);
      editor.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    navigation,
    index,
    activeView,
    editorRef,
    metrics,
    setActiveView,
    setScrollTop,
    side,
    synchronizeScroll,
    value
  ]);
  return {
    hoveredLine,
    hoverLine,
    lineAtPointer,
    selectedLine,
    selectedPointer,
    selectLine,
    selectPointer,
    caretLine,
    openLine,
    openPointer,
    openSelected,
    collapsed,
    onTreeToggle,
    treeRequest: treeRequest?.text === value ? treeRequest : undefined,
    treeNavigation: treeNavigation?.index === index ? treeNavigation : undefined
  };
}
