import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComparisonResult, Finding } from "@/domain/comparison/types";
import { ComparisonResults, type ComparisonResultsProps } from "./ComparisonResults";

afterEach(cleanup);

const emptyResult: ComparisonResult = {
  findings: [],
  counts: { added: 0, removed: 0, changed: 0, "type-changed": 0 },
  ignoredCount: 0,
  structure: [],
  truncated: false
};

const missingFinding: Finding = {
  id: "removed:/config/code",
  kind: "removed",
  path: ["config", "code"],
  pointer: "/config/code",
  valueA: "A",
  ignored: false
};

function renderResults(overrides: Partial<ComparisonResultsProps> = {}) {
  const props: ComparisonResultsProps = {
    result: emptyResult,
    visibleFindingCount: 0,
    missingInA: [],
    missingInB: [],
    differences: [],
    structureFindings: [],
    selectedFindingIds: new Set(),
    notesByFindingId: {},
    filters: { path: "", showOnlyA: true, showOnlyB: true, showIgnored: false },
    sections: { missing: false, structure: false, differences: false },
    onFiltersChange: vi.fn(),
    onSectionsChange: vi.fn(),
    onToggleAllSections: vi.fn(),
    onExport: vi.fn(),
    onToggleSelected: vi.fn(),
    onNoteChange: vi.fn(),
    ...overrides
  };

  return { ...render(<ComparisonResults {...props} />), props };
}

describe("ComparisonResults disclosures", () => {
  it("shows an arrow and toggles each result section with native summary controls", async () => {
    const user = userEvent.setup();
    const { container, props } = renderResults();
    const summaries = ["Missing Fields", "Structure Schema Compare", "Differences"].map((title) =>
      screen.getByText(title).closest("summary")!
    );

    for (const summary of summaries) {
      const arrow = summary.querySelector(".result-section-arrow");
      expect(arrow).toHaveAttribute("aria-hidden", "true");
      expect(arrow?.querySelector("svg")).toBeInTheDocument();
    }

    await user.click(summaries[0]!);

    expect(container.querySelectorAll("details")[0]).toHaveAttribute("open");
    expect(props.onSectionsChange).toHaveBeenCalledWith({ missing: true });
  });

  it("edits review status through a three-option radio group", async () => {
    const user = userEvent.setup();
    const { props } = renderResults({
      result: {
        ...emptyResult,
        findings: [missingFinding],
        counts: { ...emptyResult.counts, removed: 1 }
      },
      missingInB: [missingFinding],
      sections: { missing: true, structure: false, differences: false }
    });
    const statusGroup = screen.getByRole("group", {
      name: "Review status for config.code"
    });

    expect(within(statusGroup).getAllByRole("radio")).toHaveLength(3);
    expect(within(statusGroup).getByRole("radio", { name: "Not reviewed" })).toBeChecked();

    await user.click(within(statusGroup).getByRole("radio", { name: "Needed" }));

    expect(props.onNoteChange).toHaveBeenCalledWith(missingFinding.id, { status: "needed" });
  });
});
