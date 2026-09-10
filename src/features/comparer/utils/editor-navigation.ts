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
 * Target window scrollY to bring `rect` fully into the viewport, or null if it already is.
 * `.workspace`'s decorative `overflow: hidden` (for its rounded corners) stops the browser's
 * native `scrollIntoView` ancestor walk from ever reaching the window, so a caller scrolled far
 * from the editor (e.g. a result row) sees no scroll at all. This bypasses that by targeting
 * the window directly from the element's viewport-relative rect.
 */
export function windowScrollTargetForRect(
  rect: { top: number; bottom: number; height: number },
  viewportHeight: number,
  currentScrollY: number
): number | null {
  if (rect.top >= 0 && rect.bottom <= viewportHeight) return null;
  return Math.max(0, currentScrollY + rect.top - Math.max(0, (viewportHeight - rect.height) / 2));
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
