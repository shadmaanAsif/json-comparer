# SRS.md — Software Requirements Specification

**Project:** JSON Response Comparer — standalone, production-ready conversion
**Source artifact:** single-file HTML/CSS/JS Cowork artifact (`json-response-comparer`), fully analyzed line-by-line
**Companion docs:** `FEATURES.md` (the exhaustive feature inventory each requirement below traces to), `ARCHITECTURE.md`, `TECH_STACK.md`, `IMPLEMENTATION_PLAN.md`
**Status:** Specification — implementation has not started

> Every functional requirement (`FR-xxx`) cites the `FEATURES.md` feature ID(s) it derives from — read this document for *what must be true*, and `FEATURES.md` for *the full behavioral detail, exact algorithms, states, and edge cases*. Repeating that detail here would just create two sources of truth that can drift; this document intentionally stays at the requirement/acceptance-criteria level.

---

## 1. Project definition

### 1.1 Purpose

Convert the existing JSON Response Comparer — a single self-contained HTML artifact with no backend, no persistence, no build process, no types, and no tests — into a standalone, production-ready web application with full behavioral parity, while closing every gap that makes the artifact unsuitable to operate as real, maintained software.

### 1.2 Goals

1. Preserve 100% of the artifact's validated, intentional behavior (every feature in `FEATURES.md`).
2. Make the previously undocumented, DOM-entangled diff/ignore-path logic typed, pure, and unit-tested.
3. Keep the fetch feature client-side, matching the artifact's own model exactly (no server-side proxy in v1 — see §1.3, §2.9) — while architecting a clean seam so a hardened server-side proxy (SSRF-guarded, timed out, size-capped) can be added later without a rewrite, if and when that becomes necessary (§15.12).
4. Add the production baseline the artifact never needed as a Cowork artifact but does need as a real app: CI/CD, observability, accessibility conformance, security headers, structured error handling.
5. Leave a small number of genuine, decision-requiring gaps (auth, persistence, hosting) explicitly open rather than guessed at — see §15.

### 1.3 Scope

**In scope:** Everything in `FEATURES.md` F-001 through F-016, implemented as a **fully client-side application with zero required backend/server surface** — the fetch/curl feature (F-005) executes as a direct browser `fetch()`, matching the artifact's own model exactly, not a server-side proxy — plus the production-engineering non-functional requirements (§3) that apply to a client-only build.

**Explicitly, deliberately deferred (see §2.9 and §15.12):** a server-side fetch-proxy (FR-044/FR-045) and any backend layer at all. Nothing in the v1 baseline requires Next.js Route Handlers, Server Actions, a database, or an auth boundary to exist. The architecture keeps a clean seam for adding a backend later (`ARCHITECTURE.md` §3.10/§4) — see that seam's trigger conditions in §15.12 — but v1 ships and is fully usable without one.

**Out of scope for v1 (see §15 for the decisions that would bring these into scope):**
- Multi-tenant accounts/billing.
- Mobile native apps.
- Real-time multi-user collaborative editing of the same comparison.
- Bulk/batch comparison of more than two documents at once.
- Internationalization (English-only, NFR-011).
- The optional persistence module (FR-046–FR-048) — fully specified as a should-have in §6, but not part of the v1 acceptance baseline (§14) unless §15.2 is answered "yes."

### 1.4 Target users

1. **Frontend/backend engineers** debugging API contract drift between environments or app versions.
2. **QA engineers** verifying a response payload against an expected baseline during regression testing.
3. **Support/ops-adjacent technical staff** comparing two customer-facing API responses to diagnose a reported discrepancy.

All three are **internal, technical users**; this is an internal engineering tool, not a customer-facing product. This framing drives the auth/hosting posture in §9/§15.

### 1.5 User roles

The artifact has no role concept — anyone who can open it can do everything. **v1 preserves this** (no roles) unless §15.1 decides otherwise. If the optional persistence module (§6) is adopted, exactly two roles become relevant: **Owner** (created a saved comparison/preset; full CRUD on it) and **Viewer** (opened a shared comparison; read-only) — no admin/moderator role is specified because no requirement calls for one.

### 1.6 Assumptions

- No existing internal design system was provided; a fresh Tailwind/shadcn/ui setup is proposed (`TECH_STACK.md` §2.3/§2.4).
- No existing backend/API platform was specified; v1 needs none (§1.3). Next.js Route Handlers remain the default *if and when* a backend is built (§15.12), rather than assumed integration with an unnamed internal gateway.
- GitHub + GitHub Actions is assumed for source control/CI pending confirmation (§15.5).
- This is internal-only; not designed for public/anonymous internet exposure.

### 1.7 Constraints

- Must prefer React, Next.js, and TypeScript per the conversion brief (evaluated, not just assumed — see `TECH_STACK.md` §1).
- Must not silently alter documented artifact behavior, including the quirks/defects catalogued in `FEATURES.md` — every behavior change requires an explicit decision, recorded in §15, not a silent "improvement" made during implementation.
- Must not invent requirements the artifact's own behavior doesn't support and the user hasn't specified (auth model, persistence, hosting) — these stay open (§15) rather than assumed.

