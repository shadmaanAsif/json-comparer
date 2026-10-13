import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IgnorePathSelector } from "./IgnorePathSelector";

afterEach(cleanup);

function renderSelector(onChange = vi.fn()) {
  render(
    <IgnorePathSelector selectedPaths={[]} suggestions={[]} onChange={onChange} onApply={vi.fn()} />
  );
  return { onChange, input: screen.getByRole("combobox") as HTMLInputElement };
}

/**
 * Simulates a paste that never fires a clipboard `paste` event (e.g. middle-click paste,
 * some mobile/IME paste flows) — text lands directly as a native `input` event whose
 * `inputType` is `insertFromPaste`, bypassing the input's own `onPaste` handler entirely.
 */
function dispatchPastedInsert(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )!.set!;
  setValue.call(input, value);
  fireEvent(
    input,
    new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertFromPaste" })
  );
}

describe("IgnorePathSelector paste handling", () => {
  it("commits a pasted path immediately even when no clipboard paste event fires", () => {
    const { onChange, input } = renderSelector();

    dispatchPastedInsert(input, "user.email");

    expect(onChange).toHaveBeenCalledWith(["user.email"]);
    expect(input).toHaveValue("");
  });

  it("commits every path from a comma-separated paste that lands as a plain input event", () => {
    const { onChange, input } = renderSelector();

    // A single-line <input> strips newlines from pasted text before JS ever sees it, so a
    // multi-path paste can only arrive comma-separated here — unlike the JSON textarea.
    dispatchPastedInsert(input, "user.email,user.name");

    expect(onChange).toHaveBeenCalledWith(["user.email", "user.name"]);
  });

  it("still treats an ordinary keystroke as pending text, not an immediate chip", () => {
    const { onChange, input } = renderSelector();

    fireEvent.change(input, { target: { value: "user" } });

    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("user");
  });
});

