"use client";

import { useId } from "react";
import { useAnchoredMenu } from "../hooks/useAnchoredMenu";
import type { ResultMenuAction } from "../utils/section-actions";
import { AnchoredMenuList } from "./AnchoredMenuList";

export interface ResultSectionMenuProps {
  /** Section name, used to build the trigger and menu accessible names. */
  sectionLabel: string;
  actions: ResultMenuAction[];
}

export function ResultSectionMenu({ sectionLabel, actions }: ResultSectionMenuProps) {
  const menuId = useId();
  const { open, setOpen, placement, triggerRef, menuRef, onMenuKeyDown } = useAnchoredMenu({
    align: "right"
  });
  const label = `${sectionLabel} actions`;

  return (
    <span className="result-section-menu">
      <button
        ref={triggerRef}
        type="button"
        className="result-section-menu-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          // The trigger sits inside <summary>; never let it toggle the section.
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <circle cx="10" cy="4.2" r="1.7" />
          <circle cx="10" cy="10" r="1.7" />
          <circle cx="10" cy="15.8" r="1.7" />
        </svg>
      </button>
      {open && (
        <AnchoredMenuList
          menuId={menuId}
          label={label}
          placement={placement}
          menuRef={menuRef}
          actions={actions}
          onKeyDown={onMenuKeyDown}
          onContainerClick={(event) => event.stopPropagation()}
          onSelect={(action, event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            triggerRef.current?.focus();
            action.onSelect();
          }}
        />
      )}
    </span>
  );
}
