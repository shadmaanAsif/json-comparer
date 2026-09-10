"use client";

import { useMemo, useState } from "react";
import type { DisplayLineMaps } from "@/domain/comparison/display-format";
import type {
  ArrayMode,
  ComparisonResult,
  Finding,
  StructureFinding
} from "@/domain/comparison/types";
import type { ResponseSide } from "../types";
import type { PanelAnchorRect } from "../utils/panel-anchor";
import {
  buildPanelIndex,
  getCounterpart,
  type PanelField,
  type PanelIndex
} from "../utils/panel-context";

export type ReviewFinding = Finding | StructureFinding;
export interface PanelActionRequest {
  view?: "json" | "tree";
  field: PanelField;
  anchor: { x: number; y: number };
  getAnchor?: () => PanelAnchorRect | null;
  parentExpanded: boolean;
  onToggleParent: () => void;
  branchExpanded?: boolean;
  onToggleBranch?: () => void;
}
export interface PanelNavigation {
  field: PanelField;
  index: PanelIndex;
  token: number;
}

export function usePanelInteractions({
  textA,
  textB,
  lineMaps,
  result,
  arrayMode,
  enabled
}: {
  textA: string;
  textB: string;
  lineMaps: DisplayLineMaps | null;
  result: ComparisonResult | null;
  arrayMode: ArrayMode;
  enabled: boolean;
}) {
  const indexes = useMemo(
    () =>
      lineMaps && result
        ? {
            A: buildPanelIndex(textA, lineMaps.lineMapA, lineMaps.placeholderLineMapA),
            B: buildPanelIndex(textB, lineMaps.lineMapB, lineMaps.placeholderLineMapB)
          }
        : null,
    [lineMaps, result, textA, textB]
  );
  const [request, setRequest] = useState<
    (PanelActionRequest & { side: ResponseSide; index: PanelIndex }) | null
  >(null);
  const [navigation, setNavigation] = useState<Partial<Record<ResponseSide, PanelNavigation>>>({});
  const selection =
    enabled && request && indexes?.[request.side] === request.index ? request : null;
  const findingsByPointer = useMemo(() => {
    const map = new Map<string, ReviewFinding[]>();
    for (const finding of [...(result?.findings ?? []), ...(result?.structure ?? [])]) {
      const values = map.get(finding.pointer) ?? [];
      values.push(finding);
      map.set(finding.pointer, values);
    }
    return map;
  }, [result]);
  const reverseArrayMatches = useMemo(() => {
    const reverse: Record<string, string> = {};
    for (const [pointerA, pointerB] of Object.entries(result?.arrayMatches ?? {})) {
      reverse[pointerB] = pointerA;
    }
    return reverse;
  }, [result]);
  let related: ReviewFinding[] = [];
  if (selection) {
    let pointer = selection.field.pointer;
    while (true) {
      related = (findingsByPointer.get(pointer) ?? []).filter((finding) => {
        if (selection.field.placeholder || arrayMode === "ordered") return true;
        if (selection.side === "A" && (finding.kind === "added" || finding.kind === "extra-in-b"))
          return false;
        if (
          selection.side === "B" &&
          (finding.kind === "removed" || finding.kind === "missing-in-b")
        )
          return false;
        return true;
      });
      if (related.length || !pointer) break;
      pointer = pointer.slice(0, pointer.lastIndexOf("/"));
    }
  }
  const otherSide: ResponseSide = selection?.side === "A" ? "B" : "A";
  const counterpart =
    selection && indexes
      ? getCounterpart(
          selection.field,
          indexes[otherSide],
          indexes[selection.side],
          arrayMode,
          selection.side === "A" ? (result?.arrayMatches ?? {}) : reverseArrayMatches
        )
      : undefined;
  const parent =
    selection && selection.field.parentPointer !== null
      ? selection.index.byPointer.get(selection.field.parentPointer)
      : undefined;
  const navigate = (side: ResponseSide, pointer: string) => {
    const index = indexes?.[side];
    const field = index?.byPointer.get(pointer);
    if (!index || !field) return;
    setNavigation((current) => ({
      ...current,
      [side]: { field, index, token: (current[side]?.token ?? 0) + 1 }
    }));
  };
  /**
   * Resolve `pointer`'s counterpart field on the opposite side of `homeSide`, the same
   * matched-item-aware resolution the per-line "Jump to corresponding field" panel action uses
   * (getCounterpart + arrayMatches), generalized to any pointer rather than only the current
   * panel selection. Returns undefined when there is no safe counterpart to navigate to.
   */
  const resolveCounterpartPointer = (homeSide: ResponseSide, pointer: string) => {
    if (!indexes) return undefined;
    const homeIndex = indexes[homeSide];
    const otherSide: ResponseSide = homeSide === "A" ? "B" : "A";
    const field = homeIndex.byPointer.get(pointer);
    if (!field) return undefined;
    const matches = homeSide === "A" ? (result?.arrayMatches ?? {}) : reverseArrayMatches;
    return getCounterpart(field, indexes[otherSide], homeIndex, arrayMode, matches)?.pointer;
  };
  return {
    indexes: enabled ? indexes : null,
    selection,
    related,
    counterpart,
    parent: parent?.placeholder ? undefined : parent,
    otherSide,
    navigation,
    openActions: (side: ResponseSide, action: PanelActionRequest) => {
      const index = indexes?.[side];
      if (enabled && index) setRequest({ ...action, side, index });
    },
    closeActions: () => setRequest(null),
    navigate,
    resolveCounterpartPointer
  };
}
