import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compareJson } from "@/domain/comparison/engine";
import { formatAlignedForDisplay } from "@/domain/comparison/display-format";
import type { WorkerRequest, WorkerResponse } from "@/workers/comparison.worker";
import { downloadMarkdown } from "./utils/download";
import { Comparer } from "./Comparer";

vi.mock("./utils/download", () => ({ downloadMarkdown: vi.fn() }));

class TestWorker {
  static instances: TestWorker[] = [];
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  request?: WorkerRequest;
  terminate = vi.fn();
  constructor() {
    TestWorker.instances.push(this);
  }
  postMessage(request: WorkerRequest) {
    this.request = request;
  }
  complete() {
    const request = this.request!;
    const a = JSON.parse(request.textA);
    const b = JSON.parse(request.textB);
    const aligned = formatAlignedForDisplay(a, b);
    this.onmessage?.(
      new MessageEvent<WorkerResponse>("message", {
        data: {
          jobId: request.jobId,
          ok: true,
          formattedA: aligned.textA,
          formattedB: aligned.textB,
          lineMaps: aligned,
          result: compareJson(a, b, request.options),
          durationMs: 12
        }
      })
    );
  }
}

beforeEach(() => {
  TestWorker.instances = [];
  vi.stubGlobal("Worker", TestWorker);
  Element.prototype.scrollIntoView = vi.fn();
  // jsdom has no layout; model visible fields for native-dialog anchoring.
  const bounds = HTMLElement.prototype.getBoundingClientRect;
  const rects = HTMLElement.prototype.getClientRects;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement
  ) {
    if (this.matches(".json-tree, .editor-main textarea")) return new DOMRect(100, 100, 400, 360);
    if (this.hasAttribute("data-tree-row")) return new DOMRect(120, 160, 360, 28);
    return bounds.call(this);
  });
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function (
    this: HTMLElement
  ) {
    if (this.matches(".editor-main textarea, [data-tree-row]"))
      return [this.getBoundingClientRect()] as unknown as DOMRectList;
    return rects.call(this);
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function fillInputs() {
  fireEvent.change(screen.getByRole("textbox", { name: "JSON for Baseline" }), {
    target: { value: '{"config":{"price":10},"old":true}' }
  });
  fireEvent.change(screen.getByRole("textbox", { name: "JSON for Candidate" }), {
    target: { value: '{"config":{"price":12},"new":null}' }
  });
}
async function compare(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Compare responses" }));
  act(() => TestWorker.instances.at(-1)!.complete());
}
function openPrice() {
  const editor = screen.getByRole("textbox", {
    name: "JSON for Baseline"
  }) as HTMLTextAreaElement;
  editor.focus();
  editor.setSelectionRange(editor.value.indexOf('"price"'), editor.value.indexOf('"price"'));
  fireEvent.keyDown(editor, { key: "F10", shiftKey: true });
  return screen.getByRole("dialog", { name: "Line actions · Baseline" });
}

describe("Comparer panel actions", () => {
  it("expands Structure Schema Compare and Missing Fields by default, but not Differences", async () => {
    const user = userEvent.setup();
    render(<Comparer />);
    fillInputs();
    await compare(user);
    const detailsFor = (title: string) =>
      [...document.querySelectorAll(".result-section-title")]
        .find((el) => el.textContent?.trim() === title)
        ?.closest("details");
    expect(detailsFor("Structure Schema Compare")).toHaveAttribute("open");
    expect(detailsFor("Missing Fields")).toHaveAttribute("open");
    expect(detailsFor("Differences")).not.toHaveAttribute("open");
  });

  it("shares Tree review, report selection and ignore/restore with the JSON panel", async () => {
    const user = userEvent.setup();
    render(<Comparer />);
    fillInputs();
    await compare(user);
    const source = screen.getByRole("region", { name: "Baseline" });
    await user.click(within(source).getByRole("tab", { name: "Tree" }));
    const openField = async () => {
      await user.click(
        within(source).getByRole("button", { name: "Actions for field /config/price" })
      );
      return screen.getByRole("dialog", { name: "Field actions · Baseline" });
    };
    let dialog = await openField();
    expect(
      within(dialog).getByRole("group", { name: "Difference for this field" })
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Mark for review" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Note for panel config.price" }), {
      target: { value: "Reviewed in Tree" }
    });
    await user.click(within(dialog).getByText("More actions"));
    await user.click(within(dialog).getByRole("button", { name: "Select for report" }));
    await user.click(within(dialog).getByRole("button", { name: "Ignore path" }));
    act(() => TestWorker.instances.at(-1)!.complete());
    dialog = await openField();
    await user.click(within(dialog).getByRole("button", { name: "Restore path" }));
    act(() => TestWorker.instances.at(-1)!.complete());
    await user.click(within(source).getByRole("tab", { name: "JSON" }));
    dialog = openPrice();
    await user.click(within(dialog).getByRole("button", { name: "Add a note" }));
    expect(
      within(dialog).getByRole("textbox", { name: "Note for panel config.price" })
    ).toHaveValue("Reviewed in Tree");
    await user.click(within(dialog).getByText("More actions"));
    expect(
      within(dialog).getByRole("button", { name: "Remove from report selection" })
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Close line actions" }));
    await user.click(screen.getByRole("button", { name: "Export Selected (1)" }));
    expect(downloadMarkdown).toHaveBeenCalledWith(
      "selected-findings-report.md",
      expect.stringContaining("Reviewed in Tree")
    );
  });

  it("keeps cross-panel jumps in Tree and distinguishes branches from leaf parents", async () => {
    const user = userEvent.setup();
    render(<Comparer />);
    fillInputs();
    await compare(user);
    const source = screen.getByRole("region", { name: "Baseline" });
    const target = screen.getByRole("region", { name: "Candidate" });
    await user.click(within(source).getByRole("tab", { name: "Tree" }));
    await user.click(within(target).getByRole("tab", { name: "Tree" }));
    await user.click(within(source).getByRole("button", { name: "Actions for field /config" }));
    let dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Collapse this branch" }));
    await user.click(within(source).getByRole("button", { name: "Actions for field /config" }));
    dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Expand this branch" }));
    await user.click(
      within(source).getByRole("button", { name: "Actions for field /config/price" })
    );
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Collapse parent" })).toBeEnabled();
    await user.click(within(dialog).getByRole("button", { name: "Jump to corresponding field" }));
    await waitFor(() =>
      expect(within(target).getByText("price").closest(".tree-leaf")).toHaveFocus()
    );
    expect(within(target).getByRole("tab", { name: "Tree" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await user.click(within(source).getByRole("button", { name: "Actions for field /old" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Show missing field location"
      })
    );
    await waitFor(() =>
      expect(within(target).getByRole("status")).toHaveTextContent("Not present in Candidate: /old")
    );
  });

  it("does not offer an unsafe counterpart for unordered Tree array items", async () => {
    const user = userEvent.setup();
    render(<Comparer />);
    fireEvent.change(screen.getByRole("textbox", { name: "JSON for Baseline" }), {
      target: { value: '{"items":[{"id":"a"}]}' }
    });
    fireEvent.change(screen.getByRole("textbox", { name: "JSON for Candidate" }), {
      target: { value: '{"items":[{"id":"b"}]}' }
    });
    await user.click(screen.getByRole("radio", { name: "Unordered arrays" }));
    await compare(user);
    await user.click(
      within(screen.getByRole("region", { name: "Baseline" })).getByRole("tab", { name: "Tree" })
    );
    await user.click(screen.getByRole("button", { name: "Actions for field /items/0/id" }));
    const dialog = screen.getByRole("dialog", { name: "Field actions · Baseline" });
    expect(
      within(dialog).getByRole("button", { name: "Jump to corresponding field" })
    ).toBeDisabled();
    expect(
      within(dialog).getByText(/Unordered mode matches array items by exact value/)
    ).toBeInTheDocument();
  });

  it("resolves a counterpart for a canonically matched, reordered unordered array item", async () => {
    const user = userEvent.setup();
    render(<Comparer />);
    fireEvent.change(screen.getByRole("textbox", { name: "JSON for Baseline" }), {
      target: { value: '{"items":[{"id":1},{"id":2}]}' }
    });
    fireEvent.change(screen.getByRole("textbox", { name: "JSON for Candidate" }), {
      target: { value: '{"items":[{"id":2},{"id":1}]}' }
    });
    await user.click(screen.getByRole("radio", { name: "Unordered arrays" }));
    await compare(user);
    const source = screen.getByRole("region", { name: "Baseline" });
    const target = screen.getByRole("region", { name: "Candidate" });
    await user.click(within(source).getByRole("tab", { name: "Tree" }));
    await user.click(within(target).getByRole("tab", { name: "Tree" }));
    await user.click(within(source).getByRole("button", { name: "Actions for field /items/0/id" }));
    const dialog = screen.getByRole("dialog", { name: "Field actions · Baseline" });
    await user.click(within(dialog).getByRole("button", { name: "Jump to corresponding field" }));
    await waitFor(() => expect(within(target).getByText("1").closest(".tree-leaf")).toHaveFocus());
  });

  it("reviews and selects a changed field, reveals its result, and exports the annotation", async () => {
    const user = userEvent.setup();
    render(<Comparer />);
    expect(screen.getByRole("button", { name: "Line actions for Baseline" })).toBeDisabled();
    fillInputs();
    await compare(user);
    const dialog = openPrice();
    await user.click(within(dialog).getByRole("button", { name: "Mark for review" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Note for panel config.price" }), {
      target: { value: "Confirm new pricing" }
    });
    await user.click(within(dialog).getByText("More actions"));
    await user.click(within(dialog).getByRole("button", { name: "Select for report" }));
    await user.click(within(dialog).getByRole("button", { name: "Show difference in results" }));
    await waitFor(() =>
      expect(document.getElementById("finding-differences-changed:/config/price")).toHaveFocus()
    );
    expect(screen.getByRole("textbox", { name: "Note for config.price" })).toHaveValue(
      "Confirm new pricing"
    );
    expect(
      within(screen.getByRole("group", { name: "Review status for config.price" })).getByRole(
        "radio",
        { name: "Needed" }
      )
    ).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Export Selected (1)" }));
    expect(downloadMarkdown).toHaveBeenCalledWith(
      "selected-findings-report.md",
      expect.stringContaining("Confirm new pricing")
    );
    expect(vi.mocked(downloadMarkdown).mock.lastCall?.[1]).toContain("Type: changed");
  });

  it("preserves review through exact ignore/restore, then discards it when inputs change", async () => {
    const user = userEvent.setup();
    render(<Comparer />);
    fillInputs();
    await compare(user);
    let dialog = openPrice();
    await user.click(within(dialog).getByRole("button", { name: "Mark for review" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Note for panel config.price" }), {
      target: { value: "Keep during ignore" }
    });
    await user.click(within(dialog).getByRole("button", { name: "Ignore path" }));
    expect(TestWorker.instances.at(-1)?.request?.options.ignorePatterns).toEqual(["/config/price"]);
    act(() => TestWorker.instances.at(-1)!.complete());
    dialog = openPrice();
    await user.click(within(dialog).getByRole("button", { name: "Add a note" }));
    expect(
      within(dialog).getByRole("textbox", { name: "Note for panel config.price" })
    ).toHaveValue("Keep during ignore");
    await user.click(within(dialog).getByRole("button", { name: "Restore path" }));
    expect(TestWorker.instances.at(-1)?.request?.options.ignorePatterns).toEqual([]);
    act(() => TestWorker.instances.at(-1)!.complete());
    fillInputs();
    expect(screen.getByRole("button", { name: "Line actions for Baseline" })).toBeDisabled();
    await compare(user);
    dialog = openPrice();
    await user.click(within(dialog).getByRole("button", { name: "Add a note" }));
    expect(
      within(dialog).getByRole("textbox", { name: "Note for panel config.price" })
    ).toHaveValue("");
  });

  it("filters to the exact pointer and provides a clear way back to all results", async () => {
    const user = userEvent.setup();
    render(<Comparer />);
    fillInputs();
    await compare(user);
    const dialog = openPrice();
    await user.click(within(dialog).getByText("More actions"));
    await user.click(within(dialog).getByRole("button", { name: "Filter results to this path" }));
    expect(screen.getByRole("searchbox", { name: "Filter by path" })).toHaveValue("/config/price");
    await user.click(screen.getByRole("button", { name: "Clear path filter" }));
    expect(screen.getByRole("searchbox", { name: "Filter by path" })).toHaveValue("");
  });

  it("cancels stale worker results when editing or changing array mode", async () => {
    const user = userEvent.setup();
    render(<Comparer />);
    fillInputs();
    await user.click(screen.getByRole("button", { name: "Compare responses" }));
    const first = TestWorker.instances.at(-1)!;
    fireEvent.change(screen.getByRole("textbox", { name: "JSON for Baseline" }), {
      target: { value: '{"newInput":1}' }
    });
    expect(first.terminate).toHaveBeenCalled();
    act(() => first.complete());
    expect(screen.getByRole("textbox", { name: "JSON for Baseline" })).toHaveValue(
      '{"newInput":1}'
    );
    expect(screen.queryByRole("heading", { name: "Results" })).not.toBeInTheDocument();
    await compare(user);
    act(() => first.onerror?.());
    expect(screen.getByRole("heading", { name: "Results" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Unordered arrays" }));
    expect(screen.getByRole("button", { name: "Line actions for Baseline" })).toBeDisabled();
    expect(screen.queryByRole("heading", { name: "Results" })).not.toBeInTheDocument();
  });

  it("mirrors the current line onto the other panel and clears both on an outside click", async () => {
    const user = userEvent.setup();
    const { container } = render(<Comparer />);
    fillInputs();
    await compare(user);

    const editorA = screen.getByRole("textbox", {
      name: "JSON for Baseline"
    }) as HTMLTextAreaElement;
    const caret = editorA.value.indexOf('"price"');
    editorA.focus();
    editorA.setSelectionRange(caret, caret);
    fireEvent.select(editorA);

    const contextInA = container.querySelector(
      '.input-panel[data-side="A"] .full-line-highlight.line-context:not(.line-mirror)'
    );
    expect(contextInA).toBeInTheDocument();

    const mirrorInB = container.querySelector(
      '.input-panel[data-side="B"] .full-line-highlight.line-mirror'
    );
    expect(mirrorInB).toBeInTheDocument();
    // Same line number on both sides means the same computed vertical offset.
    expect(mirrorInB).toHaveStyle({ top: (contextInA as HTMLElement).style.top });
    expect(
      container.querySelector(
        '.input-panel[data-side="B"] .full-line-highlight.line-context:not(.line-mirror)'
      )
    ).not.toBeInTheDocument();

    await user.click(document.body);

    expect(container.querySelector(".full-line-highlight.line-context")).not.toBeInTheDocument();
    expect(container.querySelector(".full-line-highlight.line-mirror")).not.toBeInTheDocument();
  });
});
