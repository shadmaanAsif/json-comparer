import { expect, it, vi } from "vitest";
import { createMarkdownReport } from "./markdown";

it("creates a privacy-marked report and excludes ignored findings", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-21T00:00:00Z"));
  const report = createMarkdownReport(
    [
      {
        id: "changed:/a",
        kind: "changed",
        path: ["a"],
        pointer: "/a",
        valueA: 1,
        valueB: 2,
        ignored: false
      },
      {
        id: "changed:/secret",
        kind: "changed",
        path: ["secret"],
        pointer: "/secret",
        valueA: "x",
        valueB: "y",
        ignored: true
      }
    ],
    "ordered"
  );
  expect(report).toContain("2026-08-21T00:00:00.000Z");
  expect(report).toContain("may contain sensitive information");
  expect(report).toContain("## 1. a");
  expect(report).not.toContain("## 2. secret");
  vi.useRealTimers();
});
