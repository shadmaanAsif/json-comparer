import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PanelActions, type PanelActionsProps } from "./PanelActions";

beforeEach(() => {
  vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(function (
    this: HTMLDialogElement
  ) {
    this.open = true;
  });
  vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function (
    this: HTMLDialogElement
  ) {
    this.open = false;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderActions(
  overrides: Partial<PanelActionsProps> = {},
  requestOverrides: Partial<PanelActionsProps["request"]> = {}
) {
  const props: PanelActionsProps = {
    request: {
      side: "A",
      field: {
        pointer: "/price",
        segments: ["price"],
        parentPointer: "",
        line: 2,
        endLine: 2,
        valueStart: 0,
        valueEnd: 2,
        placeholder: false,
        withinArray: false
      },
      anchor: { x: 100, y: 100 },
      parentExpanded: true,
      onToggleParent: vi.fn(),
      ...requestOverrides
    },
    valueText: "10",
    findings: [
      {
        id: "changed:/price",
        kind: "changed",
        path: ["price"],
        pointer: "/price",
        valueA: 10,
        valueB: 12,
        ignored: false
      }
    ],
    ignorePaths: [],
    selected: new Set(),
    notes: {},
    onClose: vi.fn(),
    onIgnore: vi.fn(),
    onManageIgnores: vi.fn(),
    onJump: vi.fn(),
    onReveal: vi.fn(),
    onFilter: vi.fn(),
    onSelect: vi.fn(),
    onNote: vi.fn(),
    ...overrides
  };
  return { ...render(<PanelActions {...props} />), props };
}

describe("PanelActions", () => {
  it("follows its field on page and nested scrolling without resetting review controls", async () => {
    const user = userEvent.setup();
    let rect = { left: 100, right: 200, top: 140, bottom: 160 };
    const getAnchor = vi.fn(() => rect);
    renderActions({}, { getAnchor });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveStyle({ top: "166px" });
    await user.click(screen.getByRole("button", { name: "Add a note" }));
    rect = { ...rect, top: 90, bottom: 110 };
    fireEvent.scroll(window);
    await waitFor(() => expect(dialog).toHaveStyle({ top: "116px" }));
    expect(screen.getByRole("textbox", { name: "Note for panel price" })).toBeInTheDocument();
    rect = { ...rect, top: 60, bottom: 80 };
    fireEvent.scroll(document.body);
    await waitFor(() => expect(dialog).toHaveStyle({ top: "86px" }));
  });
  it("dismisses once when the field leaves view, but ignores scrolling inside the popup", async () => {
    const getAnchor = vi.fn<NonNullable<PanelActionsProps["request"]["getAnchor"]>>(() => ({
      left: 100,
      right: 200,
      top: 140,
      bottom: 160
    }));
    const { props } = renderActions({}, { getAnchor });
    const dialog = screen.getByRole("dialog");
    const calls = getAnchor.mock.calls.length;
    fireEvent.scroll(dialog);
    expect(getAnchor).toHaveBeenCalledTimes(calls);
    getAnchor.mockReturnValue(null);
    fireEvent.scroll(window);
    await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce());
    expect(dialog).not.toHaveAttribute("open");
    fireEvent.scroll(window);
    expect(props.onClose).toHaveBeenCalledOnce();
  });
  it("limits popup height to space beside the field and cleans up scroll listeners", async () => {
    const getAnchor = vi.fn(() => ({ left: 100, right: 200, top: 650, bottom: 670 }));
    const { unmount } = renderActions({}, { getAnchor });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveStyle({ maxHeight: "632px" });
    getAnchor.mockReturnValue({ left: 80, right: 180, top: 610, bottom: 630 });
    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(dialog).toHaveStyle({ maxHeight: "592px" }));
    unmount();
    getAnchor.mockClear();
    fireEvent.scroll(window);
    expect(getAnchor).not.toHaveBeenCalled();
  });
  it("copies canonical paths and values, with a manual fallback on blocked clipboard", async () => {
    const user = userEvent.setup();
    const clipboard = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    renderActions();
    await user.click(screen.getByRole("button", { name: "Copy path" }));
    expect(clipboard).toHaveBeenLastCalledWith("/price");
    await user.click(screen.getByRole("button", { name: "Copy value" }));
    expect(clipboard).toHaveBeenLastCalledWith("10");
    clipboard.mockRejectedValue(new Error("blocked"));
    await user.click(screen.getByRole("button", { name: "Copy value" }));
    expect(screen.getByRole("textbox", { name: "Copy text" })).toHaveValue("10");
  });
  it("restores only the exact ignore rule", async () => {
    const user = userEvent.setup();
    const { props } = renderActions({ ignorePaths: ["/price", "/unrelated"] });
    await user.click(screen.getByRole("button", { name: "Restore path" }));
    expect(props.onIgnore).toHaveBeenCalledWith(["/unrelated"]);
  });
  it("sends inherited ignores to the rule editor without silently deleting them", async () => {
    const user = userEvent.setup();
    const { props } = renderActions({ ignorePaths: ["/*"] });
    await user.click(screen.getByRole("button", { name: "Review matching ignore rules" }));
    expect(props.onManageIgnores).toHaveBeenCalledOnce();
    expect(props.onIgnore).not.toHaveBeenCalled();
  });
  it("links review status, notes, and report selection to the related finding", async () => {
    const user = userEvent.setup();
    const { props } = renderActions();
    await user.click(screen.getByRole("button", { name: "Mark for review" }));
    expect(props.onNote).toHaveBeenCalledWith("changed:/price", { status: "needed" });
    fireEvent.change(screen.getByRole("textbox", { name: "Note for panel price" }), {
      target: { value: "Check price" }
    });
    expect(props.onNote).toHaveBeenLastCalledWith("changed:/price", { text: "Check price" });
    await user.click(screen.getByText("More actions"));
    await user.click(screen.getByRole("button", { name: "Select for report" }));
    expect(props.onSelect).toHaveBeenCalledWith("changed:/price");
  });
  it("identifies a single difference and clearly names its results action", async () => {
    const user = userEvent.setup();
    const { props } = renderActions();
    expect(screen.getByText("Difference for this line")).toBeInTheDocument();
    expect(screen.getByText("Value changed · price")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show difference in results" }));
    expect(props.onReveal).toHaveBeenCalledWith(props.findings[0]);
  });
  it("separates difference context from actions and keeps its explanation behind one info icon", async () => {
    const user = userEvent.setup();
    const { props } = renderActions();
    const context = screen.getByRole("group", { name: "Difference for this line" });
    const actions = screen.getByRole("region", { name: "Actions" });
    expect(within(context).getByText("Value changed · price")).toBeInTheDocument();
    expect(within(context).queryByRole("button", { name: "Copy path" })).not.toBeInTheDocument();
    expect(within(actions).getByRole("button", { name: "Copy path" })).toBeInTheDocument();
    const info = screen.getByRole("button", { name: "About this difference" });
    expect(screen.getAllByRole("button", { name: "About this difference" })).toHaveLength(1);
    expect(info).toHaveAttribute(
      "title",
      "Review, notes and report selection apply to this difference."
    );
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await user.hover(info);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Review, notes and report selection apply to this difference."
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
    await user.unhover(info);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await user.click(info);
    expect(screen.getByRole("tooltip")).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(info).toHaveFocus();
    await user.tab();
    await user.tab({ shift: true });
    expect(screen.getByRole("tooltip")).toBeVisible();
    await user.tab();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
  it("explains multiple differences and applies actions to the chosen difference", async () => {
    const user = userEvent.setup();
    const { props } = renderActions({
      findings: [
        {
          id: "removed:/price",
          kind: "removed",
          path: ["price"],
          pointer: "/price",
          valueA: 10,
          ignored: false
        },
        {
          id: "structure:/price",
          kind: "missing-in-b",
          path: ["price"],
          pointer: "/price",
          detail: "Field missing in Response B.",
          ignored: false
        }
      ]
    });
    const choice = screen.getByRole("combobox", { name: "Difference to act on" });
    expect(choice).toHaveAccessibleDescription(
      "This line has multiple differences. Choose which one to open in results, mark for review, add notes to, or select for your report."
    );
    await user.selectOptions(choice, "Structure: field missing from Candidate · price");
    await user.click(screen.getByRole("button", { name: "Mark for review" }));
    expect(props.onNote).toHaveBeenCalledWith("structure:/price", { status: "needed" });
    fireEvent.change(screen.getByRole("textbox", { name: "Note for panel price" }), {
      target: { value: "Check the missing field" }
    });
    expect(props.onNote).toHaveBeenLastCalledWith("structure:/price", {
      text: "Check the missing field"
    });
    await user.click(screen.getByText("More actions"));
    await user.click(screen.getByRole("button", { name: "Select for report" }));
    expect(props.onSelect).toHaveBeenCalledWith("structure:/price");
    await user.click(screen.getByRole("button", { name: "Show difference in results" }));
    expect(props.onReveal).toHaveBeenCalledWith(props.findings[1]);
  });
  it("explains when the selected line belongs to a containing change", () => {
    renderActions({
      findings: [
        {
          id: "type-changed:",
          kind: "type-changed",
          path: [],
          pointer: "",
          valueA: { price: 10 },
          valueB: null,
          ignored: false
        }
      ]
    });
    expect(screen.getByText("Value type changed · (root)")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This line is part of the change at (root). Review, notes and report selection apply to that whole change."
      )
    ).not.toBeVisible();
  });
  it("explains why review actions are unavailable without a linked difference", async () => {
    const user = userEvent.setup();
    const { props } = renderActions({ findings: [] });
    expect(screen.getByRole("button", { name: "Mark for review" })).toBeDisabled();
    expect(
      screen.getByText(
        "No directly linked difference. Review, notes and report selection need a specific difference."
      )
    ).not.toBeVisible();
    await user.click(screen.getByRole("button", { name: "Show differences under this path" }));
    expect(props.onFilter).toHaveBeenCalledOnce();
  });
  it("keeps absent values and unsafe counterparts unavailable, and handles Escape", () => {
    const { props } = renderActions({ valueText: null });
    expect(screen.getByRole("button", { name: "Copy value" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Jump to corresponding field" })).toBeDisabled();
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { bubbles: false, cancelable: true })
    );
    expect(props.onClose).toHaveBeenCalledOnce();
  });
});
