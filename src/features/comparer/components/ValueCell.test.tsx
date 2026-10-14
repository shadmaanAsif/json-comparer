import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ValueCell } from "./ValueCell";

afterEach(cleanup);

describe("ValueCell", () => {
  it('quotes strings so the string "true" is distinguishable from the boolean true', () => {
    const { container, rerender } = render(<ValueCell value="true" />);
    expect(container.querySelector("pre")).toHaveTextContent('"true"');
    expect(container.querySelector("pre")).toHaveAttribute("data-value-type", "string");

    rerender(<ValueCell value={true} />);
    expect(container.querySelector("pre")).toHaveTextContent(/^true$/);
    expect(container.querySelector("pre")).toHaveAttribute("data-value-type", "boolean");
  });

  it("tells numbers, null, and quoted lookalikes apart", () => {
    const { container, rerender } = render(<ValueCell value={1} />);
    expect(container.querySelector("pre")).toHaveTextContent(/^1$/);
    expect(container.querySelector("pre")).toHaveAttribute("data-value-type", "number");

    rerender(<ValueCell value="1" />);
    expect(container.querySelector("pre")).toHaveTextContent('"1"');

    rerender(<ValueCell value={null} />);
    expect(container.querySelector("pre")).toHaveTextContent(/^null$/);
    expect(container.querySelector("pre")).toHaveAttribute("data-value-type", "null");

    rerender(<ValueCell value="null" />);
    expect(container.querySelector("pre")).toHaveTextContent('"null"');
  });

  it("renders a missing side as a dash and pretty-prints objects", () => {
    const { container, rerender } = render(<ValueCell value={undefined} />);
    expect(container).toHaveTextContent("—");

    rerender(<ValueCell value={{ a: 1 }} />);
    expect(container.querySelector("pre")).toHaveAttribute("data-value-type", "object");
    expect(container.querySelector("pre")).toHaveTextContent('"a": 1');
  });

  it("truncates long values and expands them on request", async () => {
    const user = userEvent.setup();
    const long = "x".repeat(100);
    const { container } = render(<ValueCell value={long} />);
    expect(container.querySelector("pre")?.textContent).toHaveLength(71);

    await user.click(screen.getByRole("button", { name: "Show more" }));
    expect(container.querySelector("pre")?.textContent).toBe(`"${long}"`);
  });
});
