import { describe, expect, it } from "vitest";
import { JsonParseError, parseJson } from "./parse";

describe("parseJson", () => {
  it("parses and formats valid JSON", () => {
    expect(parseJson('{"a":1}', "A")).toEqual({ value: { a: 1 }, formatted: '{\n  "a": 1\n}' });
  });

  it("reports the failing side", () => {
    expect(() => parseJson("{", "B")).toThrowError(JsonParseError);
    let caught: unknown;
    try {
      parseJson("{", "B");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(JsonParseError);
    expect((caught as JsonParseError).side).toBe("B");
    expect((caught as Error).message).not.toMatch(/Response/);
  });

  it("enforces byte limits", () => {
    expect(() => parseJson('"long"', "A", 2)).toThrow(/byte limit/);
  });
});
