# Software Requirements Specification — JSON Comparer

Status: Proposed baseline, 2026-08-21
Source artifact: `/Users/shadmaan.asif/Downloads/index.html` (analysis input only)

## 1. Purpose and scope

The product compares two JSON documents or API responses and presents missing fields, value changes, and structural/schema differences in a reviewable form. It is intended to become a standalone web application without losing the artifact's useful local-first behavior.

The first production release (MVP) is a single-user, local-first application. Parsing, comparison, annotations, filters, and report generation happen in the browser. A restricted server-side fetch endpoint is included only for importing remote API responses without browser CORS failures. Accounts, cloud persistence, collaboration, and share links are expansion features and are not assumed to be MVP requirements.

## 2. Target users

- API developers comparing environments, versions, or regression outputs.
- QA engineers reviewing response drift and documenting missing fields.
- Integration engineers comparing partner payloads.
- Support and operations engineers diagnosing contract differences.

## 3. Current artifact analysis

### 3.1 Existing workflow

1. Populate Response A and B by paste, local `.json`/`.txt` file, URL, or a limited cURL parser.
2. Inspect or prettify JSON, switch between text and collapsible tree views, and search each response.
3. Enter ignore-path patterns and choose highlight categories.
4. Compare. The application recursively computes missing paths and changed values, then separately evaluates structural differences.
5. Filter/group results, navigate highlighted lines/tree nodes, annotate missing fields, select rows, and export Markdown.

### 3.2 Existing implementation and data flow

- One 124 KB, 2,628-line HTML file containing markup, CSS, state, algorithms, rendering, and event handlers.
- No third-party dependencies, build process, backend, persistence, authentication, automated tests, or telemetry.
- Mutable module-level state (`lastMissing`, `lastChanged`, line maps, notes, selections, filters) drives direct DOM replacement.
- JSON is parsed with `JSON.parse`; objects are recursively compared. Object-key order is ignored. Arrays are intentionally treated as unordered multisets using canonicalized values and best-effort unmatched-item pairing.
- Structure comparison treats A as the baseline, checks missing/extra fields in B, and detects inconsistent shapes within arrays in A.
- Remote import parses a subset of cURL flags and calls `fetch` in the browser; it is therefore CORS-constrained and may expose pasted authorization headers to page/browser state.
- Reports are generated as Markdown in memory, downloaded with Blob URLs, and shown in an export preview.

### 3.3 Retain, redesign, separate, remove

| Decision           | Capability                                                                                 | Rationale                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retain             | Two-sided paste/file input; prettify; text/tree views; search                              | Core workflow and proven utility.                                                                                                                     |
| Retain             | Missing/value/structure categories; ignore patterns; filters; annotations; Markdown export | Differentiating review workflow.                                                                                                                      |
| Retain but specify | Unordered-array comparison                                                                 | Useful behavior, but must be explicit and configurable because many APIs use ordered arrays.                                                          |
| Redesign           | Comparison engine                                                                          | Pure typed functions, deterministic result model, configurable array strategy, cancellation, size limits, worker execution.                           |
| Redesign           | Editors and navigation                                                                     | Accessible components and virtualization for large inputs/results; do not port manual DOM/gutter calculations verbatim.                               |
| Redesign           | cURL/URL import                                                                            | Restricted same-origin backend-for-frontend endpoint, explicit credential warning, SSRF controls, timeouts, size limits, abort, and secret redaction. |
| Separate           | Domain comparison, structural analysis, path matching, report generation                   | Framework-independent modules with direct unit/property tests.                                                                                        |
| Separate           | UI state from persistent preferences and optional server state                             | Prevent global mutable-state coupling.                                                                                                                |
| Remove             | Artifact metadata block and sandbox-download workarounds                                   | Host-specific metadata is not product behavior; use standard downloads with accessible fallback.                                                      |
| Remove             | Unsupported cURL flags silently accepted                                                   | Reject or clearly warn about unsupported semantics rather than executing an ambiguous request.                                                        |

### 3.4 Current limitations and defects to address

