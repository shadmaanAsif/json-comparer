import { describe, expect, it } from "vitest";
import { compareJson } from "@/domain/comparison/engine";
import { formatAlignedForDisplay } from "@/domain/comparison/display-format";
import { buildLineMap } from "@/domain/comparison/line-map";
import type { ComparisonResult } from "@/domain/comparison/types";
import { createLineHighlights } from "./line-highlights";
import { projectComparisonResult, type ComparisonResultFilters } from "./result-projections";

const toggles = { missing: true, structure: true, differences: true };
const filters: ComparisonResultFilters = {
  path: "",
  showOnlyInA: true,
  showOnlyInB: true,
  showIgnored: false
};

function project(result: ComparisonResult, overrides: Partial<ComparisonResultFilters> = {}) {
  return projectComparisonResult(result, { ...filters, ...overrides });
}

describe("createLineHighlights", () => {
  it("highlights a deeply nested field and its opposite-side aligned placeholder", () => {
    const a = { data: { config: { countries: [{ code: "AE" }] } } };
    const b = { data: { config: { countries: [{ code: "AE", phone: "+971" }] } } };
    const aligned = formatAlignedForDisplay(a, b);
    const phoneLine = aligned.lineMapB["/data/config/countries/0/phone"]!;

    const highlights = createLineHighlights(
      project(compareJson(a, b, { arrayMode: "ordered" })),
      aligned.textA,
      aligned.textB,
      { ...toggles, structure: false }
    );

    expect(highlights.b[phoneLine]).toEqual({ category: "missing", ignored: false });
    expect(aligned.placeholderLineMapA["/data/config/countries/0/phone"]).toBe(phoneLine);
    expect(highlights.a[phoneLine]).toEqual({ category: "missing", ignored: false });
  });

  it("highlights modified leaves on both sides and missing-in-B structure on A", () => {
    const a = { nested: { changed: 1, removed: true } };
    const b = { nested: { changed: 2 } };
    const textA = JSON.stringify(a, null, 2);
    const textB = JSON.stringify(b, null, 2);
    const linesA = buildLineMap(textA);
    const linesB = buildLineMap(textB);

    const highlights = createLineHighlights(project(compareJson(a, b)), textA, textB, toggles);

    expect(highlights.a[linesA["/nested/changed"]!]).toEqual({
      category: "differences",
      ignored: false
    });
    expect(highlights.b[linesB["/nested/changed"]!]).toEqual({
      category: "differences",
      ignored: false
    });
    expect(highlights.a[linesA["/nested/removed"]!]).toEqual({
      category: "structure",
      ignored: false
    });
  });

  it("uses the structure highlight for a one-sided schema field when structure is enabled", () => {
    const a = {
      showGeo: {
        showFaqs: true,
        showTestimonials: true,
        showTrustFactors: true,
        showUSPs: true
      }
    };
    const b = {
      showGeo: {
        showFaqs: true,
        showTestimonials: true,
        showTrustFactors: false,
        showUSPs: false,
        showMediaMentions: false
      }
    };
    const aligned = formatAlignedForDisplay(a, b);
    const result = project(compareJson(a, b));
    const pointer = "/showGeo/showMediaMentions";
    const line = aligned.lineMapB[pointer]!;

    expect(result.structureFindings).toEqual(
      expect.arrayContaining([expect.objectContaining({ pointer, kind: "extra-in-b" })])
    );

    const structureOnly = createLineHighlights(result, aligned.textA, aligned.textB, {
      missing: false,
      structure: true,
      differences: false
    });
    expect(structureOnly.b[line]).toEqual({ category: "structure", ignored: false });
    expect(structureOnly.a[aligned.placeholderLineMapA[pointer]!]).toEqual({
      category: "structure",
      ignored: false
    });

    const allCategories = createLineHighlights(result, aligned.textA, aligned.textB, toggles);
    expect(allCategories.b[line]).toEqual({ category: "structure", ignored: false });
    expect(allCategories.a[aligned.placeholderLineMapA[pointer]!]).toEqual({
      category: "structure",
      ignored: false
    });

    const missingOnly = createLineHighlights(result, aligned.textA, aligned.textB, {
      missing: true,
      structure: false,
      differences: false
    });
    expect(missingOnly.b[line]).toEqual({ category: "missing", ignored: false });
    expect(missingOnly.a[aligned.placeholderLineMapA[pointer]!]).toEqual({
      category: "missing",
      ignored: false
    });
  });

  it("uses the worker's exact line maps for large aligned documents", () => {
    const result = project(
      compareJson(
        { showGeo: { showFaqs: true } },
        { showGeo: { showFaqs: true, showMediaMentions: false } }
      )
    );
    const pointer = "/showGeo/showMediaMentions";
    const exactLine = 5_710;
    const highlights = createLineHighlights(
      result,
      "{}",
      "{}",
      { missing: false, structure: true, differences: false },
      {
        lineMapA: { "": 1 },
        lineMapB: { "": 1, [pointer]: exactLine },
        placeholderLineMapA: { [pointer]: exactLine },
        placeholderLineMapB: {}
      }
    );

    expect(highlights.a[exactLine]).toEqual({ category: "structure", ignored: false });
    expect(highlights.b[exactLine]).toEqual({ category: "structure", ignored: false });
  });

  it("uses the filtered projection for ignored, source, path, and category highlights", () => {
    const a = {
      onlyA: true,
      changed: 1,
      ignoredChanged: "before"
    };
    const b = {
      onlyB: true,
      changed: 2,
      ignoredChanged: "after"
    };
    const result = compareJson(a, b, { ignorePatterns: ["ignoredChanged"] });
    const aligned = formatAlignedForDisplay(a, b);
    const onlyALine = aligned.lineMapA["/onlyA"]!;
    const onlyBLine = aligned.lineMapB["/onlyB"]!;
    const changedLine = aligned.lineMapA["/changed"]!;
    const ignoredLine = aligned.lineMapA["/ignoredChanged"]!;

    const partial = createLineHighlights(
      project(result, { showOnlyInB: false }),
      aligned.textA,
      aligned.textB,
      toggles
    );
    expect(partial.a[onlyALine]).toEqual({ category: "structure", ignored: false });
    // showOnlyInB now gates both the value-level "added" finding and the structure-level
    // "extra-in-b" finding for the same path, so one toggle hides the line across both.
    expect(partial.b[onlyBLine]).toBeUndefined();
    expect(partial.a[changedLine]).toEqual({ category: "differences", ignored: false });
    expect(partial.a[ignoredLine]).toBeUndefined();

    const withIgnored = createLineHighlights(
      project(result, { showIgnored: true }),
      aligned.textA,
      aligned.textB,
      toggles
    );
    // Ignored findings shown only via "Show ignored" carry ignored: true, so panels can
    // render them dimmed instead of indistinguishable from an active finding.
    expect(withIgnored.a[ignoredLine]).toEqual({ category: "differences", ignored: true });
    expect(withIgnored.b[ignoredLine]).toEqual({ category: "differences", ignored: true });
    expect(withIgnored.a[changedLine]).toEqual({ category: "differences", ignored: false });

    const differencesOnly = createLineHighlights(project(result), aligned.textA, aligned.textB, {
      missing: false,
      structure: false,
      differences: true
    });
    expect(differencesOnly.a[onlyALine]).toBeUndefined();
    expect(differencesOnly.b[onlyBLine]).toBeUndefined();
    expect(differencesOnly.a[changedLine]).toEqual({ category: "differences", ignored: false });

    const noPathMatch = createLineHighlights(
      project(result, { path: "does-not-exist", showIgnored: true }),
      aligned.textA,
      aligned.textB,
      toggles
    );
    expect(noPathMatch).toEqual({ a: {}, b: {} });
  });
});
