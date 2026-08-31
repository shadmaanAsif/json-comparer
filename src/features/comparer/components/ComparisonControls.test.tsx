import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComparisonControls, type ComparisonControlsProps } from "./ComparisonControls";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderControls(overrides: Partial<ComparisonControlsProps> = {}) {
  const props: ComparisonControlsProps = {
    arrayMode: "ordered",
    ignorePaths: ["meta.timestamp"],
    ignorePathSuggestions: ["meta.timestamp", "data.amount", "data.currency"],
    highlightVisibility: { missing: true, structure: true, differences: true },
    isComparing: false,
    status: { tone: "idle", message: "Ready to compare." },
    onArrayModeChange: vi.fn(),
    onIgnorePathsChange: vi.fn(),
    onApplyIgnorePaths: vi.fn(),
    onHighlightVisibilityChange: vi.fn(),
    onCompare: vi.fn(),
    onCancel: vi.fn(),
    onLoadSample: vi.fn(),
    onClear: vi.fn(),
    ...overrides
  };

  render(<ComparisonControls {...props} />);
  return props;
}

describe("ComparisonControls", () => {
  it("labels missing-field highlight directions as Only in A and Only in B", () => {
    renderControls();

    expect(
      screen.getByRole("button", {
        name: "Only in A Only in B Missing fields"
      })
    ).toBeVisible();
  });

  it("searches detected paths and maintains unique removable chips", async () => {
    const user = userEvent.setup();
    const onApplyIgnorePaths = vi.fn();

    function StatefulControls() {
      const [ignorePaths, setIgnorePaths] = useState(["meta.timestamp"]);
      return (
        <ComparisonControls
          arrayMode="ordered"
          ignorePaths={ignorePaths}
          ignorePathSuggestions={["meta.timestamp", "data.amount", "data.currency"]}
          highlightVisibility={{ missing: true, structure: true, differences: true }}
          isComparing={false}
          status={{ tone: "idle", message: "Ready to compare." }}
          onArrayModeChange={vi.fn()}
          onIgnorePathsChange={setIgnorePaths}
          onApplyIgnorePaths={onApplyIgnorePaths}
          onHighlightVisibilityChange={vi.fn()}
          onCompare={vi.fn()}
          onCancel={vi.fn()}
          onLoadSample={vi.fn()}
          onClear={vi.fn()}
        />
      );
    }

    render(<StatefulControls />);
    const input = screen.getByRole("combobox", { name: /Ignore paths/ });

    await user.click(input);
    const options = screen.getByRole("listbox", { name: "Detected difference paths" });
    expect(within(options).getByRole("option", { name: /data\.amount/ })).toBeVisible();
    expect(
      within(options).queryByRole("option", { name: /meta\.timestamp/ })
    ).not.toBeInTheDocument();

    await user.type(input, "currency");
    expect(within(options).getAllByRole("option")).toHaveLength(1);
    await user.click(within(options).getByRole("option", { name: /data\.currency/ }));
    expect(screen.getByRole("button", { name: "Remove ignored path data.currency" })).toBeVisible();

    fireEvent.paste(input, {
      clipboardData: {
        getData: () => "data.amount, data.amount, , meta.timestamp"
      }
    });
    expect(screen.getByRole("button", { name: "Remove ignored path data.amount" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: /Remove ignored path/ })).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "Remove ignored path data.amount" }));
    expect(
      screen.queryByRole("button", { name: "Remove ignored path data.amount" })
    ).not.toBeInTheDocument();

    await user.type(input, "config.custom.*.code");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(
      screen.getByRole("button", { name: "Remove ignored path config.custom.*.code" })
    ).toBeVisible();
    expect(onApplyIgnorePaths).toHaveBeenCalledOnce();
    expect(onApplyIgnorePaths).toHaveBeenCalledWith([
      "meta.timestamp",
      "data.currency",
      "config.custom.*.code"
    ]);
  });

  it("keeps free text in the input until the user presses Enter", () => {
    vi.useFakeTimers();

    function IdleCommitControls() {
      const [ignorePaths, setIgnorePaths] = useState<string[]>([]);
      return (
        <ComparisonControls
          arrayMode="ordered"
          ignorePaths={ignorePaths}
          ignorePathSuggestions={[]}
          highlightVisibility={{ missing: true, structure: true, differences: true }}
          isComparing={false}
          status={{ tone: "idle", message: "Ready to compare." }}
          onArrayModeChange={vi.fn()}
          onIgnorePathsChange={setIgnorePaths}
          onApplyIgnorePaths={vi.fn()}
          onHighlightVisibilityChange={vi.fn()}
          onCompare={vi.fn()}
          onCancel={vi.fn()}
          onLoadSample={vi.fn()}
          onClear={vi.fn()}
        />
      );
    }

    render(<IdleCommitControls />);
    fireEvent.change(screen.getByRole("combobox", { name: /Ignore paths/ }), {
      target: { value: "config.delayed.path" }
    });
    act(() => vi.advanceTimersByTime(10_000));

    expect(
      screen.queryByRole("button", { name: "Remove ignored path config.delayed.path" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Ignore paths/ })).toHaveValue(
      "config.delayed.path"
    );

    fireEvent.keyDown(screen.getByRole("combobox", { name: /Ignore paths/ }), {
      key: "Enter"
    });

    expect(
      screen.getByRole("button", { name: "Remove ignored path config.delayed.path" })
    ).toBeVisible();
  });

  it("edits an ignore-path chip inline and prevents empty or duplicate replacements", async () => {
    const user = userEvent.setup();
    const onApplyIgnorePaths = vi.fn();

    function EditableControls() {
      const [ignorePaths, setIgnorePaths] = useState(["meta.timestamp", "data.amount"]);
      return (
        <ComparisonControls
          arrayMode="ordered"
          ignorePaths={ignorePaths}
          ignorePathSuggestions={[]}
          highlightVisibility={{ missing: true, structure: true, differences: true }}
          isComparing={false}
          status={{ tone: "idle", message: "Ready to compare." }}
          onArrayModeChange={vi.fn()}
          onIgnorePathsChange={setIgnorePaths}
          onApplyIgnorePaths={onApplyIgnorePaths}
          onHighlightVisibilityChange={vi.fn()}
          onCompare={vi.fn()}
          onCancel={vi.fn()}
          onLoadSample={vi.fn()}
          onClear={vi.fn()}
        />
      );
    }

    render(<EditableControls />);
    await user.click(screen.getByRole("button", { name: "Edit ignored path meta.timestamp" }));
    const editor = screen.getByRole("textbox", { name: "Edit ignored path meta.timestamp" });
    await user.clear(editor);
    await user.type(editor, "meta.updatedAt{Enter}");

    expect(screen.getByRole("button", { name: "Edit ignored path meta.updatedAt" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Edit ignored path meta.timestamp" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit ignored path meta.updatedAt" }));
    const cancelledEditor = screen.getByRole("textbox", {
      name: "Edit ignored path meta.updatedAt"
    });
    await user.clear(cancelledEditor);
    await user.type(cancelledEditor, "meta.cancelled{Escape}");
    expect(screen.getByRole("button", { name: "Edit ignored path meta.updatedAt" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Edit ignored path meta.updatedAt" }));
    const duplicateEditor = screen.getByRole("textbox", {
      name: "Edit ignored path meta.updatedAt"
    });
    await user.clear(duplicateEditor);
    await user.type(duplicateEditor, "data.amount{Enter}");
    expect(screen.getAllByRole("button", { name: "Edit ignored path data.amount" })).toHaveLength(
      1
    );

    await user.click(screen.getByRole("button", { name: "Edit ignored path data.amount" }));
    const emptyEditor = screen.getByRole("textbox", { name: "Edit ignored path data.amount" });
    await user.clear(emptyEditor);
    expect(screen.getByRole("button", { name: "Save ignored path data.amount" })).toBeDisabled();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Edit ignored path data.amount" }));
    const applyEditor = screen.getByRole("textbox", { name: "Edit ignored path data.amount" });
    await user.clear(applyEditor);
    await user.type(applyEditor, "data.total");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByRole("button", { name: "Edit ignored path data.total" })).toBeVisible();
    expect(onApplyIgnorePaths).toHaveBeenCalledWith(["data.total"]);
  });

  it("applies the current ignore paths on demand", async () => {
    const user = userEvent.setup();
    const props = renderControls();

    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(props.onApplyIgnorePaths).toHaveBeenCalledOnce();
  });

  it("prevents applying ignore paths while a comparison is active", () => {
    renderControls({ isComparing: true });

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });
});