---

## 2. Functional requirements

Each FR cites its `FEATURES.md` source feature(s). "Acceptance criteria" here are the requirement-level pass/fail; `FEATURES.md`'s per-feature acceptance criteria are the detailed, implementation-level version of the same statement.

### 2.1 Input & editing

| ID | Requirement | Feature(s) | Acceptance criteria |
|---|---|---|---|
| FR-001 | The system MUST let the user paste or type JSON (or any text) directly into either of two independent input panels (A, B). | F-001, F-001.1 | Text entered in one panel never affects the other; no client-side length limit blocks normal use. |
| FR-002 | The system MUST let the user upload a local `.json`/`.txt` file into either panel via a file picker. | F-001.2, F-003.1 | A selected file's exact text content replaces the target panel's content; a file read error shows a specific message naming the file. |
| FR-003 | The system MUST let the user populate either panel by pasting a curl command or a bare URL and executing it as a direct client-side request from the browser — matching the artifact's own model exactly; **v1 deliberately does not run this request through a server-side proxy** (see §1.3, §2.9). | F-001.3, F-003.2, F-005 | The request executes via `fetch()` in the browser, behind the swappable `FetchExecutor` interface (`ARCHITECTURE.md` §3.10); the response status and body (pretty-printed if JSON, raw otherwise) populate the target panel; a cross-origin target without permissive CORS headers fails with the same "usually a CORS restriction" message the artifact shows today — this is an accepted, documented limitation of the client-only build, not a defect. |
| FR-004 | The system MUST let the user re-indent (prettify) the JSON in a panel in place. | F-001.4 | Valid JSON is reformatted to 2-space-indented `JSON.stringify` output; invalid JSON shows the specific parser error and leaves the panel's text unchanged; an empty panel is a no-op with no error. |
| FR-005 | The system MUST provide an in-panel, case-insensitive text search with match count and next/previous navigation. | F-001.5 | The find input never loses focus mid-keystroke; Enter/Shift+Enter navigate forward/back through matches, wrapping at the ends. |
| FR-006 | The system MUST let the user switch each panel independently between a raw JSON view and a read-only, expandable/collapsible Tree view of the same content. | F-001.6, F-002 | Switching views never loses the underlying text; Tree view re-parses on switch and on edit. |
| FR-007 | The system MUST show a persistent, editable curl/URL field once a fetch has populated a panel, allowing that request to be edited and re-run. | F-001.7 | Editing and re-submitting updates the panel with the new response; the field does not appear before any fetch has run. |
| FR-008 | The system MUST show a line-number gutter synced to each panel's content, correctly numbering wrapped (soft-wrapped) lines. | F-001.8 | Gutter numbers remain aligned with their text row after paste, edit, resize, or a line's wrap state changing. |
| FR-009 | The system MUST visually indicate, in both the raw JSON view and the Tree view, which lines/nodes are off-screen in a currently highlighted category, and provide a way to jump to them (minimap markers, gutter indicators, and "N more above/below" pills). | F-001.9, F-001.10, F-001.11, F-002.5, F-002.6 | Every highlighted line/node has a corresponding, clickable indicator; indicators disappear when there is nothing to show. |

### 2.1a Tree view rendering and data import (added during the cross-reference pass — `FEATURES.md` F-002/F-003/F-004 required these to be named explicitly rather than folded into FR-006's general toggle capability)

| ID | Requirement | Feature(s) | Acceptance criteria |
|---|---|---|---|
| FR-010 | The system MUST render valid JSON, when the Tree view is active, as a fully-expanded, collapsible node tree with independent expand/collapse state per node, type-aware leaf styling (string/number/boolean/null visually distinct), and inline `{}`/`[]` display for empty objects/arrays with no expander shown. | F-002, F-002.1, F-002.2, F-002.3 | A fresh switch to Tree view on valid JSON renders every node expanded by default; collapsing one node never affects a sibling's state; an empty object/array never shows a non-functional disclosure control. |
| FR-011 | The Tree view MUST apply the same diff-highlight categories and colors used by the raw JSON view to matching nodes, and MUST show a navigation strip with proportional, clickable markers when at least one highlight exists in the current view, hidden entirely (not shown empty) otherwise. | F-002.4, F-002.5, F-002.6 | A highlighted path's Tree node shows the same category color as its JSON-view line; the navigation strip is present only when there is at least one highlight to navigate to. |
| FR-012 | The system MUST provide a single modal, reachable from either panel's "Add" control, offering both a file-upload leg and a curl/URL-fetch leg, remembering which panel was targeted for the lifetime the modal is open, closing automatically on a successful file load or fetch, and remaining open with a specific error message on failure. | F-003, F-003.1, F-003.2 | The modal's title always names the panel whose "Add" control opened it; a successful file selection or fetch always closes the modal and updates the correct panel; a failed fetch leaves the modal open with a specific, visible error. |
| FR-013 | The system MUST parse a pasted curl command or bare URL, client-side and synchronously with no network access, into a structured `{url, method, headers, body}` result (or `null` for empty input), following the exact tokenization and flag-handling rules specified in `FEATURES.md` F-004's Business Logic section. | F-004 | A bare URL parses to a GET request with no headers/body; a realistic "Copy as cURL" command's method, headers, body, Basic auth, User-Agent, and Cookie all parse correctly against a fixture; the unknown-flag URL-swallowing behavior is handled per whichever decision `SRS.md` §15.7 records (fixed or deliberately preserved), not left to accident. |

