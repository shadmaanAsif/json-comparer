import type { Metadata } from "next";
import { SITE_NAME } from "../site-config";

export const metadata: Metadata = {
  title: "About",
  description:
    "CompareFiles is a privacy-first JSON diff tool: comparison runs entirely in your browser, and nothing you paste, upload, or fetch is ever logged or persisted.",
  alternates: { canonical: "/about" }
};

export default function AboutPage() {
  return (
    <main>
      <div className="content-page">
        <a href="/" className="content-page-back">
          ← Back to Compare
        </a>
        <h1>About {SITE_NAME}</h1>
        <p>
          {SITE_NAME} compares two JSON documents — API responses, config files, exported
          payloads — and shows exactly what changed: fields added, fields removed, values
          modified, and types changed. It exists because most JSON diff tools either upload
          your data to a server or bury the actual differences under noisy, unreadable output.
        </p>

        <h2>Privacy is the architecture, not a policy</h2>
        <p>
          Parsing and comparison run locally in your browser, off the main UI thread in a Web
          Worker, so large documents stay responsive without ever leaving your machine. There
          are no accounts, no analytics, and no telemetry. Payload contents, paths, values,
          notes, headers, and report contents are never written to logs or error monitoring.
        </p>
        <p>
          The one exception is opt-in: fetching a response from a URL or cURL command goes
          through a secure server-side proxy so browser CORS restrictions don&apos;t block the
          request. That proxy strips credentials before returning a response, enforces HTTPS
          and hostname allowlisting in production, and never stores what it fetches.
        </p>

        <h2>Built for real comparison work, not toy diffs</h2>
        <p>
          Object key order never affects results, duplicate array items are compared as
          multisets in unordered mode, and every field is tracked by its exact RFC 6901 JSON
          Pointer path — so a rename three levels deep in a nested array is reported precisely,
          not approximated. A separate Structure Schema comparison checks shape consistency
          independent of the values themselves, which is useful when you care that two API
          responses agree on their contract even if the actual data differs.
        </p>
        <p>
          Reports are Markdown, reviewed in an in-page preview before you download or copy
          them, and carry a standing warning that the values inside may be sensitive — because
          the tool has no way to know what you pasted into it.
        </p>
        <p>
          See the <a href="/docs">documentation</a> for the full feature set, including array
          modes, ignore-path patterns, and secure remote fetch.
        </p>
      </div>
    </main>
  );
}
