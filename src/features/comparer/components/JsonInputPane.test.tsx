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
    expect(screen.getByText("Click ⋯ beside a line for actions · or Shift+F10")).toBeVisible();
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
    const user = userEvent.setup();
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
    // Folding focuses the parent; ignore-only reruns preserve that Tree selection.
    rerender(
      <JsonInputPane
        {...props}
        panelIndex={buildPanelIndex(display.textA, display.lineMapA, display.placeholderLineMapA)}
      />
    );
    await user.click(screen.getByRole("button", { name: "Field actions for Baseline" }));
    expect(vi.mocked(props.onOpenActions!).mock.lastCall?.[0].branchExpanded).toBe(false);
    expect(vi.mocked(props.onOpenActions!).mock.lastCall?.[0].field.pointer).toBe("/config");
  });

  it("does not expose stale line actions once the comparison index is invalidated", async () => {
    const user = userEvent.setup();
    const display = formatAlignedForDisplay({ a: 1 }, { a: 2 });
    const panelIndex = buildPanelIndex(
      display.textA,
      display.lineMapA,
      display.placeholderLineMapA
    );
    const { props, rerender } = renderPane(display.textA, { panelIndex, onOpenActions: vi.fn() });
    expect(screen.getByRole("button", { name: "Line actions for Baseline" })).toBeEnabled();
    rerender(<JsonInputPane {...props} value="{" panelIndex={null} />);
    expect(screen.getByRole("button", { name: "Line actions for Baseline" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Line actions for Baseline" }));
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
    await user.click(screen.getByRole("button", { name: "Field actions for Baseline" }));
    expect(vi.mocked(props.onOpenActions!).mock.lastCall?.[0].field.pointer).toBe("/a~1b/~0key");
    expect(props.onChange).not.toHaveBeenCalled();
    rerender(<JsonInputPane {...props} panelIndex={null} />);
    expect(
      screen.queryByRole("button", { name: "Actions for field /empty" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Field actions for Baseline" })).toBeDisabled();
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
    expect(container.querySelectorAll(".tree-highlight-badge")).toHaveLength(2);
    expect(screen.getByText("Changed")).toBeVisible();
    expect(screen.getByText("Missing")).toBeVisible();

    const nextFinding = screen.getByRole("button", { name: "Next highlighted finding" });
    expect(screen.getByLabelText("Tree finding navigation")).toBeVisible();
    expect(screen.getByText("1/2")).toBeVisible();

    await user.click(nextFinding);
    expect(screen.getByText("changed").closest(".tree-leaf")).toHaveClass("is-active");

    await user.click(nextFinding);
    expect(screen.getByText("phone").closest(".tree-leaf")).toHaveClass("is-active");
    expect(screen.getByText("2/2")).toBeVisible();
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

    await user.click(screen.getByRole("button", { name: "Next highlighted finding" }));

    expect(editor.scrollTop).toBeCloseTo(719.8);
    const activeHighlight = container.querySelector<HTMLElement>(".full-line-highlight.is-active");
    expect(Number.parseFloat(activeHighlight?.style.top ?? "")).toBeCloseTo(168.8);
    expect(activeHighlight).toHaveStyle({ height: "22.4px" });
    expect(synchronizeScroll).toHaveBeenLastCalledWith("A", editor);

    await user.click(screen.getByRole("button", { name: "Next highlighted finding" }));

    expect(editor.scrollTop).toBeCloseTo(1615.8);
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
    expect(screen.getByLabelText("Baseline finding navigation")).toHaveTextContent("1/2");

    rerender(
      <JsonInputPane
        {...props}
        lineHighlights={{ 3: { category: "differences", ignored: false } }}
      />
    );

    expect(container.querySelectorAll(".json-minimap .minimap-marker")).toHaveLength(1);
    expect(screen.getByLabelText("Baseline finding navigation")).toHaveTextContent("1/1");

    rerender(<JsonInputPane {...props} lineHighlights={{}} />);

    expect(container.querySelectorAll(".json-minimap .minimap-marker")).toHaveLength(0);
    expect(screen.queryByLabelText("Baseline finding navigation")).not.toBeInTheDocument();
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

  it("dims an ignored highlight in the Tree view and labels its badge", async () => {
    const user = userEvent.setup();
    const value = ["{", '  "kept": 1,', '  "ignored": 2', "}"].join("\n");
    renderPane(value, {
      lineHighlights: {
        2: { category: "differences", ignored: false },
        3: { category: "differences", ignored: true }
      }
    });

    await user.click(screen.getByRole("tab", { name: "Tree" }));

    expect(screen.getByText("kept").closest(".tree-leaf")).not.toHaveClass("is-ignored");
    expect(screen.getByText("ignored").closest(".tree-leaf")).toHaveClass("is-ignored");
    expect(screen.getAllByText(/Changed/)[1]).toHaveTextContent("Changed · Ignored");
  });
});
