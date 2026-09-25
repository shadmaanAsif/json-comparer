import { describe, expect, it } from "vitest";
import { findDuplicateObjectKey, JsonParseError, parseJson } from "./parse";

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

  it("rejects a duplicate object key instead of silently keeping only the last one", () => {
    // Without this, the worker would parse the text (JSON.parse silently drops the earlier
    // "first"), then overwrite the editor with the deduplicated result — exactly what made a
    // pasted-in field vanish a moment after pasting, with no error shown.
    expect(() => parseJson('{"first":1,"first":2}', "A")).toThrowError(JsonParseError);
    expect(() => parseJson('{"first":1,"first":2}', "A")).toThrow(/duplicate key "first"/);
  });
});

describe("findDuplicateObjectKey", () => {
  it("finds a duplicate key in the same object literal", () => {
    expect(findDuplicateObjectKey('{"a":1,"a":2}')).toMatchObject({ key: "a" });
  });

  it("does not mistake same-named keys in different objects, or repeated array values, for duplicates", () => {
    expect(findDuplicateObjectKey('{"a":{"x":1},"b":{"x":2}}')).toBeNull();
    expect(findDuplicateObjectKey('[{"a":1},{"a":1}]')).toBeNull();
    expect(findDuplicateObjectKey('["first","first"]')).toBeNull();
  });
});
