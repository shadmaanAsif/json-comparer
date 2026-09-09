"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { SectionAction } from "../utils/section-actions";

export interface ResultSectionMenuProps {
  /** Section name, used to build the trigger and menu accessible names. */
  sectionLabel: string;
  actions: SectionAction[];
}

interface MenuPlacement {
  right: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

const MARGIN = 12;
const PREFERRED_HEIGHT = 200;

export function ResultSectionMenu({ sectionLabel, actions }: ResultSectionMenuProps) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<MenuPlacement | null>(null);

  // Fixed positioning keeps the menu outside the section's `overflow: hidden`
  // box. No ancestor establishes a fixed containing block, so it is not clipped.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom;
      const above = rect.top;
      const openDown = below >= PREFERRED_HEIGHT || below >= above;
      setPlacement({
        right: Math.max(MARGIN, window.innerWidth - rect.right),
        top: openDown ? rect.bottom + 6 : undefined,
        bottom: openDown ? undefined : Math.max(MARGIN, window.innerHeight - rect.top + 6),
        maxHeight: Math.max(120, (openDown ? below : above) - MARGIN - 6)
      });
    };
    place();
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        place();
      });
    };
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Keep Escape from also reaching the surrounding page.
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", dismissOutside, true);
    document.addEventListener("keydown", dismissOnEscape, true);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside, true);
      document.removeEventListener("keydown", dismissOnEscape, true);
    };
  }, [open]);

  const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []
    );
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (next: number) => {
      event.preventDefault();
      items[(next + items.length) % items.length]?.focus();
    };
    if (event.key === "ArrowDown") focusAt(current + 1);
    else if (event.key === "ArrowUp") focusAt(current - 1);
    else if (event.key === "Home") focusAt(0);
    else if (event.key === "End") focusAt(items.length - 1);
  };

  return (
    <span className="result-section-menu">
      <button
        ref={triggerRef}
        type="button"
        className="result-section-menu-button"
        aria-label={`${sectionLabel} actions`}
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
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`${sectionLabel} actions`}
          className="result-section-menu-list"
          style={{
            right: placement?.right,
            top: placement?.top,
            bottom: placement?.bottom,
            maxHeight: placement?.maxHeight
          }}
          onKeyDown={moveFocus}
          onClick={(event) => event.stopPropagation()}
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="result-section-menu-item"
              disabled={action.disabled}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                triggerRef.current?.focus();
                action.onSelect();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
