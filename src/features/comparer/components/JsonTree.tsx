"use client";

import { buildLineMap } from "@/domain/comparison/line-map";
import { useEffect, useMemo, useRef } from "react";
import type { TreeNavigationRequest, TreeParentRequest } from "../hooks/usePanelEditorActions";
import { SIDE_LABELS } from "../constants";
import type { LineHighlight, ResponseSide } from "../types";
import { JsonTreeNode, type TreeFieldActions } from "./JsonTreeNode";

function treeHighlights(
  raw: string,
  lineHighlights: Record<number, LineHighlight>
): Record<string, LineHighlight> {
  const highlights: Record<string, LineHighlight> = {};
  for (const [pointer, line] of Object.entries(buildLineMap(raw))) {
    const highlight = lineHighlights[line];
    if (highlight) highlights[pointer] = highlight;
  }
  return highlights;
}

export function JsonTree({
  side,
  raw,
  lineHighlights = {},
  mirroredLine = null,
  collapsedPointers,
  onExpandedChange,
  parentRequest,
  navigation,
  actions
}: {
  side: ResponseSide;
  raw: string;
  lineHighlights?: Record<number, LineHighlight>;
  /** The partner panel's active line, mirrored here onto the field that occupies it. */
  mirroredLine?: number | null;
  collapsedPointers?: ReadonlySet<string>;
  onExpandedChange?: (pointer: string, expanded: boolean) => void;
  parentRequest?: TreeParentRequest;
  navigation?: TreeNavigationRequest;
  actions: TreeFieldActions;
}) {
  const treeRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const lastNavigation = useRef<TreeNavigationRequest | undefined>(undefined);
  useEffect(() => {
    if (!parentRequest || !treeRef.current) return;
    const target = [
      ...treeRef.current.querySelectorAll<HTMLDetailsElement>("[data-tree-pointer]")
    ].find((node) => node.dataset.treePointer === parentRequest.pointer);
    if (!target) return;
    let ancestor = target.parentElement?.closest("details");
    while (ancestor) {
      ancestor.open = true;
      ancestor = ancestor.parentElement?.closest("details");
    }
    target.open = parentRequest.expanded;
    const summary = target.querySelector("summary");
    summary?.focus({ preventScroll: true });
    summary?.scrollIntoView?.({ block: "nearest" });
  }, [parentRequest]);
  useEffect(() => {
    if (!navigation || lastNavigation.current === navigation) return;
    let pointer = navigation.pointer;
    let target = nodeRefs.current.get(pointer);
    while (!target && pointer) {
      pointer = pointer.slice(0, pointer.lastIndexOf("/"));
      target = nodeRefs.current.get(pointer);
    }
    if (!target) return;
    lastNavigation.current = navigation;
    let ancestor = target.parentElement?.closest("details");
    while (ancestor && treeRef.current?.contains(ancestor)) {
      ancestor.open = true;
      ancestor = ancestor.parentElement?.closest("details");
    }
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [navigation]);
  const highlights = useMemo(() => treeHighlights(raw, lineHighlights), [lineHighlights, raw]);
  // The field occupying the partner's active line, so a click in one tree highlights the same
  // row in the other. Aligned panels share line numbers, so the map is a plain line lookup.
  const mirroredPointer = useMemo(() => {
    if (mirroredLine === null) return null;
    for (const [pointer, line] of Object.entries(buildLineMap(raw)))
      if (line === mirroredLine) return pointer;
    return null;
  }, [mirroredLine, raw]);

  const registerHighlight = (pointer: string, node: HTMLElement | null) => {
    if (node) nodeRefs.current.set(pointer, node);
    else nodeRefs.current.delete(pointer);
  };

  const parsedDocument = useMemo(() => {
    if (!raw.trim()) return { value: null, error: "" };
    try {
      return { value: JSON.parse(raw) as unknown, error: "" };
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : String(error) };
    }
  }, [raw]);
  if (!raw.trim())
    return (
      <div className="empty-state">
        Nothing to show yet — paste or load JSON on the JSON tab first.
      </div>
    );
  if (parsedDocument.error) return <div className="empty-state error">{parsedDocument.error}</div>;
  return (
    <div className="tree-with-navigation">
      {navigation?.placeholder && (
        <p className="tree-navigation-status" role="status">
          Not present in {SIDE_LABELS[side]}: {navigation.pointer || "(root)"}. Showing the nearest
          existing parent.
        </p>
      )}
      <div ref={treeRef} className="json-tree">
        <JsonTreeNode
          value={parsedDocument.value}
          path={[]}
          highlights={highlights}
          activePointer={null}
          mirroredPointer={mirroredPointer}
          registerNode={registerHighlight}
          collapsedPointers={collapsedPointers}
          onExpandedChange={onExpandedChange}
          actions={actions}
        />
      </div>
    </div>
  );
}
