import { describe, expect, it } from "vitest";
import type { Finding, StructureFinding } from "@/domain/comparison/types";
import { createReviewReport } from "./review-report";

describe("selected finding reports", () => {
  it("includes modified and structure findings with their notes", () => {
    const value: Finding = {
      id: "changed:/amount",
      kind: "changed",
      path: ["amount"],
      pointer: "/amount",
      valueA: 10,
      valueB: 12,
      ignored: false
    };
    const structure: StructureFinding = {
      id: "structure:missing:/id",
      kind: "missing-in-b",
      path: ["id"],
      pointer: "/id",
      detail: "Required baseline field is absent.",
      ignored: false
    };
    const report = createReviewReport([value, structure], "ordered", {
      [value.id]: { status: "needed", text: "Check rounding" },
      [structure.id]: { status: "reviewed", text: "Approved" }
    });
    expect(report).toContain("Actionable findings: 2");
    expect(report).toContain("Baseline:");
    expect(report).toContain("Required baseline field is absent.");
    expect(report).toContain("Check rounding");
    expect(report).toContain("Approved");
    expect(report).toContain("sensitive information");
  });
  it("never exports ignored values or annotations and distinguishes the root pointer", () => {
    const finding: Finding = {
      id: "changed:",
      kind: "changed",
      path: [],
      pointer: "",
      valueA: 1,
      valueB: 2,
      ignored: false
    };
    expect(createReviewReport([finding], "ordered", {})).toContain("(root — empty pointer)");
    const ignored = { ...finding, ignored: true, valueA: "secret payload" };
    const report = createReviewReport([ignored], "ordered", {
      [ignored.id]: { status: "needed", text: "secret annotation" }
    });
    expect(report).not.toContain("secret");
    expect(report).toContain("Ignored findings: 1");
  });
});
