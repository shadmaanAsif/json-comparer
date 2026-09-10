"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

export interface AnchoredMenuPlacement {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

const MARGIN = 12;
const PREFERRED_HEIGHT = 200;
// Mirrors the CSS min-width on the shared menu-list styling; only needed to keep a
// left-anchored menu from overflowing the viewport's right edge.
const MENU_MIN_WIDTH = 244;

export interface UseAnchoredMenuOptions {
  /** Which edge of the trigger the menu's horizontal position is anchored to. */
  align?: "left" | "right";
}

/**
 * Shared behavior for a button that opens a small fixed-position dropdown menu: placement
 * relative to the trigger, outside-click/Escape dismissal, and roving keyboard focus.
 * Used by both the per-section bulk-action menu and per-row action menus.
 */
export function useAnchoredMenu({ align = "right" }: UseAnchoredMenuOptions = {}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<AnchoredMenuPlacement | null>(null);

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
        ...(align === "right"
          ? { right: Math.max(MARGIN, window.innerWidth - rect.right) }
          : {
              left: Math.max(
                MARGIN,
                Math.min(rect.left, window.innerWidth - MENU_MIN_WIDTH - MARGIN)
              )
            }),
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
  }, [open, align]);

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

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
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

  return { open, setOpen, placement, triggerRef, menuRef, onMenuKeyDown };
}
