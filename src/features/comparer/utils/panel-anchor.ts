import type { PanelField } from "./panel-context";

export interface PanelAnchorRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Follow the actual field, not a screen coordinate captured when the menu opened. */
export function createPanelAnchor(
  pane: HTMLElement | null,
  view: "json" | "tree",
  field: PanelField,
  line = field.line
): (() => PanelAnchorRect | null) | undefined {
  if (!pane) return;
  const surface = pane.querySelector<HTMLElement>(
    view === "tree" ? ".json-tree" : ".editor-main textarea"
  );
  const node =
    view === "tree"
      ? [...pane.querySelectorAll<HTMLElement>("[data-tree-row]")].find(
          (element) => element.dataset.treeRow === field.pointer
        )
      : surface;
  if (!surface || !node) return;
  return () => {
    if (!node.isConnected || !surface.isConnected || !node.getClientRects().length) return null;
    const bounds = surface.getBoundingClientRect();
    let rect: PanelAnchorRect = node.getBoundingClientRect();
    if (view === "json") {
      const style = window.getComputedStyle(node);
      const lineHeight = Number.parseFloat(style.lineHeight) || 22.4;
      const padding = Number.parseFloat(style.paddingTop) || 0;
      const top = bounds.top + padding + (line - 1) * lineHeight - node.scrollTop;
      rect = { left: bounds.left, right: bounds.right, top, bottom: top + lineHeight };
    }
    if (
      rect.bottom <= bounds.top ||
      rect.top >= bounds.bottom ||
      rect.right <= bounds.left ||
      rect.left >= bounds.right
    )
      return null;
    return rect;
  };
}
