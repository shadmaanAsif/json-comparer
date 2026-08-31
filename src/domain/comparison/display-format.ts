import { alignForDisplay } from "./alignment";
import { buildLineMap } from "./line-map";
import { toJsonPointer } from "./path";
import type { JsonValue, PathSegment } from "./types";

export interface DisplayLineMaps {
  lineMapA: Record<string, number>;
  lineMapB: Record<string, number>;
  placeholderLineMapA: Record<string, number>;
  placeholderLineMapB: Record<string, number>;
}

export interface AlignedDisplayText extends DisplayLineMaps {
  textA: string;
  textB: string;
}

interface DisplayLine {
  text: string;
  path?: string;
  placeholderPath?: string;
}

interface DisplayBlock {
  linesA: DisplayLine[];
  linesB: DisplayLine[];
}

interface ObjectKeySlot {
  keyA?: string;
  keyB?: string;
}

const MISSING = Symbol("missing-json-value");
type MaybeJsonValue = JsonValue | typeof MISSING;

function absolutePointer(basePath: PathSegment[], relativePointer: string): string {
  return `${toJsonPointer(basePath)}${relativePointer}`;
}

function renderSingleValue(
  value: JsonValue,
  path: PathSegment[],
  indentation: number
): DisplayLine[] {
  const serialized = JSON.stringify(value, null, 2);
  const relativeLineMap = buildLineMap(serialized);
  const pathsByLine = new Map<number, string>();

  for (const [relativePointer, line] of Object.entries(relativeLineMap)) {
    pathsByLine.set(line, absolutePointer(path, relativePointer));
  }

  const prefix = " ".repeat(indentation);
  return serialized.split("\n").map((text, index) => ({
    text: `${prefix}${text}`,
    ...(pathsByLine.get(index + 1) ? { path: pathsByLine.get(index + 1)! } : {})
  }));
}

function blankMirror(lines: DisplayLine[]): DisplayLine[] {
  return lines.map((line) => ({
    text: "",
    ...(line.path ? { placeholderPath: line.path } : {})
  }));
}

function padBlocks(linesA: DisplayLine[], linesB: DisplayLine[]): DisplayBlock {
  const length = Math.max(linesA.length, linesB.length);
  return {
    linesA: [...linesA, ...Array.from({ length: length - linesA.length }, () => ({ text: "" }))],
    linesB: [...linesB, ...Array.from({ length: length - linesB.length }, () => ({ text: "" }))]
  };
}

function addPropertyPrefix(lines: DisplayLine[], key: string, indentation: number): DisplayLine[] {
  if (!lines.length) return lines;
  const [first, ...rest] = lines;
  return [
    {
      ...first!,
      text: `${" ".repeat(indentation)}${JSON.stringify(key)}: ${first!.text.trimStart()}`
    },
    ...rest
  ];
}

function addTrailingComma(lines: DisplayLine[]): DisplayLine[] {
  const output = lines.map((line) => ({ ...line }));
  for (let index = output.length - 1; index >= 0; index -= 1) {
    if (output[index]!.text.trim()) {
      output[index]!.text += ",";
      break;
    }
  }
  return output;
}

function alignObjectKeySlots(keysA: string[], keysB: string[]): ObjectKeySlot[] {
  const keysInA = new Set(keysA);
  const keysInB = new Set(keysB);
  const slots: ObjectKeySlot[] = [];
  let indexA = 0;
  let indexB = 0;

  while (indexA < keysA.length || indexB < keysB.length) {
    const keyA = keysA[indexA];
    const keyB = keysB[indexB];
    if (keyA !== undefined && keyA === keyB) {
      slots.push({ keyA, keyB });
      indexA += 1;
      indexB += 1;
    } else if (keyA !== undefined && !keysInB.has(keyA)) {
      slots.push({ keyA });
      indexA += 1;
    } else if (keyB !== undefined && !keysInA.has(keyB)) {
      slots.push({ keyB });
      indexB += 1;
    } else if (keyA !== undefined) {
      // Shared keys are already in Response A order after alignForDisplay().
      slots.push({ keyA });
      indexA += 1;
    } else if (keyB !== undefined) {
      slots.push({ keyB });
      indexB += 1;
    }
  }
  return slots;
}

