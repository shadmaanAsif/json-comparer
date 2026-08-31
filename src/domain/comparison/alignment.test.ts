import { describe, expect, it } from "vitest";
import { compareJson } from "./engine";
import { alignForDisplay } from "./alignment";
import type { ComparisonOptions, JsonValue } from "./types";

const options: ComparisonOptions = {
  arrayMode: "ordered",
  ignorePatterns: [],
  maxDepth: 256,
  maxFindings: 100_000
};

describe("alignForDisplay", () => {
  it("uses A as the shared-key baseline while keeping keys only in B in their slots", () => {
    const a: JsonValue = { first: 1, second: 2, third: 3 };
    const b: JsonValue = { before: true, third: 30, first: 10, after: true };

    const aligned = alignForDisplay(a, b);

    expect(Object.keys(aligned.valueA as object)).toEqual(["first", "second", "third"]);
    expect(Object.keys(aligned.valueB as object)).toEqual(["before", "first", "third", "after"]);
  });

  it("aligns nested objects without changing array element order", () => {
    const a: JsonValue = [
      { id: 1, name: "one" },
      { id: 2, name: "two" }
    ];
    const b: JsonValue = [
      { name: "two", id: 2 },
      { name: "one", id: 1 }
    ];

    const aligned = alignForDisplay(a, b);

    expect(aligned.valueB).toEqual([
      { id: 2, name: "two" },
      { id: 1, name: "one" }
    ]);
  });

  it("does not mutate inputs or alter comparison results", () => {
    const a: JsonValue = { value: 1, nested: { a: true, b: false } };
    const b: JsonValue = { nested: { b: true, a: true }, value: 2 };
    const originalA = JSON.stringify(a);
    const originalB = JSON.stringify(b);
    const before = compareJson(a, b, options);

    const aligned = alignForDisplay(a, b);

    expect(JSON.stringify(a)).toBe(originalA);
    expect(JSON.stringify(b)).toBe(originalB);
    expect(compareJson(aligned.valueA, aligned.valueB, options)).toEqual(before);
  });
});
