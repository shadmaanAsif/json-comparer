import { describe, expect, it } from "vitest";
import { getJsonSyntaxError } from "./json-validation";

describe("getJsonSyntaxError", () => {
  it("does not treat empty or valid JSON as an error", () => {
    expect(getJsonSyntaxError("  ")).toBeNull();
    expect(getJsonSyntaxError('{"valid":true}')).toBeNull();
  });

  it("returns the parser message for invalid JSON", () => {
    expect(getJsonSyntaxError('{"broken":}')).toMatch(/JSON|position|character/i);
  });
});
