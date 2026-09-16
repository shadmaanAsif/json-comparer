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
// Brand — used for siteName, applicationName, manifest, and schema.org identity.
export const SITE_NAME = "CompareFiles";
// Page + social-card title — leads with the JSON search terms, keeps the brand.
export const SITE_TITLE = "JSON Diff | CompareFiles";
export const SITE_DESCRIPTION =
  "Compare two JSON files and spot every difference instantly. Free, fast, and private — your JSON never leaves your browser.";
export const SITE_KEYWORDS = [
  "JSON diff",
  "JSON compare",
  "compare JSON online",
  "JSON diff tool",
  "JSON comparison tool",
  "privacy-first JSON diff"
];
