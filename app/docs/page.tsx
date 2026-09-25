import type { Metadata } from "next";
import { SITE_NAME } from "../site-config";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "How to compare JSON with CompareFiles: array modes, ignore-path patterns, secure remote fetch, and Markdown export.",
  alternates: { canonical: "/docs" }
};

export default function DocsPage() {
  return (
    <main>
      <div className="content-page">
        <h1>Documentation</h1>
        <p>
          {SITE_NAME} compares a <strong>Baseline</strong> (the first document, and the schema
          reference for structure comparison) against a <strong>Candidate</strong> (the second
          document). Every finding is one of: only in Baseline, only in Candidate, modified
          (same path, different value), or type-changed.
        </p>

        <h2>Loading JSON into a panel</h2>
        <p>Each panel accepts JSON the same four ways:</p>
        <ul>
          <li>Paste or type directly into the editor.</li>
          <li>Drag and drop a JSON or text file onto the panel.</li>
          <li>Use the panel&apos;s quick-upload control to pick a file.</li>
          <li>
            Open the shared Add Data dialog to upload a file, or fetch a response with a URL
            or cURL command.
          </li>
        </ul>
        <p>
          <strong>Prettify</strong> validates and reformats a panel&apos;s JSON without altering
          invalid input, so you can fix a syntax error in place. Once both panels hold valid
          JSON, Compare, paste, upload, remote fetch, and Load Sample all trigger the same
          display alignment: Baseline&apos;s key order becomes the shared display order, keys
          unique to one side keep their original position, and array elements are never
          reordered. Alignment only changes how the JSON is displayed — findings are always
          computed from the original, unaligned values.
        </p>

        <h2>Ordered vs. unordered arrays</h2>
        <p>
          <strong>Ordered</strong> (the default) compares array items by index — item 0 against
          item 0, item 1 against item 1, and so on. <strong>Unordered</strong> compares arrays as
          multisets: item order doesn&apos;t matter, but duplicates still count, so removing one
          of two identical entries is still reported as a removal. Switch modes with the array
          mode control before comparing; it affects both value comparison and Structure Schema
          Compare.
        </p>

        <h2>Structure Schema Compare</h2>
        <p>
          A separate pass compares the <em>shape</em> of the two documents — which fields exist —
          independent of their values, using Baseline as the schema reference. In Ordered mode,
          array items are checked against Baseline&apos;s first array item by position; in
          Unordered mode, each side&apos;s array items are pooled into a union of observed fields
          first, so a reordered array with the same item shapes reports no structural mismatch.
        </p>

        <h2>Ignore paths</h2>
        <p>
          Ignore rules suppress specific fields from visible findings, counts, and highlights
          (the underlying finding still exists — Show Ignored reveals it again). Rules accept:
        </p>
        <ul>
          <li>
            <strong>An exact path</strong> — either dotted (<code>data.config.region</code>) or a
            JSON Pointer (<code>/data/config/region</code>) — which also covers everything
            beneath it.
          </li>
          <li>
            <strong>A single-segment wildcard</strong>, <code>*</code>, which consumes exactly one
            path segment (<code>config.partnerConfig.*</code> matches every direct child of
            <code>partnerConfig</code>, including their descendants).
          </li>
          <li>
            <strong>A terminal recursive suffix</strong>, <code>**</code>, as an explicit way to
            mark a subtree — useful when you want that intent to read unambiguously in a saved
            rule list.
          </li>
        </ul>
        <p>
          The Ignore Paths panel suggests paths seen in the latest comparison, accepts pasted
          comma- or newline-separated patterns, and reruns the comparison immediately on Apply.
        </p>

        <h2>Secure remote fetch</h2>
        <p>
          The Add Data dialog can fetch a response directly instead of requiring a manual
          upload: paste a bare URL, or a cURL command (method, headers, request body, Basic
          auth, user-agent, and cookies are all supported). The request goes through a
          server-side proxy, not your browser, so it can reach APIs regardless of their CORS
          policy. Public targets must use HTTPS; a local-development-only exception permits
          plain HTTP to <code>localhost</code>, <code>127.0.0.1</code>, and <code>::1</code> so
          you can compare against a service running on your own machine. Non-2xx responses are
          still loaded, so you can diff an API&apos;s error payloads.
        </p>

        <h2>Reviewing and exporting results</h2>
        <p>
          Findings can be marked <strong>Not reviewed</strong>, <strong>Reviewed</strong>, or
          <strong>Needed</strong>, with an optional note, and selected individually or in bulk
          for a report. Export produces a Markdown report — either every actionable finding, a
          single result section, or just your current selection — shown in a read-only preview
          before you copy or download it. Every report carries a privacy warning, since the
          tool has no way to know whether the values inside are sensitive, and ignored findings
          are always excluded from report content.
        </p>
      </div>
    </main>
  );
}
