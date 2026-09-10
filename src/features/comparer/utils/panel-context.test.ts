import { describe, expect, it } from "vitest";
import { formatAlignedForDisplay } from "@/domain/comparison/display-format";
import {
  buildPanelIndex,
  getCounterpart,
  getIgnoreAction,
  resolveNearestField
} from "./panel-context";

describe("panel field context", () => {
  it.each([null, 42, "root", [], {}].map((value) => ({ value })))(
    "retains root identity for $value when root types differ",
    ({ value }) => {
      const display = formatAlignedForDisplay(value, { nested: true });
      const index = buildPanelIndex(display.textA, display.lineMapA, display.placeholderLineMapA);
      const root = index.byPointer.get("")!;
      expect(root).toBeDefined();
      expect(JSON.parse(display.textA.slice(root.valueStart, root.valueEnd))).toEqual(value);
    }
  );

  it("distinguishes an empty parent from a foldable container", () => {
    const display = formatAlignedForDisplay({ config: {} }, { config: { added: 1 } });
    const a = buildPanelIndex(display.textA, display.lineMapA, display.placeholderLineMapA);
    const b = buildPanelIndex(display.textB, display.lineMapB, display.placeholderLineMapB);
    expect(a.byPointer.get("/config")?.hasChildren).toBeFalsy();
    expect(b.byPointer.get("/config")?.hasChildren).toBe(true);
  });

  it("copies exact scalar and container values without confusing escaped keys or closing rows", () => {
    const display = formatAlignedForDisplay(
      { "a/b": { "~key": 'a "quoted" } value', empty: null }, "": false },
      { "a/b": { "~key": "new", empty: null }, "": false }
    );
    const index = buildPanelIndex(display.textA, display.lineMapA, display.placeholderLineMapA);
    const field = index.byPointer.get("/a~1b/~0key")!;
    expect(display.textA.slice(field.valueStart, field.valueEnd)).toBe('"a \\"quoted\\" } value"');
    const parent = index.byPointer.get("/a~1b")!;
    expect(JSON.parse(display.textA.slice(parent.valueStart, parent.valueEnd))).toEqual({
      "~key": 'a "quoted" } value',
      empty: null
    });
    expect(index.byLine.get(parent.endLine)?.pointer).toBe("/a~1b");
    expect(index.byPointer.get("/")?.segments).toEqual([""]);
    expect(index.byPointer.get("")?.segments).toEqual([]);
  });

  it("distinguishes absent counterparts from null and false values", () => {
    const display = formatAlignedForDisplay(
      { present: null },
      { present: false, added: { id: 1 } }
    );
    const a = buildPanelIndex(display.textA, display.lineMapA, display.placeholderLineMapA);
    const b = buildPanelIndex(display.textB, display.lineMapB, display.placeholderLineMapB);
    expect(a.byPointer.get("/added/id")?.placeholder).toBe(true);
    expect(getCounterpart(b.byPointer.get("/added/id")!, a, b, "ordered")?.placeholder).toBe(true);
    expect(a.byPointer.get("/present")?.placeholder).toBe(false);
  });

  it("does not invent identity correspondence in unordered arrays", () => {
    const display = formatAlignedForDisplay({ items: [{ id: 1 }] }, { items: [{ id: 2 }] });
    const a = buildPanelIndex(display.textA, display.lineMapA, display.placeholderLineMapA);
    const b = buildPanelIndex(display.textB, display.lineMapB, display.placeholderLineMapB);
    const field = a.byPointer.get("/items/0/id")!;
    expect(getCounterpart(field, b, a, "unordered")).toBeUndefined();
    expect(getCounterpart(field, b, a, "ordered")?.pointer).toBe("/items/0/id");
  });

  it("resolves a counterpart for canonically matched unordered array items, even reordered", () => {
    const display = formatAlignedForDisplay(
      { items: [{ id: 1 }, { id: 2 }] },
      { items: [{ id: 2 }, { id: 1 }] }
    );
    const a = buildPanelIndex(display.textA, display.lineMapA, display.placeholderLineMapA);
    const b = buildPanelIndex(display.textB, display.lineMapB, display.placeholderLineMapB);
    const matchedPointers = { "/items/0": "/items/1", "/items/1": "/items/0" };
    const field = a.byPointer.get("/items/0/id")!;
    expect(getCounterpart(field, b, a, "unordered", matchedPointers)?.pointer).toBe("/items/1/id");
    // An item outside the matched map (genuinely unmatched) still gets no counterpart.
    expect(getCounterpart(field, b, a, "unordered", {})).toBeUndefined();
  });

  it("resolveNearestField walks up to the nearest existing ancestor pointer", () => {
    const index = buildPanelIndex("", { "": 1, "/items": 2, "/items/0": 3, "/items/0/id": 4 }, {});
    // A schema-only pointer that never had a line of its own on this side (e.g. a Candidate
    // array index Baseline never reached) falls back to its nearest existing container.
    expect(resolveNearestField(index, "/items/2/amount")?.pointer).toBe("/items");
    // An exact match still returns itself rather than climbing further.
    expect(resolveNearestField(index, "/items/0/id")?.pointer).toBe("/items/0/id");
    expect(resolveNearestField(index, "/missing")?.pointer).toBe("");
  });

  it("resolveNearestField returns undefined when no ancestor exists at all", () => {
    const index = buildPanelIndex("", { "/items/0": 1 }, {});
    expect(resolveNearestField(index, "/other/path")).toBeUndefined();
  });

  it("restores only its own exact rule and never removes inherited or wildcard rules", () => {
    expect(getIgnoreAction(["config", "token"], "/config/token", []).kind).toBe("ignore");
    expect(getIgnoreAction(["config", "token"], "/config/token", ["/config/token"]).kind).toBe(
      "restore"
    );
    expect(getIgnoreAction(["config", "token"], "/config/token", ["/config"]).kind).toBe("manage");
    expect(
      getIgnoreAction(["config", "token"], "/config/token", ["/config/*", "/config/token"]).kind
    ).toBe("manage");
    expect(getIgnoreAction(["*"], "/*", []).kind).toBe("unsupported");
    expect(getIgnoreAction(["*"], "/*", ["/*"]).kind).toBe("manage");
    expect(getIgnoreAction(["key "], "/key ", []).kind).toBe("unsupported");
    expect(getIgnoreAction([], "", []).kind).toBe("unsupported");
  });
});
