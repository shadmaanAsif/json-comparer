export const SAMPLE_A = JSON.stringify(
  { status: "ok", data: { id: 42, amount: 100, tags: ["api", "stable"] }, meta: { version: 1 } },
  null,
  2
);

export const SAMPLE_B = JSON.stringify(
  {
    status: "ok",
    data: { id: 42, amount: 150, tags: ["stable", "api"], currency: "USD" },
    meta: { version: "2" }
  },
  null,
  2
);

/**
 * Distinct from SAMPLE_A/SAMPLE_B: the guided tour loads this pair to demonstrate the
 * results sections live, so it deliberately covers all three at once — a field only in
 * Baseline, one only in Candidate, a changed value, and a type mismatch.
 */
export const TOUR_DEMO_A = JSON.stringify(
  {
    status: "ok",
    data: { id: 42, amount: 100, currency: "USD", tags: ["api", "stable"], region: "eu-west" },
    meta: { version: 1 }
  },
  null,
  2
);

export const TOUR_DEMO_B = JSON.stringify(
  {
    status: "ok",
    data: { id: 42, amount: 150, currency: "USD", tags: ["stable", "api"], discount: true },
    meta: { version: "1" }
  },
  null,
  2
);

export const MAX_DOCUMENT_BYTES = Number(
  process.env.NEXT_PUBLIC_MAX_DOCUMENT_BYTES ?? 10 * 1024 * 1024
);

export const APP_AUTHOR = (process.env.NEXT_PUBLIC_APP_AUTHOR ?? "").trim();

/**
 * Display names for the two comparison roles. `A`/`B` remain the internal
 * identity for sides, editors, and finding kinds; only presentation uses these.
 */
export const SIDE_LABELS = {
  A: "Baseline",
  B: "Candidate"
} as const;

/** Directional finding labels, phrased with the role names users see. */
export const ONLY_IN_LABELS = {
  A: "Only in Baseline",
  B: "Only in Candidate"
} as const;

/** Display names for the result disclosures, shared by section headings and status copy. */
export const RESULT_SECTION_LABELS = {
  structure: "Structure Schema Compare",
  missing: "Missing Fields",
  differences: "Differences"
} as const;

/** Filename stems for per-section Markdown exports. */
export const RESULT_SECTION_REPORT_NAMES = {
  structure: "section-structure-schema-report.md",
  missing: "section-missing-fields-report.md",
  differences: "section-differences-report.md"
} as const;