describe("IgnorePathSelector dropdown and in-flight editing", () => {
  it("keeps the field editable and pasteable while a comparison runs, disabling only Apply", () => {
    const onChange = vi.fn();
    render(
      <IgnorePathSelector
        selectedPaths={[]}
        suggestions={[]}
        applyDisabled
        onChange={onChange}
        onApply={vi.fn()}
      />
    );
    const input = screen.getByRole("combobox");

    expect(input).toBeEnabled();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    fireEvent.paste(input, { clipboardData: { getData: () => "user.email" } });
    expect(onChange).toHaveBeenCalledWith(["user.email"]);
  });

  it("reopens the suggestion list on click after Escape closed it with focus still in the field", async () => {
    const user = userEvent.setup();
    render(
      <IgnorePathSelector
        selectedPaths={[]}
        suggestions={["user.email"]}
        onChange={vi.fn()}
        onApply={vi.fn()}
      />
    );
    const input = screen.getByRole("combobox");

    await user.click(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveFocus();

    await user.click(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("positions the list against the field instead of inside its clipped container", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <IgnorePathSelector
        selectedPaths={[]}
        suggestions={["user.email"]}
        onChange={vi.fn()}
        onApply={vi.fn()}
      />
    );

    await user.click(screen.getByRole("combobox"));

    const dropdown = container.querySelector<HTMLElement>(".ignore-path-dropdown")!;
    expect(dropdown.style.left).not.toBe("");
    expect(dropdown.style.maxHeight).not.toBe("");
    expect(dropdown.style.top !== "" || dropdown.style.bottom !== "").toBe(true);
  });
});

describe("IgnorePathSelector repeated paths", () => {
  function renderWithSelected(selectedPaths: string[], onChange = vi.fn()) {
    render(
      <IgnorePathSelector
        selectedPaths={selectedPaths}
        suggestions={[]}
        onChange={onChange}
        onApply={vi.fn()}
      />
    );
    return { onChange, input: screen.getByRole("combobox") };
  }

  it("adds a pasted path again as a second chip so it can be edited afterwards", () => {
    const { onChange, input } = renderWithSelected(["status"]);

    fireEvent.paste(input, { clipboardData: { getData: () => "status" } });

    expect(onChange).toHaveBeenCalledWith(["status", "status"]);
  });

  it("renders repeated paths as separate chips", () => {
    renderWithSelected(["status", "status"]);

    expect(screen.getAllByRole("button", { name: "Edit ignored path status" })).toHaveLength(2);
  });

  it("edits only the chosen copy of a repeated path", async () => {
    const user = userEvent.setup();
    const { onChange } = renderWithSelected(["status", "status"]);

    await user.click(screen.getAllByRole("button", { name: "Edit ignored path status" })[1]);
    const editor = screen.getByRole("textbox", { name: "Edit ignored path status" });
    await user.clear(editor);
    await user.type(editor, "status.code{Enter}");

    expect(onChange).toHaveBeenCalledWith(["status", "status.code"]);
  });

  it("removes only the chosen copy of a repeated path", async () => {
    const user = userEvent.setup();
    const { onChange } = renderWithSelected(["status", "user.name", "status"]);

    await user.click(screen.getAllByRole("button", { name: "Remove ignored path status" })[0]);

    expect(onChange).toHaveBeenCalledWith(["user.name", "status"]);
  });

  it("keeps the edit on the same chip when an earlier chip is removed mid-edit", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Harness() {
      const [paths, setPaths] = useState(["a", "b", "c"]);
      return (
        <IgnorePathSelector
          selectedPaths={paths}
          suggestions={[]}
          onChange={(next) => {
            onChange(next);
            setPaths(next);
          }}
          onApply={vi.fn()}
        />
      );
    }
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Edit ignored path c" }));
    await user.click(screen.getByRole("button", { name: "Remove ignored path a" }));

    const editor = screen.getByRole("textbox", { name: "Edit ignored path c" });
    expect(editor).toHaveValue("c");
    await user.type(editor, "2{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["b", "c2"]);
  });
});

describe("IgnorePathSelector select all and copy", () => {
  function renderWithSelected(selectedPaths: string[], onChange = vi.fn()) {
    render(
      <IgnorePathSelector
        selectedPaths={selectedPaths}
        suggestions={[]}
        onChange={onChange}
        onApply={vi.fn()}
      />
    );
    return { onChange, input: screen.getByRole("combobox") };
  }

  function copyFrom(input: HTMLElement) {
    const setData = vi.fn();
    const notCancelled = fireEvent.copy(input, { clipboardData: { setData } });
    return { setData, defaultPrevented: !notCancelled };
  }

  it("copies every ignored path, in paste-compatible form, after Ctrl+A in the empty field", async () => {
    const user = userEvent.setup();
    const { input } = renderWithSelected(["status", "user.name", "/items/0"]);

    await user.click(input);
    await user.keyboard("{Control>}a{/Control}");
    const { setData, defaultPrevented } = copyFrom(input);

    expect(setData).toHaveBeenCalledWith("text/plain", "status, user.name, /items/0");
    expect(defaultPrevented).toBe(true);
  });

  it("also writes the clipboard on the Ctrl+C keystroke, for browsers that skip copy on an empty selection", async () => {
    const user = userEvent.setup();
    const { input } = renderWithSelected(["status", "user.name"]);

    await user.click(input);
    await user.keyboard("{Control>}a{/Control}");
    await user.keyboard("{Control>}c{/Control}");

    expect(await navigator.clipboard.readText()).toBe("status, user.name");
    expect(document.querySelectorAll(".ignore-path-chip.is-selected")).toHaveLength(2);
  });

  it("works with Cmd+A too and highlights the chips while they are selected", async () => {
    const user = userEvent.setup();
    const { input } = renderWithSelected(["a", "b"]);
    const chips = () => document.querySelectorAll(".ignore-path-chip");

    await user.click(input);
    await user.keyboard("{Meta>}a{/Meta}");

    expect([...chips()].every((chip) => chip.classList.contains("is-selected"))).toBe(true);
  });

  it("leaves Ctrl+A to the browser when text has been typed", async () => {
    const user = userEvent.setup();
    const { input } = renderWithSelected(["status"]);

    await user.type(input, "us");
    await user.keyboard("{Control>}a{/Control}");

    expect(document.querySelector(".ignore-path-chip.is-selected")).toBeNull();
    expect(copyFrom(input).setData).not.toHaveBeenCalled();
  });

  it("does not hijack copy when nothing was selected", async () => {
    const user = userEvent.setup();
    const { input } = renderWithSelected(["status"]);

    await user.click(input);

    const { setData, defaultPrevented } = copyFrom(input);
    expect(setData).not.toHaveBeenCalled();
    expect(defaultPrevented).toBe(false);
  });

  it("drops the selection on the next keystroke without removing a chip", async () => {
    const user = userEvent.setup();
    const { onChange, input } = renderWithSelected(["status", "user.name"]);

    await user.click(input);
    await user.keyboard("{Control>}a{/Control}");
    await user.keyboard("{Backspace}");

    expect(document.querySelector(".ignore-path-chip.is-selected")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(copyFrom(input).setData).not.toHaveBeenCalled();
  });

  it("drops the selection when the field loses focus", async () => {
    const user = userEvent.setup();
    const { input } = renderWithSelected(["status"]);

    await user.click(input);
    await user.keyboard("{Control>}a{/Control}");
    await user.tab();

    expect(document.querySelector(".ignore-path-chip.is-selected")).toBeNull();
  });
});
