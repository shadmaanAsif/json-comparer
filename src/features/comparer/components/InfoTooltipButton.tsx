"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface TooltipPosition {
  top: number;
  left: number;
  placement: "above" | "below";
}

/**
 * A small "i" affordance that reveals detail on hover/focus instead of always-visible text.
 * Never nest this inside another interactive element (e.g. a toggle button) — render it as
 * a sibling, since a button-in-button would be invalid HTML and double-fire clicks.
 *
 * The detail renders through a portal at the trigger's screen coordinates rather than as an
 * absolutely-positioned child. A plain child would get clipped by any scrollable ancestor
 * (e.g. the Missing Fields table's horizontal scroll container) and can lose its `position:
 * fixed` escape the moment an ancestor animates a `transform` (as the highlight-controls chip
 * does on hover) — a transformed ancestor becomes the fixed-position containing block.
 */
export function InfoTooltipButton({ label, detail }: { label: string; detail: string }) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const above = window.innerHeight - rect.bottom < 90;
    setPosition({
      top: above ? rect.top - 6 : rect.bottom + 6,
      left: Math.min(rect.left, Math.max(8, window.innerWidth - 248)),
      placement: above ? "above" : "below"
    });
  }, [open]);

  return (
    <span className="info-tooltip">
      <button
        ref={triggerRef}
        type="button"
        className="info-tooltip-trigger"
        aria-label={label}
        aria-describedby={tooltipId}
        title={open ? undefined : detail}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <circle className="info-icon-ring" cx="10" cy="10" r="7.5" />
          <circle className="info-icon-dot" cx="10" cy="6.5" r="1.1" />
          <path className="info-icon-stem" d="M10 9.3v5" />
        </svg>
      </button>
      {open &&
        position &&
        createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            className={`info-tooltip-detail info-tooltip-detail-${position.placement}`}
            style={{ top: position.top, left: position.left }}
          >
            {detail}
          </span>,
          document.body
        )}
    </span>
  );
}