function renderObjectPair(
  valueA: Record<string, JsonValue>,
  valueB: Record<string, JsonValue>,
  path: PathSegment[],
  indentation: number
): DisplayBlock {
  const pointer = toJsonPointer(path);
  const linesA: DisplayLine[] = [{ text: `${" ".repeat(indentation)}{`, path: pointer }];
  const linesB: DisplayLine[] = [{ text: `${" ".repeat(indentation)}{`, path: pointer }];
  const keysA = Object.keys(valueA);
  const keysB = Object.keys(valueB);
  const slots = alignObjectKeySlots(keysA, keysB);
  let renderedA = 0;
  let renderedB = 0;

  for (const slot of slots) {
    const key = slot.keyA ?? slot.keyB!;
    const block = renderValuePair(
      slot.keyA === undefined ? MISSING : valueA[slot.keyA]!,
      slot.keyB === undefined ? MISSING : valueB[slot.keyB]!,
      [...path, key],
      indentation + 2
    );
    let propertyLinesA =
      slot.keyA === undefined
        ? block.linesA
        : addPropertyPrefix(block.linesA, slot.keyA, indentation + 2);
    let propertyLinesB =
      slot.keyB === undefined
        ? block.linesB
        : addPropertyPrefix(block.linesB, slot.keyB, indentation + 2);
    renderedA += slot.keyA === undefined ? 0 : 1;
    renderedB += slot.keyB === undefined ? 0 : 1;
    if (slot.keyA !== undefined && renderedA < keysA.length)
      propertyLinesA = addTrailingComma(propertyLinesA);
    if (slot.keyB !== undefined && renderedB < keysB.length)
      propertyLinesB = addTrailingComma(propertyLinesB);
    linesA.push(...propertyLinesA);
    linesB.push(...propertyLinesB);
  }

  linesA.push({ text: `${" ".repeat(indentation)}}` });
  linesB.push({ text: `${" ".repeat(indentation)}}` });
  return { linesA, linesB };
}

function renderArrayPair(
  valueA: JsonValue[],
  valueB: JsonValue[],
  path: PathSegment[],
  indentation: number
): DisplayBlock {
  const pointer = toJsonPointer(path);
  const linesA: DisplayLine[] = [{ text: `${" ".repeat(indentation)}[`, path: pointer }];
  const linesB: DisplayLine[] = [{ text: `${" ".repeat(indentation)}[`, path: pointer }];
  const length = Math.max(valueA.length, valueB.length);

  for (let index = 0; index < length; index += 1) {
    const block = renderValuePair(
      index < valueA.length ? valueA[index]! : MISSING,
      index < valueB.length ? valueB[index]! : MISSING,
      [...path, index],
      indentation + 2
    );
    linesA.push(...(index < valueA.length - 1 ? addTrailingComma(block.linesA) : block.linesA));
    linesB.push(...(index < valueB.length - 1 ? addTrailingComma(block.linesB) : block.linesB));
  }

  linesA.push({ text: `${" ".repeat(indentation)}]` });
  linesB.push({ text: `${" ".repeat(indentation)}]` });
  return { linesA, linesB };
}

function renderValuePair(
  valueA: MaybeJsonValue,
  valueB: MaybeJsonValue,
  path: PathSegment[],
  indentation: number
): DisplayBlock {
  if (valueA === MISSING) {
    const linesB = renderSingleValue(valueB as JsonValue, path, indentation);
    return { linesA: blankMirror(linesB), linesB };
  }
  if (valueB === MISSING) {
    const linesA = renderSingleValue(valueA, path, indentation);
    return { linesA, linesB: blankMirror(linesA) };
  }
  if (Array.isArray(valueA) && Array.isArray(valueB)) {
    return renderArrayPair(valueA, valueB, path, indentation);
  }
  if (
    valueA !== null &&
    valueB !== null &&
    typeof valueA === "object" &&
    typeof valueB === "object" &&
    !Array.isArray(valueA) &&
    !Array.isArray(valueB)
  ) {
    return renderObjectPair(valueA, valueB, path, indentation);
  }
  return padBlocks(
    renderSingleValue(valueA, path, indentation),
    renderSingleValue(valueB, path, indentation)
  );
}

function lineMap(lines: DisplayLine[], key: "path" | "placeholderPath"): Record<string, number> {
  const output: Record<string, number> = {};
  lines.forEach((line, index) => {
    const pointer = line[key];
    if (pointer !== undefined && output[pointer] === undefined) output[pointer] = index + 1;
  });
  return output;
}

/**
 * Formats a JSON pair into equal-height line blocks. Missing fields are mirrored
 * as JSON-safe blank lines, so corresponding paths share the same visual row.
 */
export function formatAlignedForDisplay(valueA: JsonValue, valueB: JsonValue): AlignedDisplayText {
  const aligned = alignForDisplay(valueA, valueB);
  const block = renderValuePair(aligned.valueA, aligned.valueB, [], 0);
  return {
    textA: block.linesA.map((line) => line.text).join("\n"),
    textB: block.linesB.map((line) => line.text).join("\n"),
    lineMapA: lineMap(block.linesA, "path"),
    lineMapB: lineMap(block.linesB, "path"),
    placeholderLineMapA: lineMap(block.linesA, "placeholderPath"),
    placeholderLineMapB: lineMap(block.linesB, "placeholderPath")
  };
}
