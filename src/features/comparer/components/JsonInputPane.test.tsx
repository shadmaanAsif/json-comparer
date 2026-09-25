import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { formatAlignedForDisplay } from "@/domain/comparison/display-format";
import { buildPanelIndex } from "../utils/panel-context";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JsonInputPane, type JsonInputPaneProps } from "./JsonInputPane";

afterEach(cleanup);

function renderPane(value: string, overrides: Partial<JsonInputPaneProps> = {}) {
  const props: JsonInputPaneProps = {
    side: "A",
    value,
    onChange: vi.fn(),
    onPaste: vi.fn(),
    onFileLoad: vi.fn(),
    onAdd: vi.fn(),
    onPrettify: vi.fn(),
    curlCommand: null,
    onCurlCommandChange: vi.fn(),
    onCurlRun: vi.fn(),
    onCurlClose: vi.fn(),
    isFetching: false,
    lineHighlights: {},
    registerEditor: vi.fn(),
    synchronizeScroll: vi.fn(),
    ...overrides
  };

  return { ...render(<JsonInputPane {...props} />), props };
}

describe("JsonInputPane validation state", () => {
  it("shows explicit row action buttons after comparison and opens the clicked line", async () => {
    const user = userEvent.setup();
    const display = formatAlignedForDisplay({ price: 10 }, { price: 12 });
    const panelIndex = buildPanelIndex(
      display.textA,
      display.lineMapA,
      display.placeholderLineMapA
    );
    const { props, container, rerender } = renderPane(display.textA, {
      panelIndex,
      onOpenActions: vi.fn()
    });
    const button = screen.getByRole("button", { name: "Actions for line 2" });
    expect(button).toHaveTextContent("⋯");
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).toHaveAttribute("title", expect.stringContaining("copy, ignore, review"));
    await user.hover(button);
    expect(container.querySelector(".line-action-hover")).toBeInTheDocument();
    await user.click(button);
    expect(vi.mocked(props.onOpenActions!).mock.lastCall?.[0].field.pointer).toBe("/price");
    expect(props.onChange).not.toHaveBeenCalled();
    rerender(<JsonInputPane {...props} panelIndex={null} />);
    expect(screen.queryByRole("button", { name: "Actions for line 2" })).not.toBeInTheDocument();
    expect(container.querySelector(".line-action-icon")).not.toBeInTheDocument();
    expect(container.querySelector(".line-action-hover")).not.toBeInTheDocument();
  });

  it('only re-scrolls a line\'s "..." click when the line isn\'t already visible', async () => {
    // Regression test: the gutter's click handler used to call jumpToLine(line, "upper")
    // unconditionally, so clicking "..." on a line Previous/Next had just centered would
    // immediately relocate it near the top of the editor, before the popup even opened.
    const user = userEvent.setup();
    const fields = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`k${i}`, i]));
    const display = formatAlignedForDisplay(fields, fields);
    const panelIndex = buildPanelIndex(
      display.textA,
      display.lineMapA,
      display.placeholderLineMapA
    );
    const { props } = renderPane(display.textA, { panelIndex, onOpenActions: vi.fn() });
    const editor = screen.getByRole("textbox", {
      name: "JSON for Baseline"
    }) as HTMLTextAreaElement;
    // jsdom never lays anything out, so give the editor a real scrollHeight to compute against —
    // otherwise scrollOffsetForLine's clamp forces every result to 0, masking this assertion.
    Object.defineProperty(editor, "scrollHeight", { value: 900, configurable: true });

    // jsdom's default (unmeasured) clientHeight of 360px treats lines 1-16 as already visible.
    await user.click(screen.getByRole("button", { name: "Actions for line 2" }));
    expect(editor.scrollTop).toBe(0);
    expect(vi.mocked(props.onOpenActions!)).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Actions for line 20" }));
    expect(editor.scrollTop).toBeGreaterThan(0);
  });

  it("tracks the hovered JSON row while leaving normal text clicks editable", () => {
    const display = formatAlignedForDisplay({ price: 10 }, { price: 12 });
    const panelIndex = buildPanelIndex(
      display.textA,
      display.lineMapA,
      display.placeholderLineMapA
    );
    const { props, container } = renderPane(display.textA, { panelIndex, onOpenActions: vi.fn() });
    const editor = screen.getByRole("textbox", { name: "JSON for Baseline" });
    fireEvent.mouseMove(editor, { clientY: 44 });
    expect(screen.getByRole("button", { name: "Actions for line 2" })).toHaveClass("is-hovered");
    fireEvent.click(editor);
    expect(props.onOpenActions).not.toHaveBeenCalled();
    fireEvent.mouseLeave(container.querySelector(".editor-with-gutter")!);
    expect(container.querySelector(".line-action-hover")).not.toBeInTheDocument();
  });

  it("uses one gutter tab stop with arrow-key navigation and Enter to open actions", async () => {
    const user = userEvent.setup();
    const display = formatAlignedForDisplay({ price: 10 }, { price: 12 });
    const panelIndex = buildPanelIndex(
      display.textA,
      display.lineMapA,
      display.placeholderLineMapA
    );
    const { props, container } = renderPane(display.textA, { panelIndex, onOpenActions: vi.fn() });
    const first = screen.getByRole("button", { name: "Actions for line 1" });
    act(() => first.focus());
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Actions for line 2" })).toHaveFocus();
    expect(container.querySelectorAll('.line-gutter button[tabindex="0"]')).toHaveLength(1);
    await user.keyboard("{Enter}");
    expect(vi.mocked(props.onOpenActions!).mock.lastCall?.[0].field.pointer).toBe("/price");
    expect(screen.getByRole("button", { name: "Actions for line 2" })).toHaveFocus();
  });

  it("opens exact line actions by keyboard and folds the parent without modifying JSON", async () => {
    const display = formatAlignedForDisplay({ config: { code: 1 } }, { config: { code: 2 } });
    const panelIndex = buildPanelIndex(
      display.textA,
      display.lineMapA,
      display.placeholderLineMapA
    );
    const { props, container, rerender } = renderPane(display.textA, {
      panelIndex,
      onOpenActions: vi.fn()
    });
    const editor = screen.getByRole("textbox", {
      name: "JSON for Baseline"
    }) as HTMLTextAreaElement;
    editor.focus();
    editor.setSelectionRange(display.textA.indexOf('"code"'), display.textA.indexOf('"code"'));
    fireEvent.keyDown(editor, { key: "F10", shiftKey: true });
    const request = vi.mocked(props.onOpenActions!).mock.calls[0]![0];
    expect(request.field.pointer).toBe("/config/code");
    act(() => request.onToggleParent());
    await waitFor(() =>
      expect(container.querySelector('details[data-tree-pointer="/config"]')).not.toHaveAttribute(
        "open"
      )
    );
    expect(props.onChange).not.toHaveBeenCalled();
    // Folding focuses the parent; ignore-only reruns (a fresh PanelIndex object, same content)
    // preserve that Tree selection by pointer value rather than by object identity.
    rerender(
      <JsonInputPane
        {...props}
        panelIndex={buildPanelIndex(display.textA, display.lineMapA, display.placeholderLineMapA)}
      />
    );
    expect(container.querySelector('[data-tree-row="/config"]')).toHaveClass("tree-field-selected");
  });

  it("does not expose stale line actions once the comparison index is invalidated", async () => {
    const user = userEvent.setup();
    const display = formatAlignedForDisplay({ a: 1 }, { a: 2 });
    const panelIndex = buildPanelIndex(
      display.textA,
      display.lineMapA,
      display.placeholderLineMapA
    );
    const { props, container, rerender } = renderPane(display.textA, {
      panelIndex,
      onOpenActions: vi.fn()
    });
    expect(screen.getByRole("button", { name: "Actions for line 1" })).toBeInTheDocument();
    rerender(<JsonInputPane {...props} value="{" panelIndex={null} />);
    expect(screen.queryByRole("button", { name: "Actions for line 1" })).not.toBeInTheDocument();
    // The gutter is aria-hidden without a comparison index, so query the DOM directly for the
    // now-inert line button rather than by role.
    await user.click(container.querySelector(".line-gutter button")!);
    expect(props.onOpenActions).not.toHaveBeenCalled();
  });

  it("keeps counterpart navigation in Tree and highlights unchanged fields", async () => {
    const user = userEvent.setup();
    const display = formatAlignedForDisplay({ a: 1 }, { a: 1 });
    const panelIndex = buildPanelIndex(
      display.textA,
      display.lineMapA,
      display.placeholderLineMapA
    );
    const { props, rerender, container } = renderPane(display.textA, { panelIndex });
    await user.click(screen.getByRole("tab", { name: "Tree" }));
    rerender(
      <JsonInputPane
        {...props}
        panelNavigation={{ field: panelIndex.byPointer.get("/a")!, index: panelIndex, token: 1 }}
      />
    );
    await waitFor(() => expect(screen.getByText("a").closest(".tree-leaf")).toHaveFocus());
    expect(screen.getByRole("tab", { name: "Tree" })).toHaveAttribute("aria-selected", "true");
    expect(container.querySelector(".tree-field-selected")).toBeInTheDocument();
  });

  it("keeps a JSON destination in JSON when navigating to its counterpart", async () => {
    const display = formatAlignedForDisplay({ a: 1 }, { a: 1 });
    const panelIndex = buildPanelIndex(
      display.textA,
      display.lineMapA,
      display.placeholderLineMapA
    );
    const { props, rerender, container } = renderPane(display.textA, { panelIndex });
    rerender(
      <JsonInputPane
        {...props}
        panelNavigation={{ field: panelIndex.byPointer.get("/a")!, index: panelIndex, token: 1 }}
      />
    );
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "JSON for Baseline" })).toHaveFocus()
    );
    expect(screen.getByRole("tab", { name: "JSON" })).toHaveAttribute("aria-selected", "true");
    expect(container.querySelector(".line-context")).toBeInTheDocument();
  });

  it("applies a JSON navigation the instant it commits, with no frame where the gutter/highlight still show the previous line", () => {
    // Regression test: this effect used to defer its scroll/selection work to a
    // requestAnimationFrame callback, so the caller's own state (e.g. the shared finding-nav
    // counter, updated in the same event as this prop) could paint one frame before the gutter,
    // highlight, and scroll position here caught up. Asserting with no `waitFor`/timer flush
    // pins the fix: the line-context highlight must already be in the DOM synchronously.
    const display = formatAlignedForDisplay({ a: 1, b: 2 }, { a: 1, b: 2 });
    const panelIndex = buildPanelIndex(
      display.textA,
      display.lineMapA,
      display.placeholderLineMapA
    );
    const { props, rerender, container } = renderPane(display.textA, { panelIndex });
    rerender(
      <JsonInputPane
        {...props}
        panelNavigation={{ field: panelIndex.byPointer.get("/b")!, index: panelIndex, token: 1 }}
      />
    );
    expect(screen.getByRole("textbox", { name: "JSON for Baseline" })).toHaveFocus();
    expect(container.querySelector(".line-context")).toBeInTheDocument();
  });

  it("brings the navigated-to line into view instantly, not with a smooth animation", () => {
    // Regression test: a `behavior: "smooth"` window scroll here left the target line's gutter
    // "..." button drifting under the viewport for several hundred ms (the page also sets
    // `scroll-behavior: smooth` globally), so a click made right after a Previous/Next navigation
    // (the natural next action) could land on the wrong line or miss the button entirely.
    const scrollSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const display = formatAlignedForDisplay({ a: 1, b: 2 }, { a: 1, b: 2 });
    const panelIndex = buildPanelIndex(
      display.textA,
      display.lineMapA,
      display.placeholderLineMapA
    );
    const { props, rerender } = renderPane(display.textA, { panelIndex });
    const editor = screen.getByRole("textbox", { name: "JSON for Baseline" });
    // jsdom lays nothing out, so the editor's rect is all zeros by default. Push it below the
    // viewport so this test exercises the same geometry the browser actually computes.
    vi.spyOn(editor, "getBoundingClientRect").mockReturnValue({
      top: 900,
      bottom: 1400,
      height: 500,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: 900,
      toJSON() {
        return this;
      }
    });
    rerender(
      <JsonInputPane
        {...props}
        panelNavigation={{ field: panelIndex.byPointer.get("/b")!, index: panelIndex, token: 1 }}
      />
    );
    expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: "instant" }));
    scrollSpy.mockRestore();
  });

  it("centers the navigated-to line itself, not the editor's top edge", () => {
    // Regression test: the old scroll target unioned the toolbar-to-editor-bottom rect and
    // top-aligned it when taller than the viewport, so the actual highlighted line could land
    // anywhere from just below the toolbar to off the bottom of the screen — not at vertical
    // center, and not in the same place from one navigation to the next.
    const scrollSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const display = formatAlignedForDisplay({ a: 1, b: 2 }, { a: 1, b: 2 });
    const panelIndex = buildPanelIndex(
      display.textA,
      display.lineMapA,
      display.placeholderLineMapA
    );
    const { props, rerender } = renderPane(display.textA, { panelIndex });
    const editor = screen.getByRole("textbox", { name: "JSON for Baseline" });
    vi.spyOn(editor, "getBoundingClientRect").mockReturnValue({
      top: 900,
      bottom: 1400,
      height: 500,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: 900,
      toJSON() {
        return this;
      }
    });
    rerender(
      <JsonInputPane
        {...props}
        panelNavigation={{ field: panelIndex.byPointer.get("/b")!, index: panelIndex, token: 1 }}
      />
    );
    // "/b" is line 3 (`{`, `"a": 1,`, `"b": 2`): mocked editor top (900) + paddingTop (15) + two
    // lineHeights (22.4 each) — jsdom's scrollHeight is 0, so scrollOffsetForLine clamps scrollTop
    // to 0 regardless of placement.
    const lineTopOnPage = 900 + 15 + 2 * 22.4;
    const expectedTarget = window.scrollY + lineTopOnPage + 22.4 / 2 - window.innerHeight / 2;
    expect(scrollSpy).toHaveBeenCalledWith(
      expect.objectContaining({ top: expect.closeTo(expectedTarget, 5) })
    );
    scrollSpy.mockRestore();
  });

  it("does not call synchronizeScroll from a JSON navigation", () => {
    // Regression test: Previous/Next can navigate both panels in the same commit, each setting its
    // own scrollTop directly. Also calling synchronizeScroll() here raced that cross-write against
    // the other panel's own write and its requestAnimationFrame-timed re-entry guard, ping-ponging
    // through native scroll events until React threw "Maximum update depth exceeded".
    const synchronizeScroll = vi.fn();
    const display = formatAlignedForDisplay({ a: 1, b: 2 }, { a: 1, b: 2 });
    const panelIndex = buildPanelIndex(
      display.textA,
      display.lineMapA,
      display.placeholderLineMapA
    );
    const { props, rerender } = renderPane(display.textA, { panelIndex, synchronizeScroll });
    rerender(
      <JsonInputPane
        {...props}
        synchronizeScroll={synchronizeScroll}
        panelNavigation={{ field: panelIndex.byPointer.get("/b")!, index: panelIndex, token: 1 }}
      />
    );
    expect(synchronizeScroll).not.toHaveBeenCalled();
  });

  it.each([null, {}, []])(
    "offers root actions for %j without a nonexistent branch",
    async (value) => {
      const user = userEvent.setup();
      const display = formatAlignedForDisplay(value, value);
      const panelIndex = buildPanelIndex(
        display.textA,
        display.lineMapA,
        display.placeholderLineMapA
      );
      const { props } = renderPane(display.textA, { panelIndex, onOpenActions: vi.fn() });
      await user.click(screen.getByRole("tab", { name: "Tree" }));
      await user.click(screen.getByRole("button", { name: "Actions for field (root)" }));
      expect(vi.mocked(props.onOpenActions!).mock.lastCall?.[0]).toMatchObject({
        view: "tree",
        field: { pointer: "", parentPointer: null }
      });
      expect(vi.mocked(props.onOpenActions!).mock.lastCall?.[0].onToggleBranch).toBeUndefined();
    }
  );

  it("opens exact Tree field actions without toggling branches or using the last JSON line", async () => {
    const user = userEvent.setup();
    const display = formatAlignedForDisplay(
      { "a/b": { "~key": 1 }, empty: [] },
      { "a/b": { "~key": 2 }, empty: [] }
    );
    const panelIndex = buildPanelIndex(
      display.textA,
      display.lineMapA,
      display.placeholderLineMapA
    );
    const { props, container, rerender } = renderPane(display.textA, {
      panelIndex,
      onOpenActions: vi.fn()
    });
    await user.click(screen.getByRole("tab", { name: "Tree" }));
    const branch = container.querySelector('details[data-tree-pointer="/a~1b"]')!;
    const trigger = screen.getByRole("button", { name: "Actions for field /a~1b" });
    expect(trigger).toHaveTextContent("⋯");
    await user.click(trigger);
    expect(branch).toHaveAttribute("open");
    expect(vi.mocked(props.onOpenActions!).mock.lastCall?.[0]).toMatchObject({
      view: "tree",
      field: { pointer: "/a~1b" },
      branchExpanded: true
    });
    act(() => vi.mocked(props.onOpenActions!).mock.lastCall?.[0].onToggleBranch?.());
    await waitFor(() => expect(branch).not.toHaveAttribute("open"));
    await user.click(trigger);
    expect(vi.mocked(props.onOpenActions!).mock.lastCall?.[0].branchExpanded).toBe(false);
    act(() => vi.mocked(props.onOpenActions!).mock.lastCall?.[0].onToggleBranch?.());
    await waitFor(() => expect(branch).toHaveAttribute("open"));
    await user.click(screen.getByRole("button", { name: "Actions for field /a~1b/~0key" }));
    expect(vi.mocked(props.onOpenActions!).mock.lastCall?.[0].field.pointer).toBe("/a~1b/~0key");
    expect(props.onChange).not.toHaveBeenCalled();
    rerender(<JsonInputPane {...props} panelIndex={null} />);
    expect(
      screen.queryByRole("button", { name: "Actions for field /empty" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Actions for field /a~1b/~0key" })
    ).not.toBeInTheDocument();
  });

  it("supports context-menu keys on Tree fields and does not open a menu on ordinary leaf clicks", async () => {
    const user = userEvent.setup();
    const display = formatAlignedForDisplay({ a: null }, { a: false });
    const panelIndex = buildPanelIndex(
      display.textA,
      display.lineMapA,
      display.placeholderLineMapA
    );
    const { props } = renderPane(display.textA, { panelIndex, onOpenActions: vi.fn() });
    await user.click(screen.getByRole("tab", { name: "Tree" }));
    const row = screen.getByText("a").closest(".tree-leaf")!;
    await user.click(row);
    expect(props.onOpenActions).not.toHaveBeenCalled();
    fireEvent.keyDown(row, { key: "F10", shiftKey: true });
    expect(vi.mocked(props.onOpenActions!).mock.lastCall?.[0].field.pointer).toBe("/a");
    fireEvent.contextMenu(row, { clientX: 80, clientY: 90 });
    expect(vi.mocked(props.onOpenActions!).mock.lastCall?.[0].anchor).toEqual({ x: 80, y: 90 });
  });

  it("opens collapsed ancestors in Tree and explicitly identifies absent fields", async () => {
    const user = userEvent.setup();
    const display = formatAlignedForDisplay(
      { config: { keep: 1 } },
      { config: { keep: 1, absent: 2 } }
    );
    const panelIndex = buildPanelIndex(
      display.textA,
      display.lineMapA,
      display.placeholderLineMapA
    );
    const { props, container, rerender } = renderPane(display.textA, { panelIndex });
    await user.click(screen.getByRole("tab", { name: "Tree" }));
    const branch = container.querySelector('details[data-tree-pointer="/config"]')!;
    await user.click(branch.querySelector("summary")!);
    expect(branch).not.toHaveAttribute("open");
    rerender(
      <JsonInputPane
        {...props}
        panelNavigation={{
          field: panelIndex.byPointer.get("/config/keep")!,
          index: panelIndex,
          token: 1
        }}
      />
    );
    await waitFor(() => expect(screen.getByText("keep").closest(".tree-leaf")).toHaveFocus());
    expect(branch).toHaveAttribute("open");
    rerender(
      <JsonInputPane
        {...props}
        panelNavigation={{
          field: panelIndex.byPointer.get("/config/absent")!,
          index: panelIndex,
          token: 2
        }}
      />
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Not present in Baseline: /config/absent"
      )
    );
    expect(screen.getByRole("tab", { name: "Tree" })).toHaveAttribute("aria-selected", "true");
    expect(
      screen.queryByRole("button", { name: "Actions for field /config/absent" })
    ).not.toBeInTheDocument();
  });

  it("highlights nested comparison findings in the Tree view", async () => {
    const user = userEvent.setup();
    const value = [
      "{",
      '  "changed": 1,',
      '  "data": {',
      '    "countries": [',
      "      {",
      '        "phone": "+971"',
      "      }",
      "    ]",
      "  }",
      "}"
    ].join("\n");
    const { container } = renderPane(value, {
      lineHighlights: {
        2: { category: "differences", ignored: false },
        6: { category: "missing", ignored: false }
      }
    });

    await user.click(screen.getByRole("tab", { name: "Tree" }));

    expect(screen.getByText("changed").closest(".tree-leaf")).toHaveClass(
      "tree-highlight-differences"
    );
    expect(screen.getByText("phone").closest(".tree-leaf")).toHaveClass("tree-highlight-missing");
    // Tree mode relies on background/border highlighting alone — no redundant text badges.
    expect(container.querySelectorAll(".tree-highlight-badge")).toHaveLength(0);

    // The finding stepper now lives once between the panels (in Comparer), not per panel/view.
    expect(screen.queryByLabelText("Tree finding navigation")).not.toBeInTheDocument();
  });

  it("highlights the invalid JSON line and panel only in the JSON view", async () => {
    const user = userEvent.setup();
    const { container } = renderPane('{"broken":}');
    const editor = screen.getByRole("textbox", { name: "JSON for Baseline" });

    expect(container.querySelector(".input-panel")).toHaveClass("has-json-error");
    expect(editor).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Invalid JSON")).toBeVisible();
    expect(screen.getByText("Fix JSON syntax to compare")).toBeVisible();
    expect(container.querySelector(".full-line-highlight.line-invalid")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Tree" }));

    expect(container.querySelector(".input-panel")).not.toHaveClass("has-json-error");
    expect(container.querySelector(".full-line-highlight.line-invalid")).not.toBeInTheDocument();
  });

  it("loads a dropped JSON file and shows the drop-zone overlay only while dragging a file over it", () => {
    const onFileLoad = vi.fn();
    const { container } = renderPane("", { onFileLoad });
    const panel = container.querySelector(".input-panel")!;
    // jsdom's File lacks a working .text(), so stand in a File-shaped object with the
    // one method/property loadFile() actually reads.
    const file = { size: 17, text: () => Promise.resolve('{"dropped":true}') } as unknown as File;
    const fileDataTransfer = { types: ["Files"], files: [file], dropEffect: "" };

    fireEvent.dragEnter(panel, { dataTransfer: fileDataTransfer });
    expect(container.querySelector(".drop-zone-overlay")).toBeInTheDocument();
    expect(panel).toHaveClass("is-drag-over");

    fireEvent.drop(panel, { dataTransfer: fileDataTransfer });
    expect(container.querySelector(".drop-zone-overlay")).not.toBeInTheDocument();
    expect(panel).not.toHaveClass("is-drag-over");
    return waitFor(() => expect(onFileLoad).toHaveBeenCalledWith('{"dropped":true}'));
  });

  it("loads a dropped file's content even when the browser withholds dataTransfer.types until drop (Safari)", () => {
    // Safari doesn't list "Files" in dataTransfer.types during dragenter/dragover, only at
    // drop. The drop zone must still claim the drag (preventDefault) up front, or the browser
    // falls back to its native text-field default of inserting the file's name instead of
    // letting loadFile() read its content.
    const onFileLoad = vi.fn();
    const { container } = renderPane("", { onFileLoad });
    const panel = container.querySelector(".input-panel")!;
    const file = { size: 17, text: () => Promise.resolve('{"dropped":true}') } as unknown as File;
    const withheldDataTransfer = { types: [], files: [], dropEffect: "" };
    const fileDataTransfer = { types: ["Files"], files: [file], dropEffect: "" };

    const dragOverEvent = fireEvent.dragOver(panel, { dataTransfer: withheldDataTransfer });
    expect(dragOverEvent).toBe(false); // false return means preventDefault() was called

    fireEvent.drop(panel, { dataTransfer: fileDataTransfer });
    return waitFor(() => expect(onFileLoad).toHaveBeenCalledWith('{"dropped":true}'));
  });

  it("ignores a non-file drag (such as dragging selected text) without opening the overlay", () => {
    const onFileLoad = vi.fn();
    const { container } = renderPane("", { onFileLoad });
    const panel = container.querySelector(".input-panel")!;
    const textDataTransfer = { types: ["text/plain"], files: [], dropEffect: "" };

    fireEvent.dragEnter(panel, { dataTransfer: textDataTransfer });
    expect(container.querySelector(".drop-zone-overlay")).not.toBeInTheDocument();

    // No .items either, matching a real plain-text DataTransfer shape — must not throw, and
    // must leave the drop unprevented so the browser's native text-insertion still runs.
    const dropEvent = fireEvent.drop(panel, { dataTransfer: textDataTransfer });
    expect(onFileLoad).not.toHaveBeenCalled();
    expect(dropEvent).toBe(true); // true return means preventDefault() was NOT called
  });

  it("loads a dropped file's content even when dataTransfer.types omits Files at drop (real-world Chrome report)", () => {
    // A real report showed dataTransfer.types missing "Files" even in the drop event itself in
    // stock Chrome, which previously made handleDrop bail out before calling preventDefault(),
    // letting the browser navigate the tab to the dropped file instead ("about:blank#blocked").
    // The fix reads dataTransfer.files/.items directly rather than trusting the .types hint.
    const onFileLoad = vi.fn();
    const { container } = renderPane("", { onFileLoad });
    const panel = container.querySelector(".input-panel")!;
    const file = { size: 17, text: () => Promise.resolve('{"dropped":true}') } as unknown as File;
    const typesOmittingFiles = { types: [], files: [file], dropEffect: "" };

    const dropEvent = fireEvent.drop(panel, { dataTransfer: typesOmittingFiles });
    expect(dropEvent).toBe(false); // false return means preventDefault() was called
    return waitFor(() => expect(onFileLoad).toHaveBeenCalledWith('{"dropped":true}'));
  });

  it("shows the empty-state hint only when the panel is empty, hiding it while a file is dragged over", () => {
    const { container, rerender } = renderPane("");
    expect(container.querySelector(".editor-empty-hint")).toBeInTheDocument();
    expect(screen.getByText("No JSON loaded")).toBeInTheDocument();

    const panel = container.querySelector(".input-panel")!;
    const file = { size: 17, text: () => Promise.resolve('{"dropped":true}') } as unknown as File;
    fireEvent.dragEnter(panel, { dataTransfer: { types: ["Files"], files: [file], dropEffect: "" } });
    expect(container.querySelector(".editor-empty-hint")).not.toBeInTheDocument();

    fireEvent.dragLeave(panel);
    rerender(
      <JsonInputPane
        side="A"
        value='{"loaded":true}'
        onChange={vi.fn()}
        onPaste={vi.fn()}
        onFileLoad={vi.fn()}
        onAdd={vi.fn()}
        onPrettify={vi.fn()}
        curlCommand={null}
        onCurlCommandChange={vi.fn()}
        onCurlRun={vi.fn()}
        onCurlClose={vi.fn()}
        isFetching={false}
        lineHighlights={{}}
        registerEditor={vi.fn()}
        synchronizeScroll={vi.fn()}
      />
    );
    expect(container.querySelector(".editor-empty-hint")).not.toBeInTheDocument();
  });

  it("keeps valid and empty panels neutral", () => {
    const { container, rerender } = renderPane('{"valid":true}');

    expect(container.querySelector(".input-panel")).not.toHaveClass("has-json-error");
    expect(screen.getByRole("textbox", { name: "JSON for Baseline" })).toHaveAttribute(
      "aria-invalid",
      "false"
    );

    rerender(
      <JsonInputPane
        side="A"
        value=""
        onChange={vi.fn()}
        onPaste={vi.fn()}
        onFileLoad={vi.fn()}
        onAdd={vi.fn()}
        onPrettify={vi.fn()}
        curlCommand={null}
        onCurlCommandChange={vi.fn()}
        onCurlRun={vi.fn()}
        onCurlClose={vi.fn()}
        isFetching={false}
        lineHighlights={{}}
        registerEditor={vi.fn()}
        synchronizeScroll={vi.fn()}
      />
    );

    expect(container.querySelector(".input-panel")).not.toHaveClass("has-json-error");
  });

  it("centers compact-panel navigation and keeps the selected finding visible", async () => {
    const user = userEvent.setup();
    const lines = ["[", ...Array.from({ length: 98 }, (_, index) => `  ${index},`), "  98", "]"];
    const synchronizeScroll = vi.fn();
    const { container } = renderPane(lines.join("\n"), {
      lineHighlights: {
        40: { category: "differences", ignored: false },
        80: { category: "missing", ignored: false }
      },
      synchronizeScroll
    });
    const editor = screen.getByRole("textbox", { name: "JSON for Baseline" });
    Object.defineProperties(editor, {
      clientHeight: { configurable: true, value: 360 },
      scrollHeight: { configurable: true, value: 2200 }
    });

    // The finding stepper moved to the shared workspace nav; the minimap still centers a finding
    // through the same pane geometry, so it exercises the centering math here.
    await user.click(screen.getByRole("button", { name: "Go to highlighted line 40" }));

    expect(editor.scrollTop).toBeCloseTo(719.8);
    const activeHighlight = container.querySelector<HTMLElement>(".full-line-highlight.is-active");
    expect(Number.parseFloat(activeHighlight?.style.top ?? "")).toBeCloseTo(168.8);
    expect(activeHighlight).toHaveStyle({ height: "22.4px" });
    expect(synchronizeScroll).toHaveBeenLastCalledWith("A", editor);

    await user.click(screen.getByRole("button", { name: "Go to highlighted line 80" }));

    expect(editor.scrollTop).toBeCloseTo(1615.8);
  });

  it("scrolls an offscreen Find match into view instead of leaving it to the browser", async () => {
    // Regression test: jumpFind used to only call editor.focus() + setSelectionRange(), which
    // doesn't reliably scroll a textarea and never centers the match. It now routes through the
    // same jumpToLine/scrollOffsetForLine math as every other jump in this file.
    const user = userEvent.setup();
    const lines = Array.from({ length: 60 }, (_, index) => `line${index}`);
    const value = lines.join("\n");
    renderPane(value);
    const editor = screen.getByRole("textbox", { name: "JSON for Baseline" }) as HTMLTextAreaElement;
    Object.defineProperties(editor, {
      clientHeight: { configurable: true, value: 360 },
      scrollHeight: { configurable: true, value: 1500 }
    });

    await user.click(screen.getByRole("button", { name: "Find" }));
    await user.type(screen.getByPlaceholderText("Find in JSON"), "line55");
    expect(editor.scrollTop).toBe(0);

    await user.click(screen.getByRole("button", { name: "Next" }));

    // "line55" sits on document line 56 (1-indexed), well past the ~16 lines jsdom's default
    // metrics treat as already visible, so a real scroll must have happened.
    expect(editor.scrollTop).toBeCloseTo(15 + 55 * 22.4 + 22.4 / 2 - 180);
    const matchStart = value.indexOf("line55");
    expect(editor.selectionStart).toBe(matchStart);
    expect(editor.selectionEnd).toBe(matchStart + "line55".length);
  });

  it("updates JSON markers and navigation immediately when visible highlights change", () => {
    const value = ["{", '  "first": 1,', '  "second": 2', "}"].join("\n");
    const { container, props, rerender } = renderPane(value, {
      lineHighlights: {
        2: { category: "missing", ignored: false },
        3: { category: "differences", ignored: false }
      }
    });

    expect(container.querySelectorAll(".json-minimap .minimap-marker")).toHaveLength(2);

    rerender(
      <JsonInputPane
        {...props}
        lineHighlights={{ 3: { category: "differences", ignored: false } }}
      />
    );

    expect(container.querySelectorAll(".json-minimap .minimap-marker")).toHaveLength(1);

    rerender(<JsonInputPane {...props} lineHighlights={{}} />);

    expect(container.querySelectorAll(".json-minimap .minimap-marker")).toHaveLength(0);
  });

  it("dims an ignored highlight in the gutter, full-line overlay, and minimap alike", () => {
    const value = ["{", '  "kept": 1,', '  "ignored": 2', "}"].join("\n");
    const { container } = renderPane(value, {
      lineHighlights: {
        2: { category: "differences", ignored: false },
        3: { category: "differences", ignored: true }
      }
    });

    const gutterButtons = container.querySelectorAll(".line-gutter button");
    expect(gutterButtons[1]).not.toHaveClass("is-ignored");
    expect(gutterButtons[2]).toHaveClass("is-ignored");

    const overlayLines = container.querySelectorAll(".full-line-highlight.line-differences");
    expect(overlayLines[0]).not.toHaveClass("is-ignored");
    expect(overlayLines[1]).toHaveClass("is-ignored");

    const markers = container.querySelectorAll(".json-minimap .minimap-marker");
    expect(markers[0]).not.toHaveClass("is-ignored");
    expect(markers[1]).toHaveClass("is-ignored");
    expect(markers[1]).toHaveAttribute("title", "Line 3 — differences (ignored)");
  });

  it("fades the ignored line's own JSON text, not just the highlight bar behind it", () => {
    const value = ["{", '  "kept": 1,', '  "ignored": 2', "}"].join("\n");
    const { container } = renderPane(value, {
      lineHighlights: {
        2: { category: "differences", ignored: false },
        3: { category: "differences", ignored: true }
      }
    });

    expect(container.querySelectorAll(".line-text-dim")).toHaveLength(1);
  });

  it("dims an ignored highlight in the Tree view via opacity alone, no text badge", async () => {
    const user = userEvent.setup();
    const value = ["{", '  "kept": 1,', '  "ignored": 2', "}"].join("\n");
    const { container } = renderPane(value, {
      lineHighlights: {
        2: { category: "differences", ignored: false },
        3: { category: "differences", ignored: true }
      }
    });

    await user.click(screen.getByRole("tab", { name: "Tree" }));

    expect(screen.getByText("kept").closest(".tree-leaf")).not.toHaveClass("is-ignored");
    expect(screen.getByText("ignored").closest(".tree-leaf")).toHaveClass("is-ignored");
    expect(container.querySelectorAll(".tree-highlight-badge")).toHaveLength(0);
  });
});

