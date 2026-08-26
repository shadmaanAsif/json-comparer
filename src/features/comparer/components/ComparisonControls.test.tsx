import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComparisonControls, type ComparisonControlsProps } from "./ComparisonControls";

afterEach(cleanup);

function renderControls(overrides: Partial<ComparisonControlsProps> = {}) {
  const props: ComparisonControlsProps = {
    arrayMode: "ordered",
    ignorePathsText: "meta.timestamp",
    highlightVisibility: { missing: true, structure: true, differences: true },
    isComparing: false,
    status: { tone: "idle", message: "Ready to compare." },
    onArrayModeChange: vi.fn(),
    onIgnorePathsTextChange: vi.fn(),
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
