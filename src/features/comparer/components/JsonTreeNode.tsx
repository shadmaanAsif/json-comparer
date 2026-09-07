"use client";

import { useRef, type KeyboardEvent, type MouseEvent } from "react";
import { toJsonPointer } from "@/domain/comparison/path";
import type { PathSegment } from "@/domain/comparison/types";
import type { HighlightCategory } from "../types";
import type { PanelIndex } from "../utils/panel-context";

export interface TreeFieldActions {
  index?: PanelIndex | null;
  selectedPointer: string | null;
  onSelect: (pointer: string) => void;
  onOpen: (pointer: string, anchor: { x: number; y: number }) => void;
}

interface JsonTreeNodeProps {
  name?: string;
  value: unknown;
  path: PathSegment[];
  highlights: Record<string, HighlightCategory>;
  activePointer: string | null;
  registerNode: (pointer: string, node: HTMLElement | null) => void;
  collapsedPointers?: ReadonlySet<string>;
  onExpandedChange?: (pointer: string, expanded: boolean) => void;
  actions: TreeFieldActions;
}

const highlightLabels: Record<HighlightCategory, string> = {
  missing: "Missing",
  structure: "Structure",
  differences: "Changed",
  invalid: "Invalid"
};

export function JsonTreeNode({
  name,
  value,
  path,
  highlights,
  activePointer,
  registerNode,
  collapsedPointers,
  onExpandedChange,
  actions
}: JsonTreeNodeProps) {
  const pointer = toJsonPointer(path);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const category = highlights[pointer];
  const canAct = !!actions.index?.byPointer.has(pointer);
  const classes = `${category ? ` tree-highlight tree-highlight-${category}` : ""}${pointer === activePointer ? " is-active" : ""}${canAct && pointer === actions.selectedPointer ? " tree-field-selected" : ""}`;
  const select = () => {
    if (canAct) actions.onSelect(pointer);
  };
  const open = (anchor: { x: number; y: number }) => {
    if (!canAct) return;
    triggerRef.current?.focus({ preventScroll: true });
    actions.onOpen(pointer, anchor);
  };
  const onContextMenu = (event: MouseEvent<HTMLElement>) => {
    if (!canAct) return;
    event.preventDefault();
    event.stopPropagation();
    open({ x: event.clientX, y: event.clientY });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!canAct || !(event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)))
      return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    open({ x: rect.left, y: rect.bottom });
  };
  const button = canAct && (
    <button
      ref={triggerRef}
      type="button"
      className="tree-field-actions"
      aria-label={`Actions for field ${pointer || "(root)"}`}
      aria-haspopup="dialog"
      title="Field actions · copy, ignore, review and more"
      onFocus={select}
      onKeyDown={onKeyDown}
      onContextMenu={onContextMenu}
      onClick={(event) => {
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        open({ x: rect.left, y: rect.bottom });
      }}
    >
      <span aria-hidden="true">⋯</span>
    </button>
  );
  const badge = category && (
    <span className="tree-highlight-badge">{highlightLabels[category]}</span>
  );
  const entries = value !== null && typeof value === "object" ? Object.entries(value) : null;
  if (entries?.length) {
    const label = Array.isArray(value)
      ? `[ ${entries.length} item${entries.length === 1 ? "" : "s"} ]`
      : `{ ${entries.length} field${entries.length === 1 ? "" : "s"} }`;
    return (
      <div className={"tree-branch" + (canAct ? " has-field-actions" : "")}>
        {button}
        <details
          className="tree-node"
          data-tree-pointer={pointer}
          open={!collapsedPointers?.has(pointer)}
          onToggle={(event) => onExpandedChange?.(pointer, event.currentTarget.open)}
        >
          <summary
            ref={(node) => registerNode(pointer, node)}
            data-tree-row={pointer}
            className={classes.trim()}
            onFocus={select}
            onClick={select}
            onKeyDown={onKeyDown}
            onContextMenu={onContextMenu}
          >
            {name !== undefined && <span className="tree-key">{name}: </span>}
            {label}
            {badge}
          </summary>
          <div>
            {entries.map(([key, child]) => (
              <JsonTreeNode
                key={key}
                name={key}
                value={child}
                path={[...path, Array.isArray(value) ? Number(key) : key]}
                highlights={highlights}
                activePointer={activePointer}
                registerNode={registerNode}
                collapsedPointers={collapsedPointers}
                onExpandedChange={onExpandedChange}
                actions={actions}
              />
            ))}
          </div>
        </details>
      </div>
    );
  }
  const content = entries
    ? Array.isArray(value)
      ? "[]"
      : "{}"
    : typeof value === "string"
      ? JSON.stringify(value)
      : String(value);
  return (
    <div
      ref={(node) => registerNode(pointer, node)}
      data-tree-row={pointer}
      tabIndex={canAct || category ? -1 : undefined}
      className={`tree-leaf value-${value === null ? "null" : typeof value}${classes}${canAct ? " has-field-actions" : ""}`}
      onFocus={select}
      onClick={(event) => {
        if (canAct) event.currentTarget.focus({ preventScroll: true });
      }}
      onKeyDown={onKeyDown}
      onContextMenu={onContextMenu}
    >
      <span className="tree-key">{name ?? "(root)"}</span>
      {": "}
      <span>{content}</span>
      {badge}
      {button}
    </div>
  );
}
