import { describe, expect, it } from "vitest";
import { alignedVerticalScrollOffset, proportionalScrollOffset } from "./useSynchronizedEditors";

describe("proportionalScrollOffset", () => {
  it("maps the same relative position between differently sized editors", () => {
    expect(proportionalScrollOffset(450, 1000, 100, 2000, 200)).toBe(900);
  });

  it("clamps offsets and handles non-scrollable editors", () => {
    expect(proportionalScrollOffset(2000, 1000, 100, 500, 100)).toBe(400);
    expect(proportionalScrollOffset(0, 100, 100, 500, 100)).toBe(0);
  });

  it("uses the same line offset for structurally aligned editors", () => {
    expect(alignedVerticalScrollOffset(450, 2000, 360, 2000, 360)).toBe(450);
    expect(alignedVerticalScrollOffset(1900, 2000, 360, 2000, 360)).toBe(1640);
  });

  it("falls back to proportional scrolling for temporarily unaligned manual input", () => {
    expect(alignedVerticalScrollOffset(450, 1000, 100, 2000, 200)).toBe(900);
  });
});
