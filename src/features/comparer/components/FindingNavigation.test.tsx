import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceFindingNav } from "./FindingNavigation";

afterEach(() => {
  cleanup();
});

function renderNav(props: Partial<Parameters<typeof WorkspaceFindingNav>[0]> = {}) {
  const handlers = { onPrevious: vi.fn(), onNext: vi.fn(), onScrollToOutput: vi.fn() };
  render(
    <WorkspaceFindingNav categories={["differences"]} current={2} total={5} {...handlers} {...props} />
  );
  return handlers;
}

describe("WorkspaceFindingNav", () => {
  it("shows the active count and no ignored tally when nothing is ignored", () => {
    renderNav();

    expect(screen.getByText("Finding 2 of 5")).toBeInTheDocument();
    expect(screen.queryByText(/ignored/)).not.toBeInTheDocument();
  });

  it("shows the ignored tally on its own line, separate from the active count", () => {
    renderNav({ ignored: 3 });

    expect(screen.getByText("Finding 2 of 5")).toBeInTheDocument();
    const tally = screen.getByText("3 ignored");
    expect(tally).toBeInTheDocument();
    expect(screen.getByText("Finding 2 of 5")).not.toHaveTextContent("ignored");
    // It reports a number rather than acting as a control.
    expect(tally.closest("button")).toBeNull();
  });

  it("stays mounted with disabled stepping when every finding is ignored", async () => {
    const user = userEvent.setup();
    const handlers = renderNav({ total: 0, current: 1, categories: [], ignored: 4 });

    expect(screen.getByText("No active findings")).toBeInTheDocument();
    expect(screen.getByText("4 ignored")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Next/ })).toBeDisabled();

    // The way down to the comparison output stays available.
    await user.click(screen.getByRole("button", { name: /Advanced View/ }));
    expect(handlers.onScrollToOutput).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when there are no findings at all", () => {
    const { container } = render(
      <WorkspaceFindingNav
        categories={[]}
        current={1}
        total={0}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onScrollToOutput={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("steps with enabled Previous/Next while there are active findings", async () => {
    const user = userEvent.setup();
    const handlers = renderNav({ ignored: 1 });

    await user.click(screen.getByRole("button", { name: /Previous/ }));
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(handlers.onPrevious).toHaveBeenCalledTimes(1);
    expect(handlers.onNext).toHaveBeenCalledTimes(1);
  });
});
