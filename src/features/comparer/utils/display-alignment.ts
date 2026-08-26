import {
  formatAlignedForDisplay,
  type AlignedDisplayText
} from "@/domain/comparison/display-format";
import type { JsonValue } from "@/domain/comparison/types";

export type AlignedInputText = AlignedDisplayText;

export function alignValidInputText(textA: string, textB: string): AlignedInputText | null {
  try {
    const valueA = JSON.parse(textA) as JsonValue;
    const valueB = JSON.parse(textB) as JsonValue;
    return formatAlignedForDisplay(valueA, valueB);
  } catch {
    return null;
  }
}
