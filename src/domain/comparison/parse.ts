import type { JsonValue, ParsedDocument } from "./types";

export class JsonParseError extends Error {
  constructor(
    public readonly side: "A" | "B",
    message: string
  ) {
    super(`Response ${side} is not valid JSON: ${message}`);
    this.name = "JsonParseError";
  }
}

export function parseJson(
  text: string,
  side: "A" | "B",
  maxBytes = 10 * 1024 * 1024
): ParsedDocument {
  if (!text.trim()) throw new JsonParseError(side, "input is empty");
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > maxBytes)
    throw new JsonParseError(side, `input exceeds the ${maxBytes.toLocaleString()} byte limit`);
  try {
    const value = JSON.parse(text) as JsonValue;
    return { value, formatted: JSON.stringify(value, null, 2) };
  } catch (error) {
    throw new JsonParseError(side, error instanceof Error ? error.message : "unknown parse error");
  }
}
