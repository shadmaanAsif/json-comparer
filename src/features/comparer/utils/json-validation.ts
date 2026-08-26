export interface JsonSyntaxIssue {
  message: string;
  line: number;
}

function errorLine(raw: string, message: string): number {
  const explicitLine = message.match(/line\s+(\d+)/i)?.[1];
  if (explicitLine) return Math.max(1, Number(explicitLine));

  const position = message.match(/position\s+(\d+)/i)?.[1];
  if (position) return raw.slice(0, Number(position)).split("\n").length;
  return 1;
}

export function getJsonSyntaxIssue(raw: string): JsonSyntaxIssue | null {
  if (!raw.trim()) return null;

  try {
    JSON.parse(raw);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    return { message, line: errorLine(raw, message) };
  }
}

export function getJsonSyntaxError(raw: string): string | null {
  return getJsonSyntaxIssue(raw)?.message ?? null;
}
