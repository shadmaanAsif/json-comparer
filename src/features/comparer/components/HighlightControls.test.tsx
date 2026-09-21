import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HighlightControls } from "./HighlightControls";

afterEach(() => {
  cleanup();
});

describe("HighlightControls", () => {
  it("keeps the missing-fields highlight toggle simple, moving the Baseline/Candidate color legend to a hover detail", async () => {
    const user = userEvent.setup();
    render(
      <HighlightControls
        highlightVisibility={{ missing: true, structure: true, differences: true }}
        onHighlightVisibilityChange={vi.fn()}
      />
    );

    const toggle = screen.getByRole("button", { name: "Missing fields" });
    expect(toggle).toBeVisible();
    expect(toggle).not.toHaveTextContent("Only in Baseline");

    const info = screen.getByRole("button", { name: "Missing-fields highlight colors" });
    expect(info).toHaveAttribute(
      "title",
      "Only in Baseline is highlighted in red, Only in Candidate in green."
    );
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await user.hover(info);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Only in Baseline is highlighted in red, Only in Candidate in green."
    );
  });

  it("toggles a highlight category without affecting the others", async () => {
    const user = userEvent.setup();
    const onHighlightVisibilityChange = vi.fn();
    render(
      <HighlightControls
        highlightVisibility={{ missing: true, structure: true, differences: true }}
        onHighlightVisibilityChange={onHighlightVisibilityChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Structure schema" }));

    expect(onHighlightVisibilityChange).toHaveBeenCalledWith({
      missing: true,
      structure: false,
      differences: true
    });
  });
});
