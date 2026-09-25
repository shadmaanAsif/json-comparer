import {
  formatAlignedForDisplay,
  type AlignedDisplayText
} from "@/domain/comparison/display-format";
import { findDuplicateObjectKey } from "@/domain/comparison/parse";
import type { JsonValue } from "@/domain/comparison/types";

export type AlignedInputText = AlignedDisplayText;

export function alignValidInputText(textA: string, textB: string): AlignedInputText | null {
  try {
    // JSON.parse silently keeps only the last of a duplicate key, so realigning here would erase
    // a key a user just duplicated (e.g. via paste) before they renamed it. Leave both sides
    // untouched — same as invalid JSON — until the duplicate is resolved.
    if (findDuplicateObjectKey(textA) || findDuplicateObjectKey(textB)) return null;
    const valueA = JSON.parse(textA) as JsonValue;
    const valueB = JSON.parse(textB) as JsonValue;
    return formatAlignedForDisplay(valueA, valueB);
  } catch {
    return null;
  }
}
