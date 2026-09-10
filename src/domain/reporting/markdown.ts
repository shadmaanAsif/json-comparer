import { displayPath } from "../comparison/path";
import type { ArrayMode, Finding, StructureFinding } from "../comparison/types";

function printable(value: unknown): string {
  if (value === undefined) return "—";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `\`${text.replaceAll("`", "\\`")}\``;
}

export function createMarkdownReport(
  findings: (Finding | StructureFinding)[],
  arrayMode: ArrayMode
): string {
  const actionable = findings.filter((finding) => !finding.ignored);
  const lines = [
    "# JSON Comparison Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Array mode: ${arrayMode}`,
    `Actionable findings: ${actionable.length}`,
    `Ignored findings: ${findings.length - actionable.length}`,
    "",
    "> Review this report before sharing; compared values may contain sensitive information.",
    ""
  ];
  if (actionable.length === 0) lines.push("No actionable differences found.", "");
  actionable.forEach((finding, index) => {
    lines.push(
      `## ${index + 1}. ${displayPath(finding.path)}`,
      "",
      `- Type: ${finding.kind}`,
      `- JSON Pointer: ${finding.pointer ? printable(finding.pointer) : "(root — empty pointer)"}`,
      ...("detail" in finding
        ? [`- Detail: ${printable(finding.detail)}`]
        : [
            `- Baseline: ${printable(finding.valueA)}`,
            `- Candidate: ${printable(finding.valueB)}`
          ]),
      ""
    );
  });
  return lines.join("\n");
}
