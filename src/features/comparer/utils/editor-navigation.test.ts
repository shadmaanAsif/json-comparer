import { describe, expect, it } from "vitest";
import {
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
});
