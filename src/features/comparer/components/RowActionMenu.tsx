"use client";

import { useId } from "react";
import { useAnchoredMenu } from "../hooks/useAnchoredMenu";
import type { ResultMenuAction } from "../utils/section-actions";
import { AnchoredMenuList } from "./AnchoredMenuList";

export interface RowActionMenuProps {
  /** Accessible name for the trigger and menu, e.g. "Row actions for /data/amount". */
  label: string;
  actions: ResultMenuAction[];
}

export function RowActionMenu({ label, actions }: RowActionMenuProps) {
  const menuId = useId();
  const { open, setOpen, placement, triggerRef, menuRef, onMenuKeyDown } = useAnchoredMenu({
    align: "left"
  });

  return (
    <span className="row-action-menu">
      <button
        ref={triggerRef}
        type="button"
        className="row-action-menu-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <AnchoredMenuList
          menuId={menuId}
          label={label}
          placement={placement}
          menuRef={menuRef}
          actions={actions}
          onKeyDown={onMenuKeyDown}
          onSelect={(action) => {
            setOpen(false);
            triggerRef.current?.focus();
            action.onSelect();
          }}
        />
      )}
    </span>
  );
}
