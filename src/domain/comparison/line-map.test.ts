import { describe, expect, it } from "vitest";
import { buildLineMap, nearestMappedLine } from "./line-map";

describe("line map", () => {
  it("maps nested object and array JSON Pointers to source lines", () => {
    const map = buildLineMap(
      JSON.stringify({ user: { name: "A" }, items: [{ id: 1 }, 2] }, null, 2)
    );
    expect(map).toMatchObject({
      "": 1,
      "/user": 2,
      "/user/name": 3,
      "/items": 5,
      "/items/0": 6,
      "/items/0/id": 7,
      "/items/1": 9
    });
  });
  it("falls back to the nearest visible ancestor", () =>
    expect(nearestMappedLine("/items/0/missing", { "": 1, "/items": 2, "/items/0": 3 })).toBe(3));

  it("does not treat alignment gap lines as array items", () => {
    const map = buildLineMap('[\n  "first",\n\n  "second"\n]');

    expect(map["/0"]).toBe(2);
    expect(map["/1"]).toBe(4);
    expect(map["/2"]).toBeUndefined();
  });
});
