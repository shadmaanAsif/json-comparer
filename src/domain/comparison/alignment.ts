import type { JsonValue } from "./types";

export interface AlignedJsonPair {
  valueA: JsonValue;
  valueB: JsonValue;
}

function isJsonObject(value: JsonValue): value is Record<string, JsonValue> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(cloneJson);
  if (isJsonObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneJson(child)]));
  }
  return value;
}

function alignPair(valueA: JsonValue, valueB: JsonValue): AlignedJsonPair {
  if (Array.isArray(valueA) && Array.isArray(valueB)) {
    const alignedA: JsonValue[] = [];
    const alignedB: JsonValue[] = [];
    const sharedLength = Math.min(valueA.length, valueB.length);

    for (let index = 0; index < sharedLength; index += 1) {
      const pair = alignPair(valueA[index]!, valueB[index]!);
      alignedA.push(pair.valueA);
      alignedB.push(pair.valueB);
    }
    for (let index = sharedLength; index < valueA.length; index += 1)
      alignedA.push(cloneJson(valueA[index]!));
    for (let index = sharedLength; index < valueB.length; index += 1)
      alignedB.push(cloneJson(valueB[index]!));

    return { valueA: alignedA, valueB: alignedB };
  }

  if (!isJsonObject(valueA) || !isJsonObject(valueB)) {
    return { valueA: cloneJson(valueA), valueB: cloneJson(valueB) };
  }

  const keysA = Object.keys(valueA);
  const keysB = Object.keys(valueB);
  const keysInB = new Set(keysB);
  const sharedInBaselineOrder = keysA.filter((key) => keysInB.has(key));
  let sharedIndex = 0;
  const alignedKeysB = keysB.map((key) =>
    Object.hasOwn(valueA, key) ? sharedInBaselineOrder[sharedIndex++]! : key
  );
  const alignedA: Record<string, JsonValue> = {};
  const alignedB: Record<string, JsonValue> = {};
  const pairedB = new Map<string, JsonValue>();

  for (const key of keysA) {
    if (Object.hasOwn(valueB, key)) {
      const pair = alignPair(valueA[key]!, valueB[key]!);
      alignedA[key] = pair.valueA;
      pairedB.set(key, pair.valueB);
    } else {
      alignedA[key] = cloneJson(valueA[key]!);
    }
  }
  for (const key of alignedKeysB) {
    alignedB[key] = pairedB.get(key) ?? cloneJson(valueB[key]!);
  }

  return { valueA: alignedA, valueB: alignedB };
}

/**
 * Produces display copies with shared object keys ordered from Response A.
 * Unique keys retain their original slots, and array elements are never moved.
 */
export function alignForDisplay(valueA: JsonValue, valueB: JsonValue): AlignedJsonPair {
  return alignPair(valueA, valueB);
}
