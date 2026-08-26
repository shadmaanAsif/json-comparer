import { cleanup, render, screen } from "@testing-library/react";
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
  it("highlights the invalid JSON line and panel only in the JSON view", async () => {
    const user = userEvent.setup();
    const { container } = renderPane('{"broken":}');
    const editor = screen.getByRole("textbox", { name: "JSON for Response A" });

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
    expect(screen.getByRole("textbox", { name: "JSON for Response A" })).toHaveAttribute(
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
      lineHighlights: { 40: "differences", 80: "missing" },
      synchronizeScroll
    });
    const editor = screen.getByRole("textbox", { name: "JSON for Response A" });
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
});