describe("JsonInputPane paste handling", () => {
  function getEditor() {
    return screen.getByRole("textbox", { name: "JSON for Baseline" }) as HTMLTextAreaElement;
  }

  it("inserts ordinary pasted text at the cursor", () => {
    const { props } = renderPane('{"a":1}');
    const editor = getEditor();
    editor.focus();
    editor.setSelectionRange(7, 7);
    fireEvent.paste(editor, { clipboardData: { getData: () => ',"b":2' } });
    expect(props.onPaste).toHaveBeenCalledWith('{"a":1},"b":2');
  });

  it("loads a pasted URL instead of inserting it, into an empty panel", () => {
    const { props } = renderPane("", { onPasteUrl: vi.fn() });
    const editor = getEditor();
    editor.focus();
    fireEvent.paste(editor, {
      clipboardData: { getData: () => "https://api.example.com/users/1" }
    });
    expect(props.onPasteUrl).toHaveBeenCalledWith("https://api.example.com/users/1");
    expect(props.onPaste).not.toHaveBeenCalled();
  });

  it("loads a pasted URL instead of inserting it, when it replaces a fully selected panel", () => {
    const value = '{"old":true}';
    const { props } = renderPane(value, { onPasteUrl: vi.fn() });
    const editor = getEditor();
    editor.focus();
    editor.setSelectionRange(0, value.length);
    fireEvent.paste(editor, {
      clipboardData: { getData: () => "  https://api.example.com/users/1  " }
    });
    expect(props.onPasteUrl).toHaveBeenCalledWith("https://api.example.com/users/1");
    expect(props.onPaste).not.toHaveBeenCalled();
  });

  it("inserts a pasted URL literally instead of fetching it when it would not replace the whole panel", () => {
    const value = '{"link":""}';
    const { props } = renderPane(value, { onPasteUrl: vi.fn() });
    const editor = getEditor();
    editor.focus();
    const cursor = value.indexOf('""') + 1;
    editor.setSelectionRange(cursor, cursor);
    fireEvent.paste(editor, {
      clipboardData: { getData: () => "https://api.example.com/users/1" }
    });
    expect(props.onPasteUrl).not.toHaveBeenCalled();
    expect(props.onPaste).toHaveBeenCalledWith('{"link":"https://api.example.com/users/1"}');
  });

  it("falls back to inserting the URL literally when no onPasteUrl handler is wired", () => {
    const { props } = renderPane("");
    const editor = getEditor();
    editor.focus();
    fireEvent.paste(editor, {
      clipboardData: { getData: () => "https://api.example.com/users/1" }
    });
    expect(props.onPaste).toHaveBeenCalledWith("https://api.example.com/users/1");
  });
});