### 2.2 Ignore Paths

| ID | Requirement | Feature(s) | Acceptance criteria |
|---|---|---|---|
| FR-014 | The system MUST let the user enter a comma-separated list of field-path patterns excluded from every result view and all highlighting. | F-006 | Entering a pattern immediately affects Missing Fields, Structure Schema Compare, Differences, and highlighting, without requiring Compare to be re-run. |
| FR-015 | The system MUST support three pattern forms: exact path (+ implicit subtree), single-segment wildcard (`*`), and trailing-wildcard subtree (`.*`), matching the exact semantics in `FEATURES.md` F-006's Business Logic section. | F-006 | All three pattern forms match exactly as specified, including the documented (not silently altered) bare-`*` and compound-path behaviors pending the decision in §15.7. |

### 2.3 Compare engine

| ID | Requirement | Feature(s) | Acceptance criteria |
|---|---|---|---|
| FR-016 | The system MUST validate both panels are non-empty and independently valid JSON before comparing, and MUST name the offending panel and parse error otherwise, aborting the entire compare (no partial result). | F-007.6 | An invalid-JSON panel blocks Compare entirely; a previous successful result (if any) remains visible unchanged. |
| FR-017 | The system MUST re-prettify both panels in place as a side effect of a successful Compare. | F-007.5 | Comparing minified input leaves both panels visibly pretty-printed afterward. |
| FR-018 | The system MUST compute Missing Fields as a key-set diff for objects and a canonical-value, order-independent pairing for arrays, exactly as specified in `FEATURES.md` F-007. | F-007.1 | Reordered keys/array items with identical content produce zero Missing Fields. |
| FR-019 | The system MUST compute value-level Differences for fields present on both sides. | F-007.2 | Every field with an unequal value on both sides appears exactly once, with both raw values available. |
| FR-020 | The system MUST compute a Structure Schema Compare using Response A's `[0]` array item as the baseline field set, checking every B item (and every other A item, for internal consistency) against it, per the exact algorithm in `FEATURES.md` F-007. | F-007.3 | `missing-in-b`, `extra-in-b`, `inconsistent-in-a`, and `a-empty-array` findings are all produced under the documented conditions. |
| FR-021 | The system MUST build a path→line-number map per panel from its prettified text, for use by result-row line tags. | F-007.4 | Every path that appears on its own line in the 2-space-indented output resolves to the correct line number. |

### 2.4 Highlighting

