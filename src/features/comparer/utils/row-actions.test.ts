import { describe, expect, it, vi } from "vitest";
import type { Finding, StructureFinding } from "@/domain/comparison/types";
import { buildRowActions } from "./row-actions";

const removed: Finding = {
  id: "removed:/config/code",
  kind: "removed",
  path: ["config", "code"],
  pointer: "/config/code",
  valueA: "A",
  ignored: false
};

const added: Finding = {
  id: "added:/config/currency",
  kind: "added",
  path: ["config", "currency"],
  pointer: "/config/currency",
  valueB: "AED",
  ignored: false
};

const withinArray: Finding = {
  id: "changed:/items/0/name",
  kind: "changed",
  path: ["items", 0, "name"],
  pointer: "/items/0/name",
  valueA: "a",
  valueB: "b",
  ignored: false
};

const structureExtraInB: StructureFinding = {
  id: "structure:extra-in-b:/candidateOnly",
  kind: "extra-in-b",
  path: ["candidateOnly"],
  pointer: "/candidateOnly",
  detail: "Only in B",
  ignored: false
};

const structureInconsistentInA: StructureFinding = {
  id: "structure:inconsistent-in-a:/items",
  kind: "inconsistent-in-a",
  path: ["items"],
  pointer: "/items",
  detail: "Baseline array items disagree on shape",
  ignored: false
};

function buildOptions(overrides: Partial<Parameters<typeof buildRowActions>[0]> = {}) {
  return {
    finding: removed,
    ignorePaths: [] as string[],
    onIgnorePaths: vi.fn(),
    onManageIgnores: vi.fn(),
    onScrollToPanel: vi.fn(),
    ...overrides
  };
}

describe("buildRowActions", () => {
  it("offers to add an ignore rule when the pointer is not yet covered", () => {
    const options = buildOptions();
    const [ignoreAction] = buildRowActions(options);

    expect(ignoreAction!.label).toBe("Add to ignore path");
    expect(ignoreAction!.disabled).toBeFalsy();

    ignoreAction!.onSelect();

    expect(options.onIgnorePaths).toHaveBeenCalledWith([removed.pointer]);
    expect(options.onManageIgnores).not.toHaveBeenCalled();
  });

  it("offers to restore an exact ignore rule already covering the pointer", () => {
    const options = buildOptions({ ignorePaths: [removed.pointer, "/unrelated"] });
    const [ignoreAction] = buildRowActions(options);

    expect(ignoreAction!.label).toBe("Restore ignore path");
    expect(ignoreAction!.disabled).toBeFalsy();

    ignoreAction!.onSelect();

    expect(options.onIgnorePaths).toHaveBeenCalledWith(["/unrelated"]);
    expect(options.onManageIgnores).not.toHaveBeenCalled();
  });

  it("offers to review matching rules when a broader pattern already covers the pointer", () => {
    const options = buildOptions({
      finding: withinArray,
      ignorePaths: ["items.*"]
    });
    const [ignoreAction] = buildRowActions(options);

    expect(ignoreAction!.label).toBe("Review matching ignore rules");
    expect(ignoreAction!.disabled).toBeFalsy();

    ignoreAction!.onSelect();

    expect(options.onManageIgnores).toHaveBeenCalledTimes(1);
    expect(options.onIgnorePaths).not.toHaveBeenCalled();
  });

  it("disables the ignore action for an unsupported pointer", () => {
    const options = buildOptions({ finding: { ...structureExtraInB, pointer: "" } });
    const [ignoreAction] = buildRowActions(options);

    expect(ignoreAction!.disabled).toBe(true);
  });

  it("scrolls a Baseline-only finding to side A and resolves a Candidate counterpart", () => {
    const options = buildOptions({ finding: removed });
    const [, scrollAction] = buildRowActions(options);

    expect(scrollAction!.label).toBe("Scroll to panel");

    scrollAction!.onSelect();

    expect(options.onScrollToPanel).toHaveBeenCalledWith(removed.pointer, "A", true);
  });

  it("scrolls a Candidate-only finding to side B and resolves a Baseline counterpart", () => {
    const options = buildOptions({ finding: added });
    const [, scrollAction] = buildRowActions(options);

    scrollAction!.onSelect();

    expect(options.onScrollToPanel).toHaveBeenCalledWith(added.pointer, "B", true);
  });

  it("scrolls a Candidate-only structure finding to side B and resolves a Baseline counterpart", () => {
    const options = buildOptions({ finding: structureExtraInB });
    const [, scrollAction] = buildRowActions(options);

    scrollAction!.onSelect();

    expect(options.onScrollToPanel).toHaveBeenCalledWith(structureExtraInB.pointer, "B", true);
  });

  it("scrolls a missing-in-b structure finding to side B, not Baseline's canonical item", () => {
    // The array index in a missing-in-b pointer is Candidate's own (job.valueB's loop), never
    // Baseline's — Baseline is only ever compared via its single canonical item 0, which may not
    // exist at all at this index. Side B is the only side guaranteed to resolve.
    const structureMissingInB: StructureFinding = {
      id: "structure:missing-in-b:/items/2/amount",
      kind: "missing-in-b",
      path: ["items", 2, "amount"],
      pointer: "/items/2/amount",
      detail: "Only in A",
      ignored: false
    };
    const options = buildOptions({ finding: structureMissingInB });
    const [, scrollAction] = buildRowActions(options);

    scrollAction!.onSelect();

    expect(options.onScrollToPanel).toHaveBeenCalledWith(structureMissingInB.pointer, "B", true);
  });

  it("resolves a Candidate counterpart for a changed value present on both sides", () => {
    const options = buildOptions({ finding: withinArray });
    const [, scrollAction] = buildRowActions(options);

    scrollAction!.onSelect();

    expect(options.onScrollToPanel).toHaveBeenCalledWith(withinArray.pointer, "A", true);
  });

  it("resolves a Candidate counterpart for a type-changed value present on both sides", () => {
    const typeChanged: Finding = { ...withinArray, kind: "type-changed" };
    const options = buildOptions({ finding: typeChanged });
    const [, scrollAction] = buildRowActions(options);

    scrollAction!.onSelect();

    expect(options.onScrollToPanel).toHaveBeenCalledWith(typeChanged.pointer, "A", true);
  });

  it("does not resolve a Candidate counterpart for a Baseline-only structure consistency finding", () => {
    const options = buildOptions({ finding: structureInconsistentInA });
    const [, scrollAction] = buildRowActions(options);

    scrollAction!.onSelect();

    expect(options.onScrollToPanel).toHaveBeenCalledWith(
      structureInconsistentInA.pointer,
      "A",
      false
    );
  });
});
