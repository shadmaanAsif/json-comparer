import { describe, expect, it } from "vitest";
import { formatAlignedForDisplay } from "./display-format";
import type { JsonValue } from "./types";

describe("formatAlignedForDisplay", () => {
  it("mirrors a one-sided nested field with equal-height placeholder lines", () => {
    const valueA = { config: { name: "A", tail: true } };
    const valueB = {
      config: { name: "A", extra: { nested: { code: 971 } }, tail: true }
    };

    const aligned = formatAlignedForDisplay(valueA, valueB);
    const linesA = aligned.textA.split("\n");
    const linesB = aligned.textB.split("\n");

    expect(linesA).toHaveLength(linesB.length);
    expect(JSON.parse(aligned.textA)).toEqual(valueA);
    expect(JSON.parse(aligned.textB)).toEqual(valueB);
    expect(aligned.lineMapA["/config/tail"]).toBe(aligned.lineMapB["/config/tail"]);
    expect(aligned.placeholderLineMapA["/config/extra"]).toBe(aligned.lineMapB["/config/extra"]);
    expect(aligned.placeholderLineMapA["/config/extra/nested/code"]).toBe(
      aligned.lineMapB["/config/extra/nested/code"]
    );
    expect(linesA[aligned.placeholderLineMapA["/config/extra"]! - 1]).toBe("");
  });

  it("aligns one-sided fields from either response without changing array order", () => {
    const valueA: JsonValue = {
      before: true,
      items: [{ id: 1, onlyA: { deep: "A" } }, { id: 2 }],
      after: true
    };
    const valueB: JsonValue = {
      before: true,
      items: [{ id: 1 }, { id: 2, onlyB: [1, 2, 3] }],
      after: true
    };

    const aligned = formatAlignedForDisplay(valueA, valueB);

    expect(aligned.textA.split("\n")).toHaveLength(aligned.textB.split("\n").length);
    expect(aligned.lineMapA["/after"]).toBe(aligned.lineMapB["/after"]);
    expect(aligned.placeholderLineMapB["/items/0/onlyA/deep"]).toBe(
      aligned.lineMapA["/items/0/onlyA/deep"]
    );
    expect(aligned.placeholderLineMapA["/items/1/onlyB/2"]).toBe(
      aligned.lineMapB["/items/1/onlyB/2"]
    );
    expect(JSON.parse(aligned.textA)).toEqual(valueA);
    expect(JSON.parse(aligned.textB)).toEqual(valueB);
  });

  it("pads type-changed multiline containers so following fields stay aligned", () => {
    const aligned = formatAlignedForDisplay(
      { changed: { nested: { value: 1 } }, following: "same" },
      { changed: "short", following: "same" }
    );

    expect(aligned.lineMapA["/following"]).toBe(aligned.lineMapB["/following"]);
    expect(aligned.textA.split("\n")).toHaveLength(aligned.textB.split("\n").length);
  });

  it("preserves null array elements while padding a missing tail item", () => {
    const aligned = formatAlignedForDisplay({ items: [null, 1] }, { items: [null] });

    expect(JSON.parse(aligned.textA)).toEqual({ items: [null, 1] });
    expect(JSON.parse(aligned.textB)).toEqual({ items: [null] });
    expect(aligned.placeholderLineMapB["/items/1"]).toBe(aligned.lineMapA["/items/1"]);
  });

  it("keeps paths aligned through deeply nested one-sided content", () => {
    let valueA: JsonValue = { following: true };
    let valueB: JsonValue = { extra: { multiline: [1, 2, 3] }, following: true };
    const segments: string[] = [];
    for (let depth = 0; depth < 64; depth += 1) {
      const segment = `level${depth}`;
      segments.unshift(segment);
      valueA = { [segment]: valueA };
      valueB = { [segment]: valueB };
    }

    const aligned = formatAlignedForDisplay(valueA, valueB);
    const prefix = segments.map((segment) => `/${segment}`).join("");

    expect(aligned.lineMapA[`${prefix}/following`]).toBe(aligned.lineMapB[`${prefix}/following`]);
    expect(aligned.placeholderLineMapA[`${prefix}/extra/multiline/2`]).toBe(
      aligned.lineMapB[`${prefix}/extra/multiline/2`]
    );
  });
});