| ID | Requirement | Feature(s) | Acceptance criteria |
|---|---|---|---|
| FR-022 | The system MUST provide three independent toggles (Missing / Structure / Differences) controlling highlight overlays in both panels' JSON and Tree views. | F-008 | Each toggle affects only its own category, additively. |
| FR-023 | When more than one active category would highlight the same line/node, the system MUST apply exactly one, using priority order Missing > Structure > Differences. | F-008 | Verified via a fixture where a line qualifies for two categories simultaneously. |
| FR-024 | The system MUST exclude any ignore-path-matched finding from highlighting regardless of toggle state. | F-006, F-008 | An ignored finding is never highlighted under any toggle combination. |
| FR-025 | *(reserved — consolidated into FR-022–FR-024; kept to preserve ID continuity with `FEATURES.md`'s FR-022–FR-025 citation range.)* | F-008 | — |

### 2.5 Results & filtering

| ID | Requirement | Feature(s) | Acceptance criteria |
|---|---|---|---|
| FR-026 | The system MUST show a clickable summary of actionable-finding counts (onlyA, onlyB, changed, structure) plus a separate, non-clickable ignored-total, collapsing to a single "no differences" message when all four actionable counts are zero. | F-009 | Chip counts always match post-ignore-filter row counts; zero-count chips are disabled; clicking a chip scrolls to (and, for the two Missing Fields chips, pre-filters) the relevant section. |
| FR-027 | The Missing Fields section MUST support independent side filters (onlyA/onlyB), a show-ignored toggle, and a free-text path filter, composing with AND semantics. | F-010.1–F-010.3 | All filter combinations behave as specified. |
| FR-028 | The Missing Fields section MUST support dynamically-generated level-1/level-2 path-prefix group filters with bulk All/None actions, shown only when more than one distinct group exists at that level. | F-010.4 | Group filters are regenerated fresh on every Compare; a single-group level is hidden. |
| FR-029 | The Missing Fields section MUST support per-row selection and a filtered-scope "select all" with correct indeterminate tri-state. | F-010.5 | Selection persists across filter changes; select-all reflects only currently visible rows. |
| FR-030 | The Missing Fields section MUST support a per-row status (unreviewed/reviewed/needed/ignore) and free-text note, edited without losing input focus/cursor position. | F-010.6 | Notes persist across filter changes, tab switches, and re-Compare; they are cleared only by Clear (FR-040). |
| FR-031 | Long values in any result table MUST truncate at 70 characters with a show-more/show-less expander. | F-010.7 | A 70-character value does not truncate; 71+ does. |
| FR-032 | Every result row with a resolvable source line MUST show a clickable line tag that scrolls the corresponding panel to that line. | F-010.8 | Clicking always scrolls the correct panel to the correct line. |
| FR-033 | The Structure Schema Compare section MUST support filtering by finding kind (with `inconsistent-in-a` and `a-empty-array` sharing one filter checkbox, per `FEATURES.md` F-011), show-ignored, and free-text path. | F-011 | Filter behavior matches F-011 exactly, including the shared-checkbox quirk unless §15.7 changes it. |
| FR-034 | The Differences section MUST support show-ignored and free-text path filtering. | F-012 | Filter behavior matches F-012. |
| FR-035 | Each of the three result sections MUST be independently collapsible, with Missing Fields open and the other two closed by default after a fresh Compare, and MUST force-open + scroll + briefly flash when jumped to via a summary chip or line tag. | F-013 | Matches `FEATURES.md` F-013's acceptance criteria exactly. |

### 2.6 Export

| ID | Requirement | Feature(s) | Acceptance criteria |
|---|---|---|---|
| FR-036 | The system MUST export all Missing Fields rows as a Markdown report with the exact structure specified in `FEATURES.md` F-014, guarded on having completed a compare. | F-010.11, F-014 | Report structure matches exactly, including conditional sections. |
| FR-037 | The system MUST export only the currently selected Missing Fields rows as a Markdown report, guarded on having completed a compare **and** having a non-empty selection. | F-010.12, F-014 | Both guards produce specific error messages on failure. |
| FR-038 | Every export MUST trigger an automatic file download **and** show an in-page preview with copy-to-clipboard (falling back to manual-select on clipboard failure) and a "download again" action. | F-014 | A blocked clipboard write still leaves the user able to copy the content manually. |

### 2.7 Sample data & reset

| ID | Requirement | Feature(s) | Acceptance criteria |
|---|---|---|---|
| FR-039 | The system MUST provide a "Load sample" action that seeds both panels with a fixed, intentionally key/array-order-shuffled example pair and overwrites Ignore Paths with a matching demo value, with no confirmation prompt. | F-015 | Matches the exact payload/ignore-value specified in `FEATURES.md` F-015. |
| FR-040 | The system MUST provide a "Clear" action that resets both panels and all derived compare state (results, notes, selection, level-group filters) but explicitly does **not** reset the Ignore Paths field, with no confirmation prompt. | F-015 | Ignore Paths retains its value after Clear; every other listed state is reset. |

### 2.8 Miscellaneous

| ID | Requirement | Feature(s) | Acceptance criteria |
|---|---|---|---|
| FR-041 | The system MUST show a scroll-to-top control once the page has scrolled past a fixed threshold. | F-016.1 | Appears/disappears at the documented threshold; smooth-scrolls to top on click. |
| FR-042 | The system MUST theme entirely from OS/browser `prefers-color-scheme`, with no in-app override. | F-016.2 | Verified in both a light- and dark-preference test environment. |
| FR-043 | The system MUST report every validation/guard failure through a single, shared, non-queued status element. | F-016.3 | Two failures in quick succession show only the latest; no message history/stack. |

### 2.9 Future-scope requirements (deferred — not built for v1; see §1.3, §15.12)

These two requirements describe the server-side fetch-proxy **only if and when** the backend layer is adopted (§15.12). They are written now, in full, so the design exists and the architectural seam (`ARCHITECTURE.md` §3.10) is built correctly from day one — but neither is implemented, tested, or part of v1's Definition of Done (§14).

| ID | Requirement | Feature(s) | Acceptance criteria (only applicable once built) |
|---|---|---|---|
| FR-044 | *(Deferred)* If a server-side fetch-proxy is built to replace v1's direct browser `fetch()`, it MUST reject requests targeting loopback, link-local, private, and cloud-metadata IP ranges before making any outbound network call, MUST enforce a request timeout and a response-size cap, and MUST NOT follow redirects into a blocked range. | F-005 (future scope) | A request to `169.254.169.254` (or any blocked range, including via a redirect) is rejected pre-connect, verified with a test that asserts the outbound `fetch` is never invoked for a blocked target. |
| FR-045 | *(Deferred)* If any backend endpoint is built (fetch-proxy and/or, if adopted, persistence endpoints), it MUST return a stable, typed `{error: <code>, message}` envelope — never a raw framework error page — and MUST NOT log request/response bodies or credential header values. | F-005 (future scope) | Verified by a deliberately-triggered server error in each endpoint. |

### 2.10 Optional persistence module (should-have, not v1 baseline — see §15.2)

| ID | Requirement | Feature(s) | Acceptance criteria |
|---|---|---|---|
| FR-046 | IF adopted, authenticated users MAY save a comparison (both panel contents, ignore paths, notes) and retrieve it later via a stable, non-enumerable URL. | (new — no F-ID; extends F-010/F-006) | A saved comparison round-trips byte-for-byte on both panels' text through save → reload. |
| FR-047 | IF adopted, authenticated users MAY save and reuse named Ignore Path presets across comparisons. | (new — extends F-006) | A saved preset's pattern list applies identically to typing it manually. |
| FR-048 | IF adopted, authenticated users MAY view a history of their own past saved comparisons and share one, read-only, with another authenticated user. | (new — extends F-010) | A shared comparison is viewable by the recipient and not independently discoverable by ID guessing. |

---

## 3. Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-001 | Performance | Diffing a typical payload (≤500 KB per side) completes and renders in **< 300ms**; a large payload (up to the 5 MB guard in NFR-003) completes in **< 1.5s** without freezing input panels (diff execution off the main thread — a **new** requirement vs. the artifact's synchronous main-thread diff). |
| NFR-002 | Performance | Initial page load (empty shell) reaches Largest Contentful Paint in **< 2s** on a broadband connection. |
| NFR-003 | Scalability | The app remains usable with either panel containing up to **5 MB** of JSON text; beyond that, a clear "payload too large" guard is shown rather than freezing the tab — a **new** requirement (the artifact has no such guard). |
| NFR-004 | Reliability | A single malformed input, failed fetch, or rendering exception in one panel/section MUST NOT crash the whole page (error boundaries per major section — a **new** requirement). |
| NFR-005 | Maintainability | `packages/diff-engine` (the ported diff/ignore-path/report logic) ships with ≥90% unit-test line coverage; every filter/toggle interaction in `FEATURES.md` has at least one component test. |
| NFR-006 | Accessibility | WCAG 2.2 **AA** conformance for all interactive controls — closing the specific gaps enumerated in §12. |
| NFR-007 | Security | See §11 in full. v1 has no server-side attack surface for the fetch feature — it runs client-side, subject to the browser's own same-origin/CORS policy, the same risk profile the artifact already has today. Output escaping, CSP, and standard security headers (`ARCHITECTURE.md` §12) apply to v1; the SSRF/timeout/size-cap protections (FR-044) and dependency scanning of backend packages apply only once the deferred backend layer (§2.9, §15.12) is built. |
| NFR-008 | Security | *(Applies once a backend exists — §2.9, §15.12)* No `Authorization`/`Cookie`/credential header **value** would ever be logged, traced, or included in an error report — header names only. Not applicable to v1: there is no server to log anything on. |
| NFR-009 | Portability | Fully functional in the last two major versions of Chrome, Firefox, Safari, and Edge. |
| NFR-010 | Observability | v1: client-side exceptions report to an error tracker with non-sensitive context only (never the actual JSON payload content, per §11.4's data-sensitivity note) — there are no server requests to correlate or trace. *(Deferred, §2.9/§15.12)* If the backend layer is built, every backend request is additionally logged with a correlation ID and traced. |
| NFR-011 | Internationalization | Out of scope for v1 — English-only UI copy; no string externalization required. |
| NFR-012 | Developer experience | Full TypeScript `strict` mode, linting, and CI gates (lint, typecheck, unit, component, e2e) block merge on failure. |
| NFR-013 | Data sensitivity | Because real usage will plausibly involve customer-identifying JSON payloads and free-text notes (the artifact's own sample data already models this), server-side logs and error reports MUST NEVER include payload/note content — sizes/shapes only. If the persistence module is adopted, this becomes a data-at-rest classification question (§15.4), not something this document resolves unilaterally. |

---

## 4. User flows

See `FEATURES.md` for the per-feature "User flow" subsection of every feature (F-001 through F-016); the three flows below are the cross-feature journeys that tie multiple features together end to end.

### 4.1 Primary flow — compare two pasted responses
Open app (no login, per §15.1's pending confirmation) → paste/upload/fetch into A and B (F-001/F-003/F-005) → optionally set Ignore Paths (F-006) → click Compare (F-007) → read Summary (F-009), filter/annotate Missing Fields (F-010), review Structure/Differences (F-011/F-012) → export (F-014).

### 4.2 Fetch-via-curl flow
Click "Add" (F-003) → paste a DevTools-copied curl command → parsed client-side (F-004) → executed as a direct browser `fetch()` (F-005, FR-003 — no server involved in v1) → response populates the panel, with the persistent inline curl bar (F-001.7) left available for edit-and-rerun. *(Deferred, §2.9/§15.12: if the backend layer is built, this flow gains a server hop with SSRF/timeout/size-cap checks — FR-044 — between "executed" and "response populates the panel," with no change to the steps before or after.)*

### 4.3 Save & retrieve flow (optional persistence module only — §15.2)
Authenticated user saves a comparison (FR-046) → receives a stable URL → another authenticated user opens it and sees the same panels/ignore-paths/notes, read-only or editable per FR-048's sharing decision.

---

## 5. Data requirements

**Baseline (no persistence):** nothing outlives the browser tab. In-memory shapes are specified in `ARCHITECTURE.md` §3.4 (the Zustand store) and `FEATURES.md`'s per-feature "Data" subsections — not repeated here.

**If the persistence module (§2.10) is adopted:**

| Entity | Key fields | Notes |
|---|---|---|
| `User` | id, email/SSO subject, name | Sourced from whichever auth provider §15.1 settles on. |
| `Comparison` | id, owner_id, title, response_a (text), response_b (text), ignore_paths (text), created_at, updated_at | `response_a`/`response_b` stored as raw text, not `jsonb` — must round-trip the user's exact formatting; may contain customer PII (§NFR-013/§15.4). |
| `Note` | id, comparison_id, field_path, status, text | One row per annotated field path (F-010.6). |
| `IgnorePathPreset` | id, owner_id (nullable = shared/team), name, patterns (text) | FR-047. |
| `AuditLog` (should-have) | id, actor_id, action, entity_type, entity_id, at | Only if §15.4 requires access-audit traceability. |

## 6. API requirements

**v1 baseline: zero server endpoints.** F-005's fetch/curl feature is a direct client-side `fetch()` call (FR-003); there is no `/api/fetch-proxy` and no other server route in v1. This is a deliberate scope decision (§1.3), not an oversight — the app is fully functional and shippable with no backend at all.

**Future scope only (§2.9, §15.12) — if the backend layer is ever built:**

| Method & path | Purpose | Request | Response |
|---|---|---|---|
| `POST /api/fetch-proxy` | Execute a user-supplied curl command/URL server-side instead of client-side (FR-044, FR-045) | `{url, method, headers, body}` (Zod-validated) | `{status, statusText, bodyText, isJson}` or `{error: 'blocked_host'\|'timeout'\|'too_large'\|'network_error', message}` |

**If the persistence module is adopted** (also future scope, §15.2), add (all behind auth):

| Method & path | Purpose |
|---|---|
| `POST /api/comparisons` | Save a comparison (FR-046) |
| `GET /api/comparisons/:id` | Retrieve a saved comparison |
| `PATCH /api/comparisons/:id` | Update notes/ignore-paths on a saved comparison |
| `GET /api/comparisons` | List the current user's saved comparisons (FR-048) |
| `POST /api/presets`, `GET /api/presets` | Create/list ignore-path presets (FR-047) |

Full request/response schemas are an implementation-time artifact (Zod schemas colocated with the route handlers), not fabricated here ahead of the persistence go/no-go decision.

---

## 7. Accessibility (NFR-006 detail)

Target: WCAG 2.2 AA. Known gaps in the artifact that MUST be closed:
- The Add Data modal has no focus trap or `role="dialog"`/`aria-modal` — replace with an accessible dialog primitive (`ARCHITECTURE.md` §3.4).
- The JSON/Tree tab pair is two plain buttons with manual active-state toggling, not a `role="tablist"`/`aria-selected` pattern.
- Color is already not the sole differentiator for diff categories in the artifact (text tags accompany color) — this MUST be preserved, not lost in any visual refresh.
- The gutter/minimap/highlight-pill controls are mouse-only today — MUST gain a keyboard-reachable equivalent (the existing line tags already provide one path; ensure it's in the tab order and discoverable).
- All form controls MUST have properly associated labels — audit for completeness during implementation.

---

## 8. Assumptions and constraints

(Consolidated from §1.6/1.7 — repeated here as the SRS's canonical location for "things this spec relied on without independent confirmation," per the required document outline.)

1. Internal-only tool; not designed for public/anonymous exposure (pending §15.1).
2. No existing design system to adopt instead of a fresh Tailwind/shadcn/ui setup (pending §15.6).
3. No existing internal API/BFF platform this should integrate with instead of its own (currently unbuilt) backend layer (pending §15.10).
4. GitHub/GitHub Actions assumed for CI/CD (pending §15.5).
5. v1 ships with **zero backend** — the fetch feature runs entirely client-side, matching the artifact's request-origin behavior (end-user browser) exactly, so the hosting decision (§15.3) does not gate this feature for v1. It resurfaces only if the deferred backend layer (§15.12) is built and needs to reach an intranet-only target from a server network location.

---

## 9. Security requirements

Covered in full in `ARCHITECTURE.md` §12 (implementation-level) — the requirement-level statements are NFR-007, NFR-008 above, with FR-044/FR-045 as the deferred (§2.9) server-side requirements that apply only if the backend layer is built. No further detail is repeated here to avoid the two documents drifting.

---

## 10. Performance requirements

See NFR-001 through NFR-003.

---

## 11. Additional requirement detail

### 11.1 Error handling
Every user-facing failure (invalid JSON, failed fetch/CORS error, oversized payload, export guard failure) MUST show a specific, actionable message — never a silent no-op (except the one documented, intentional exception: Prettify on an empty panel, F-001) and never a raw stack trace.

### 11.2 Logging/monitoring
v1: see NFR-010/NFR-013 — client-side exceptions report to an error tracker only, with non-sensitive context. *(Deferred, §2.9)* If the backend layer is built, its requests are logged with host/status/duration/correlation-ID only, never body or header values.

### 11.3 Server-side fetch safety detail (FR-044) — deferred, §2.9/§15.12; not built for v1
If and when a server-side fetch-proxy is built, it MUST reject, pre-connect: loopback (`127.0.0.0/8`, `::1`), link-local (`169.254.0.0/16`, `fe80::/10`), private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and cloud metadata addresses (`169.254.169.254`) — unless explicitly allow-listed for a known-safe internal API. Redirects MUST be handled manually and re-validated against the same blocklist before being followed. v1 has no equivalent requirement: the client-side `fetch()` is subject only to the browser's own same-origin policy, exactly as in the artifact.

### 11.4 Data sensitivity
See NFR-013. This is a real, not hypothetical, concern: the artifact's own sample data already models a customer-service scenario (customer name, plan tier, call notes) — production usage will very plausibly involve genuine customer PII in both panel content and free-text notes.

---

## 12. Accessibility

See §7.

---

## 13. Assumptions and constraints

See §8 (kept as a single canonical section; not duplicated here beyond this pointer, to satisfy the requested outline without creating two divergent lists).

---

## 14. Acceptance criteria — Definition of Done for v1

- [ ] Every baseline FR — §2.1 through §2.8, plus FR-010–FR-013 in §2.1a — is implemented and covered by at least one automated test. §2.9's FR-044/FR-045 (deferred backend layer) and §2.10's optional persistence module are excluded from v1's Definition of Done, gated on §15.12 and §15.2 respectively.
- [ ] Every feature and sub-feature in `FEATURES.md` has its acceptance criteria satisfied, including a recorded fix-or-preserve decision for each "⚠ ARTIFACT QUIRK" callout (bare-`*` ignore pattern, compound-path ignore/highlight gap, curl-parser unknown-flag bug, shared structure-finding-kind checkbox).
- [ ] `packages/diff-engine` has ≥90% line coverage and zero DOM/React coupling.
- [ ] `lib/fetch-executor.ts`'s `BrowserFetchExecutor` is unit-tested against a mocked `fetch` for every case in F-005's acceptance criteria. *(Not part of v1's DoD, tracked separately for if/when §15.12 triggers it: the fetch-proxy satisfying FR-044/FR-045 with a passing SSRF-blocklist test suite.)*
- [ ] Automated accessibility audit (axe) passes with zero critical/serious violations on the main screen.
- [ ] CI blocks merge on lint/typecheck/unit/component/e2e failure.
- [ ] Error tracking is verified end-to-end (a deliberately-triggered client-side error appears in the tracker) in a staging environment — no server-side error to verify in v1.
- [ ] Production is reachable over HTTPS with the security headers from §11.3/`ARCHITECTURE.md` §12 present.
- [ ] Every item in §15 has either a documented answer or an explicit "deferred, tracked as ticket X" note before the phase it blocks begins (see `IMPLEMENTATION_PLAN.md` Phase 0).

---

## 15. Open Questions / Unresolved Requirements

This is the single canonical register for everything this specification could not determine from the artifact itself and did not want to invent. `FEATURES.md`, `ARCHITECTURE.md`, and `TECH_STACK.md` each reference this section by number rather than maintaining their own separate lists.

| # | Question | Related feature/requirement | Why clarification is required | Potential implementation impact | Blocking? |
|---|---|---|---|---|---|
| 15.1 | Should this stay a no-login, anyone-with-network-access tool (matching the artifact), or does it need real user accounts? If accounts: is there an existing company SSO/IdP to federate into? | All — determines whether any auth boundary exists at all | The artifact has zero auth concept; nothing in scope implies one is needed, but persistence (15.2) would require it | Determines whether `middleware.ts`/auth is built at all, and which provider (`TECH_STACK.md` §2.12) | **Yes** — blocks Phase 4 (persistence) entirely; does not block Phases 1–3, 5–7 |
| 15.2 | Is saving/sharing comparisons and ignore-path presets (FR-046–FR-048) actually wanted, or is the artifact's fully stateless, per-session model intentional and sufficient? | F-006, F-010, §2.10 | The artifact was deliberately built with zero persistence; nothing indicates this was a limitation vs. a design choice | Determines whether `packages/db`, Drizzle schema, and the four persistence endpoints are built at all | **Yes** — blocks Phase 4 |
| 15.3 | Hosting: a managed platform (e.g. Vercel) vs. company-controlled infrastructure — for v1 this is a general hosting-policy question only (deploy a static-capable frontend somewhere); it becomes **also** about network reachability only if a future backend (§15.12) needs to reach intranet-only APIs, since v1's fetch feature runs in the end user's own browser, not from the hosting platform | F-005 (future scope only, if §15.12 triggers) | v1 needs *some* hosting decision to ship at all, but has no server-side network-reachability constraint driving it; that constraint only exists for the deferred backend | Determines deployment architecture (`ARCHITECTURE.md` §13) for v1; determines whether a future fetch-proxy could even fulfill its use cases, if built | **Yes, but only in the general "must pick somewhere to deploy" sense** — blocks Phase 7; does not block or gate any v1 feature's design, since F-005 stays client-side regardless of which option is chosen |
| 15.4 | If persistence is adopted, what retention, encryption-at-rest, and access-audit requirements apply to potentially customer-identifying JSON payloads and notes? | NFR-013, `Comparison`/`Note` entities | The artifact never had data at rest, so there is no existing policy to inherit; this is genuinely undecided, not discoverable from the artifact | Determines whether field-level encryption, an `AuditLog` table, and a retention job are built | **Yes** — blocks the persistence-module portion of Phase 4 only |
| 15.5 | Confirm GitHub Actions (assumed) vs. an existing internal CI/CD platform | `ARCHITECTURE.md` §14 | Assumed by convention, not stated | Changes only the CI pipeline's runner syntax, not its shape | No — low-cost to swap later, but should be confirmed before Phase 1 to avoid rebuilding pipeline config |
| 15.6 | Confirm there is no existing internal component library/design system this should adopt instead of a fresh Tailwind/shadcn/ui setup | `TECH_STACK.md` §2.4 | None was referenced in the source material provided | Could change the entire component layer if an internal system exists | No — but expensive to redo late; confirm before Phase 3.1 |
| 15.7 | For each "⚠ ARTIFACT QUIRK" in `FEATURES.md` (bare-`*` ignore-everything, the compound-path ignore/highlight-matching gap for reordered+changed array items, the curl-parser's unknown-flag URL-swallowing bug, and the shared checkbox for `inconsistent-in-a`/`a-empty-array`): fix, or preserve for byte-for-byte behavioral parity with the artifact? | F-004, F-006, F-007, F-011 | These are genuine defects/oddities in the artifact's own logic, not ambiguities in the *specification* — but "port faithfully" and "fix obvious bugs" are in tension, and only the product owner can resolve that tension per quirk | Each decision is a one-line implementation choice once made, but the choice itself is a product call, not an engineering one | **Yes**, narrowly — blocks writing the final unit tests for `ignore-paths.ts` and `curl-parser.ts` (Phase 2) until each is resolved, since the "correct" test assertion depends on the answer |
| 15.8 | Should `FEATURES.md` F-015's optional improvement (generic, non-brand-specific sample payload data, mirroring the Ignore Paths help-text change already made in an earlier session) be applied? | F-015 | Purely a polish decision with no functional impact either way | Cosmetic only — changes the seeded sample JSON's field names/values | No |
| 15.9 | Is English-only (NFR-011) acceptable for v1? | NFR-011 | Not stated either way; assumed from the artifact's own English-only copy | Determines whether any string-externalization scaffolding is built now vs. later | No |
| 15.10 | Does an existing internal API/BFF platform already exist that the fetch-proxy (F-005) and/or the optional persistence endpoints (FR-046–FR-048) should live in, instead of this app's own Next.js Route Handlers? | F-005, FR-044–FR-048, `TECH_STACK.md` §2.9 | Not discoverable from the artifact, which has no server side at all today | Could move the fetch-proxy and/or persistence API into a different service/repo entirely, changing `ARCHITECTURE.md` §4's boundary | No — but expensive to redo late; confirm before Phase 2 |
| 15.11 | Where should traces/logs/error reports (Sentry, OpenTelemetry, `pino`) ultimately land — a new Sentry project, or an existing company observability backend (Datadog, Grafana/Tempo, Honeycomb, etc.)? | NFR-010, `TECH_STACK.md` §2.15 | Not discoverable from the artifact, which has no server-side logging at all today | Changes only the export/destination configuration, not the instrumentation code itself | No — confirm before Phase 6 |
| 15.12 | v1 ships with zero backend (§1.3) — the fetch feature (F-005) runs as a direct client-side `fetch()`, subject to standard CORS, exactly like the artifact. What condition would actually justify building the deferred backend layer (server-side fetch-proxy hardening per FR-044/FR-045, and/or the persistence module)? Candidates: a security review flags the client-side fetch as unacceptable for production; a real user need for saved/shared comparisons emerges; a target API the tool must reach only works from a server network location. | F-005, FR-044–FR-048 | Nothing in the artifact or in the request to build this as a client-only app specifies a trigger; building the backend speculatively, with no driving need, would be scope creep this document is explicitly avoiding | Determines whether/when any backend-layer work (`ARCHITECTURE.md` §4, `IMPLEMENTATION_PLAN.md` Future Scope) is ever scheduled at all | No — this is a forward-looking trigger question, not a blocker for v1; the architecture stays ready either way (`ARCHITECTURE.md` §3.10) |
