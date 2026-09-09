import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComparisonResult, Finding, StructureFinding } from "@/domain/comparison/types";
import type { ComparisonProjectionCounts } from "../utils/result-projections";
import { ComparisonResults, type ComparisonResultsProps } from "./ComparisonResults";

afterEach(cleanup);

const emptyResult: ComparisonResult = {
  findings: [],
  counts: { added: 0, removed: 0, changed: 0, "type-changed": 0 },
  ignoredCount: 0,
  structure: [],
  arrayMatches: {},
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

const onlyInBFinding: Finding = {
  id: "added:/config/currency",
  kind: "added",
  path: ["config", "currency"],
  pointer: "/config/currency",
  valueB: "AED",
  ignored: false
};

const structureOnlyInB: StructureFinding = {
  id: "structure:extra-in-b:/candidateOnly",
  kind: "extra-in-b",
  path: ["candidateOnly"],
  pointer: "/candidateOnly",
  detail: "Only in B",
  ignored: false
};

const structureOnlyInA: StructureFinding = {
  id: "structure:missing-in-b:/baselineOnly",
  kind: "missing-in-b",
  path: ["baselineOnly"],
  pointer: "/baselineOnly",
  detail: "Only in A",
  ignored: false
};

const emptyCounts: ComparisonProjectionCounts = {
  differences: { visible: 0, total: 0 },
  missing: { visible: 0, total: 0 },
  structure: { visible: 0, total: 0 },
  onlyInA: { visible: 0, total: 0 },
  onlyInB: { visible: 0, total: 0 },
  modified: { visible: 0, total: 0 },
  ignored: { visible: 0, total: 0 }
};

function renderResults(overrides: Partial<ComparisonResultsProps> = {}) {
  const props: ComparisonResultsProps = {
    result: emptyResult,
    counts: emptyCounts,
    comparisonDurationMs: 120,
    onlyInA: [],
    onlyInB: [],
    differences: [],
    structureFindings: [],
    selectedFindingIds: new Set(),
    notesByFindingId: {},
    filters: {
      path: "",
      showOnlyInA: true,
      showOnlyInB: true,
      showIgnored: false,
      showStructureOnlyInA: true,
      showStructureOnlyInB: true
    },
    sections: { missing: false, structure: false, differences: false },
    ignorePaths: [],
    onFiltersChange: vi.fn(),
    onSectionsChange: vi.fn(),
    onToggleAllSections: vi.fn(),
    onExport: vi.fn(),
    onExportSection: vi.fn(),
    onToggleSelected: vi.fn(),
    onSelectFindings: vi.fn(),
    onCopyPaths: vi.fn(),
    onIgnorePaths: vi.fn(),
    onNoteChange: vi.fn(),
    ...overrides
  };

  return { ...render(<ComparisonResults {...props} />), props };
}

describe("ComparisonResults disclosures", () => {
  it("allows structure findings to be selected and reviewed without duplicating missing reviews", async () => {
    const user = userEvent.setup();
    const { props } = renderResults({
      structureFindings: [structureOnlyInA],
      onlyInA: [missingFinding],
      differences: [missingFinding],
      sections: { missing: true, structure: true, differences: true }
    });
    await user.click(screen.getByRole("checkbox", { name: "Select structure baselineOnly" }));
    expect(props.onToggleSelected).toHaveBeenCalledWith(structureOnlyInA.id);
    await user.click(
      within(
        screen.getByRole("group", { name: "Review status for structure baselineOnly" })
      ).getByRole("radio", { name: "Needed" })
    );
    expect(props.onNoteChange).toHaveBeenCalledWith(structureOnlyInA.id, { status: "needed" });
    expect(screen.getAllByRole("group", { name: "Review status for config.code" })).toHaveLength(1);
  });

  it("uses Only in A and Only in B consistently across summaries, filters, groups, and rows", () => {
    const { container } = renderResults({
      result: {
        ...emptyResult,
        findings: [missingFinding, onlyInBFinding],
        counts: { ...emptyResult.counts, removed: 1, added: 1 }
      },
      onlyInA: [missingFinding],
      onlyInB: [onlyInBFinding],
      differences: [missingFinding, onlyInBFinding],
      counts: {
        ...emptyCounts,
        differences: { visible: 2, total: 2 },
        missing: { visible: 2, total: 2 },
        onlyInA: { visible: 1, total: 1 },
        onlyInB: { visible: 1, total: 1 }
      },
      sections: { missing: true, structure: false, differences: true }
    });

    expect(container.querySelector(".summary-chip.removed")).toHaveTextContent(
      "1 / 1 Only in Baseline"
    );
    expect(container.querySelector(".summary-chip.added")).toHaveTextContent(
      "1 / 1 Only in Candidate"
    );
    const resultFilters = screen.getByRole("group", { name: "Result filters" });
    expect(within(resultFilters).getByRole("button", { name: "Only in Baseline" })).toBeVisible();
    expect(within(resultFilters).getByRole("button", { name: "Only in Candidate" })).toBeVisible();
    expect(screen.getByRole("rowheader", { name: "Only in Baseline 1" })).toBeVisible();
    expect(screen.getByRole("rowheader", { name: "Only in Candidate 1" })).toBeVisible();
  });

  it("shows displayed-versus-total counts and comparison duration", () => {
    renderResults({
      counts: {
        differences: { visible: 133, total: 165 },
        missing: { visible: 12, total: 20 },
        structure: { visible: 0, total: 30 },
        onlyInA: { visible: 12, total: 15 },
        onlyInB: { visible: 0, total: 5 },
        modified: { visible: 121, total: 145 },
        ignored: { visible: 8, total: 8 }
      },
      comparisonDurationMs: 120,
      onlyInA: Array.from({ length: 12 }, (_, index) => ({
        ...missingFinding,
        id: `${missingFinding.id}:${index}`,
        path: ["config", `code${index}`]
      })),
      sections: { missing: false, structure: false, differences: false }
    });

    expect(screen.getByRole("status")).toHaveTextContent("133 of 165 differences shown in 120 ms.");
    expect(screen.getByText("Missing Fields").closest("summary")).toHaveTextContent(
      "12 / 20 · 0 selected"
    );
    expect(screen.getByText("Structure Schema Compare").closest("summary")).toHaveTextContent(
      "0 / 30"
    );
    expect(screen.getByText("Differences").closest("summary")).toHaveTextContent("133 / 165");
    expect(screen.getByText("8 / 8 ignored")).toBeVisible();
  });

  it("toggles Only in A and Only in B structure filters independently", async () => {
    const user = userEvent.setup();
    const { props } = renderResults({
      result: {
        ...emptyResult,
        structure: [structureOnlyInB, structureOnlyInA]
      },
      structureFindings: [structureOnlyInB, structureOnlyInA],
      counts: {
        ...emptyCounts,
        structure: { visible: 2, total: 2 }
      },
      sections: { missing: false, structure: true, differences: false }
    });
    const filters = screen.getByRole("group", { name: "Structure schema filters" });
    const onlyInA = within(filters).getByRole("button", { name: "Only in Baseline" });
    const onlyInB = within(filters).getByRole("button", { name: "Only in Candidate" });

    expect(onlyInA).toHaveAttribute("aria-pressed", "true");
    expect(onlyInB).toHaveAttribute("aria-pressed", "true");

    await user.click(onlyInA);
    await user.click(onlyInB);

    expect(props.onFiltersChange).toHaveBeenNthCalledWith(1, {
      showStructureOnlyInA: false
    });
    expect(props.onFiltersChange).toHaveBeenNthCalledWith(2, {
      showStructureOnlyInB: false
    });
  });

  it("shows an arrow and toggles each result section with native summary controls", async () => {
    const user = userEvent.setup();
    const { props } = renderResults();
    const summaries = ["Missing Fields", "Structure Schema Compare", "Differences"].map((title) =>
      screen.getByText(title).closest("summary")!
    );

    for (const summary of summaries) {
      const arrow = summary.querySelector(".result-section-arrow");
      expect(arrow).toHaveAttribute("aria-hidden", "true");
      expect(arrow?.querySelector("svg")).toBeInTheDocument();
    }

    await user.click(summaries[0]!);

    expect(summaries[0]!.closest("details")).toHaveAttribute("open");
    expect(props.onSectionsChange).toHaveBeenCalledWith({ missing: true });
  });

  it("renders Structure Schema Compare before Missing Fields and Differences", () => {
    const { container } = renderResults();
    const sectionTitles = Array.from(
      container.querySelectorAll(".result-section > summary .result-section-title")
    ).map((element) => element.textContent?.trim());

    expect(sectionTitles).toEqual(["Structure Schema Compare", "Missing Fields", "Differences"]);
  });

  it("opens a section action menu without toggling the disclosure", async () => {
    const user = userEvent.setup();
    renderResults({
      onlyInA: [missingFinding],
      counts: { ...emptyCounts, missing: { visible: 1, total: 1 } }
    });
    const trigger = screen.getByRole("button", { name: "Missing Fields actions" });
    const section = trigger.closest("details")!;

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(section).not.toHaveAttribute("open");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    // A control inside <summary> must not open the section it lives in.
    expect(section).not.toHaveAttribute("open");
    expect(screen.getByRole("menu", { name: "Missing Fields actions" })).toBeVisible();
  });

  it("copies, exports, bulk-selects, and ignores the visible findings of one section", async () => {
    const user = userEvent.setup();
    const { props } = renderResults({
      onlyInA: [missingFinding],
      onlyInB: [onlyInBFinding],
      counts: { ...emptyCounts, missing: { visible: 2, total: 2 } }
    });
    const openMenu = async () => {
      await user.click(screen.getByRole("button", { name: "Missing Fields actions" }));
      return screen.getByRole("menu", { name: "Missing Fields actions" });
    };

    await user.click(
      within(await openMenu()).getByRole("menuitem", { name: /Copy visible paths/ })
    );
    expect(props.onCopyPaths).toHaveBeenCalledWith(
      [missingFinding.pointer, onlyInBFinding.pointer],
      "Missing Fields"
    );

    await user.click(
      within(await openMenu()).getByRole("menuitem", { name: "Export this section (.md)" })
    );
    expect(props.onExportSection).toHaveBeenCalledWith("missing");

    await user.click(
      within(await openMenu()).getByRole("menuitem", { name: /Select all for report/ })
    );
    expect(props.onSelectFindings).toHaveBeenCalledWith(
      [missingFinding.id, onlyInBFinding.id],
      true
    );

    await user.click(
      within(await openMenu()).getByRole("menuitem", { name: /Ignore visible paths/ })
    );
    expect(props.onIgnorePaths).toHaveBeenCalledWith([
      missingFinding.pointer,
      onlyInBFinding.pointer
    ]);
  });

  it("offers restoring once every visible path in the section is already ignored", async () => {
    const user = userEvent.setup();
    const { props } = renderResults({
      onlyInA: [missingFinding],
      ignorePaths: [missingFinding.pointer, "/unrelated"],
      counts: { ...emptyCounts, missing: { visible: 1, total: 1 } }
    });

    await user.click(screen.getByRole("button", { name: "Missing Fields actions" }));
    const menu = screen.getByRole("menu", { name: "Missing Fields actions" });

    expect(within(menu).queryByRole("menuitem", { name: /Ignore visible paths/ })).toBeNull();
    await user.click(within(menu).getByRole("menuitem", { name: "Restore ignored paths (1)" }));

    expect(props.onIgnorePaths).toHaveBeenCalledWith(["/unrelated"]);
  });

  it("disables section actions that have nothing to act on", async () => {
    const user = userEvent.setup();
    renderResults();

    await user.click(screen.getByRole("button", { name: "Differences actions" }));
    const menu = screen.getByRole("menu", { name: "Differences actions" });

    expect(within(menu).getByRole("menuitem", { name: "Copy visible paths (0)" })).toBeDisabled();
    expect(
      within(menu).getByRole("menuitem", { name: "Export this section (.md)" })
    ).toBeDisabled();
    expect(
      within(menu).getByRole("menuitem", { name: "Select all for report (0)" })
    ).toBeDisabled();
    expect(within(menu).getByRole("menuitem", { name: "Ignore visible paths (0)" })).toBeDisabled();
  });

  it("keeps Differences bulk selection to rows that own a report checkbox", async () => {
    const user = userEvent.setup();
    const modified: Finding = {
      id: "changed:/config/amount",
      kind: "changed",
      path: ["config", "amount"],
      pointer: "/config/amount",
      valueA: 1,
      valueB: 2,
      ignored: false
    };
    const { props } = renderResults({
      // missingFinding is "removed", so Differences delegates its review elsewhere.
      differences: [missingFinding, modified],
      counts: { ...emptyCounts, differences: { visible: 2, total: 2 } }
    });

    await user.click(screen.getByRole("button", { name: "Differences actions" }));
    await user.click(
      within(screen.getByRole("menu", { name: "Differences actions" })).getByRole("menuitem", {
        name: "Select all for report (1)"
      })
    );

    expect(props.onSelectFindings).toHaveBeenCalledWith([modified.id], true);
  });

  it("closes the section menu on Escape and returns focus to its trigger", async () => {
    const user = userEvent.setup();
    renderResults();
    const trigger = screen.getByRole("button", { name: "Structure Schema Compare actions" });

    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeVisible();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("edits review status through a three-option radio group", async () => {
    const user = userEvent.setup();
    const { props } = renderResults({
      result: {
        ...emptyResult,
        findings: [missingFinding],
        counts: { ...emptyResult.counts, removed: 1 }
      },
      onlyInA: [missingFinding],
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
