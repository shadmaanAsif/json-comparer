"use client";

import { buildLineMap } from "@/domain/comparison/line-map";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TreeNavigationRequest, TreeParentRequest } from "../hooks/usePanelEditorActions";
import type { HighlightCategory, ResponseSide } from "../types";
import { FindingStepper } from "./FindingNavigation";
import { JsonTreeNode, type TreeFieldActions } from "./JsonTreeNode";

function treeHighlights(
  raw: string,
  lineHighlights: Record<number, HighlightCategory>
): Record<string, HighlightCategory> {
  const highlights: Record<string, HighlightCategory> = {};
  for (const [pointer, line] of Object.entries(buildLineMap(raw))) {
    const category = lineHighlights[line];
    if (category) highlights[pointer] = category;
  }
  return highlights;
}

export function JsonTree({
  side,
  raw,
  lineHighlights = {},
  collapsedPointers,
  onExpandedChange,
  parentRequest,
  navigation,
  actions
}: {
  side: ResponseSide;
  raw: string;
  lineHighlights?: Record<number, HighlightCategory>;
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
  const [activePointer, setActivePointer] = useState<string | null>(null);
  const highlights = useMemo(() => treeHighlights(raw, lineHighlights), [lineHighlights, raw]);
  const highlightedPointers = Object.keys(highlights);
  const activeIndex = activePointer === null ? -1 : highlightedPointers.indexOf(activePointer);
  const categories = (["missing", "structure", "differences", "invalid"] as const).filter(
    (category) => Object.values(highlights).includes(category)
  );

  const registerHighlight = (pointer: string, node: HTMLElement | null) => {
    if (node) nodeRefs.current.set(pointer, node);
    else nodeRefs.current.delete(pointer);
  };

  const navigateFinding = (direction: 1 | -1) => {
    if (!highlightedPointers.length) return;
    const nextIndex =
      activeIndex < 0
        ? direction === 1
          ? 0
          : highlightedPointers.length - 1
        : (activeIndex + direction + highlightedPointers.length) % highlightedPointers.length;
    const pointer = highlightedPointers[nextIndex]!;
    const target = nodeRefs.current.get(pointer);
    const tree = treeRef.current;
    if (!target || !tree) return;

    let parentDetails = target.closest("details");
    while (parentDetails && tree.contains(parentDetails)) {
      parentDetails.open = true;
      parentDetails = parentDetails.parentElement?.closest("details") ?? null;
    }

    const treeRect = tree.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    tree.scrollTop +=
      targetRect.top - treeRect.top - Math.max(0, (tree.clientHeight - targetRect.height) / 2);
    setActivePointer(pointer);
    target.focus({ preventScroll: true });
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
          Not present in Response {side}: {navigation.pointer || "(root)"}. Showing the nearest
          existing parent.
        </p>
      )}
      <div ref={treeRef} className="json-tree">
        <JsonTreeNode
          value={parsedDocument.value}
          path={[]}
          highlights={highlights}
          activePointer={activePointer}
          registerNode={registerHighlight}
          collapsedPointers={collapsedPointers}
          onExpandedChange={onExpandedChange}
          actions={actions}
        />
      </div>
      <FindingStepper
        label="Tree"
        categories={categories}
        current={(activeIndex < 0 ? 0 : activeIndex) + 1}
        total={highlightedPointers.length}
        onPrevious={() => navigateFinding(-1)}
        onNext={() => navigateFinding(1)}
      />
    </div>
  );
}
