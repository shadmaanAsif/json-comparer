import type { PathSegment } from "./types";

export function toJsonPointer(path: PathSegment[]): string {
  if (path.length === 0) return "";
  return path
    .map((segment) => `/${String(segment).replaceAll("~", "~0").replaceAll("/", "~1")}`)
    .join("");
}

export function displayPath(path: PathSegment[]): string {
  if (path.length === 0) return "(root)";
  return path.reduce<string>((out, segment) => {
    if (typeof segment === "number") return `${out}[${segment}]`;
    if (/^[A-Za-z_$][\w$]*$/.test(segment)) return out ? `${out}.${segment}` : segment;
    return `${out}[${JSON.stringify(segment)}]`;
  }, "");
}

export function parseIgnorePatterns(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function patternSegments(pattern: string): string[] {
  if (pattern.startsWith("/")) {
    return pattern
      .slice(1)
      .split("/")
      .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
  }
  return pattern
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
}

export function matchesIgnorePattern(path: PathSegment[], pattern: string): boolean {
  const expected = patternSegments(pattern);
  const actual = path.map(String);
  const hasRecursiveSuffix = expected.at(-1) === "**";
  const limit = hasRecursiveSuffix ? expected.length - 1 : expected.length;
  // Every rule matches its resolved prefix and descendants. A trailing `**`
  // makes that subtree intent explicit without consuming another path segment.
  if (actual.length < limit) return false;
  for (let index = 0; index < limit; index += 1) {
    if (expected[index] !== "*" && expected[index] !== actual[index]) return false;
  }
  return true;
}

export function isIgnored(path: PathSegment[], patterns: string[]): boolean {
  return patterns.some((pattern) => matchesIgnorePattern(path, pattern));
}
