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
      lineHighlights: { 2: "differences", 6: "missing" }
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

  it("updates JSON markers and navigation immediately when visible highlights change", () => {
    const value = ["{", '  "first": 1,', '  "second": 2', "}"].join("\n");
    const { container, props, rerender } = renderPane(value, {
      lineHighlights: { 2: "missing", 3: "differences" }
    });

    expect(container.querySelectorAll(".json-minimap .minimap-marker")).toHaveLength(2);
    expect(screen.getByLabelText("Response A finding navigation")).toHaveTextContent("1/2");

    rerender(<JsonInputPane {...props} lineHighlights={{ 3: "differences" }} />);

    expect(container.querySelectorAll(".json-minimap .minimap-marker")).toHaveLength(1);
    expect(screen.getByLabelText("Response A finding navigation")).toHaveTextContent("1/1");

    rerender(<JsonInputPane {...props} lineHighlights={{}} />);

    expect(container.querySelectorAll(".json-minimap .minimap-marker")).toHaveLength(0);
    expect(screen.queryByLabelText("Response A finding navigation")).not.toBeInTheDocument();
  });
});
