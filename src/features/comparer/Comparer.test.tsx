import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Comparer } from "./Comparer";

afterEach(cleanup);

describe("Comparer JSON panel layout", () => {
  it("shows the configured author in the application header", () => {
    render(<Comparer author="User1" />);

    expect(screen.getByText("Crafted by")).toBeVisible();
    expect(screen.getByText("User1")).toBeVisible();
  });

  it("switches the document theme and keeps the toggle label in sync", async () => {
    const user = userEvent.setup();
    render(<Comparer />);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    await user.click(screen.getByRole("button", { name: "Switch to light theme" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();
  });

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
