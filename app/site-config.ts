const DEFAULT_SITE_URL = "http://localhost:3001";

function normalizeSiteUrl(value: string | undefined): string {
  if (!value) return DEFAULT_SITE_URL;
  try {
    return new URL(value).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
export const SITE_NAME = "JSON Comparer";
export const SITE_DESCRIPTION =
  "Compare two JSON documents and see every added, removed, changed, and type-changed field. Parsing and comparison run locally in your browser — nothing is uploaded.";
export const SITE_KEYWORDS = [
  "JSON diff",
  "JSON compare",
  "compare JSON online",
  "JSON diff tool",
  "JSON comparison tool",
  "privacy-first JSON diff"
];
