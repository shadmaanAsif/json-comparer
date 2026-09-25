import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Comparer } from "./Comparer";

afterEach(cleanup);

describe("Comparer JSON panel layout", () => {
  // Array-mode default selection now lives in Comparer.panels.test.tsx: comparison settings are
  // hidden until Advanced View is clicked, which needs a completed comparison via TestWorker.

  // Author byline is commented out on this branch (hideAuthor); see Comparer.tsx.
  // it("shows the configured author in the application header", () => {
  //   render(<Comparer author="User1" />);
  //
  //   expect(screen.getByText("Crafted by")).toBeVisible();
  //   expect(screen.getByText("User1")).toBeVisible();
  // });

  it("switches the document theme and keeps the toggle label in sync", async () => {
    const user = userEvent.setup();
    render(<Comparer />);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    await user.click(screen.getByRole("button", { name: "Switch to light theme" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();
  });

  it("shows both JSON panels expanded by default, and collapses them together", async () => {
    const user = userEvent.setup();
    render(<Comparer />);
    const panels = screen.getByLabelText("JSON response inputs");
    const collapseButton = screen.getByRole("button", { name: "Shorter panels" });

    expect(panels).toHaveClass("panels-expanded");
    expect(collapseButton).toHaveAttribute("aria-expanded", "true");

    fireEvent.change(screen.getByRole("textbox", { name: "JSON for Baseline" }), {
      target: { value: "{}" }
    });
    await user.click(collapseButton);

    expect(panels).not.toHaveClass("panels-expanded");
    expect(screen.getByRole("button", { name: "Taller panels" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("disables the panel-size toggle while the workspace is empty", async () => {
    render(<Comparer />);
    const toggleButton = screen.getByRole("button", { name: "Shorter panels" });

    expect(toggleButton).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox", { name: "JSON for Baseline" }), {
      target: { value: "{}" }
    });
    expect(toggleButton).toBeEnabled();

    await userEvent.setup().click(screen.getByRole("button", { name: "Clear all" }));
    expect(toggleButton).toBeDisabled();
  });

  it("shrinks panels to half the viewport while both are empty, and restores the designated height once either has content", async () => {
    const user = userEvent.setup();
    render(<Comparer />);
    const panels = screen.getByLabelText("JSON response inputs");

    expect(panels).toHaveClass("panels-empty");

    fireEvent.change(screen.getByRole("textbox", { name: "JSON for Baseline" }), {
      target: { value: "{}" }
    });
    expect(panels).not.toHaveClass("panels-empty");

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(panels).toHaveClass("panels-empty");
  });
});
