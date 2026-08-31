"use client";

import { buildLineMap } from "@/domain/comparison/line-map";
import { toJsonPointer } from "@/domain/comparison/path";
import type { PathSegment } from "@/domain/comparison/types";
import { useMemo, useRef, useState } from "react";
import type { HighlightCategory } from "../types";
import { FindingStepper } from "./FindingNavigation";

interface TreeNodeProps {
  name?: string;
  value: unknown;
  path: PathSegment[];
  highlights: Record<string, HighlightCategory>;
  activePointer: string | null;
  registerHighlight: (pointer: string, node: HTMLElement | null) => void;
}

const highlightLabels: Record<HighlightCategory, string> = {
  missing: "Missing",
  structure: "Structure",
  differences: "Changed",
  invalid: "Invalid"
};

function HighlightBadge({ category }: { category?: HighlightCategory }) {
  if (!category) return null;
  return <span className="tree-highlight-badge">{highlightLabels[category]}</span>;
}

function highlightClass(category?: HighlightCategory): string {
  return category ? ` tree-highlight tree-highlight-${category}` : "";
}

function TreeNode({
  name,
  value,
  path,
  highlights,
  activePointer,
  registerHighlight
}: TreeNodeProps) {
  const pointer = toJsonPointer(path);
  const category = highlights[pointer];
  const activeClass = category && pointer === activePointer ? " is-active" : "";
  const registerNode = category
    ? (node: HTMLElement | null) => registerHighlight(pointer, node)
    : undefined;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const label = Array.isArray(value)
      ? `[ ${entries.length} item${entries.length === 1 ? "" : "s"} ]`
      : `{ ${entries.length} field${entries.length === 1 ? "" : "s"} }`;
    if (!entries.length) {
      return (
        <div
          ref={registerNode}
          tabIndex={category ? -1 : undefined}
          className={`tree-leaf${highlightClass(category)}${activeClass}`}
        >
          <span className="tree-key">{name}</span> <span>{Array.isArray(value) ? "[]" : "{}"}</span>
          <HighlightBadge category={category} />
        </div>
      );
    }
    return (
      <details className="tree-node" open>
        <summary ref={registerNode} className={`${highlightClass(category).trim()}${activeClass}`}>
          {name !== undefined && <span className="tree-key">{name}: </span>}
          {label}
          <HighlightBadge category={category} />
        </summary>
        <div>
          {entries.map(([key, child]) => (
            <TreeNode
              key={key}
              name={key}
              value={child}
              path={[...path, Array.isArray(value) ? Number(key) : key]}
              highlights={highlights}
              activePointer={activePointer}
              registerHighlight={registerHighlight}
            />
          ))}
        </div>
      </details>
    );
  }
  return (
    <div
      ref={registerNode}
      tabIndex={category ? -1 : undefined}
      className={`tree-leaf value-${value === null ? "null" : typeof value}${highlightClass(category)}${activeClass}`}
    >
      <span className="tree-key">{name}</span>
      {name !== undefined && ": "}
      <span>{typeof value === "string" ? JSON.stringify(value) : String(value)}</span>
      <HighlightBadge category={category} />
    </div>
  );
}

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
  raw,
  lineHighlights = {}
}: {
  raw: string;
  lineHighlights?: Record<number, HighlightCategory>;
}) {
  const treeRef = useRef<HTMLDivElement>(null);
  const highlightedNodeRefs = useRef(new Map<string, HTMLElement>());
  const [activePointer, setActivePointer] = useState<string | null>(null);
  const highlights = useMemo(() => treeHighlights(raw, lineHighlights), [lineHighlights, raw]);
  const highlightedPointers = Object.keys(highlights);
  const activeIndex = activePointer === null ? -1 : highlightedPointers.indexOf(activePointer);
  const categories = (["missing", "structure", "differences", "invalid"] as const).filter(
    (category) => Object.values(highlights).includes(category)
  );

  const registerHighlight = (pointer: string, node: HTMLElement | null) => {
    if (node) highlightedNodeRefs.current.set(pointer, node);
    else highlightedNodeRefs.current.delete(pointer);
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
    const target = highlightedNodeRefs.current.get(pointer);
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

  if (!raw.trim())
    return (
      <div className="empty-state">
        Nothing to show yet — paste or load JSON on the JSON tab first.
      </div>
    );
  let parsed: unknown;
  let parseError = "";
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }
  if (parseError) return <div className="empty-state error">{parseError}</div>;
  return (
    <div className="tree-with-navigation">
      <div ref={treeRef} className="json-tree">
        <TreeNode
          value={parsed}
          path={[]}
          highlights={highlights}
          activePointer={activePointer}
          registerHighlight={registerHighlight}
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
