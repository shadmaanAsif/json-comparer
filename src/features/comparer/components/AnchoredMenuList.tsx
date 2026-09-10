"use client";

import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  RefObject
} from "react";
import type { AnchoredMenuPlacement } from "../hooks/useAnchoredMenu";
import type { ResultMenuAction } from "../utils/section-actions";

export interface AnchoredMenuListProps {
  menuId: string;
  label: string;
  placement: AnchoredMenuPlacement | null;
  menuRef: RefObject<HTMLDivElement | null>;
  actions: ResultMenuAction[];
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onSelect: (action: ResultMenuAction, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onContainerClick?: (event: ReactMouseEvent<HTMLDivElement>) => void;
}

/** Shared dropdown markup for an anchored menu; open state and placement live in useAnchoredMenu. */
export function AnchoredMenuList({
  menuId,
  label,
  placement,
  menuRef,
  actions,
  onKeyDown,
  onSelect,
  onContainerClick
}: AnchoredMenuListProps) {
  return (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label={label}
      className="result-section-menu-list"
      style={{
        left: placement?.left,
        right: placement?.right,
        top: placement?.top,
        bottom: placement?.bottom,
        maxHeight: placement?.maxHeight
      }}
      onKeyDown={onKeyDown}
      onClick={onContainerClick}
    >
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          role="menuitem"
          tabIndex={-1}
          className="result-section-menu-item"
          disabled={action.disabled}
          onClick={(event) => onSelect(action, event)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
