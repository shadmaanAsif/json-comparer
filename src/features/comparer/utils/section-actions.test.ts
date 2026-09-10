import { describe, expect, it } from "vitest";
import type { Finding, StructureFinding } from "@/domain/comparison/types";
import { planSectionActions } from "./section-actions";

const removed: Finding = {
  id: "removed:/config/code",
  kind: "removed",
  path: ["config", "code"],
  pointer: "/config/code",
  valueA: "A",
  ignored: false
};

const changed: Finding = {
  id: "changed:/config/amount",
  kind: "changed",
  path: ["config", "amount"],
  pointer: "/config/amount",
  valueA: 1,
  valueB: 2,
  ignored: false
};

const withinArray: Finding = {
  id: "changed:/items/0/name",
  kind: "changed",
  path: ["items", 0, "name"],
  pointer: "/items/0/name",
  valueA: "a",
  valueB: "b",
  ignored: false
};

const structure: StructureFinding = {
  id: "structure:extra-in-b:/candidateOnly",
  kind: "extra-in-b",
  path: ["candidateOnly"],
  pointer: "/candidateOnly",
  detail: "Only in B",
  ignored: false
};

describe("planSectionActions", () => {
  it("collects de-duplicated pointers and counts only report-eligible findings", () => {
    const plan = planSectionActions(
      [
        removed,
        { ...changed, id: "duplicate", pointer: removed.pointer },
        { ...structure, ignored: true }
      ],
      new Set(),
      []
    );

    expect(plan.pointers).toEqual(["/config/code", "/candidateOnly"]);
    expect(plan.actionableCount).toBe(2);
  });

  it("reports all-selected only when every selectable finding is selected", () => {
    const ids = new Set([removed.id]);

    expect(planSectionActions([removed], ids, []).allSelected).toBe(true);
    expect(planSectionActions([removed, changed], ids, []).allSelected).toBe(false);
    expect(planSectionActions([], ids, []).allSelected).toBe(false);
  });

  it("excludes findings the section does not offer a checkbox for", () => {
    const plan = planSectionActions(
      [removed, changed],
      new Set(),
      [],
      (finding) => finding.kind !== "removed"
    );

    expect(plan.selectableIds).toEqual([changed.id]);
  });

  it("separates paths that can be ignored from exact rules that can be restored", () => {
    const plan = planSectionActions([removed, changed], new Set(), [removed.pointer]);

    expect(plan.ignorePointers).toEqual([changed.pointer]);
    expect(plan.restorePointers).toEqual([removed.pointer]);
  });

  it("offers neither ignore nor restore for a path covered by a broader rule", () => {
    const plan = planSectionActions([withinArray], new Set(), ["items.*"]);

    expect(plan.ignorePointers).toEqual([]);
    expect(plan.restorePointers).toEqual([]);
  });

  it("keeps numeric array segments matchable against ignore patterns", () => {
    const plan = planSectionActions([withinArray], new Set(), ["/items/0/name"]);

    expect(plan.restorePointers).toEqual([withinArray.pointer]);
  });
});
