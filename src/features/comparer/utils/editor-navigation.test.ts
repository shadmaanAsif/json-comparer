import { describe, expect, it } from "vitest";
import {
  centerRectInWindow,
  minimapMarkerPercent,
  navigationTargetLine,
  scrollOffsetForLine,
  visibleLineRange,
  type EditorViewportMetrics
} from "./editor-navigation";

const compactMetrics: EditorViewportMetrics = {
  clientHeight: 360,
  lineHeight: 22.4,
  paddingTop: 15,
  paddingBottom: 15
};

describe("editor navigation geometry", () => {
  it("uses the measured line height and viewport for visible lines", () => {
    expect(visibleLineRange(0, 100, compactMetrics)).toEqual({ first: 1, last: 16 });
    expect(visibleLineRange(38, 100, compactMetrics)).toEqual({ first: 2, last: 18 });
  });

  it("centers a selected line in compact and expanded editors", () => {
    expect(scrollOffsetForLine(40, 2200, compactMetrics)).toBeCloseTo(719.8);
    expect(scrollOffsetForLine(40, 2200, { ...compactMetrics, clientHeight: 800 })).toBeCloseTo(
      499.8
    );
  });

  it("keeps navigation targets away from impossible scroll edges", () => {
    expect(scrollOffsetForLine(1, 2200, compactMetrics)).toBe(0);
    expect(scrollOffsetForLine(100, 2200, compactMetrics)).toBe(1840);
  });

  it("continues from a visible selected line and wraps", () => {
    const lines = [2, 40, 80];
    const range = { first: 30, last: 46 };

    expect(navigationTargetLine(lines, 1, 40, range)).toBe(80);
    expect(navigationTargetLine(lines, -1, 40, range)).toBe(2);
    expect(navigationTargetLine(lines, 1, 80, { first: 70, last: 86 })).toBe(2);
  });

  it("starts from the current viewport when the previous selection is offscreen", () => {
    const lines = [2, 40, 80];
    const range = { first: 30, last: 46 };

    expect(navigationTargetLine(lines, 1, 2, range)).toBe(40);
    expect(navigationTargetLine(lines, -1, 80, range)).toBe(40);
  });

  it("recenters a line even when it's already fully visible", () => {
    // Unconditional, unlike a "scroll into view" check: a line sitting near the top edge of the
    // viewport (top: 100, well within [0, 720]) still gets pulled to vertical center rather than
    // left where it happened to land, so every navigation ends up in the same place.
    const target = centerRectInWindow({ top: 100, height: 22.4 }, 720, 1200);
    expect(target).toBeCloseTo(1200 + 100 + 11.2 - 360);
  });

  it("scrolls the window up to center a line entirely above the viewport", () => {
    const target = centerRectInWindow({ top: -1065, height: 358 }, 720, 2346);
    expect(target).toBeCloseTo(2346 - 1065 + 179 - 360);
  });

  it("scrolls the window down to center a line entirely below the viewport", () => {
    const target = centerRectInWindow({ top: 900, height: 358 }, 720, 0);
    expect(target).toBeCloseTo(900 + 179 - 360);
  });

  it("never targets a negative scroll position", () => {
    const target = centerRectInWindow({ top: -10, height: 358 }, 720, 5);
    expect(target).toBe(0);
  });

  it("places an onscreen minimap marker at the same on-screen fraction as its highlight", () => {
    // Line 1 sits at pixel 15 (paddingTop) in the editor; the minimap is the same clientHeight,
    // so its marker should land at 15/360 of the way down the strip, not 0% (its whole-document
    // fraction) or any other value disconnected from where the highlight actually renders.
    expect(minimapMarkerPercent(15, 0, 360)).toBeCloseTo((15 / 360) * 100);
    expect(minimapMarkerPercent(15 + 9 * 22.4, 0, 360)).toBeCloseTo(((15 + 9 * 22.4) / 360) * 100);
  });

  it("pins a minimap marker to the top edge once its line scrolls above the viewport", () => {
    expect(minimapMarkerPercent(15, 5000, 360)).toBe(0);
  });

  it("pins a minimap marker to the bottom edge once its line scrolls below the viewport", () => {
    expect(minimapMarkerPercent(15 + 999 * 22.4, 0, 360)).toBe(100);
  });
});
