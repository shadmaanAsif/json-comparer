import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
