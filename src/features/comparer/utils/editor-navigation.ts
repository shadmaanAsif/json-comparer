export interface EditorViewportMetrics {
  clientHeight: number;
  lineHeight: number;
  paddingTop: number;
  paddingBottom: number;
}

export const DEFAULT_EDITOR_VIEWPORT_METRICS: EditorViewportMetrics = {
  clientHeight: 360,
  lineHeight: 22.4,
  paddingTop: 15,
  paddingBottom: 15
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function visibleLineRange(
  scrollTop: number,
  totalLines: number,
  metrics: EditorViewportMetrics
) {
  const safeTotalLines = Math.max(1, totalLines);
  const first = Math.floor(Math.max(0, scrollTop - metrics.paddingTop) / metrics.lineHeight) + 1;
  const last = Math.ceil(
    (scrollTop + metrics.clientHeight - metrics.paddingTop) / metrics.lineHeight
  );

  return {
    first: clamp(first, 1, safeTotalLines),
    last: clamp(Math.max(first, last), 1, safeTotalLines)
  };
}

export function scrollOffsetForLine(
  line: number,
  scrollHeight: number,
  metrics: EditorViewportMetrics,
  placement: "center" | "upper" = "center"
) {
  const safeLine = Math.max(1, line);
  const lineTop = metrics.paddingTop + (safeLine - 1) * metrics.lineHeight;
  const desiredOffset =
    placement === "center"
      ? lineTop + metrics.lineHeight / 2 - metrics.clientHeight / 2
      : lineTop - Math.max(metrics.paddingTop, metrics.lineHeight * 2);
  const maximumOffset = Math.max(0, scrollHeight - metrics.clientHeight);

  return clamp(desiredOffset, 0, maximumOffset);
}

/**
 * Target window scrollY that centers `rect`'s vertical midpoint in the viewport. `.workspace`'s
 * decorative `overflow: hidden` (for its rounded corners) stops the browser's native
 * `scrollIntoView` ancestor walk from ever reaching the window, so a caller scrolled far from the
 * editor (e.g. a result row) would see no scroll at all — this bypasses that by targeting the
 * window directly from the element's viewport-relative rect.
 *
 * Unconditional, unlike a "scroll into view" check: a rect already on-screen but near an edge is
 * still recentered, so a navigated-to line lands in the same place — vertical center — on every
 * navigation, regardless of where it happened to be beforehand. That consistency also gives a
 * popup opened right after (e.g. a line's "..." actions) roughly equal room above and below to
 * place itself, rather than being squeezed against whichever edge the line landed near.
 */
export function centerRectInWindow(
  rect: { top: number; height: number },
  viewportHeight: number,
  currentScrollY: number
): number {
  return Math.max(0, currentScrollY + rect.top + rect.height / 2 - viewportHeight / 2);
}

/**
 * Vertical position (0-100) for a minimap marker, expressed as a percentage of the editor's
 * own viewport height. Takes the line's already-measured top (see `useMeasuredLineOffsets`)
 * rather than deriving it from paddingTop/lineHeight itself — the gutter and highlight layer
 * consume that same measured value, so a marker for a currently visible line lands at the same
 * on-screen height as its highlight, and a marker for an offscreen line pins to the nearest edge
 * instead of landing at an unrelated spot.
 */
export function minimapMarkerPercent(
  lineTopPx: number,
  scrollTop: number,
  clientHeight: number
): number {
  if (clientHeight <= 0) return 0;
  return clamp(((lineTopPx - scrollTop) / clientHeight) * 100, 0, 100);
}

export function navigationTargetLine(
  highlightedLines: number[],
  direction: 1 | -1,
  activeLine: number | null,
  visibleRange: { first: number; last: number }
) {
  if (!highlightedLines.length) return null;

  const activeIndex = activeLine === null ? -1 : highlightedLines.indexOf(activeLine);
  if (activeIndex >= 0 && activeLine! >= visibleRange.first && activeLine! <= visibleRange.last) {
    return highlightedLines[
      (activeIndex + direction + highlightedLines.length) % highlightedLines.length
    ]!;
  }

  if (direction === 1) {
    return highlightedLines.find((line) => line >= visibleRange.first) ?? highlightedLines[0]!;
  }

  for (let index = highlightedLines.length - 1; index >= 0; index -= 1) {
    const line = highlightedLines[index]!;
    if (line <= visibleRange.last) return line;
  }

  return highlightedLines.at(-1)!;
}
