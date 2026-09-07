import { afterEach, describe, expect, it, vi } from "vitest";
import { createPanelAnchor } from "./panel-anchor";
import { buildPanelIndex } from "./panel-context";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
  x: left,
  y: top,
  toJSON: () => ({})
});
const field = buildPanelIndex('{\n  "a/b": 1\n}', { "": 1, "/a~1b": 2 }, {}).byPointer.get(
  "/a~1b"
)!;

describe("panel anchors", () => {
  it("tracks JSON rows through page and editor scrolling, including closing lines", () => {
    const pane = document.createElement("section");
    const main = document.createElement("div");
    main.className = "editor-main";
    const editor = document.createElement("textarea");
    editor.style.lineHeight = "22px";
    editor.style.paddingTop = "10px";
    main.append(editor);
    pane.append(main);
    document.body.append(pane);
    const bounds = vi
      .spyOn(editor, "getBoundingClientRect")
      .mockReturnValue(rect(100, 200, 300, 220));
    vi.spyOn(editor, "getClientRects").mockReturnValue([
      rect(100, 200, 300, 220)
    ] as unknown as DOMRectList);
    const anchor = createPanelAnchor(pane, "json", field, 3)!;
    expect(anchor()).toMatchObject({ left: 100, right: 400, top: 254, bottom: 276 });
    editor.scrollTop = 44;
    expect(anchor()).toMatchObject({ top: 210, bottom: 232 });
    bounds.mockReturnValue(rect(100, 100, 300, 220));
    expect(anchor()).toMatchObject({ top: 110, bottom: 132 });
    editor.scrollTop = 100;
    expect(anchor()).toBeNull();
  });

  it("tracks exact escaped Tree fields and stops when they are clipped, hidden or removed", () => {
    const pane = document.createElement("section");
    const tree = document.createElement("div");
    tree.className = "json-tree";
    const row = document.createElement("div");
    row.dataset.treeRow = "/a~1b";
    tree.append(row);
    pane.append(tree);
    document.body.append(pane);
    vi.spyOn(tree, "getBoundingClientRect").mockReturnValue(rect(100, 200, 300, 220));
    const bounds = vi.spyOn(row, "getBoundingClientRect").mockReturnValue(rect(120, 260, 260, 24));
    const rects = vi
      .spyOn(row, "getClientRects")
      .mockReturnValue([rect(120, 260, 260, 24)] as unknown as DOMRectList);
    const anchor = createPanelAnchor(pane, "tree", field)!;
    expect(anchor()).toMatchObject({ left: 120, right: 380, top: 260, bottom: 284 });
    bounds.mockReturnValue(rect(120, 220, 260, 24));
    expect(anchor()).toMatchObject({ top: 220, bottom: 244 });
    bounds.mockReturnValue(rect(120, 170, 260, 24));
    expect(anchor()).toBeNull();
    bounds.mockReturnValue(rect(120, 260, 260, 24));
    rects.mockReturnValue([] as unknown as DOMRectList);
    expect(anchor()).toBeNull();
    row.remove();
    expect(anchor()).toBeNull();
  });

  it("does not guess an anchor for an absent panel or field", () => {
    expect(createPanelAnchor(null, "tree", field)).toBeUndefined();
    expect(createPanelAnchor(document.createElement("section"), "tree", field)).toBeUndefined();
  });
});
