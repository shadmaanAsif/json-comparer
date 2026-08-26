import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Comparer } from "./Comparer";

afterEach(cleanup);

describe("Comparer JSON panel layout", () => {
  it("expands and collapses both JSON panels together", async () => {
    const user = userEvent.setup();
    render(<Comparer />);
    const panels = screen.getByLabelText("JSON response inputs");
    const expandButton = screen.getByRole("button", { name: "Expand panels" });

    expect(panels).not.toHaveClass("panels-expanded");
    expect(expandButton).toHaveAttribute("aria-expanded", "false");

    await user.click(expandButton);

    expect(panels).toHaveClass("panels-expanded");
    expect(screen.getByRole("button", { name: "Collapse panels" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });
});
