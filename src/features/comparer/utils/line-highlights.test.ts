import { describe, expect, it } from "vitest";
import { compareJson } from "@/domain/comparison/engine";
import { formatAlignedForDisplay } from "@/domain/comparison/display-format";
import { buildLineMap } from "@/domain/comparison/line-map";
import { createLineHighlights } from "./line-highlights";

const toggles = { missing: true, structure: true, differences: true };

describe("createLineHighlights", () => {
  it("highlights a deeply nested field and its opposite-side aligned placeholder", () => {
    const a = { data: { config: { countries: [{ code: "AE" }] } } };
    const b = { data: { config: { countries: [{ code: "AE", phone: "+971" }] } } };
    const aligned = formatAlignedForDisplay(a, b);
    const phoneLine = aligned.lineMapB["/data/config/countries/0/phone"]!;

    const highlights = createLineHighlights(
      compareJson(a, b),
      aligned.textA,
      aligned.textB,
      toggles
    );

    expect(highlights.b[phoneLine]).toBe("missing");
    expect(aligned.placeholderLineMapA["/data/config/countries/0/phone"]).toBe(phoneLine);
    expect(highlights.a[phoneLine]).toBe("missing");
  });

  it("highlights modified leaves on both sides and missing-in-B structure on A", () => {
    const a = { nested: { changed: 1, removed: true } };
    const b = { nested: { changed: 2 } };
    const textA = JSON.stringify(a, null, 2);
    const textB = JSON.stringify(b, null, 2);
    const linesA = buildLineMap(textA);
    const linesB = buildLineMap(textB);

    const highlights = createLineHighlights(compareJson(a, b), textA, textB, toggles);

    expect(highlights.a[linesA["/nested/changed"]!]).toBe("differences");
    expect(highlights.b[linesB["/nested/changed"]!]).toBe("differences");
    expect(highlights.a[linesA["/nested/removed"]!]).toBe("missing");
  });
});
