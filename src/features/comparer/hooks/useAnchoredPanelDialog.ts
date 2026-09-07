"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { PanelActionRequest } from "./usePanelInteractions";

export function useAnchoredPanelDialog(
  dialogRef: RefObject<HTMLDialogElement | null>,
  request: PanelActionRequest,
  onClose: () => void
) {
  const { anchor, getAnchor, view } = request;
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const initialScroll = { x: window.scrollX, y: window.scrollY };
    let frame = 0;
    let dismissed = false;
    let placement: "above" | "below" | undefined;
    const position = () => {
      if (dismissed) return;
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const rect = getAnchor?.();
      // Keep a scroll-relative fallback for callers that only supply an opening point.
      const x = rect
        ? view === "tree"
          ? rect.right + 8
          : rect.left + 8
        : anchor.x + initialScroll.x - window.scrollX;
      const y = rect?.top ?? anchor.y + initialScroll.y - window.scrollY;
      const bottom = rect?.bottom ?? y;
      if (
        (!rect && getAnchor) ||
        bottom <= top ||
        y >= top + height ||
        (rect && (rect.right <= left || rect.left >= left + width))
      ) {
        dismissed = true;
        dialog.close();
        closeRef.current();
        return;
      }
      const margin = 12;
      const below = Math.max(0, top + height - Math.max(top, bottom) - margin - 6);
      const above = Math.max(0, Math.min(y, top + height) - top - margin - 6);
      placement ??= below >= 260 || below >= above ? "below" : "above";
      // Change side only when the current side can no longer hold usable controls.
      if (
        (placement === "below" ? below : above) < 160 &&
        (placement === "below" ? above : below) > 160
      )
        placement = placement === "below" ? "above" : "below";
      dialog.style.maxHeight = Math.max(0, placement === "below" ? below : above) + "px";
      dialog.style.maxWidth = Math.max(0, width - margin * 2) + "px";
      const size = dialog.getBoundingClientRect();
      dialog.style.left =
        Math.max(left + margin, Math.min(x, left + width - size.width - margin)) + "px";
      dialog.style.top =
        (placement === "below" ? Math.max(top + margin, bottom + 6) : y - size.height - 6) + "px";
    };
    const schedule = (event?: Event) => {
      // Scrolling notes or the popup itself must not reposition or dismiss it.
      if (event?.target instanceof Node && dialog.contains(event.target)) return;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        position();
      });
    };
    dialog.showModal();
    position();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => schedule());
    observer?.observe(dialog);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    return () => {
      dismissed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      dialog.close();
    };
  }, [dialogRef, anchor, getAnchor, view]);
}
