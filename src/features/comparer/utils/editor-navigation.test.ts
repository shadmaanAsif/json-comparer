import { describe, expect, it } from "vitest";
import {
  minimapMarkerPercent,
  navigationTargetLine,
  scrollOffsetForLine,
  visibleLineRange,
  windowScrollTargetForRect,
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

  it("leaves the window alone when the target rect is already fully visible", () => {
    expect(windowScrollTargetForRect({ top: 0, bottom: 358, height: 358 }, 720, 1200)).toBeNull();
    expect(windowScrollTargetForRect({ top: 100, bottom: 458, height: 358 }, 720, 1200)).toBeNull();
  });

  it("scrolls the window up to reveal a rect entirely above the viewport", () => {
    // top is far negative (well off-screen above), so the target centers the rect vertically.
    const target = windowScrollTargetForRect({ top: -1065, bottom: -707, height: 358 }, 720, 2346);
    expect(target).toBeCloseTo(2346 - 1065 - 181, 0);
  });

  it("scrolls the window down to reveal a rect entirely below the viewport", () => {
    const target = windowScrollTargetForRect({ top: 900, bottom: 1258, height: 358 }, 720, 0);
    expect(target).toBeGreaterThan(0);
  });

  it("never targets a negative scroll position", () => {
    const target = windowScrollTargetForRect({ top: -10, bottom: 348, height: 358 }, 720, 5);
    expect(target).toBe(0);
  });

  it("aligns an oversized rect to the top of the viewport instead of centering it off-screen", () => {
    // A rect taller than the viewport (e.g. a finding-nav toolbar unioned with a tall expanded
    // editor) would have its bottom pushed below the viewport by naive centering. Aligning its
    // top to 0 instead keeps whatever sits at that top edge (the toolbar) fully visible.
    const target = windowScrollTargetForRect({ top: 200, bottom: 1400, height: 1200 }, 720, 100);
    expect(target).toBe(300);
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
