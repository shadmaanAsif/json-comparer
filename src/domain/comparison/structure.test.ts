import { describe, expect, it } from "vitest";
import { compareStructure } from "./structure";
import type { JsonValue } from "./types";

describe("compareStructure", () => {
  it("does not flag a heterogeneous root-level array as inconsistent against a trivial candidate", () => {
    const heterogeneousLog: JsonValue[] = [
      { event: "content-view", "content-name": "/en" },
      { event: "flight_search", origin_iata: "RUH", destination_iata: "DXB" },
      { event: "home_page", pos: "AE" }
    ];
    const findings = compareStructure(heterogeneousLog, []);
    expect(findings).toHaveLength(0);
  });

  it("still reports real schema differences between root array items at the same index", () => {
    const findings = compareStructure(
      [{ event: "a", shared: 1, onlyInA: true }],
      [{ event: "a", shared: 1, onlyInB: true }]
    );
    expect(findings.map((finding) => finding.kind)).toEqual(
      expect.arrayContaining(["missing-in-b", "extra-in-b"])
    );
    expect(findings.map((finding) => finding.pointer)).toEqual(
      expect.arrayContaining(["/0/onlyInA", "/0/onlyInB"])
    );
  });

  it("does not pair root array items beyond the shorter side's length", () => {
    const findings = compareStructure([{ a: 1 }, { b: 2 }], [{ a: 1 }]);
    expect(findings).toHaveLength(0);
  });

  it("ignores the self-check for unordered root-level arrays too", () => {
    const findings = compareStructure(
      [{ event: "a", onlyOnFirst: true }, { event: "b" }],
      [{ event: "a" }, { event: "b" }],
      "unordered"
    );
    expect(findings.every((finding) => finding.kind !== "inconsistent-in-a")).toBe(true);
  });

  it("still flags inconsistent items within a nested array field, unaffected by the root-array change", () => {
    const findings = compareStructure(
      { items: [{ id: 1, name: "a" }, { id: 2 }] },
      { items: [{ id: 1, name: "a" }, { id: 2 }] }
    );
    expect(findings.some((finding) => finding.kind === "inconsistent-in-a")).toBe(true);
  });
});
