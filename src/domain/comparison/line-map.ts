import { toJsonPointer } from "./path";
import type { PathSegment } from "./types";

export function buildLineMap(formattedJson: string): Record<string, number> {
  const map: Record<string, number> = { "": 1 };
  const lines = formattedJson.split("\n");
  const stack: Array<{ path: PathSegment[]; indent: number; array: boolean; index: number }> = [];
  const root = lines[0]?.trim();
  if (root === "{" || root === "[")
    stack.push({ path: [], indent: -1, array: root === "[", index: 0 });
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!;
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    while (stack.length > 1 && indent <= stack.at(-1)!.indent) stack.pop();
    const parent = stack.at(-1);
    if (!parent) continue;
    const trimmed = line.trim().replace(/,$/, "");
    if (!trimmed) continue;
    if (trimmed === "}" || trimmed === "]") continue;
    const property = trimmed.match(/^"((?:\\.|[^"])*)":\s*(.*)$/);
    let path: PathSegment[];
    let tail: string;
    if (property) {
      path = [...parent.path, JSON.parse(`"${property[1]}"`) as string];
      tail = property[2]!;
    } else if (parent.array) {
      path = [...parent.path, parent.index];
      parent.index += 1;
      tail = trimmed;
    } else continue;
    map[toJsonPointer(path)] = lineIndex + 1;
    if (tail === "{" || tail === "[") stack.push({ path, indent, array: tail === "[", index: 0 });
  }
  return map;
}

export function nearestMappedLine(
  pointer: string,
  map: Record<string, number>
): number | undefined {
  let current = pointer;
  while (!(current in map) && current) current = current.slice(0, current.lastIndexOf("/"));
  return map[current];
}