- Array matching repeatedly canonicalizes and searches, producing poor worst-case time behavior; unmatched elements are paired by position rather than semantic identity.
- Deeply nested JSON can overflow the call stack. Large documents can freeze the main thread and generate very large DOM tables.
- Dot/bracket path strings are ambiguous for keys containing `.`, `[`, `]`, or `*`; internal paths need JSON Pointer or typed segments.
- Duplicate/cyclic structures are irrelevant to valid JSON, but numeric edge cases, root primitives, duplicate object keys in source text, and array semantics need explicit tests.
- Fetch lacks URL allow/deny policy, redirect validation, private-network blocking, timeout, response-byte limit, method allowlist, audit metadata, and robust cURL parsing.
- Notes exist only in memory; a reload loses the review.
- No URL routing, installable package, versioned domain schema, error boundary, tests, CI, deployment config, dependency policy, security headers, or operational signals.
- Custom modal/disclosure/tree/minimap interactions have incomplete keyboard, focus, semantics, and screen-reader behavior; status updates are not consistently announced.

## 4. Functional requirements

Priority: P0 = required for MVP; P1 = production follow-up; P2 = optional expansion.

| ID     | Priority | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------ | -------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-001 |       P0 | Accept two JSON inputs by paste and local UTF-8 `.json`/`.txt` upload.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| FR-002 |       P0 | Validate each input independently, identify the failing side, and report a useful parse location without transmitting content.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| FR-003 |       P0 | Prettify valid JSON and provide text and accessible tree views.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| FR-004 |       P0 | Compare objects without regard to property order and distinguish missing, added, changed-value, type, and structural differences.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| FR-005 |       P0 | Offer explicit array modes: ordered/indexed and unordered/multiset. Unordered/multiset is selected by default; display the active mode in controls, results, and exports.                                                                                                                                                                                                                                                                                                                                                                                                      |
| FR-006 |       P0 | Preserve original paths for both sides and use unambiguous internal path segments/JSON Pointer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| FR-007 |       P0 | Filter results by category, source, and path; provide searchable detected-path suggestions and editable, removable, deduplicated chips for selected or pasted ignore patterns. Free-typed paths do not auto-commit while idle and require Enter or Apply; exact paths include descendants, `*` consumes one segment, and terminal `**` explicitly denotes a recursive subtree.                                                                                                                                                                                                 |
| FR-008 |       P0 | Navigate from a result to the corresponding source/tree location on either side.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| FR-009 |       P0 | Add a native radio-group review status (Not reviewed, Reviewed, or Needed) and free-text note to a missing-field finding, and select findings for export.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| FR-010 |       P0 | Export full or selected results as Markdown; include timestamp, comparison options, counts, ignore rules, and an indication that payload values may be sensitive.                                                                                                                                                                                                                                                                                                                                                                                                              |
| FR-011 |       P0 | Clear all content after confirmation when annotations exist; sample data must be non-sensitive.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| FR-012 |       P0 | Save an in-progress comparison locally and restore it after reload, subject to an explicit privacy preference; default payload persistence is off.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| FR-013 |       P0 | Import a response through a controlled server endpoint using URL or supported cURL subset, showing method, target host, header names, redirects, status, media type, and truncation/errors. Public targets require HTTPS; an opt-in local-development exception may access exact loopback HTTP/HTTPS targets only.                                                                                                                                                                                                                                                             |
| FR-014 |       P0 | Cancel local comparison and remote import operations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| FR-015 |       P0 | Enforce configurable input, response, result-count, nesting, and execution-time limits with actionable errors; report visible/total differences and per-section counts with measured comparison duration. Visible counts apply all display filters; totals include all underlying findings before display filters.                                                                                                                                                                                                                                                             |
| FR-016 |       P1 | Import/export a versioned local workspace file containing inputs, options, findings, and annotations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| FR-017 |       P1 | Provide machine-readable JSON and CSV reports in addition to Markdown.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| FR-018 |       P1 | Allow a user-defined identity key for matching object arrays (for example `/items/*/id`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| FR-019 |       P2 | Authenticated users can save, name, list, delete, and share comparisons according to authorization rules.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| FR-020 |       P2 | Team workspaces support roles, retention, audit events, and concurrent-review conflict handling.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| FR-021 |       P0 | Automatically show a replayable guided tour on the first visit and include a concrete, static example in every step. Explain local-processing privacy, A/B inputs, array modes, ignore rules, editor highlights, compare/sample actions, and result review/export. The tour must support keyboard navigation, restore focus when closed, respect reduced-motion preferences, and never include payload content in its steps or completion state. Persist only a versioned, non-sensitive `seen` flag after exit or completion; storage failure must not block the app or tour. |

## 5. User flows

### Primary local comparison

Open app → populate A/B → parse feedback → choose array mode/ignore rules → Compare → summary → filter/navigate findings → annotate/select → export or save locally.

### Guided onboarding

First visit → guided tour opens automatically → review each explanation and example → move with pointer or keyboard controls → exit at any time or finish → store the non-sensitive `seen` flag and return focus to the launch control → later visits do not auto-open the tour → replay on demand, including after results exist.

### Remote import

Choose side → paste URL/cURL → app parses and previews request → user confirms sensitive headers → server validates destination → fetches with limits → response populates side → user compares. Failed policy checks never initiate an outbound request.

### Restore

Open app → detect locally saved draft → user chooses Restore or Discard → restore validated/version-migrated state → continue. Payloads are restored only if the user opted into local payload persistence.

## 6. Data requirements

Core types: `JsonValue`, `DocumentInput`, `ComparisonOptions`, `PathSegment[]`, `Finding`, `StructureFinding`, `Annotation`, `ComparisonSummary`, `Report`, `LocalWorkspaceEnvelope`.

Each finding requires a stable ID derived from category plus canonical side paths, separate A/B paths, category, A/B value previews, value types, ignored flag, and optional annotation. Full values remain referenced from parsed documents rather than duplicated into every result. Workspace envelopes include `schemaVersion`, timestamps, options, and a checksum.

MVP persistence uses IndexedDB for opted-in drafts/preferences; payload persistence defaults off. Do not use `localStorage` for large or sensitive response bodies. P2 cloud data, if approved, uses PostgreSQL entities `User`, `Workspace`, `Membership`, `Comparison`, `DocumentBlob`, `FindingSnapshot`, `Annotation`, `ShareGrant`, and `AuditEvent`. Large payloads should be encrypted object-storage blobs with metadata in PostgreSQL, not unbounded JSON columns.

Data classification: API payloads and authorization values are confidential by default. Logs, analytics, traces, URLs, error reports, and metric labels must not contain payloads, query strings, header values, tokens, notes, or exports.

Onboarding persistence is limited to a versioned boolean-equivalent `seen` flag in `localStorage`. It contains no payload, path, note, URL, header, filename, report content, or user identifier.

Retention: local drafts are user-controlled. Remote fetch response bodies are streamed back and not retained server-side. P2 cloud retention and deletion SLAs are unresolved product decisions.

## 7. API requirements

### MVP endpoint

`POST /api/fetch-proxy`

Request: `{ url, method, headers, body }`, validated against a strict schema. Permit `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, and `DELETE`; the policy discards bodies for `GET` and `HEAD`. Return `{ status, statusText, bodyText, isJson }` or a stable safe error object.

Controls: public targets require HTTPS/443; DNS resolution and every redirect are revalidated; block loopback, link-local, private, multicast, metadata-service, non-HTTP(S), credential-in-URL, and disallowed-port targets by default; strip hop-by-hop headers; maintain a header allowlist; never forward browser cookies; apply timeout, decompressed-byte, redirect, and global/per-IP rate limits; abort on client disconnect where supported. An explicit non-production setting may allow HTTP/HTTPS only for `localhost`, `127.0.0.1`, and `::1` when the application origin is also loopback; localhost DNS must resolve exclusively to loopback, and private LAN, metadata, public HTTP, production, and non-loopback app origins remain blocked.

No API is required for comparison itself. P2 persistence APIs must be versioned, authenticated, resource-authorized, idempotent where applicable, paginated, and protected against cross-workspace access.

## 8. Non-functional requirements

### Performance and capacity

- P0 target: 95th percentile local comparison under 500 ms for two 1 MB representative payloads on the agreed reference device; UI remains responsive via Web Worker.
- Initial hard limit: 10 MB per local input, 5 MB decompressed remote response, depth 256, and 100,000 findings. Values are configuration defaults pending load tests.
- Render only visible editor/tree/table rows for large documents. Comparison cancellation should be observed within 100 ms between work chunks.
- Avoid quadratic unordered-array matching: precompute canonical hashes and bucket matches; document hash-collision handling.
- MVP availability target: 99.9% monthly for hosted shell and fetch endpoint, excluding planned maintenance.

### Accessibility and usability

- Conform to WCAG 2.2 AA for supported workflows.
- Full keyboard operation, visible focus, logical headings, labeled controls, focus-trapped/restored modal, semantic tables, accessible disclosure/tree patterns, and `aria-live` status/errors.
- Do not convey categories by color alone. Support zoom/reflow at 400%, reduced motion, light/dark/system themes, and screen-reader-friendly result summaries.
- Supported browsers: current and previous major Chrome, Edge, Firefox, and Safari; confirm enterprise/older-browser needs before locking Tailwind version.

### Security and privacy

- HTTPS, restrictive CSP, HSTS, `nosniff`, referrer/permissions policies, frame denial, dependency scanning, secret scanning, and least-privilege runtime identity.
- Treat all JSON, paths, notes, URLs, headers, response bodies, filenames, and reports as untrusted. React escaping is the default; no raw HTML rendering.
- No secrets in client bundles or `NEXT_PUBLIC_*`. Validate environment at startup. Rotate credentials and document incident handling.
- Remote-fetch authorization header values exist only in request memory and must never be persisted, returned, or logged. Warn before sending credentials to a third-party host.
- P2 authentication must use secure, HttpOnly, SameSite cookies, CSRF-safe mutations, MFA-capable identity providers where needed, short sessions, and server-side resource authorization.

### Reliability, error handling, and observability

- Errors use stable codes, safe user messages, correlation IDs, and retained user input unless unsafe. Expected validation/policy errors are distinct from faults.
- Client error boundaries isolate editor/result failures; worker crashes can be retried once after explicit notice.
- Structured server logs contain timestamp, severity, service/version/environment, request ID, route, safe host classification, status, duration, and byte counts—never content.
- Metrics: request count/error/latency, fetch policy denials, timeout/truncation, comparison duration/size/finding counts (client telemetry only with consent), Web Vitals, and worker failures.
- Distributed tracing covers the fetch handler and outbound request with sanitized attributes. Alerts use burn-rate/error-rate and latency thresholds, refined after baseline traffic.

### Maintainability

- TypeScript strict mode; pure domain core independent of React/Next.js; architectural dependency rules; public module contracts; no circular imports.
- Unit, property, component, API integration, security, accessibility, and end-to-end tests; deterministic fixtures and no real third-party calls in CI.
- Supported Node.js LTS and locked package manager version; reproducible lockfile-based installs.

## 9. Acceptance criteria

1. Golden fixtures demonstrate object order independence and both ordered/unordered array semantics, including duplicates, moves, type changes, root values, escaped keys, empty containers, and deep-limit behavior.
2. Results have stable IDs and correct separate A/B paths and line locations; re-filtering does not lose annotations/selections.
3. A 1 MB representative comparison meets the performance target without a main-thread long task over 100 ms during compute.
4. Ignore rules are validated, previewable, deterministic, and applied consistently to counts, highlights, tables, and exports.
5. Refresh loses payloads by default; with explicit local-save consent, a versioned draft restores correctly and can be deleted.
6. Remote fetch rejects private/loopback/metadata addresses and unsafe redirects by default, enforces timeout/size/method/header policy, redacts secrets, and returns stable errors. When explicitly enabled for local development, exact loopback HTTP/HTTPS works only from a loopback app origin and remains disabled in production.
7. Keyboard-only and screen-reader test scripts can populate inputs, compare, filter, annotate, navigate, export, and recover from errors; automated accessibility scan has no serious/critical violations.
8. Unit/domain coverage includes all branch-critical comparison/path logic; all CI quality, security, integration, and end-to-end gates pass.
9. Production deployment has health checks, security headers, rollback, dashboards, alerts, backup/restore only if P2 persistence exists, and a documented runbook.
10. Ignore suggestions support accessible search, multi-selection, paste-to-chip conversion, inline editing, deduplication, and removal; source/path/ignored filters immediately update displayed/total counts without deleting underlying findings.

## 10. Assumptions and unresolved questions

### Assumptions used for this plan

- A browser-hosted standalone application is acceptable; offline desktop packaging is not currently required.
- JSON is the only comparison format in MVP.
- Payload privacy is more important than cross-device persistence, so comparison remains local.
- A is the schema baseline only in the structure view; ordinary difference output is symmetric.
- Modern evergreen browsers are acceptable until a browser matrix is confirmed.

### Product decisions required before implementation

1. Must URL/cURL import ship in MVP? Which methods, headers, target domains, and request-body sizes are allowed?
2. Is the deployment public internet, private/internal, on-premises, or desktop/offline?
3. Are accounts, saved comparisons, share links, collaboration, audit retention, or SSO MVP requirements?
4. What payload sensitivity/compliance regimes apply (PII, PHI, PCI, data residency), and may any telemetry leave the device?
5. What exact input sizes, nesting depths, performance reference devices, browser versions, and availability SLO apply?
6. Should structure comparison infer schemas from all array elements on both sides, and how should heterogeneous arrays be judged?
7. Are ignore rules glob-like, JSON Pointer-based, JSONPath-based, or all three via explicit modes?
8. Which export formats and report contents are mandatory, and may full changed values appear in exports?
9. What retention/deletion and backup/restore targets apply if cloud persistence is approved?
