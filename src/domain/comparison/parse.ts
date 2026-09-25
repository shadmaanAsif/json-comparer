import type { JsonValue, ParsedDocument } from "./types";

export class JsonParseError extends Error {
  constructor(
    public readonly side: "A" | "B",
    message: string
  ) {
    super(`JSON is not valid: ${message}`);
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
  // JSON.parse silently keeps only the last of a duplicate key, so comparing (and formatting)
  // this text would silently erase whichever copy loses — surface it as a parse error instead,
  // same as any other JSON that isn't ready to compare yet.
  const duplicate = findDuplicateObjectKey(text);
  if (duplicate)
    throw new JsonParseError(side, `duplicate key "${duplicate.key}" — rename or remove one copy`);
  try {
    const value = JSON.parse(text) as JsonValue;
    return { value, formatted: JSON.stringify(value, null, 2) };
  } catch (error) {
    throw new JsonParseError(side, error instanceof Error ? error.message : "unknown parse error");
  }
}

export interface DuplicateObjectKey {
  key: string;
  /** Character offset of the opening quote of the duplicate (second) occurrence. */
  index: number;
}

// Scans raw JSON text for two keys in the same object literal, which JSON.parse can't surface on
// its own since duplicates are already collapsed by the time a value comes out of it.
export function findDuplicateObjectKey(text: string): DuplicateObjectKey | null {
  type Frame = { keys: Set<string> } | null; // null marks an array frame (no keys to track)
  const stack: Frame[] = [];
  let i = 0;

  const readString = (): string => {
    let result = "";
    i++; // opening quote
    while (i < text.length) {
      const char = text[i];
      if (char === "\\") {
        result += text.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (char === '"') {
        i++;
        break;
      }
      result += char;
      i++;
    }
    return result;
  };

  while (i < text.length) {
    const char = text[i];
    if (char === '"') {
      const keyStart = i;
      const key = readString();
      let lookahead = i;
      while (lookahead < text.length && /\s/.test(text[lookahead]!)) lookahead++;
      const frame = stack[stack.length - 1];
      if (frame && text[lookahead] === ":") {
        if (frame.keys.has(key)) return { key, index: keyStart };
        frame.keys.add(key);
      }
      continue;
    }
    if (char === "{") {
      stack.push({ keys: new Set() });
    } else if (char === "[") {
      stack.push(null);
    } else if (char === "}" || char === "]") {
      stack.pop();
    }
    i++;
  }
  return null;
}
