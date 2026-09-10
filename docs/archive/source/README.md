# JSON Response Comparer — Complete Feature Specification & Standalone Implementation Guide

**Document purpose:** this is the single, self-contained specification for the JSON Response Comparer — currently a single-file HTML/CSS/JS Cowork artifact — written so a coding agent (human or AI) can recreate it as a standalone, production-ready web application **without needing to infer any missing behavior**. Every feature, business rule, edge case, and state the artifact actually implements is documented here from a full line-by-line read of its source, not from its rendered UI alone.

**Non-negotiable rule for anyone implementing from this document:** existing behavior described in Part 1 — including the parts that look like bugs — must be preserved unless a decision explicitly says otherwise (see §9, the Known Quirks register). UI/UX improvements are welcome, but only as described in Part 2, and only when they do not remove, hide, or silently change any behavior in Part 1. Part 3 is the recommended technical approach for building the standalone version; it is a recommendation, not a behavioral requirement — the product **must** match Part 1, but **may** be built with a different stack than Part 3 proposes if the team prefers.

**How this document is organized:**

- **Functionality Checklist.** A complete, scannable, bullet-point list of every feature and behavior — read this first.
- **Part 1 — Functional Requirements & Existing Behavior.** The same features in full depth: exact entry conditions, business logic, states, edge cases, dependencies, and acceptance criteria. This is the normative product specification. Nothing here may be dropped, simplified, or silently changed.
- **Part 2 — Recommended UI/UX Enhancements.** Optional improvements (accessibility, modernization, performance, minor polish) that make the standalone build better without changing what it does. Every item here is explicitly optional and called out as such.
- **Part 3 — Technical Implementation Details.** A recommended architecture, tech stack, folder structure, and build/test/deploy process for the standalone application, plus the phased plan to get there.

This document consolidates and supersedes the working analysis previously split across `SRS.md`, `FEATURES.md`, `ARCHITECTURE.md`, `TECH_STACK.md`, and `IMPLEMENTATION_PLAN.md` in this `docs/` folder. Those documents remain available with additional cross-referenced detail (traceability IDs, mermaid diagrams, full rationale for every technology choice) and are cited throughout this document by their `FR-xxx` / `NFR-xxx` / `F-xxx` IDs so a reader can jump to the deeper source; this README is written to stand on its own without requiring that cross-reference.

Read order: this **Functionality Checklist** first (a complete, scannable list of every feature and behavior), then Part 1's detailed write-up (the same features, in full depth — entry conditions, exact business logic, states, edge cases, acceptance criteria), then Part 2 (optional UI/UX enhancements) and Part 3 (technical/implementation approach).

---

## Functionality Checklist (Read First)

Every bullet below is a real, currently-implemented behavior of the artifact — not a proposal. Each line is short and self-contained; the feature ID in brackets points to Part 1's full write-up (business logic, exact states, dependencies, acceptance criteria) for that behavior. **Nothing below may be removed, hidden, or silently changed** when building the standalone app — see Part 1's own preamble for the handful of items marked "known bug," each of which needs an explicit fix-or-preserve decision rather than a silent choice either way.

### Input panels — Response A / Response B `[F-001]`

- Two independent, always-visible panels (A and B) for typing or pasting JSON; editing one never affects the other, and there's no client-side character limit.
- "Prettify" re-indents valid JSON (`JSON.stringify(_, null, 2)`); on invalid JSON it shows the exact parser error and panel name and leaves the text untouched; on an **empty** panel it silently does nothing (no error).
- A synced line-number gutter renumbers on every keystroke/resize and correctly numbers long, soft-wrapped lines as a single line.
- A minimap strip shows a proportional marker for every currently highlighted line across the whole document; clicking a marker scrolls that line to center.
- Colored gutter bars mark every highlighted line at its scroll position; clicking one scrolls that line into the top third of the panel.
- "N more above/below" pills appear only when highlighted lines are scrolled out of view in that direction; clicking jumps to the nearest one.
- In-panel Find: case-insensitive substring search with a live match counter (`i/N`), Enter = next match, Shift+Enter = previous, Escape closes the bar; zero matches shows `0/0` and tints the input; the find input never loses keyboard focus while typing.
- A JSON/Tree tab pair per panel; switching tabs never loses the underlying text, and switching to Tree always re-parses fresh.
- "Add" opens the Add Data Modal, pre-targeted at that panel.
- Once any fetch has populated a panel, a persistent, editable inline curl bar appears under it; Ctrl/Cmd+Enter re-runs it; its × button hides it without clearing the panel's content.
- Below roughly 800px viewport width, the two panels stack vertically instead of side by side (the app's only responsive breakpoint).
- No payload-size guard exists today — a very large paste can slow the panel (flagged as a **recommended new addition** for the standalone build, not present in the artifact).

### JSON Tree View `[F-002]`

- Per-panel toggle to view the current content as a collapsible, indented tree instead of raw text.
- Every node is expanded by default; each node's expand/collapse state is independent of every other node.
- Objects render as `{ N field(s) }`, arrays as `[ N item(s) ]`; empty `{}`/`[]` render inline with no expand control.
- Leaf values (string/number/boolean/null) are color-coded by type, using the same colors as the diff-highlight system.
- The tree re-parses the panel's raw text on every keystroke while the Tree tab is active, and on every switch into Tree.
- Empty input shows "Nothing to show yet — paste or load JSON on the JSON tab first."; invalid JSON shows the exact `JSON.parse` error instead of a tree.
- Once a compare has run, matching nodes get the same highlight coloring as the raw JSON view's lines.
- A proportional, clickable navigation-dot strip appears on the tree's edge only when at least one highlight exists.
- The same scroll-aware "N more above/below" pills as the JSON view, scoped to tree nodes.
- A subtle vertical guide line runs down the left edge of every nested node/subtree, purely visual, to keep a large or deeply-nested tree easy to trace level-by-level.

### Add Data Modal `[F-003]`

- One shared modal (not two separate ones) opened by either panel's "Add" button; its title always names the correct target panel ("Add data to Response A/B").
- Two sections inside the one dialog: a file-upload leg and a curl/URL-fetch leg.
- Closes via the × button, a click on the dimmed backdrop, or the Escape key.
- File leg: pick a file → read as text → on success, replaces the target panel's content and closes the modal; on a read error, shows the specific error and stays open.
- Fetch leg: a multi-line text field; "Go" or Ctrl/Cmd+Enter submits; submitting empty input shows "Enter a URL or a curl command first." with no network call attempted.
- "Go" is disabled for the duration of any in-flight request, preventing duplicate submissions from a fast double-click.
- A successful fetch auto-closes the modal and leaves that panel's inline curl bar visible and pre-filled; a failed fetch (including a non-2xx response, handled per the Fetch Execution rules below) keeps the modal open with the specific error/status shown.
- Re-opening the modal for the other panel always retargets correctly with no leftover state from the previous open.

### Curl command parsing `[F-004]`

- Turns a pasted curl command, or a bare URL, into `{url, method, headers, body}` — a pure, synchronous parse with zero network access.
- A bare URL (no leading `curl`) parses to a GET request with no headers or body.
- Recognized flags: `-X`/`--request` (method), `-H`/`--header` (one header per flag, split on the first `:`), `-d`/`--data`/`--data-raw`/`--data-binary`/`--data-ascii` (body text, joined with `&` if the flag repeats), `-u`/`--user` (Basic-auth header, base64 of the value exactly as typed — a missing `:` is **not** inserted), `-A`/`--user-agent`, `-b`/`--cookie`.
- No-op flags consumed with no argument: `--compressed`, `-s`/`--silent`, `-k`/`--insecure`, `-L`/`--location`, `-v`/`--verbose`.
- Method defaults to POST if a body was parsed, otherwise GET, unless `-X` explicitly overrides it.
- Single- and double-quoted arguments are tokenized shell-style; double-quoted strings support `\"` escaping, single-quoted strings support no escaping at all.
- The first token that isn't a flag becomes the URL, but only if no URL has been captured yet.
- **Known bug (needs a fix-or-preserve decision):** an unrecognized flag's value is never skipped, so it can be mistaken for the URL on the very next token — silently discarding the command's real URL (e.g. `curl --foo bar https://example.com` currently parses `url: "bar"`).

### Fetch execution `[F-005]`

- Executes the parsed request as a direct browser `fetch(url, {method, headers, body})` — entirely client-side, no server-side proxy.
- The body is only actually attached to the request when the method is **not** GET or HEAD, even if a body was parsed from the curl input.
- JSON-ness of the response is detected by attempting `JSON.parse` on the body text, never by trusting the `Content-Type` header; a JSON body is pretty-printed into the panel, anything else is inserted raw.
- A non-2xx HTTP response still loads its body into the panel — the response is never discarded, only its status is communicated differently.
- Exact status-line messages: "Fetching into Response A/B..." (in flight); "Fetched `<status>` `<statusText>` into Response A/B." (2xx); "Server responded `<status>` `<statusText>` — body loaded into Response A/B anyway." (non-2xx); "Fetch failed: `<message>`. This is usually a CORS restriction — the API needs to allow requests from this page's origin." (thrown/network/CORS error).
- No timeout, redirect handling, or response-size cap beyond the browser's own `fetch()` defaults — a cross-origin target without permissive CORS headers fails, by accepted design (not a bug to fix in v1).

### Ignore Paths `[F-006]`

- A single comma-separated pattern field, always editable, independent of whether a compare has run.
- An exact-path pattern matches that path and every path nested beneath it (no `.*` suffix needed).
- A `*` segment matches exactly one path segment at that position (e.g. `items.*.internalId`).
- A pattern ending in `.*` matches its prefix and everything beneath it at any depth.
- Every keystroke live-filters Missing Fields, Structure Schema Compare, Differences, the Summary counts, and all highlighting — no re-compare is ever required.
- **Known bug (needs a fix-or-preserve decision):** a pattern that is just `*` alone matches every path in the document, silently hiding the entire comparison.
- **Known bug (needs a fix-or-preserve decision):** a finding whose array item was both reordered *and* changed carries a compound path (`tags[0] / tags[2]`) that an otherwise-matching ignore pattern can fail to match.
- "Clear" leaves this field untouched; "Load Sample" overwrites it with a matching demo value — this asymmetry is intentional, not a bug.

### Compare engine `[F-007]`

- "Compare" first validates both panels are non-empty and independently valid JSON; on failure the whole compare aborts with a specific error and no partial result, and any previous results are left exactly as they were.
- Both panels are re-pretty-printed in place as a side effect of a successful compare.
- **Missing Fields:** object comparison is key-order-independent; array items are paired across A/B by canonical (recursively sorted) value, not by index — reordering identical items produces zero findings.
- **Differences:** any field present on both sides whose `JSON.stringify` output differs, including an array-vs-object type mismatch reported at that same path.
- **Structure Schema Compare:** presence-only, never value/type; Response A's first array item (`A[0]`) is always the baseline every item on both sides is checked against; also flags an A item that itself diverges from `A[0]`, and the special case of an empty A array paired with a non-empty B array.
- Builds a path→line-number map per panel from the freshly prettified text, powering every clickable "Ln N" tag.
- Row selection resets on every successful compare; per-row notes and Ignore Paths do **not** reset; level-1/level-2 group filters are rebuilt fresh every time, discarding prior group selections.
- A bare JSON primitive (e.g. a string) at the root of either document is valid input.

### Highlighting system `[F-008]`

- Three independent toggle checkboxes — Missing Fields, Structure Schema Compare, Differences — each affecting both panels' JSON and Tree views at once.
- Missing Fields renders in one of two colors depending on which panel is being viewed, both still controlled by the single "Missing Fields" checkbox: red in Response A for a field present in A but missing from B, green in Response B for a field present in B but missing from A. The legend next to the checkbox shows both colors and spells out which is which.
- When a line/node qualifies for more than one active category, exactly one color wins, in this fixed order: Missing Fields > Structure Schema Compare > Differences.
- A finding matched by an active Ignore Path rule is never highlighted, under any toggle combination.
- Toggling never requires a re-compare and never changes the result tables' own filters.
- Toggle state is never reset by Compare, Clear, or Load Sample.

### Results summary `[F-009]`

- A row of chips appears once a compare has run: `-N in A, not in B`, `+N in B, not in A`, `~N changed`, `◆N structure`, plus a non-clickable `N ignored` chip shown only when at least one row is ignored.
- Every chip's count is the count *after* ignore-path filtering, so it always matches what's actually visible in its table.
- A zero-count chip renders disabled and ignores clicks.
- If all four actionable counts are zero, the whole row collapses to a single "No differences found — responses match on all fields." message.
- Clicking `-N in A, not in B` or `+N in B, not in A` both scrolls to Missing Fields **and** sets its side filter to match; clicking `~N changed` or `◆N structure` only scrolls.

### Missing Fields section `[F-010]`

- Table columns: row-select checkbox, Field Path (+ side tag, + ignored tag when applicable), Response A value, Response B value, Notes (status dropdown + free-text field).
- Two independent side filters ("present in A, missing from B" / "present in B, missing from A"), both on by default.
- "Show ignored" reveals ignore-matched rows (tagged, dimmed) instead of hiding them.
- A free-text filter does a case-insensitive substring match against the field path.
- Level-1/level-2 path-prefix group filters, regenerated fresh on every compare, shown only when more than one distinct group exists at that level, each with "All"/"None" bulk-select buttons.
- All active filters combine with AND semantics.
- Per-row checkboxes plus a header "select all *currently visible* rows" checkbox with a correct indeterminate state; a selection survives being filtered out and back in, but resets on the next compare.
- A per-row status dropdown (Not reviewed / Reviewed / Needed / Can ignore) plus a free-text note; typing a note never loses input focus or cursor position.
- Notes and status persist across filters, tab switches, and re-compare — cleared only by "Clear."
- Long values truncate at exactly 70 characters with a "show more"/"show less" toggle (a 70-character value does not truncate; 71 does).
- A clickable "Ln N" tag next to a value jumps the correct panel to that exact source line, shown only when the path actually resolves to one.
- A "Showing X of Y fields · Z selected" counter always matches the current filters and selection exactly.
- A count note appears specifically when rows are hidden by Ignore Paths (not other filters), with correct singular/plural phrasing.
- "Export Missing Fields (.md)" exports **every** row regardless of the table's current display filters — guarded on having compared ("Run a comparison first." if not).
- "Export Selected (.md)" exports only the checked rows — guarded on having compared **and** a non-empty selection ("No fields selected — check the boxes next to the fields you want to export, then click this again." if empty).
- A row's note status/text is completely independent of whether that row happens to be currently ignored.

### Structure Schema Compare section `[F-011]`

- Closed by default after a compare; table columns: Field Path, Issue tag, Detail.
- Filter checkboxes per finding kind, plus show-ignored and a free-text path filter — same interaction pattern as Missing Fields, minus selection/notes/export.
- **Known quirk (needs a fix-or-preserve decision):** the "Inconsistent within A" checkbox controls two distinct finding kinds together (an A item diverging from `A[0]`, and an empty-A-vs-non-empty-B case).
- `missing-in-b`/`extra-in-b` rows show fixed, generic detail text; only the "inconsistent" rows show a dynamic, finding-specific detail string.

### Differences section `[F-012]`

- Closed by default after a compare; table columns: Field Path, Response A value, Response B value.
- Show-ignored toggle and free-text path filter, matching the other two sections' behavior.
- Same 70-character truncation and clickable line-tag behavior as Missing Fields.

### Collapsible result sections `[F-013]`

- Each of the three result sections expands/collapses independently by clicking its own header.
- Missing Fields opens by default after every fresh compare; the other two start closed.
- A Summary-chip click or a line-tag click force-opens its target section even if it was manually closed, scrolls it into view, and plays a brief border-flash animation — every time, including on repeated clicks.

### Markdown export `[F-014]`

- Two export actions: "Export Missing Fields (.md)" (every row) and "Export Selected (.md)" (checked rows only).
- Each export both auto-downloads a file (`missing-fields-report.md` or `missing-fields-selected-report.md`) **and** opens an in-page, read-only preview titled "Export preview — `<filename>`," scrolled into view.
- Exact report structure, top to bottom: a title heading; "Generated by JSON Response Comparer."; a Comparison Summary (Source A and Local B's Total Missing/Ignored/Requires Review counts, an Overall Status roll-up, and a one-line prose summary sentence); the literal Ignore Path patterns configured (or "None configured."); one block per actionable (non-ignored) field — path, Presence, Classification (Ignore Path/Status/Actionable/Requires Review), and a Reason/Action pair, each block separated by a `---` rule; and, only if at least one row was ignored, an identically-formatted "Ignored Paths" section.
- The Status line in each field's block uses one of four labels, mapped 1:1 from that row's note status: 🟡 Not Reviewed, 🟢 Reviewed, 🔴 Needs Action, 🟢 Expected Difference.
- Preview controls: Copy (shows "Copied to clipboard." on success; on a blocked clipboard it auto-selects the text and shows "Clipboard access was blocked — text is selected, press Ctrl/Cmd+C to copy." instead of failing silently), Download again (re-downloads the exact content captured at export time — it does not regenerate the report from any later edits), and Close.
- Exporting before any compare has run shows "Run a comparison first." and generates nothing; exporting a selection with nothing checked shows "No fields selected..." and generates nothing.
- If every Missing Field happens to be ignored, the Actionable section shows a specific "no actionable fields" message instead of the generic empty state.

### Sample data / reset `[F-015]`

- "Load Sample" fills both panels with a fixed demo payload pair (deliberately shuffled key/array order between A and B) and overwrites Ignore Paths with a matching demo pattern — it does **not** auto-run Compare, but since both panels are now populated with valid JSON, Aligned JSON Comparison (F-017) fires immediately and re-orders the display text.
- "Clear" empties both panels and every derived compare state (results, notes, selection, level-group filters, status line) — but explicitly leaves Ignore Paths untouched.
- Neither action asks for confirmation before discarding existing work.

### Miscellaneous UI `[F-016]`

- A floating scroll-to-top button appears once the page has scrolled past 300px, and smooth-scrolls to the top on click.
- One single shared status/error text element is reused for every validation/guard message in the app (Compare, Prettify, Export) — a new message always replaces whatever was showing, with no history or stacking.
- Theme (light/dark) is now a separate, dedicated feature — see Theme Toggle `[F-018]` below.

### Aligned JSON Comparison `[F-017]`

- When both panels independently hold valid, non-empty JSON, their **display text** is automatically re-ordered so that object keys shared between a matching A/B pair appear in the same sequence in both panels — Response A's own key order is always the baseline.
- Only object **keys** are reordered; array **element order is never touched**, at any depth — this guarantees alignment can only ever change how the JSON reads on screen, never which fields/values the diff engine considers a match.
- Fires automatically right after: Compare, a paste into either panel, a completed file upload, a completed fetch, and Load Sample — every case where a panel just went from "not both populated" to "both populated and valid" in one discrete step.
- Does **not** fire on ordinary keystroke-by-keystroke typing, so it never fights active manual editing.
- If either panel is empty or not valid JSON at the moment of one of the triggers above, alignment silently does nothing — no new error message is introduced by this feature; Compare's own validation/error messages are unchanged.
- Comparison results (Missing Fields, Differences, Structure Schema Compare, and every count derived from them) are computed from the original, unaligned parsed values and are provably identical whether alignment ran or not — object-key order and array order are already meaningless to the diff engine (see F-007).
- The per-side "Prettify" button (F-001.4) is unaffected — it remains a single-panel action and never triggers cross-panel alignment.

### Theme Toggle — Light / Dark Mode `[F-018]`

- A visible toggle button in the header switches the entire app between Light Mode and Dark Mode.
- With no explicit choice made yet, the app follows the OS/browser's `prefers-color-scheme` setting, exactly as before this feature existed.
- Clicking the toggle sets an explicit override that persists across reloads (stored in the browser's local storage) and takes precedence over the OS setting until cleared.
- The toggle's icon and label always reflect the theme that is *actually* in effect right now — the OS-followed theme when no override is set, or the explicit override once one is set.
- Every section, highlight color, difference-state color, editor, button, and text element remains readable and correctly themed in both modes — the entire color system was already built on CSS custom properties, so no visual surface was missed.
- If local storage is unavailable or throws (private browsing, storage disabled), the toggle still works for the rest of the session — it just won't be remembered on the next reload.

---

# PART 1 — Functional Requirements & Existing Behavior

Everything in this Part describes the artifact **exactly as it behaves today**. Anything marked **⚠ QUIRK** is a real, verified behavior found by reading the artifact's actual logic (not assumed from the UI) that looks unintended or inconsistent — each is flagged for an explicit fix-or-preserve decision (tracked in §9) rather than silently "corrected" during a rewrite.

## 1. Purpose, Scope, and Expected Behavior

### 1.1 What this tool is

A single-page, entirely client-side web application that lets an engineer paste, upload, or fetch two JSON payloads ("Response A" and "Response B") and see, in detail:

- which fields exist in one response but not the other ("Missing Fields"),
- which fields exist in both but have different values ("Differences"), and
- whether the two responses have the same overall *shape*, independent of value differences ("Structure Schema Compare").

The tool also lets the user annotate findings, filter them down, ignore expected/known differences by path pattern, visually locate every finding inside the original JSON (raw text or a collapsible tree), and export a Markdown report of the missing-fields findings.

### 1.2 What it is not

- It is not a general-purpose JSON diff/merge tool for arbitrary numbers of documents (exactly two documents, A and B, always).
- It has no backend, no accounts, no persistence, and no multi-user collaboration in the baseline (v1) scope.
- It does not validate JSON against a schema (JSON Schema, OpenAPI, etc.) — only against itself, structurally, using Response A as the implicit baseline for its Structure Schema Compare feature.

### 1.3 Expected behavior, at a glance

1. The app loads instantly with two empty input panels, a toolbar (Compare / Load Sample / Clear), an Ignore Paths field, three highlight toggles, and no results area (nothing has been compared yet).
2. The user gets JSON into both panels by typing, pasting, uploading a file, or fetching from a URL/curl command.
3. Clicking **Compare** validates, diffs, and renders three result sections (Missing Fields, Structure Schema Compare, Differences) plus a summary chip row — all while re-pretty-printing both panels in place.
4. The user filters, annotates, and reviews results; toggles let them see exactly where each finding lives in the original JSON (raw or tree view, with a minimap and gutter markers).
5. The user optionally sets Ignore Path patterns at any point, which live-filters everything (tables, highlights, summary counts) without needing to re-run Compare.
6. The user exports a Markdown report (all Missing Fields, or only the ones they've selected) for pasting into a PR, ticket, or chat message.

### 1.4 Target users

1. **Frontend/backend engineers** debugging API contract drift between environments or app versions.
2. **QA engineers** verifying a response payload against an expected baseline during regression testing.
3. **Support/ops-adjacent technical staff** comparing two customer-facing API responses to diagnose a reported discrepancy.

All three are internal, technical users — this is an internal engineering tool, not a customer-facing product. There is no user-role concept: anyone who can open the app can do everything (see §12.3).

### 1.5 In scope vs. out of scope

**In scope (v1 baseline, fully specified below):** everything in the Complete Feature List (§2), implemented as a **fully client-side application with zero required backend** — the fetch/curl feature runs as a direct browser `fetch()`, exactly like the artifact does today, not through a server-side proxy.

**Explicitly out of scope for v1** (each is a genuine, deliberate deferral, not an oversight):
- A server-side fetch proxy, or any backend/API/database layer at all (a clean extension seam is designed for this — see Part 3 §22 — but nothing is built).
- User accounts, authentication, or roles.
- Persistence of any kind (saved/shared comparisons, saved ignore-path presets) — the artifact is, and v1 remains, entirely stateless across page loads.
- Multi-tenant accounts/billing.
- Mobile native apps.
- Real-time multi-user collaborative editing of the same comparison.
- Bulk/batch comparison of more than two documents at once.
- Internationalization (English-only UI copy).

---

## 2. Complete Feature List

| ID | Name | One-line summary |
|---|---|---|
| F-001 | Dual JSON Input Panels | Two independent panels (A, B) for typing, pasting, uploading, or fetching JSON, with find, prettify, a line gutter, a minimap, and diff-highlight overlays. |
| F-002 | JSON Tree View | A collapsible, type-styled tree rendering of either panel's current content, sharing the same diff highlights as the raw view. |
| F-003 | Add Data Modal | One modal per panel, reachable via "Add," offering a file-upload leg and a curl/URL-fetch leg. |
| F-004 | Curl Command Parsing | A pure, synchronous, client-side parser that turns a pasted curl command or bare URL into `{url, method, headers, body}`. |
| F-005 | Fetch Execution | Executes the parsed request as a direct browser `fetch()` and loads the response into the target panel. |
| F-006 | Ignore Paths | A comma-separated pattern list (exact / `*` wildcard / `.*` subtree) that live-filters every result view and all highlighting. |
| F-007 | Compare Engine | The core diff: Missing Fields, value-level Differences, and a Structure Schema Compare, all order-independent for objects/arrays. |
| F-008 | Highlighting System | Renders the three finding categories as color-coded overlays in both panels' JSON and Tree views, with a fixed priority order. |
| F-009 | Results Summary | Clickable chip row showing actionable counts per category plus a separate ignored-count, collapsing to a single message when nothing differs. |
| F-010 | Missing Fields Section | The primary triage table: filters, level-group filters, row selection, per-row status/notes, value truncation, line-jump tags, and export. |
| F-011 | Structure Schema Compare Section | Displays structural findings (missing/extra/inconsistent fields) relative to Response A's baseline shape. |
| F-012 | Differences Section | Displays value-level differences for fields present on both sides. |
| F-013 | Collapsible Result Sections | Each of the three result sections can be independently expanded/collapsed, with force-open-and-scroll-and-flash on jump. |
| F-014 | Markdown Export | Exports Missing Fields (all, or only selected) as a structured Markdown report, with an automatic download and an in-page preview/copy panel. |
| F-015 | Sample Data / Reset | "Load Sample" seeds a fixed demo payload pair; "Clear" wipes all input/derived state except Ignore Paths. |
| F-016 | Miscellaneous UI | Scroll-to-top button and a single shared status/error message element. |
| F-017 | Aligned JSON Comparison | Automatically reorders each panel's display text (object keys only, Response A as baseline) so shared fields line up visually — never changes comparison results. |
| F-018 | Theme Toggle — Light / Dark Mode | An explicit, persisted Light/Dark override on top of the existing OS-preference-driven theming, with every color surface remaining readable in both modes. |

Each feature is documented in full in §4, using this template for every top-level feature: **Purpose**, **Entry conditions**, **User flow**, **UI behavior**, **Data**, **Business logic & validation**, **Application states**, **Edge cases**, **Dependencies**, **Acceptance criteria** — followed by a compact table of its sub-features where applicable.

---

## 3. Cross-Feature User Flows

These three flows tie multiple features together end-to-end; each individual feature's own step-by-step flow is documented in its own section in §4.

### 3.1 Primary flow — compare two responses

Open app (no login) → paste/upload/fetch into Panel A and Panel B (F-001/F-003/F-005) → once both panels hold valid JSON, their display text is automatically key-aligned (F-017) → optionally set Ignore Paths (F-006) → click Compare (F-007) → read the Summary chip row (F-009) → filter/annotate Missing Fields (F-010) → review Structure Schema Compare and Differences (F-011/F-012) → export a Markdown report (F-014).

### 3.2 Fetch-via-curl flow

Click "Add" on either panel (F-003) → paste a browser-DevTools "Copy as cURL" command → parsed client-side, synchronously, with no network access (F-004) → executed as a direct browser `fetch()` (F-005) → response status and body populate the panel → the persistent inline curl bar (F-001.7) stays visible for editing and re-running the same request later.

### 3.3 Ignore-and-annotate flow

After a compare, the user notices a field they know is expected to differ (e.g., a timestamp or a per-partner theme color) → types a pattern into Ignore Paths (F-006) → every result table, the summary counts, and every highlight update immediately, with **no** re-compare required → for fields that still need attention, the user sets a per-row status (Not Reviewed / Reviewed / Needed / Can Ignore) and writes a free-text note (F-010.6) → exports either the full Missing Fields report or just the rows they've selected (F-014).

---

## 4. Detailed Feature Specifications

### F-001 — Dual JSON Input Panels

**Purpose:** Let the user get two JSON payloads into the tool by whatever means is convenient — typing, pasting, uploading a file, or fetching live from an API — and read/edit them comfortably, including large, deeply-nested documents.

**Entry conditions:** App loaded; no data or prior compare required. Each panel (A, B) is independent and always available.

**User flow:**
1. Click/focus into the Response A or B text area → paste or type JSON. Nothing is processed until Prettify or Compare is triggered — raw text is held as-is. The panel's gutter line count recalculates on every input; if the Tree tab is active for that panel, the tree re-parses on every keystroke (see F-002).
2. Alternative entry: click "Add" → Add Data Modal (F-003) → file upload or curl/URL fetch (F-005) → panel populated.
3. Click "Prettify" → text is re-indented via `JSON.parse` then `JSON.stringify(parsed, null, 2)` if valid, else an inline error names the parse failure.

**UI behavior:** Two side-by-side panels (stacked on narrow viewports, see §12.7), each with a label, "Find," "Prettify," and "Add" buttons in the header; a JSON/Tree tab pair; the editor itself; and, once a fetch has run at least once, a persistent inline curl bar. The editor has a synced line-number gutter that scrolls with the text and renumbers on every input/resize. The gutter/editor also carries the diff-highlight overlay described in F-008 once a compare has run.

**Data:** Input is raw text, unconstrained, not required to be valid JSON until Compare/Prettify is invoked. Derived output (on successful Prettify/Compare) is the parsed JSON value and a per-panel line→path map (F-007.4) used by result-row line tags. Nothing persists beyond the current browser session/tab in the baseline scope.

**Business logic & validation:**
- Prettify: `JSON.parse` then `JSON.stringify(_, null, 2)`.
- **⚠ QUIRK:** Prettify on an empty panel is a silent no-op — the code checks `if (!raw) return null` before showing any status message, so nothing visibly happens at all. This must be preserved deliberately, not "fixed" into an error message, unless a product decision (§9) says otherwise.
- Compare (F-007) also re-prettifies both panels **in place** as a side effect — the visible text in each panel changes to the pretty-printed form even though the user's original formatting is otherwise irrelevant to the diff itself. This is a real, visible, user-facing behavior, not an implementation detail, and must be preserved for parity.

**Application states:**

| State | Trigger | UI |
|---|---|---|
| Empty | Initial load / after Clear | Placeholder text shown (e.g. `{"status":"ok","data":{"amount":100}}`-style example) |
| Populated, unvalidated | User has typed/pasted/uploaded/fetched text | Gutter shows line numbers; no parse attempted yet |
| Valid, prettified | Prettify or Compare succeeded | Text reformatted; no error shown |
| Invalid | Prettify or Compare attempted on unparsable text | Inline error naming the panel and the `JSON.parse` error message; text is left untouched (not partially reformatted) |

**Edge cases:**
- No client-side size guard exists today — a genuinely huge paste can degrade textarea/gutter responsiveness (Part 2/Part 3 propose a new 5 MB guard for the standalone build — not present in the artifact today).
- Pasting non-JSON text is allowed with no immediate validation — it only surfaces as an error when Prettify/Compare is clicked.
- **⚠ QUIRK:** if only one of A/B is empty when Compare is clicked, the error message ("Paste both responses before comparing.") does not say *which* panel is empty.

**Dependencies:** F-002 (Tree tab shares the same underlying raw text), F-003/F-005 (alternative population routes), F-007 (Compare consumes and mutates panel text), F-008 (highlight overlay renders into this component).

**Acceptance criteria:**
- Typing/pasting into either panel updates that panel only, immediately, with no perceptible lag for payloads under 1 MB.
- Prettify on valid JSON reformats to 2-space-indented `JSON.stringify` output; on invalid JSON it shows the specific parser error and panel name, and does not alter the panel's text.
- Prettify on an empty panel does nothing at all (no error, no state change).
- Gutter line numbers always match the visible text exactly, including after paste, upload, fetch, prettify, and manual edits.

**Sub-features:**

| ID | Name | Behavior | Edge cases | Acceptance criteria |
|---|---|---|---|---|
| F-001.1 | Direct paste/type | Freeform text entry; no character limit enforced client-side today. | Extremely long single lines (no newlines) still render correctly if soft-wrap is supported (F-001.8). | Text entered appears exactly as typed/pasted, with no transformation until Prettify/Compare. |
| F-001.2 | File upload | Via Add Data Modal (F-003.1): `FileReader.readAsText`, `.json`/`.txt`/`text/plain` accept hint (not enforced). | Binary file upload renders garbled text with no explicit error; an empty file yields an empty panel. | Selecting a valid `.json` file replaces the target panel's content exactly with the file's text content. |
| F-001.3 | Curl/URL fetch into panel | Via Add Data Modal (F-003.2) or the persistent inline curl bar (F-001.7) — see F-004/F-005. | See F-005's edge cases (client-side, CORS-limited both in the artifact and in v1 — no server proxy in v1). | Successful fetch replaces panel content with the pretty-printed (if JSON) or raw (otherwise) response body, and shows the HTTP status. |
| F-001.4 | Prettify | Re-indents valid JSON in place; see the empty-input no-op quirk above. | See parent Edge Cases. | See parent Acceptance Criteria. |
| F-001.5 | In-panel Find | Case-insensitive substring search within the panel's raw text; next/prev navigation; match count display (`i/N`); Enter = next, Shift+Enter = previous, Escape = close. The find input keeps keyboard focus while typing (never steals focus back to the textarea mid-keystroke). | Zero matches shows `0/0` and tints the input red; the search term persists per-panel while the bar is open. | Typing a search term highlights/selects the first match and scrolls it into view; Next/Prev cycle through all matches including wraparound. |
| F-001.6 | JSON/Tree tab switch | Toggles which of the two views is visible for that panel; switching to Tree re-parses the current raw text fresh, every time. | Switching to Tree on invalid JSON shows a tree-panel error state (F-002), not a silent blank. | The correct view is visible after each click; the hidden view's controls (e.g. its Find bar) are hidden, not just visually covered. |
| F-001.7 | Persistent inline curl bar | Appears only after a fetch has populated the panel (from either the modal or this bar itself); pre-filled with the curl/URL text used; editable; Ctrl/Cmd+Enter re-runs it; a close (×) button hides it (does not clear the panel's content). | Editing the curl text without pressing Go/Ctrl+Enter has no effect — plain Enter is reserved for multi-line editing, since real curl commands often span lines. | Editing and re-running the curl bar re-fetches and replaces the panel's content, and updates the status line with the new result. |
| F-001.8 | Line-number gutter (soft-wrap aware) | Measures each logical line's rendered visual-row height (via a hidden mirror element matching the textarea's font metrics and wrap width) so a long, wrapped line still gets exactly one gutter number, with blank continuation rows beneath it. Recomputes on input, window resize, and textarea resize (`ResizeObserver`). | A whitespace-only line still gets a gutter number (a non-breaking space is used during measurement to avoid collapsing to zero height). | Gutter numbers stay correctly aligned with their text row at any zoom level, panel width, or after a wrapped line's wrap state changes. |
| F-001.9 | Minimap overview | A slim, fixed-height strip to the right of the editor showing proportionally-positioned markers for every currently-highlighted line across the *entire* document, not just the visible viewport; clicking a marker scrolls that line to view-center. | With zero highlights (no compare run, or all categories toggled off), the strip renders empty. | Every highlighted line in F-008 has a corresponding, correctly-positioned, clickable marker regardless of scroll position. |
| F-001.10 | Gutter diff indicators | Small colored bars on the gutter's right edge, one per highlighted line, scroll-synced with the gutter itself (unlike the minimap, which is scroll-independent); clicking scrolls that line into the top third of the viewport. | Two indicators for adjacent lines render distinctly (not merged) down to a 3px minimum height. | Clicking a gutter indicator scrolls the corresponding line into view within the same panel. |
| F-001.11 | Scroll-aware "N more above/below" pills | Floating pills at the top/bottom of the editor (and, separately, of the Tree view) reporting how many highlighted lines/nodes are currently scrolled out of view in that direction, with small category-colored dots; clicking jumps to the nearest one in that direction. Recomputed on scroll, on highlight-toggle change, and after every Compare. | With all highlights currently on-screen, neither pill is shown. | Scrolling away from a highlighted line makes the correct pill appear with an accurate count and category dots; clicking it jumps to the next off-screen highlight in that direction, not an arbitrary one. |

---

### F-002 — JSON Tree View

**Purpose:** Raw indented JSON is hard to scan for structure in a deeply nested payload; a collapsible tree lets the user explore shape without losing their place, and shows the same diff highlighting as the raw JSON view.

**Entry conditions:** A panel has non-empty text and its Tree tab is selected (F-001.6).

**User flow:** Click the "Tree" tab for a panel → the current raw text is parsed fresh → success renders a fully-expanded, collapsible node tree (every node defaults `open`) → clicking a node's disclosure triangle collapses/expands that subtree independently of siblings → if a compare has run and a highlight category is on, matching nodes are visually flagged (F-008) and a navigation strip appears.

**UI behavior:** Objects render as `{ N field(s) }` with an expandable list of `key: value` children; arrays as `[ N item(s) ]` similarly; empty objects/arrays render inline as `{}`/`[]` with no expander. Leaf values are type-styled (string/number/boolean/null get distinct, theme-aware colors, matching the same category colors used for JSON highlighting so the tool reads as one visual system). A vertical navigation strip (proportional dot markers) appears on the right edge of the tree container only when there's at least one highlight to show. A subtle, theme-aware vertical guide line runs down the left edge of every nested node/subtree (purely visual — no effect on layout, spacing, or behavior) so a deep or large tree stays easy to trace level-by-level (F-002.7).

**Data:** Input is the panel's current raw text, re-parsed on every keystroke while the Tree tab is active (not cached) and on every tab switch to Tree. No separate data model exists beyond the parsed JSON value plus the highlight map from F-008.

**Business logic & validation:**
- Empty raw text → "Nothing to show yet — paste or load JSON on the JSON tab first."
- Invalid JSON → shows the specific `JSON.parse` error message inline, styled as an error, instead of a tree.
- Every node and leaf carries a canonical dot/bracket path (e.g. `config.partner.id`, `tags[0]`) used both for highlighting lookups and for matching the same path notation the diff engine and ignore-path matcher use elsewhere.

**Application states:** Empty (no input) · Error (invalid JSON) · Rendered (valid JSON, all nodes default-expanded) · Highlighted (rendered plus one or more highlight categories active).

**Edge cases:**
- Re-parsing on every keystroke (rather than only on tab-activation) means typing while the Tree tab happens to be active re-renders the whole tree per character — a real performance consideration for large documents (flagged in Part 2 as something the standalone build should debounce/defer, not silently changed here).
- A tree with thousands of nodes has no virtualization in the artifact — acceptable for typical payloads, a stated risk for very large ones.

**Dependencies:** F-001 (shares raw text with the JSON tab), F-008 (highlight categories drive node styling and the nav strip).

**Acceptance criteria:**
- Switching to the Tree tab on valid JSON renders a fully expanded, accurate structural mirror of the parsed value.
- Collapsing a node hides only its descendants, not siblings.
- Invalid JSON shows the parser's exact error message, not a generic failure.
- Highlighted nodes visually match the same categories/colors as the JSON view's line highlights for the same path.

**Sub-features:**

| ID | Name | Behavior | Edge cases | Acceptance criteria |
|---|---|---|---|---|
| F-002.1 | Recursive expand/collapse | Native disclosure-widget semantics per node, independent state per node. | Deeply nested (10+ levels) structures still render and collapse correctly. | Expand/collapse state is per-node and doesn't reset on an unrelated re-render (e.g. a sibling's highlight toggling). |
| F-002.2 | Type-aware leaf styling | string/number/boolean/null each get a distinct, theme-aware color. | `NaN`/`Infinity` never occur (not valid JSON) — no special case needed. | Each leaf type is visually distinguishable at a glance, consistent between light/dark themes. |
| F-002.3 | Empty object/array display | Renders `{}`/`[]` inline, no expander shown. | An array containing only empty objects (`[{}, {}]`) still shows a real expander (it has 2 items) even though each item is itself an empty-object leaf. | `{}` and `[]` never show a (non-functional) disclosure triangle. |
| F-002.4 | Tree node highlighting | Adds category-colored background/outline to the node matching a highlighted path. | A node whose *path* matches a highlight but whose *displayed* key differs due to array reindexing may fail to highlight — inherits the same underlying path-matching limitation as F-007's compound-path quirk. | Every leaf/branch whose exact path appears in the current highlight map is visually flagged. |
| F-002.5 | Tree navigation strip | Proportional clickable dots on the tree's right edge; click scrolls the node to center. | The strip is absent (not just empty) when there are zero highlights. | Clicking a nav-strip dot scrolls the corresponding node into the vertical center of the tree viewport. |
| F-002.6 | Tree scroll indicators | Same "N more above/below" pill pattern as F-001.11, scoped to the Tree view. | Only rendered while the Tree tab is the active view. | Matches F-001.11's acceptance criteria, scoped to tree nodes instead of gutter lines. |
| F-002.7 | Nesting indent guides | A 1px, theme-aware border on the left edge of every nested node/subtree wrapper, spanning that subtree's full rendered height — a purely visual addition with no change to margins, spacing, or click targets. | On a very deep structure, many guide lines can appear close together; this is an accepted, intentionally subtle look, not a defect. | Every nested node/subtree shows a continuous guide line down its own left edge, correctly colored for the active theme, with no change to existing spacing or layout. |

---

### F-003 — Add Data Modal

**Purpose:** A single, consistent entry point for "get data into this panel," regardless of source (local file vs. live API), rather than separate, disconnected controls.

**Entry conditions:** User clicks the "Add" button on either panel's header.

**User flow:**
1. Click "Add" on Response A or B → modal opens, titled "Add data to Response A/B"; the target panel is remembered for the lifetime the modal is open.
2. User either (a) picks a local file, or (b) pastes a curl command/URL into the modal's fetch field and clicks "Go" (or Ctrl/Cmd+Enter).
3. On file selection: content loads immediately and the modal closes.
4. On fetch: the modal shows an in-progress status; on success it closes automatically and leaves the persistent inline curl bar (F-001.7) visible in the target panel; on failure the modal stays open showing the error so the user can correct and retry.

**UI behavior:** A backdrop-dimmed, centered dialog; closes via the × button, clicking the backdrop, or Escape; two clearly divided sections ("Upload a file" / "or" / "Paste a curl command or URL") inside one modal rather than two separate modals.

**Data:** Ephemeral — file contents or the fetch response are written directly into the target panel's state; the modal itself holds no persistent data.

**Business logic & validation:** No file-type validation beyond the `accept` attribute hint (browser-enforced only, never app-enforced). No URL validation before submit — the request is simply attempted client-side (F-005), and a rejection (non-2xx response, network error, or CORS failure) surfaces through the modal's existing error messaging.

**Application states:** Closed · Open (idle) · Open (fetch in progress, Go button disabled) · Open (fetch failed, error shown, retry available) · Closed (success).

**Edge cases:**
- Opening the modal for panel A, then closing without action, then opening for panel B correctly retargets — the "currently targeted panel" state must never leak between the two.
- Rapid double-clicking "Go" is safe: the artifact disables the Go button for the duration of the in-flight request, preventing duplicate submissions.

**Dependencies:** F-001 (writes into a panel), F-004 (parses the modal's curl input), F-005 (executes it).

**Acceptance criteria:**
- The modal always opens targeting the panel whose "Add" button was clicked, shown correctly in its title.
- Escape, backdrop click, and the × button all close the modal without side effects when idle.
- A successful file upload or fetch closes the modal and updates the correct panel; a failed fetch keeps the modal open with a specific error message.

**Sub-features:**

| ID | Name | Behavior | Acceptance criteria |
|---|---|---|---|
| F-003.1 | File upload leg | `<input type="file">` + `FileReader.readAsText`; on load, writes to the target panel, refreshes gutter/tree, shows a success status, closes the modal. | Selecting a file always either populates the panel and closes the modal, or shows a specific read error and stays open. |
| F-003.2 | Curl/URL fetch leg | Multi-line textarea input; "Go" and Ctrl/Cmd+Enter both submit. Submitting an empty field shows "Enter a URL or a curl command first." without attempting a request. | Submitting valid input always results in either a populated panel + closed modal, or a specific, visible error with the modal still open. |

---

### F-004 — Curl Command Parsing

**Purpose:** Engineers routinely copy "Copy as cURL" from browser DevTools when debugging an API call; pasting that directly, instead of manually re-extracting the URL/headers/method, is the actual workflow this feature optimizes for.

**Entry conditions:** Any text has been entered into a curl/URL input (modal or inline bar) and submission (Go / Ctrl+Enter) is triggered. Parsing itself is a pure, client-side, synchronous function — no network access.

**User flow:** User pastes text → `parseCurlCommand(input)` runs synchronously → returns `{url, method, headers, body}` or `null` (empty input) → the result is consumed by F-005's execution step.

**UI behavior:** None directly — this is a pure parsing step with no UI of its own; its output/failure surfaces through F-003/F-005's status messaging.

**Data:** Input is the raw pasted string. Output is `{ url: string, method: 'GET'|'POST'|..., headers: Record<string,string>, body: string|null }`, or `null` for empty input.

**Business logic & validation (exact rules):**
- If the trimmed input doesn't start with `curl` (case-insensitive), it's treated as a bare URL: `{url: trimmed, method: 'GET', headers: {}, body: null}`.
- Otherwise, the parser tokenizes shell-style, respecting single/double-quoted strings, with backslash-escaped double quotes supported *inside double-quoted strings only* — single-quoted strings support no escaping at all (a real, current limitation; see Edge Cases).
- Recognized flags: `-X`/`--request` (method), `-H`/`--header` (adds one header, split on first `:`), `-d`/`--data`/`--data-raw`/`--data-binary`/`--data-ascii` (appends to body, joining multiple with `&`), `-u`/`--user` (sets `Authorization: Basic <base64(value-as-given)>` — does **not** insert a missing `:` if the value isn't already `user:pass`), `-A`/`--user-agent` (sets `User-Agent`), `-b`/`--cookie` (sets `Cookie`).
- No-op flags consumed with no argument: `--compressed`, `-s`/`--silent`, `-k`/`--insecure`, `-L`/`--location`, `-v`/`--verbose`.
- Method defaults to `POST` if a body was set, else `GET`, unless explicitly overridden by `-X`.
- The first non-flag token is taken as the URL, but only if a URL hasn't already been set (`!url` guard).

**Application states:** Not applicable — pure function; success is a valid parse result, and "failure" is an empty-input `null`, which the caller turns into a status message.

**Edge cases (found by reading the tokenizer/flag-loop logic, not just observing the UI):**
- **⚠ QUIRK — real bug:** the code comment above the "unknown flag" branch says the parser should "skip it, and skip its value if it looks like one wasn't already consumed" — but the actual code for an unrecognized flag (any token starting with `-`) does **nothing**, including not skipping that flag's value token. If that value token doesn't itself start with `-`, the *next* loop iteration's "if no URL yet, treat this token as the URL" branch incorrectly captures it — silently discarding the real URL that appears later in the command. Example: `curl --foo bar https://example.com` parses to `url = "bar"`, not `https://example.com`. This is a genuine parsing defect, not a hypothetical.
- Single-quoted strings support no escaping (`'it\'s'` inside a single-quoted argument terminates the string early at the unescaped `'`), while double-quoted strings do support `\"` — an intentional-looking asymmetry worth preserving as-is unless product direction says otherwise.
- `-u user` with no colon produces `Authorization: Basic <base64("user")>`, which is not a valid Basic-auth value per RFC 7617 (which requires `user:password`) — preserved as-is; a known limitation, not silently "corrected."

**Dependencies:** Consumed by F-003.2 and F-001.7; feeds F-005.

**Acceptance criteria:**
- A bare URL (no `curl` prefix) parses to a GET request with no headers/body.
- Method, headers, body, Basic auth, User-Agent, and Cookie all parse correctly from a realistic "Copy as cURL" command (verify against a real DevTools-copied example as a test fixture).
- The unknown-flag URL-swallowing bug above is either fixed (with a regression test proving `curl --foo bar https://example.com` now resolves to `https://example.com`) or explicitly, deliberately preserved — this must be a recorded decision (§9), not an accident either way.

---

### F-005 — Fetch Execution

**Purpose:** Actually perform the parsed request and get its response body into the target panel. **The standalone v1 build keeps this entirely client-side, matching the artifact's own model exactly — no server-side proxy is built for v1.** A server-side proxy remains a fully designed future option behind a swappable interface (Part 3 §22) but is not part of what ships now.

**Entry conditions:** F-004 has produced a non-null result with a non-empty `url`.

**User flow (identical in the artifact and in the v1 standalone build):**
1. The browser calls `fetch(url, {method, headers, body})` directly from the page.
2. The response text is read; if it parses as JSON, it's pretty-printed into the target panel; otherwise the raw text is inserted as-is.
3. The status line shows one of: `Fetched <status> <statusText> into Response A/B.` (success) · `Server responded <status> <statusText> — body loaded into Response A/B anyway.` (non-2xx, but the body is still shown) · `Fetch failed: <message>. This is usually a CORS restriction...` (a thrown exception, typically CORS).

**UI behavior:** Status text appears in the modal (if fetched from there) or the inline curl bar's own status line (if re-run from there); the Go button is disabled for the duration of the request either way.

**Data:** Request is method/headers/body from F-004. Response is the HTTP status/statusText/body text, read directly from the browser's `Response` object.

**Business logic & validation:**
- A non-2xx HTTP response is **not** treated as a failure for the purpose of populating the panel — the body is shown regardless, with the status communicated separately. This is deliberate and useful (seeing a 4xx/5xx error body is often exactly what the user is debugging) and must be preserved.
- JSON-ness is detected by attempting `JSON.parse` on the response text, not by trusting the `Content-Type` response header — a response that says `text/plain` but is valid JSON is still pretty-printed.
- The parsed body is only actually attached to the outgoing request when the method is **not** `GET` or `HEAD` — even if F-004 parsed a body from `-d`/`--data`, a `GET`/`HEAD` request is sent without one (matching standard HTTP semantics, and the artifact's own `executeFetchInto` logic exactly).

**Application states:** Idle · In-flight (Go disabled, "Fetching into Response A/B..." shown) · Success (2xx or non-2xx, body loaded either way) · Network/CORS failure (the same client-side limitation the artifact has today — a target without permissive CORS headers fails, and the UI says so explicitly).

**Edge cases:**
- **v1 accepts the artifact's own CORS limitation as-is, by decision, not by oversight.** A target API without permissive CORS headers cannot be reached from the browser in v1 — exactly as in the artifact today.
- Because v1 has no server-side proxy, there is no server-side redirect-handling, size-cap, or timeout requirement for this feature — the browser's own `fetch()` defaults apply, identical to the artifact's current behavior.
- Extremely large response bodies are bounded only by browser memory, matching the artifact exactly — no new cap is introduced in v1.

**Dependencies:** F-004 (provides the parsed request), F-003/F-001.7 (UI entry points).

**Acceptance criteria:**
- A successful fetch of a JSON-returning endpoint pretty-prints the body into the target panel and shows the HTTP status.
- A successful fetch of a non-JSON-returning endpoint inserts the raw text body, not an error.
- A non-2xx response still loads its body into the panel while clearly communicating the non-success status.
- A cross-origin target without permissive CORS headers fails with the existing "usually a CORS restriction" message — this is an accepted v1 limitation, not a bug to chase.

---

### F-006 — Ignore Paths

**Purpose:** Real API responses often contain fields that are expected to differ (timestamps, request IDs, per-partner theming values) — the user needs to say "don't tell me about these" once, and have it apply everywhere in the tool consistently and immediately.

**Entry conditions:** Any time; independent of whether a compare has run yet (patterns are stored/edited regardless, but only visibly affect anything once results exist).

**User flow:**
1. User types a comma-separated pattern list into the Ignore Paths field.
2. On every keystroke, if a compare has already run, the app re-filters Missing Fields, Structure Schema Compare, and Differences, and re-renders both panels' highlight overlays and tree highlights — **without** re-running Compare itself.

**UI behavior:** A single field with inline help text and a placeholder showing example patterns (e.g. `user.password`, `items.*.internalId`, `metadata.*`).

**Data:** A single raw string, split on commas and trimmed into a pattern list; no further structure in the baseline scope.

**Business logic & validation (exact matching rules):**
1. A pattern with no wildcard matches that exact path **and** every path nested beneath it (no `.*` suffix needed) — e.g. `user.password` matches `user.password` and `user.password.hash`.
2. A `*` segment matches exactly one path segment at that position — e.g. `items.*.internalId`.
3. A pattern ending in `.*` matches that prefix and everything beneath it at any depth — functionally sugar for rule 1, since rule 1 already covers "and everything beneath."
4. Matching is checked against the *exact string* of a finding's `path` field (see Edge Cases for where this string isn't always what a naive reader would expect).

**Application states:** No patterns entered (nothing filtered) · Patterns entered, no compare run yet (stored, inert) · Patterns entered, compare run, live filtering active.

**Edge cases:**
- **⚠ QUIRK — real, testable, surprising behavior:** a pattern consisting of exactly `*` (just the wildcard, no other segments) matches **every** path in the document — because the trailing-`*`-stripping rule reduces it to zero pattern segments, and an empty pattern-segment list vacuously matches any path via an "every segment matches" check on an empty array. Typing `*` alone silently ignores the entire comparison. This needs an explicit product decision (§9): is "ignore literally everything" useful/intended, should it require confirmation, or should a bare `*` be rejected as invalid input?
- **⚠ QUIRK:** for a "changed" finding whose array item was both reindexed *and* changed in value, the diff engine stores a compound display path like `tags[0] / tags[2]` in that finding's `path` field (see F-007). The ignore-path matcher tokenizes that entire compound string as one path, producing nonsensical segments — so an ignore pattern that should logically match (e.g. `tags[0]`) **will not** reliably match this specific finding. This is a real, narrow gap in correctness, not a standalone-build regression.
- Clearing the field does not require re-running Compare — previously-hidden findings reappear immediately.
- **⚠ QUIRK, intentional-looking, must be preserved:** the "Clear" action (F-015) does **not** reset the Ignore Paths field — only "Load Sample" overwrites it (with its own demo value). A rebuild that "helpfully" clears Ignore Paths on Clear would be a real behavior regression, not an improvement, unless a product decision explicitly changes this.

**Dependencies:** F-007 (findings this filters), F-008 (highlighting this suppresses), F-010/F-011/F-012 (the three result sections, each independently filtered), F-014 (export report's "Ignored Paths" section).

**Acceptance criteria:**
- An exact-match pattern hides that field and everything nested under it, everywhere (results tables, highlights, export) simultaneously.
- A `*`-wildcard pattern matches only at the specific segment position specified, not at any depth.
- A `.*`-suffixed pattern matches its prefix and every depth beneath it.
- Editing Ignore Paths after a compare has run updates all filtered views and highlights live, without requiring another click of Compare.
- The bare-`*` and compound-path matching quirks above have an explicit, recorded product decision (fix or preserve) before implementation — not a silent choice made during coding.

---

### F-007 — Compare Engine

**Purpose:** The actual value proposition of the tool — take two JSON documents and tell the user precisely what's missing, what changed, and (separately) whether the two documents even have the same *shape*, regardless of key/array ordering noise.

**Entry conditions:** Both panels contain text; user clicks "Compare."

**User flow:**
1. User clicks Compare.
2. System validates both panels are non-empty (F-007.6) → if not, shows a status error and stops.
3. System parses both panels → if either fails to parse, shows the specific panel + parse error and stops (neither panel is compared, even if the *other* one is valid) — nothing has been written back to either panel yet at this point.
4. System computes the Aligned JSON Comparison (F-017) display text from the two parsed values and writes it into both panels (re-indented via `JSON.stringify(_, null, 2)` as part of the same step) — this is the same re-pretty-printing side effect the artifact always had on Compare, now also key-aligned.
5. System builds a line-number map for each now-aligned, prettified panel (F-007.4).
6. System runs the Missing Fields diff, the Differences diff, and the Structure Schema Compare over the two **original, unaligned** parsed values from step 3 (see Business logic below for why this is safe).
7. System resets row selection (`selectedMissingPaths`) but **not** notes — see Edge Cases.
8. System rebuilds the level-1/level-2 group filters (F-010.4) fresh, discarding any prior group-filter selections.
9. Results render (F-009 through F-013); highlights render (F-008).

**UI behavior:** No dedicated UI beyond the Compare button and the resulting sections — this feature's "UI" *is* F-009 through F-013.

**Data:** Input is two parsed JSON values (any valid JSON type at the root — object, array, or primitive). Output is `missing: MissingField[]`, `changed: ChangedField[]`, `structure: StructureFinding[]`, plus two line-number maps (one per panel).

**Business logic (exact semantics — the single highest-value logic in the whole app; port precisely, never "improve" or re-derive from scratch):**
- **Missing Fields:** object comparison is key-set-based and inherently order-independent. Array comparison canonicalizes each item (a string form where object keys and array elements are recursively sorted) and pairs items across A/B by matching canonical form — **not by index** — so a reordered array with identical items produces zero missing/changed findings. Items that can't be paired become "missing" (if one side has strictly more unmatched items) or "changed" (if both sides have an unmatched item left over at the same position in their respective unmatched lists — see the compound-path edge case below).
- **Differences:** for fields present on both sides, a value is "changed" if `JSON.stringify(a) !== JSON.stringify(b)` (for non-object/array leaves), or if the two sides disagree on being an array vs. a plain object at the same path (reported at that path as a whole-value change, not descended into further).
- **Structure Schema Compare:** presence-only — never inspects value or type. Response A is always the baseline. For arrays, **every** item on both sides is checked against `A[0]`'s field set specifically — not "the array's own average shape," not each B item against its position-matched A item. This baseline choice is a deliberate simplification worth calling out explicitly, since a naive re-implementation might reach for "compare A[i] to B[i]" instead. Also flags internal inconsistency *within* A itself (an A item whose fields differ from `A[0]`) and the specific edge case of an empty A array paired with a non-empty B array (reported once, at the array's own path, since there's no baseline to check individual B items against).
- **Pre-compare validation:** both panels must be non-empty and independently valid JSON; the whole Compare aborts (no partial result) if either fails.
- **Aligned display (F-017) is safe by construction:** the three diff algorithms above are already, independently, insensitive to object key order (key-set/`Set`-based comparison) and to array element order (canonical-value pairing, not index pairing) — this is exactly what makes it safe to run them against the *original, unaligned* parsed values while showing the user *aligned* text. Alignment reorders object keys only (Response A's order as baseline) and never reorders array elements, so even if a future maintainer ran the diff against the aligned copies instead, the results would be provably identical — but running against the original values is the implemented, zero-risk choice.

**Validation:** the "Pre-compare validation" rule above is the entirety of Compare's input validation — there is no further schema/shape requirement (comparing a bare JSON primitive, e.g. the string `"ok"` against `"ok"`, is valid input and produces "no differences").

**Application states:** Not yet compared (`hasCompared = false`, results area hidden) · Comparing (synchronous in the artifact today) · Compared, results shown · Blocked (validation failure, no results shown; a prior successful compare's results remain exactly as they were — **not** cleared by a failed re-compare attempt).

**Edge cases:**
- **⚠ QUIRK — the same compound-path issue flagged under F-006:** when an array item is both reordered *and* changed in value between A and B, the resulting "changed" finding's `path` is a compound string (`tags[0] / tags[2]`) rather than a single clean path. This affects: the Differences table's Field Path display (arguably fine/informative there), ignore-path matching against that finding (broken, see F-006), and highlighting — the line-highlight lookup uses `aPath`/`bPath` separately for gutter/tree highlighting, which *are* clean single paths, so highlighting itself is unaffected; only ignore-matching and the raw `path` field are affected. This nuance — some consumers use the compound `path`, others use the clean `aPath`/`bPath` — must be preserved exactly as-is, since accidentally unifying them would change which findings can be ignored.
- A root-level type mismatch (A is an object, B is an array, or vice versa) is reported as a single "changed" finding at path `(root)`, not descended into.
- Comparing two primitives at the root is valid and simply reports a "changed" finding at `(root)` if they differ, or no findings if they match.
- Structure Schema Compare produces **zero** findings for an array with 0 or 1 items on the A side beyond the "empty baseline, non-empty B" case — the "inconsistent within A" check specifically requires more than one A item.
- Level-1/level-2 group filters (F-010.4) are rebuilt from scratch on every Compare, discarding the user's prior group-filter selections — while Notes and Ignore Paths are **not** reset by Compare. This asymmetry (some state survives re-compare, some doesn't) is a real, specific behavior to preserve, not an oversight to "fix" by making everything consistently persist or consistently reset.

**Dependencies:** F-001 (source panels), F-017 (the display-alignment step run as part of Compare), F-006 (ignore-path filtering happens downstream of this, not inside it — Compare itself is unaware of ignore rules), F-008 through F-013 (everything downstream of this feature's output).

**Acceptance criteria:**
- Comparing two documents with identical content but different key order and different array element order for equal item sets produces zero Missing Fields and zero Differences.
- A field present only in A (or only in B) appears exactly once in Missing Fields, tagged with the correct side.
- A field present in both with a different value appears exactly once in Differences, with both raw values shown.
- Structure Schema Compare correctly identifies fields missing/extra relative to `A[0]` across every item in B's array, and correctly flags an A item whose own fields diverge from `A[0]`.
- An invalid-JSON panel blocks the entire Compare with a specific error naming the panel and parse failure; any *previous* successful compare's results remain visible and unchanged.
- Row selection resets on every successful Compare; Notes and Ignore Paths do not.
- Running Compare against a documented sample pair, then independently running the same three diff algorithms against the *original, pre-alignment* JSON, must produce identical missing/changed/structure counts and identical path lists — this is the regression test that guards F-017 against ever silently changing a comparison result.

**Sub-features:**

| ID | Name | Behavior |
|---|---|---|
| F-007.1 | Missing Fields diff | See Business logic above. |
| F-007.2 | Differences diff | See Business logic above. |
| F-007.3 | Structure Schema Compare | See Business logic above. |
| F-007.4 | Line-map building | Parses the now-aligned, prettified `JSON.stringify(_, null, 2)` text line-by-line via a small stack-based parser (not a general JSON parser) to recover a path→line-number map per panel, used only for the result tables' clickable line tags. |
| F-007.5 | Auto-prettify + auto-align on compare | Both panels are reformatted to `JSON.stringify(_, null, 2)` as a side effect of clicking Compare, using the key-aligned copies produced by F-017 rather than independent per-panel prettification. |
| F-007.6 | Pre-compare validation | Both panels non-empty and independently parseable — see Business logic. |

---

### F-008 — Highlighting System

**Purpose:** Once Compare has identified findings, the user needs to *see where they are* in the original JSON/Tree, not just read them in a separate table — this closes the loop between "what differs" and "where, in context."

**Entry conditions:** A compare has run and at least one of the three highlight toggles is on. (The toggles are always visible and interactive regardless of compare state, but have no visible effect until there's a result to highlight.)

**User flow:** User checks/unchecks one of "Missing Fields" / "Structure Schema Compare" / "Differences" → both panels' JSON views and Tree views recompute their highlight sets and re-render the overlay (line bands, gutter indicators, minimap markers, tree node classes, tree nav strip, scroll pills) for both panels simultaneously.

**UI behavior:** Three checkboxes with colored legend dots, directly above the Ignore Paths field, with explanatory copy pointing at the minimap strip. The Missing Fields checkbox's legend shows two dots (red, green) with copy naming which color means which direction, since that one category now renders in two colors (see below).

**Data:** No new data — this feature is purely a *rendering* pass over the already-computed findings plus the per-panel line maps and the current ignore patterns.

**Business logic & validation:**
- **Priority order when multiple categories would highlight the same line:** Missing Fields > Structure Schema Compare > Differences — a line is painted with whichever of these, in this order, is both checked and applicable; it is never painted with more than one category at once. This priority order is unchanged by the color split below — it still operates on three categories, not four.
- **Direction-aware Missing Fields color:** within the Missing Fields category, the color shown depends only on which panel is being rendered, never on any new per-finding data — a finding only ever has a line/node in Panel A when it is "present in A, missing from B" (shown red), and only ever has one in Panel B when it is "present in B, missing from A" (shown green); a single finding is therefore never shown in both colors, because it never has a line in both panels simultaneously. Structure Schema Compare and Differences are unaffected and keep their single existing colors (purple, amber).
- A finding whose path matches an active ignore rule is excluded from highlighting **regardless of toggle state** — ignore rules are a hard filter applied before highlight computation runs, not a separate, overridable layer.
- Tree-view highlighting matches on exact path string against each rendered node's data path — inherits the same compound-path limitation noted in F-006/F-007 for the narrow "reordered + changed array item" case.

**Application states:** All toggles off (no highlight overlay, checkboxes still interactive) · One or more toggles on, no compare run yet (no visible effect) · One or more toggles on, compare run (overlay active).

**Edge cases:**
- Toggling a highlight category does not require re-running Compare and has no effect on the result tables' own filters — these are two independent filtering/display systems that happen to share the same underlying ignore-path exclusion rule.
- Toggle checked-state itself is never reset by Compare, Clear, or Load Sample — it's pure UI preference that persists for the duration of the session.

**Dependencies:** F-006 (exclusion), F-007 (source data + line maps), F-001.8–F-001.11 (JSON-view rendering surfaces), F-002.4–F-002.6 (Tree-view rendering surfaces).

**Acceptance criteria:**
- Each of the three toggles independently controls only its own category's highlights, additively (multiple can be on at once).
- A line/node matching more than one active category is painted with exactly one color, following the documented priority order.
- With the Missing Fields toggle on, every highlighted line/node in Response A's view is red and every highlighted line/node in Response B's view is green — never the reverse, and never both colors in the same panel.
- An ignored-path finding is never highlighted, in any toggle combination.
- Turning all toggles off removes every highlight from both panels' JSON and Tree views without altering the underlying result tables.

---

### F-009 — Results Summary

**Purpose:** A single-glance answer to "are these the same?" before diving into three separate detailed tables, with one-click navigation into whichever category has something interesting.

**Entry conditions:** A compare has run.

**User flow:** Compare completes → summary chips render immediately above the three result sections → user clicks a non-empty chip → the relevant section's filters are pre-set (for the two Missing Fields chips specifically) and the page scrolls to that section, which briefly flashes its border.

**UI behavior:** A horizontal row of pill-shaped chips: `-N in A, not in B` (red), `+N in B, not in A` (green), `~N changed` (amber), `◆N structure` (purple), and, only if non-zero, `N ignored` (neutral, non-clickable). Chips with a zero count render disabled (non-interactive, visually muted) rather than being hidden.

**Data:** Purely derived — counts recomputed from the findings, filtered through the current ignore patterns, so the summary always reflects *actionable* counts, with the ignored total shown separately and never double-counted into the other four.

**Business logic & validation:**
- If literally every count (onlyA, onlyB, changed, structure) is zero, the summary collapses to a single "No differences found — responses match on all fields." message (plus the ignored-count chip if applicable) instead of showing four zero-value chips.
- Clicking the "-N in A, not in B" chip sets the Missing Fields section's filters to show only the "onlyA" side (and hides "onlyB"); clicking "+N in B, not in A" does the mirror opposite. Clicking "~N changed" or "◆N structure" only scrolls/flashes — it does not alter those sections' own filters.

**Application states:** No compare run (summary not rendered at all) · All-zero (single "no differences" message) · Mixed (chip row, some enabled, some disabled per count).

**Edge cases:** The ignored-count chip is never clickable/interactive — it's informational only, unlike the four actionable chips.

**Dependencies:** F-006 (ignored total), F-007 (source counts), F-010/F-011/F-012 (scroll-and-filter targets), F-013 (the flash/scroll mechanism operates on these sections' collapsible wrappers).

**Acceptance criteria:**
- Chip counts always match the actual number of rows visible in each corresponding table *after* ignore-path filtering (not before).
- A zero-count chip is visibly disabled and does not respond to clicks.
- Clicking "-N in A, not in B" or "+N in B, not in A" both scrolls to Missing Fields *and* sets its side filters accordingly; clicking the other two chips only scrolls.
- The all-zero state shows the single summary message, not four disabled chips.

---

### F-010 — Missing Fields Section

**Purpose:** The primary triage surface — for every field present on only one side, let the user filter down to what matters, mark rows as reviewed/needed/ignorable with a note, and select a subset to export.

**Entry conditions:** A compare has run; the section is open by default (F-013).

**User flow:**
1. The section renders all non-ignored (unless "Show ignored" is checked) Missing Fields rows matching the current side/text/level-group filters.
2. The user can: toggle side filters, toggle "show ignored," type a path filter, toggle level-1/level-2 group checkboxes, check individual rows (or "select all," scoped to currently *visible* rows only), pick a status per row, type a free-text note per row, expand a long value's "show more," click a line tag to jump to source, or export (all rows, or selection-only).

**UI behavior:** A filter row (checkboxes + text input + two export buttons) → optional level-1/level-2 group-filter rows (only shown when more than one distinct group exists at that level) → a "Showing X of Y fields · Z selected" counter line → the table itself, with columns: select-checkbox, Field Path (+ side tag + ignored tag if applicable), Response A value, Response B value, Notes (status dropdown + text input).

**Data:** Row shape is `{path, aPath, bPath, a, b, side}`, joined at render time with the current note (`{status, text}`, default `unreviewed`/empty) and the current selection state for that path. Persistence: none in the baseline scope — notes and selection live only in memory for the session (notes survive re-Compare; selection resets on re-Compare; both are wiped on Clear).

**Business logic & validation:**
- "Select all" is scoped to the *currently filtered/visible* rows — checking it while a text filter is narrowing the list does not silently select hidden rows; its checkbox shows an indeterminate state when some-but-not-all visible rows are selected.
- Level-1/level-2 filter rows are generated fresh from the *current* result set every Compare and only rendered if there's more than one distinct group at that level.
- Note edits (status change, text typing) are applied without a full table re-render per keystroke — this is a real UX guarantee, not just an implementation detail: it exists specifically so that typing a note doesn't lose input focus or cursor position, which a naive "re-render everything on every keystroke" implementation would break. This must be preserved functionally in the standalone build.

**Validation:** No required fields — notes are entirely optional free text, with no character limit or format constraint.

**Application states:** No rows (either zero Missing Fields overall, or all filtered out — two distinct empty-state messages, see §10) · Rows present, unfiltered · Rows present, filtered (with the ignored-hidden-count note shown if applicable) · Rows present, with a selection · Export triggered without having compared yet ("Run a comparison first.") · Export Selected triggered with an empty selection ("No fields selected...").

**Edge cases:**
- A row's Notes status and text are independent of that row's ignored-state — a row can be individually marked "Needed" even while it's also excluded by an Ignore Path rule (it just won't be visible unless "Show ignored" is also checked).
- Very long values truncate to 70 characters with a "show more"/"show less" inline expander rather than breaking the table's layout — this threshold (`VALUE_PREVIEW_LIMIT = 70`) is a specific, documented constant, not an approximation.

**Dependencies:** F-006 (ignore filtering), F-007.1 (source rows), F-007.4 (line tags), F-009 (summary chip cross-filtering), F-014 (export consumes this section's rows/notes/selection).

**Acceptance criteria:**
- All documented filter combinations (side × ignored-visibility × text × level-1 × level-2) compose correctly (AND semantics across all active filters).
- Selection persists across filter changes (a row selected, then hidden by a new filter, then re-shown by removing that filter, is still selected) but resets on every new Compare.
- A note's status and text persist across filter changes, tab switches, and re-Compare (but not across Clear).
- Editing a note's text never causes the input to lose focus or cursor position mid-keystroke.
- The "select all" checkbox accurately reflects checked/unchecked/indeterminate relative to only the currently visible rows.

**Sub-features:**

| ID | Name | Behavior | Acceptance criteria |
|---|---|---|---|
| F-010.1 | Side filters | "Present in A, missing from B" / "Present in B, missing from A" independent checkboxes, both default checked. | Unchecking one hides only that side's rows. |
| F-010.2 | Show ignored toggle | Reveals ignore-matched rows (visually tagged "ignored," row dimmed) instead of hiding them entirely. | Toggling shows/hides exactly the ignore-matched rows, with an accurate hidden-count note when off. |
| F-010.3 | Free-text path filter | Case-insensitive substring match against the field path. | Filtering by a partial path segment correctly narrows the table. |
| F-010.4 | Level 1/2 group filters | Dynamically generated checkboxes per distinct path prefix; "All"/"None" bulk actions per level. | Unchecking a level-1 group hides every row under that prefix, including across multiple level-2 subgroups. |
| F-010.5 | Row selection + select-all | Per-row checkbox; header checkbox is select-all-visible with indeterminate tri-state. | See parent criteria. |
| F-010.6 | Notes (status + text) | Per-path status enum (`unreviewed`/`reviewed`/`needed`/`ignore`) plus free text, applied without disrupting input focus. | See parent criteria. |
| F-010.7 | Value display/truncation | 70-character preview plus show-more/less for both A and B value cells independently. | A value exactly at 70 characters does not truncate; 71+ does. |
| F-010.8 | Line tags | Clickable `Ln N` tag next to each side's value, present only if that path resolved to a line in that panel's line map. | Clicking a line tag scrolls the correct panel to the correct line. |
| F-010.9 | Result counter | "Showing X of Y fields · Z selected" text, updates with every filter/selection change. | Counter values always match the actual rendered row count and selection size. |
| F-010.10 | Ignored-hidden-count note | Shows only when ≥1 row is hidden specifically by ignore rules (not by other filters). | Note text uses correct singular/plural ("1 field" vs. "N fields"). |
| F-010.11 | Export Missing Fields (.md) | Exports the *full* Missing Fields list (all rows, not just filtered-visible ones) — see F-014. | Guarded: requires a completed compare. |
| F-010.12 | Export Selected (.md) | Exports only the currently selected rows — see F-014. | Guarded: requires a completed compare **and** a non-empty selection. |

---

### F-011 — Structure Schema Compare Section

**Purpose:** Separates "does B have all the fields A's schema implies it should" from "do the values match" — valuable specifically when comparing, e.g., a paginated list where item *count* differs but each item's *shape* should still match a baseline.

**Entry conditions:** A compare has run; the section is closed by default (F-013).

**User flow:** Renders all structural findings, filterable by kind/ignored-visibility/text — the same interaction pattern as F-010 minus selection/notes/export.

**UI behavior:** A filter row (three kind checkboxes + show-ignored + text filter) → table: Field Path, Issue (tag), Detail.

**Data:** Row shape is `{path, kind, detail?}`; there is no notes/selection concept for this section.

**Business logic & validation:**
- **⚠ QUIRK, must be preserved deliberately:** the "Inconsistent within A" filter checkbox controls **both** the `inconsistent-in-a` **and** `a-empty-array` finding kinds — two semantically distinct issues share one filter toggle. A rebuild that "cleanly" splits these into separate filters would be a scope-creep UI change, not a faithful port, unless explicitly decided otherwise.
- `missing-in-b`/`extra-in-b` findings show fixed, generic detail text regardless of the specific field; only `inconsistent-in-a`/`a-empty-array` carry a dynamic, finding-specific detail string.

**Application states:** No findings (either none exist, or all filtered out) · Findings present, filtered · Findings present, with ignored-hidden-count note.

**Edge cases:** Inherits F-007's Structure Schema Compare business-logic notes (A-as-baseline, the "more than one A item" gate for internal-consistency checks) — this section is a pure display layer and introduces no new edge cases of its own.

**Dependencies:** F-006 (ignore filtering), F-007.3 (source data), F-009 (summary chip scroll target).

**Acceptance criteria:**
- All four finding kinds render with correct, distinct tag styling and correct detail text per kind.
- The "Inconsistent within A" checkbox shows/hides both `inconsistent-in-a` and `a-empty-array` findings together (preserving the shared-checkbox quirk, unless a product decision changes it).
- Text/ignored filters behave identically to their Missing Fields counterparts.

---

### F-012 — Differences Section

**Purpose:** For fields that exist on both sides but disagree in value — the most "classically expected" diff view.

**Entry conditions:** A compare has run; the section is closed by default (F-013).

**User flow:** Renders all value-level differences, filterable by ignored-visibility/text.

**UI behavior:** A filter row (show-ignored + text filter) → table: Field Path, Response A value, Response B value (both with the same truncation/line-tag treatment as F-010.7/F-010.8).

**Data:** Row shape is `{path, aPath, bPath, a, b}`.

**Business logic & validation:** No additional rules beyond F-007's diff semantics and F-006's ignore filtering — this section, like F-011, is a display layer.

**Application states:** No findings · Findings present, filtered · Findings present, with ignored-hidden-count note.

**Edge cases:** Inherits the compound-path display (`tags[0] / tags[2]`) noted under F-007 for reordered+changed array items — here it's arguably *useful* information (it tells the user the item moved *and* changed), unlike its effect on ignore-matching.

**Dependencies:** F-006, F-007.2, F-009.

**Acceptance criteria:**
- Every field present in both documents with an unequal value appears exactly once, with both original values visible (truncated if long).
- Text/ignored filters behave identically to their counterparts in the other two sections.

---

### F-013 — Collapsible Result Sections

**Purpose:** Three potentially-long tables shouldn't all be open by default competing for attention — Missing Fields (usually the most actionable) starts open; the other two start closed but are one click away.

**Entry conditions:** A compare has run.

**User flow:** User clicks a section's header (or a Summary chip, F-009) → the section toggles open/closed (or is forced open, scrolled-to, and briefly flashed, if triggered via a chip/line-tag jump even if it was previously closed).

**UI behavior:** A native disclosure-widget pattern (chevron rotates 45°↔−45°) for each of the three sections; Missing Fields is `open` by default, the other two are closed by default; a jump-to action always force-opens the target section even if the user had manually closed it, then scrolls and flashes its border briefly.

**Data:** No data of its own — pure UI/disclosure state, one boolean per section, never persisted.

**Business logic & validation:** A jump-to action must open a closed section before scrolling to it — scrolling to a closed, height-collapsed element would otherwise land on the wrong scroll position or show nothing.

**Application states:** Open · Closed · Open + freshly jumped-to (flash animation playing).

**Edge cases:** Rapidly clicking a Summary chip multiple times restarts the flash animation each time (a forced reflow before re-adding the animation class ensures the CSS animation replays rather than being a no-op on an already-present class).

**Dependencies:** F-009 (triggers jump-to), F-010/F-011/F-012 (the sections themselves).

**Acceptance criteria:**
- Missing Fields is open and the other two are closed immediately after every fresh Compare.
- Manually closing/opening a section is independent of the other two.
- Jumping to a closed section via a Summary chip or line tag force-opens it, scrolls it into view, and plays the flash animation, every time (including repeatedly).

---

### F-014 — Markdown Export

**Purpose:** The user needs to take findings out of the tool — into a PR description, a Jira comment, a Slack message — as a structured, readable artifact rather than a screenshot.

**Entry conditions:** A compare has run (both export buttons); for "Export Selected," at least one Missing Fields row must also be currently selected.

**User flow:**
1. User clicks "Export Missing Fields (.md)" or "Export Selected (.md)."
2. A guard check runs (see Business logic) — on failure, a specific status error shows and nothing is generated.
3. On success: a Markdown string is built, a file download is triggered automatically (Blob + anchor click), **and** an in-page preview panel opens showing the same content in a read-only textarea with its own Copy / Download-again / Close controls.

**UI behavior:** The preview panel appears below the result sections (auto-scrolled into view), titled "Export preview — `<filename>`," with explanatory copy about why it exists (some sandboxed contexts silently block the automatic download).

**Data:** Input is the full (or selected-only) Missing Fields list, current notes, and current ignore patterns.

**Output — the exact Markdown structure (must be preserved byte-for-structure, not just "similar"):**

1. `# <Title>` — "Missing Fields Report" or "Selected Missing Fields Report."
2. "Generated by JSON Response Comparer."
3. `## Comparison Summary`, in three subsections:
   - `### Source (A) — Missing Fields` — `Total Missing`, `Ignored`, `Requires Review` (the last two always sum to the first, counted for A's rows only).
   - `### Local (B) — Missing Fields` — the same three counts, for B's rows only.
   - `### Overall Status` — `Total Differences`, `Ignored Paths`, `Actionable / Requires Review` (the combined A+B totals), followed by a one-line prose sentence: `Summary: Out of N total differences, M are intentionally ignored and K require review or action.` (singular "difference"/"is" when N/M is 1).
4. `## Ignore Path Rules` — the literal configured patterns, or "None configured."
5. `## Missing Fields (Actionable)` — one block per non-ignored row, in this exact order, followed by a `---` rule before the next entry:
   - `### \`<path>\`` — a heading with the field's path, no numbering.
   - `**Presence**`, then `* Source (A): ✅ Present` or `❌ Missing`, `* Local (B): ✅ Present` or `❌ Missing`.
   - `**Classification**`, then `* Ignore Path: No`, `* Status:` one of `🟡 Not Reviewed` / `🟢 Reviewed` / `🔴 Needs Action` / `🟢 Expected Difference` (mapped 1:1 from the row's status — unreviewed/reviewed/needed/ignore respectively), `* Actionable: Yes` only when the status is Needs Action, `* Requires Review: Yes` only when the status is Not Reviewed.
   - `Reason: <text>` — the note's free text if one was written, otherwise an auto-generated sentence describing which side the field is present/missing on, phrased for that status.
   - `Action: <text>` — a fixed sentence per status (e.g. "✅ No action required." for Expected Difference, "⚠️ Action required — see notes for details." for Needs Action, "🔍 Pending review." for Not Reviewed, "✅ No action required (reviewed)." for Reviewed).
6. `## Ignored Paths` (only present if ≥1 ignored row exists) — the same per-entry block format, with `Ignore Path: Yes`.

**Business logic & validation:**
- "Export Missing Fields" exports **every** Missing Fields row regardless of the table's current filters (only Ignore Paths affects the actionable/ignored split — text/side/level filters are display-only and do not affect what gets exported).
- "Export Selected" requires a completed compare **and** a non-empty selection; "Export Missing Fields" requires only a completed compare.
- If every row happens to be ignored, the Actionable section shows a specific message ("No actionable missing fields — all N matched an Ignore Path rule...") rather than the generic empty message.
- The downloaded filename is exactly `missing-fields-report.md` for "Export Missing Fields," and exactly `missing-fields-selected-report.md` for "Export Selected" — both saved as `text/markdown`.
- The preview's Copy control shows the exact text "Copied to clipboard." on success, or falls back to selecting the textarea's content and showing "Clipboard access was blocked — text is selected, press Ctrl/Cmd+C to copy." if the clipboard write throws.

**Application states:** Guard failed (not compared / empty selection) — status error shown, no file/preview · Success — file download attempted plus preview shown · Preview open (Copy succeeded / Copy blocked, falls back to text-selection plus manual-copy instructions) · Preview closed.

**Edge cases:**
- A clipboard write failure (blocked by a sandboxed context) falls back to programmatically selecting the preview textarea's content and instructing the user to press Ctrl/Cmd+C manually — a real, necessary fallback that should be preserved for the standalone build too, since some corporate/locked-down browser policies produce the same restriction.
- "Download again" in the preview re-triggers the same Blob/anchor download using the already-generated content — it does not regenerate the report, so it reflects the state *at export time*, not any notes/selection edits made afterward, until the user exports again.

**Dependencies:** F-006 (ignore split), F-010 (source rows, notes, selection).

**Acceptance criteria:**
- The exported Markdown matches the documented structure exactly, including correct singular/plural phrasing and the conditional presence of the Ignored Paths section.
- "Export Missing Fields" always includes all rows (ignoring current table filters); "Export Selected" includes only the currently selected rows.
- Both guards produce their specific, correct error message and prevent any file/preview from being generated.
- A blocked clipboard write falls back to a usable manual-copy state rather than failing silently.

---

### F-015 — Sample Data / Reset

**Purpose:** A zero-effort way to see the tool actually do something (Load Sample) and a full reset when starting a new comparison (Clear).

**Entry conditions:** Always available.

**User flow (Load Sample):** Click → both panels populate with a fixed example pair, deliberately shuffled in key/array order between A and B to demonstrate order-independence → the Ignore Paths field is overwritten with a matching demo pattern → gutters/tree views refresh → because both panels now hold valid JSON simultaneously, Aligned JSON Comparison (F-017) fires immediately and re-orders each panel's display text so shared keys line up. No compare runs automatically — the user must still click Compare (which re-aligns again, harmlessly, as part of its own flow).

**User flow (Clear):** Click → both panels empty → all diff state, notes, selection, and level-group filters clear → the results area hides → the status line clears. **The Ignore Paths field is deliberately left untouched.**

**UI behavior:** Two buttons in the main toolbar alongside Compare.

**Data (sample payload, exact):**
- Response A: `status`, `user{id,name,plan}`, `data{amount,currency}`, `tags[]`, `notes` (free text resembling a support-call summary), `config{partner{id,tier}, region, partnerConfig{<partner-name>: {themeColors:{aqua, amGradient}}} for two example partners}`, `countries[]`.
- Response B: the same fields reordered, `user.plan` changed, `data.amount` changed, an added `meta.cached` field, an extended `notes` string, `config.partner.contractRef` added, `config.region` removed, `partnerConfig` theme colors emptied out, and a third `countries` entry with a differently-named field (`isoName` instead of `name`) to also demonstrate a Structure Schema Compare finding.

**Business logic & validation:** None beyond the fixed seed data and the explicit ignore-paths overwrite noted above.

**Application states:** Not applicable — both actions are instantaneous, synchronous state resets.

**Edge cases:**
- Loading Sample while existing data/results are present silently overwrites both panels and all derived state with no confirmation prompt.
- Clear likewise has no confirmation prompt.

**Dependencies:** F-001 (target of both actions), F-006 (Ignore Paths — overwritten by Sample, preserved by Clear), F-007 (diff state cleared by Clear), F-010 (notes/selection/level-groups cleared by Clear), F-017 (auto-alignment triggered by Load Sample).

**Acceptance criteria:**
- Load Sample always produces the exact documented payload pair and Ignore Paths value, regardless of prior state.
- Clear always empties both panels and every piece of derived compare state, while leaving the Ignore Paths field's current value untouched.
- Neither action prompts for confirmation (preserving the artifact's current no-confirmation behavior, unless a product decision adds one — see Part 2).

---

### F-016 — Miscellaneous UI

**Purpose:** Small pieces of UX polish that don't belong to any single feature above but are still real, specified behavior.

**Entry conditions:** Always active.

**User flow / behavior:**
- **Scroll-to-top button (F-016.1):** a floating circular button appears once the page has scrolled more than 300px, and smooth-scrolls to the top on click; hidden otherwise.
- ~~**Light/dark theming (F-016.2)**~~ — **superseded by F-018.** Theming was previously purely OS-driven, with no in-app toggle; it is now its own documented feature (Theme Toggle — Light / Dark Mode, F-018), which adds an explicit, persisted override on top of the same OS-driven default. The sub-ID F-016.2 is retired rather than reused, so any existing cross-reference to it should be read as F-018.
- **Status/error messaging (F-016.3):** a single shared status text element (not a toast/notification stack) is reused across Compare validation errors, Prettify errors, and Export guard failures — only one status message is ever visible at a time, and a new one simply replaces whatever was showing.

**Data:** None beyond the current status message string and its error/non-error styling class.

**Business logic & validation:** Not applicable — these are presentational behaviors, not business rules.

**Application states:** Scroll button hidden/visible; status empty/info/error.

**Edge cases:** Because status messaging is a single shared element, two different validation failures in quick succession simply overwrite each other — there is no message queue or history.

**Dependencies:** Cross-cutting — referenced by F-001 (Prettify errors), F-007 (Compare validation errors), F-014 (Export guard errors).

**Acceptance criteria:**
- The scroll-to-top button appears/disappears at exactly the documented threshold and scroll direction.
- Every error-producing action in the app writes to the same single status element, replacing any prior message.
- (Theme acceptance criteria now live under F-018.)

---

### F-017 — Aligned JSON Comparison

**Purpose:** Two independently-authored (or independently-fetched) JSON documents rarely happen to declare their fields in the same order. Scanning two panels of raw JSON to spot a value difference is much harder when a shared field sits on line 4 in one panel and line 11 in the other. This feature makes the two panels *read* in the same order wherever they share structure, without touching what the comparison actually reports.

**Entry conditions:** Both panels (A and B) independently hold non-empty, valid JSON at the moment one of the trigger events below occurs.

**User flow:**
1. User gets both panels into a valid, non-empty state, by any combination of typing, pasting, file upload, fetch, or Load Sample.
2. The moment both panels are simultaneously valid — specifically right after a paste event, a completed file-upload, a completed fetch, a Load Sample click, or a Compare click — the app recomputes each panel's display text via `alignForDisplay(parsedA, parsedB)` and writes the result back into both panels (re-indented as `JSON.stringify(_, null, 2)`, same formatting Prettify/Compare already produced).
3. The user sees both panels' shared fields now appear in the same relative order; fields unique to one side are still present, simply placed after the shared ones on whichever side they belong to.
4. If either panel is empty or fails to parse at the moment of a trigger, nothing happens — no alignment, no new error message, and (for the paste/upload/fetch/sample triggers specifically) no interruption to whatever normal error handling that action already has.

**UI behavior:** No new UI element — this feature only changes the *text already visible* in the two existing JSON panels (F-001) and, by extension, whatever the Tree view (F-002) renders from that text afterward. There is no toggle to turn this off; it is a display transform, not an optional feature the user chooses to enable.

**Data:** Input is the two panels' current parsed JSON values. Output is two new JSON values — structurally identical to the inputs (same keys, same values, same array lengths/order) but with each object's own key insertion order changed — which are then stringified and written back into the panels' raw text. Nothing about the stored diff result, notes, selection, or ignore patterns is touched by this feature.

**Business logic & validation (exact algorithm):**
- Define `align(a, b)` recursively:
  - If both `a` and `b` are arrays: walk index-by-index up to the longer array's length. For an index present in both, recurse `align(a[i], b[i])` and keep the two results at that same index on their respective sides. For an index present in only one array, keep that side's original value at that index, unchanged. **Array element order is never reordered or re-matched by value at this step** — this is the single most important invariant in this feature, since it's what keeps this display transform provably independent of the diff engine's own array-matching logic (F-007), which pairs array items by canonical value, not by index.
  - If both `a` and `b` are plain objects: build one key order — Response A's own keys first, in A's own order, then any keys unique to B appended afterward in B's own order (keys already seen from A's list are skipped). For each key in that unified order: if both sides have it, recurse and place the aligned result on each side under that key; if only one side has it, that side keeps its own value under that key, unchanged, and the other side simply does not have that key (exactly as before — alignment never invents or removes a key on either side).
  - Otherwise (primitives, `null`, or a type mismatch between `a` and `b` at the same position, e.g. one side is an object and the other is a primitive): return both values unchanged — there is nothing safe to reorder.
- Response A's key order is always the baseline when both sides share an object at the same position — this mirrors the same "A is the baseline" precedent already established by Structure Schema Compare (F-007.3), for consistency across the app.
- The diff engine (F-007) runs against the *original, unaligned* parsed values, never the aligned copies — see F-007's Business logic for why this is provably safe and not just assumed to be.
- This feature introduces no new validation rule and no new error message; it is purely a silent, best-effort convenience that no-ops when its precondition (both sides valid) isn't met.

**Application states:** Not applicable in the usual sense — there is no separate "aligning..." state (the transform is synchronous and effectively instantaneous even for large documents); the only observable states are "did not run" (precondition not met) and "ran" (both panels' text just changed).

**Edge cases:**
- A key present in both A and B, but nested inside a value whose *type* differs between the two sides (e.g. `config` is an object in A but a string in B) is left alone at that key — alignment only descends into a shared object/array pair, never forces one side's shape onto the other.
- An array containing objects (e.g. `countries: [{code, name}, ...]`) has its own key order aligned *within* each index-matched pair of objects, but the array items themselves are never reordered or re-matched by value, even if that would make the arrays "look more aligned" — this is deliberate, not a missed opportunity, precisely to avoid any risk of this feature's output being mistaken for (or drifting into) the diff engine's own array-matching semantics.
- Running alignment twice in a row (e.g. Load Sample, then immediately Compare) is idempotent and harmless — the second run's input already has A's keys in A's own order, so nothing further changes.
- A document whose root is a bare primitive (e.g. both panels are just `"ok"`) has nothing for this feature to reorder; it passes through unchanged, same as any other primitive value encountered during the recursive walk.

**Dependencies:** F-001 (reads from and writes back into the two panels), F-003/F-005 (file-upload and fetch completion are trigger events), F-015 (Load Sample is a trigger event), F-007 (Compare both triggers this and consumes its *unaligned* input for the actual diff — see F-007's Business logic for the non-interference guarantee).

**Acceptance criteria:**
- Given two objects that share every key but declare them in a different order, after alignment both panels' displayed key order for those shared keys is identical, and matches Response A's original order.
- A key unique to one side remains present, under that side only, after alignment — alignment never adds or removes a key.
- Array element order in both panels is byte-for-byte identical, index-for-index, before and after alignment — only nested object keys change position.
- Running the diff algorithms (F-007.1–F-007.3) against the pre-alignment values and the post-alignment values for the same document pair produces identical missing/changed/structure results, path-for-path.
- Typing manually into a panel while the other panel is also already valid does not trigger alignment on every keystroke — only the discrete trigger events listed above do.
- With either panel empty or invalid at the moment of a trigger event, no alignment occurs and no new status/error message appears.

---

### F-018 — Theme Toggle — Light / Dark Mode

**Purpose:** The artifact's color theme was previously entirely OS-driven, with no way for a user to choose a theme independent of their system/browser setting (e.g., a system in dark mode where the user still wants this one tool in light mode, or vice versa). This feature adds that explicit choice without discarding the sensible OS-driven default.

**Entry conditions:** App loaded. The toggle is always visible and interactive.

**User flow:**
1. On load, with no stored preference, the app's theme follows the OS/browser's `prefers-color-scheme` setting, exactly as before this feature existed.
2. User clicks the theme toggle button (in the header) → the app immediately switches to the opposite of whichever theme is *currently in effect* (not necessarily the opposite of the last explicit choice, the first time this is clicked) → that explicit choice is written to the browser's local storage → the toggle's icon/label update to reflect the new state.
3. On a later reload (same browser, same storage), the app reads the stored explicit choice and applies it immediately, ahead of/overriding the OS preference, until the user clears it (by toggling back and forth is the only exposed way to change it — there is no separate "reset to system" control).

**UI behavior:** A single button in the page header, showing an icon (🌙/☀️) and a text label ("Dark"/"Light") that always names the theme *currently in effect*, not the theme a click would switch to.

**Data:** A single stored value, one of `'light'`, `'dark'`, or absent (no explicit override — the app then defers to `prefers-color-scheme`). Stored under a single, dedicated local-storage key, scoped to this app's origin only.

**Business logic & validation:**
- Theme is applied via a `data-theme` attribute on the document root: `data-theme="light"` or `data-theme="dark"` when an explicit override is set, or the attribute absent entirely when following the OS preference. Every themed color in the app is a CSS custom property, so this single attribute change re-themes every surface at once — panels, buttons, tables, tags, chips, the diff-highlight colors (F-008), and the tree indent guides (F-002.7) — with no per-component theme logic needed.
- Reading/writing the stored preference is wrapped so that a browser context where local storage throws (private browsing, storage disabled by policy) never breaks the toggle itself — the toggle still switches the visible theme for the rest of that session; it simply isn't remembered on the next load.
- This feature introduces no new validation rule and no new error/status message.

**Application states:** No explicit override, OS reports light · No explicit override, OS reports dark · Explicit override = light · Explicit override = dark.

**Edge cases:**
- A user who has never touched the toggle sees the app change theme automatically if they change their OS-level setting while the app is open (unchanged from the artifact's pre-existing, purely OS-driven behavior) — this only stops once they click the toggle for the first time.
- Because the toggle always reports/switches based on the theme *currently in effect*, a user whose OS is in dark mode and who has never set an explicit override sees the toggle labeled "Dark" and clicking it explicitly sets "light" — there is no scenario where the toggle's label and the actually-rendered theme disagree.
- Every diff-highlight color, including the two direction-aware Missing Fields colors introduced by F-008's color split, has a distinct, readable value defined for both themes — verified visually in both modes, not assumed from the dark-theme values alone.

**Dependencies:** Cross-cutting by nature — every visually themed feature in the app (F-001 through F-016) consumes the same CSS custom properties this feature switches, but none of them contain any theme-specific logic of their own.

**Acceptance criteria:**
- With no stored preference, the app's theme matches the OS/browser's `prefers-color-scheme` setting exactly, with no visible toggle-driven override in effect.
- Clicking the toggle switches every themed surface in the app (not just some) to the other theme, immediately, with no partial/half-updated state at any point.
- Reloading the app after clicking the toggle preserves the explicitly-chosen theme, ignoring the OS preference from that point on.
- If local storage throws or is unavailable, the toggle still functions for the remainder of the session (no crash, no broken UI) — it simply does not persist across reloads in that case.
- Every text, icon, button, table row, tag, chip, and diff-highlight color remains at a readable contrast in both themes.

---

## 5. UI Sections, Components, and Responsibilities

This is the visual/interaction inventory of the screen — what a person sees and clicks, independent of how it's implemented:

- **Header/title bar.** App name, plus the Theme Toggle button (F-018) showing the currently-effective theme; no navigation (single-page app, single screen).
- **Toolbar.** Compare, Load Sample, Clear buttons (F-015), plus the shared status/error message line (F-016.3).
- **Ignore Paths field + highlight toggles.** The Ignore Paths text input (F-006) directly above the three highlight checkboxes (F-008), with a color legend.
- **Panel A / Panel B (identical structure, mirrored).** Each panel (F-001) contains: a header (label, Find, Prettify, Add buttons, JSON/Tree tab pair), the editor or tree view body, a line-number gutter (JSON tab only), a minimap strip, gutter diff indicators, scroll-aware "N more" pills, and — once a fetch has run — a persistent inline curl bar.
- **Add Data Modal (F-003).** A single dialog with a file-upload section and a curl/URL-fetch section, opened from either panel's "Add" button.
- **Summary chip row (F-009).** Appears above the result sections once a compare has run.
- **Missing Fields section (F-010).** The largest, most interactive result section: filter row, level-group filter rows, result counter, and the results table with per-row selection, status, and notes.
- **Structure Schema Compare section (F-011).** Filter row + results table, closed by default.
- **Differences section (F-012).** Filter row + results table, closed by default.
- **Export preview panel (F-014).** Appears below the result sections after an export, with a read-only textarea and Copy/Download-again/Close controls.
- **Scroll-to-top button (F-016.1).** A floating circular control, bottom corner of the viewport.

Every one of these is a **client-side, interactive UI region** — there is no server-rendered or static content beyond the outer page shell.

---

## 6. Data Flow & State Model

### 6.1 In-memory state shape (baseline — nothing persists beyond the browser tab)

- **Per panel (A, B):** raw text, parsed value (or `null`), parse error (or `null`), current tab (`json`/`tree`), curl bar text (if a fetch has run).
- **Ignore Paths:** a single raw string.
- **Diff result (set once per Compare, replaced wholesale — never mutated piecemeal):** `missing[]`, `changed[]`, `structure[]`, plus a line-number map per panel.
- **Highlight toggles:** three independent booleans (missing/structure/differences).
- **Missing Fields filters:** side toggles, show-ignored, free-text, level-1 group map, level-2 group map.
- **Structure filters:** kind toggles, show-ignored, free-text.
- **Differences filters:** show-ignored, free-text.
- **Selection:** a set of currently-selected Missing Fields paths.
- **Notes:** a map from field path to `{status, text}`.
- **Theme override (F-018):** `'light' | 'dark' | null` — the only piece of state in the whole app that survives a page reload, via local storage. `null` means "no explicit choice — follow `prefers-color-scheme`."
- **Alignment (F-017) is deliberately *not* separate state.** It has no on/off flag, no stored "last aligned at" marker, and nothing to reset — it is a pure, synchronous function of whatever the two panels' current parsed values are, re-run at each trigger event, with its output written directly into the same `raw` text field each panel already has. There is nothing about it in this state shape beyond the panels' `raw` text itself.

### 6.2 The state-persistence asymmetries (must be preserved exactly)

This is the single most important "hidden" behavior in the whole app — a naive rewrite that makes everything reset uniformly, or nothing reset at all, is a real regression, not a simplification:

| Action | Resets | Does NOT reset |
|---|---|---|
| **Compare** | Row selection; level-1/level-2 group filters (rebuilt fresh from the new result set) | Notes; Ignore Paths; highlight toggle checked-state |
| **Clear** | Both panels; diff result; notes; selection; level-group filters; status line | **Ignore Paths** (deliberately preserved) |
| **Load Sample** | Both panels; **Ignore Paths** (overwritten with the demo value) | Whatever else was set before (notes/selection are implicitly stale until the next Compare, since Load Sample doesn't auto-run Compare) |
| **Theme toggle (F-018)** | Nothing else in the app — this is the one action whose whole effect is the theme override itself | Every other piece of state listed in §6.1; the theme override is also never reset by Compare, Clear, or Load Sample, and is the only state that survives a reload |

### 6.3 Data flow for the two core operations

**Compare:** UI (Compare click) → validate both panels non-empty and parseable → parse both panels → compute the aligned display text (F-017) from the two parsed values and write it into both panels, re-indented → parse the freshly-aligned text is *not* repeated — the diff step below uses the original parsed values from before alignment → build per-panel line maps from the now-aligned text → run the three diff algorithms (Missing / Differences / Structure) against the original, unaligned parsed values → store the result wholesale → re-render Summary, the three result sections, and all highlights.

**Aligned JSON Comparison (F-017), as its own trigger-driven flow:** A discrete population event completes (paste, file-upload load, fetch load, Load Sample) → check whether both panels now independently parse → if not, stop silently → if so, compute `alignForDisplay(parsedA, parsedB)` → write the two aligned, re-indented results back into the two panels' raw text → refresh each panel's gutter/tree view exactly as any other text-changing action would.

**Fetch-via-curl:** UI (paste + Go) → parse the curl/URL text synchronously, client-side, no network → execute the parsed request as a direct browser `fetch()` → read response text → detect JSON-ness by attempting `JSON.parse` (not by trusting `Content-Type`) → pretty-print into the panel if JSON, otherwise insert raw text → show status.

---

## 7. Validation Rules (consolidated)

The entire validation surface of the artifact, all in one place:

1. **JSON parseability**, checked at two points: Prettify (per-panel) and Compare (both panels, all-or-nothing). This is a bare `JSON.parse` try/catch — there is no schema, type, or shape validation beyond "is this syntactically valid JSON."
2. **Compare's pre-flight guard:** both panels must be non-empty and independently parseable, or Compare aborts entirely with no partial result.
3. **Export guards:** "Export Missing Fields" requires a completed compare; "Export Selected" additionally requires a non-empty selection.
4. **Add Data Modal's fetch leg:** an empty submission is rejected client-side with "Enter a URL or a curl command first." before any network attempt.
5. **No validation exists for:** note text (any free text, any length), Ignore Paths pattern syntax (any string is accepted and parsed leniently — including the bare-`*` quirk), file type on upload (accept-attribute hint only, not enforced), or the shape of a parsed curl request before it's executed.
6. **Aligned JSON Comparison (F-017) and Theme Toggle (F-018) introduce no new validation rules.** Alignment's only "guard" is its trigger precondition (both panels independently parse) — failing it means the feature silently does nothing, never a new error message. The theme toggle has no invalid state to guard against — it only ever reads/writes one of two known values.

---

## 8. Known Artifact Quirks / Defects Register

Each of these is a real, verified behavior (not a hypothetical) found by reading the artifact's actual logic. **None of these should be silently "fixed" during a rewrite** — each needs an explicit, recorded decision (fix or preserve) before the affected code is finalized, because "port faithfully" and "fix obvious bugs" are genuinely in tension and only a product owner can resolve that tension per-quirk.

| # | Quirk | Where | Impact if unresolved |
|---|---|---|---|
| Q1 | A bare `*` Ignore Paths pattern (no other segments) matches **every** path in the document, silently suppressing the entire comparison. | F-006 | A user typing just `*` gets a comparison that reports nothing, with no warning. |
| Q2 | When an array item is both reordered and changed in value, the resulting finding's `path` field is a compound string (`tags[0] / tags[2]`), which the ignore-path matcher tokenizes incorrectly, so an otherwise-matching ignore pattern silently fails to apply to that specific finding. | F-006, F-007 | A small, narrow correctness gap — an ignore rule the user expects to work, doesn't, for this one specific finding shape. |
| Q3 | The curl parser's "unknown flag" handling doesn't skip the flag's value token, so an unrecognized flag followed by a bare value can cause the *next* token (the real URL) to be silently discarded and the flag's leftover value used as the URL instead — e.g. `curl --foo bar https://example.com` parses to `url = "bar"`. | F-004 | A pasted curl command with any flag the parser doesn't recognize can silently target the wrong URL. |
| Q4 | The Structure Schema Compare section's "Inconsistent within A" filter checkbox controls two semantically distinct finding kinds (`inconsistent-in-a` and `a-empty-array`) at once. | F-011 | Toggling that one checkbox hides/shows two different kinds of issue together; a user may not realize both are tied to it. |
| Q5 | Prettify on an empty panel is a completely silent no-op (no error, no visible change). | F-001 | Mildly surprising the first time, but arguably reasonable — flagged for completeness, not necessarily a "bug" the way Q1–Q3 are. |
| Q6 | Compare's error message when only one panel is empty doesn't say which panel. | F-001 | Minor UX friction — the user has to check both panels themselves. |
| Q7 | Clear does not reset Ignore Paths, but Load Sample does. | F-006, F-015 | Intentional-looking asymmetry; flagged so a rewrite doesn't "fix" it into consistency by accident. |

Each of these should be resolved as an explicit item before the corresponding unit tests are finalized (the "correct" test assertion for Q1–Q4 depends entirely on which way the decision goes).

---

## 9. Error / Loading / Empty / Success State Catalog

A consolidated view across every feature — the exhaustive list of non-happy-path states the UI must render correctly:

| Area | Empty | Loading/in-progress | Error | Success |
|---|---|---|---|---|
| Panel A/B (F-001) | Placeholder example text | N/A (typing is synchronous) | Inline parse error naming the panel, on Prettify/Compare | Text present, optionally prettified |
| Add Data Modal (F-003) | Idle, both legs available | Fetch leg: Go disabled, in-progress status shown | File read error, or fetch error (network/CORS/non-2xx handled per F-005), shown inline, modal stays open | Modal closes, target panel updated |
| Fetch execution (F-005) | N/A | "Fetching into Response A/B..." | "Fetch failed: ... usually a CORS restriction" (thrown exception) | "Fetched `<status>` `<statusText>`..." (2xx) or "Server responded `<status>`... body loaded anyway" (non-2xx, still a "success" for panel-population purposes) |
| Compare (F-007) | Not yet run — results area not rendered at all | Synchronous in the artifact (no spinner state exists today) | Specific panel + JSON.parse error; previous results (if any) remain unchanged | Results area renders (Summary + 3 sections) |
| Missing Fields (F-010) | Two distinct empty states: "no missing fields at all" (shown via the Summary's all-zero message) vs. "no missing fields match the current filters" (this section's own empty state) | N/A | Export guard failures ("Run a comparison first." / "No fields selected...") | Rows rendered, correctly filtered/counted |
| Structure/Differences (F-011/F-012) | "No findings" (either none exist or all filtered out) | N/A | N/A (no export/guard concept here) | Rows rendered, correctly filtered |
| Export (F-014) | N/A | N/A | Guard-failure status message, no file/preview generated | File download triggered + preview panel opens; clipboard-copy success or fallback-to-manual-select |
| Tree view (F-002) | "Nothing to show yet — paste or load JSON on the JSON tab first." | N/A (synchronous parse) | Inline `JSON.parse` error, styled as an error | Fully expanded tree rendered |
| Status line (F-016.3) | Empty | N/A | Error-styled message (replaces any prior message) | Info-styled message (replaces any prior message) |
| Aligned JSON Comparison (F-017) | Precondition not met (either panel empty/invalid) — silent no-op, no message of any kind | N/A (synchronous) | None — this feature has no error state; a parse failure is Compare's/Prettify's error, not this feature's | Both panels' display text re-ordered, key-for-key, with no change to any comparison result |
| Theme Toggle (F-018) | N/A (always has a value — explicit override or "follow OS") | N/A (synchronous) | None — local-storage read/write failures are swallowed and never surface to the user | Theme switches immediately across every themed surface; persisted for next load when storage succeeds |

The one deliberate exception to "every failure shows a specific, actionable message" is Prettify on an empty panel (Q5 above) — a silent no-op, not an error.

---

## 10. Feature Dependency Matrix

| Feature | Depends on |
|---|---|
| F-001 Dual JSON Input Panels | F-002 (shares raw text), F-003/F-005 (population routes), F-007 (Compare mutates panel text), F-008 (highlight overlay target) |
| F-002 JSON Tree View | F-001 (raw text source), F-008 (highlight driver) |
| F-003 Add Data Modal | F-001 (writes into a panel), F-004 (parses input), F-005 (executes it) |
| F-004 Curl Command Parsing | Consumed by F-003.2, F-001.7; feeds F-005 |
| F-005 Fetch Execution | F-004 (parsed request), F-003/F-001.7 (UI entry points) |
| F-006 Ignore Paths | F-007 (findings filtered), F-008 (highlighting suppressed), F-010/F-011/F-012 (result sections), F-014 (export's Ignored Paths section) |
| F-007 Compare Engine | F-001 (source panels), F-017 (display-alignment step run as part of Compare), F-006 (downstream, not internal), F-008–F-013 (everything downstream) |
| F-008 Highlighting System | F-006 (exclusion), F-007 (source data + line maps), F-001.8–F-001.11, F-002.4–F-002.6 (rendering surfaces) |
| F-009 Results Summary | F-006 (ignored total), F-007 (source counts), F-010/F-011/F-012 (scroll/filter targets), F-013 (flash/scroll mechanism) |
| F-010 Missing Fields Section | F-006, F-007.1, F-007.4, F-009, F-014 |
| F-011 Structure Schema Compare Section | F-006, F-007.3, F-009 |
| F-012 Differences Section | F-006, F-007.2, F-009 |
| F-013 Collapsible Result Sections | F-009 (triggers jump-to), F-010/F-011/F-012 (the sections themselves) |
| F-014 Markdown Export | F-006 (ignore split), F-010 (source rows/notes/selection) |
| F-015 Sample Data / Reset | F-001, F-006, F-007, F-010, F-017 (auto-alignment triggered by Load Sample) |
| F-016 Miscellaneous UI | Cross-cutting (F-001, F-007, F-014 all write to the shared status element) |
| F-017 Aligned JSON Comparison | F-001 (reads/writes panel text), F-003/F-005 (upload/fetch completion triggers), F-015 (Load Sample triggers), F-007 (Compare triggers, and consumes this feature's *unaligned* input, not its output) |
| F-018 Theme Toggle | Cross-cutting (every visually themed feature, F-001–F-016, consumes the CSS custom properties this feature switches; none of them contain theme-specific logic) |

**Build-order implication:** F-004/F-005/F-006/F-007 (the pure logic layer) should be built and tested before any UI is built on top of them — see Part 3 §29 for the full phased sequence.

---

## 11. Non-Functional Behavior (as the artifact exists today)

- **Performance:** synchronous, main-thread diffing; no payload-size guard; no virtualization of large trees/tables. Acceptable for typical payloads; a stated risk for very large ones (addressed as a *new* requirement in Part 2/3, not a behavior the artifact has today).
- **Accessibility:** color is not the sole differentiator for diff categories (text tags accompany color) — this must be preserved, including for the two Missing Fields colors introduced by F-008's color split (the side tag — "IN A, NOT IN B" / "IN B, NOT IN A" — remains the non-color differentiator there, exactly as it already was for the Structure/Differences categories). Known gaps: the Add Data Modal has no focus trap or `role="dialog"`/`aria-modal`; the JSON/Tree tab pair is two plain buttons with manual active-state toggling, not a proper tablist pattern; the gutter/minimap/highlight-pill controls are mouse-only. The Theme Toggle (F-018) was verified to keep every existing color surface at a readable contrast in both themes — this should be re-verified with an automated contrast check in the standalone build, not just visually.
- **Security:** the artifact escapes HTML manually before templating into `innerHTML`; no CSP, no security headers (it's a sandboxed artifact, not a hosted app). The fetch feature has no server-side attack surface today because it has no server at all — it is subject only to the browser's own same-origin/CORS policy.
- **Browser support:** no explicit statement in the artifact; assume modern evergreen browsers (Chrome/Firefox/Safari/Edge, current and previous major version).
- **Responsive behavior:** a single breakpoint collapses the two-column panel layout to one column on narrow viewports (~800px) — this is the artifact's only responsive behavior; no other breakpoints exist.
- **Internationalization:** English-only UI copy; no string externalization.
- **Roles/permissions:** none — anyone who can open the app can do everything.

---

## 12. Explicitly Out of Scope (and why)

These are genuine, deliberate deferrals — not gaps in this specification:

- **Backend/API/database layer.** Nothing in the current feature set needs one; F-005's fetch runs entirely client-side. A clean extension seam is designed (Part 3 §22) so this can be added later without a rewrite, triggered only by a real need (a security review flagging client-side fetch as unacceptable, a real requirement for saved/shared comparisons, or a target API reachable only from a server network location).
- **Authentication/authorization.** The artifact has no concept of this; nothing in scope requires it unless persistence (below) is adopted.
- **Persistence (saved/shared comparisons, saved ignore-path presets).** The artifact is deliberately, entirely stateless across page loads — this should not be assumed to be a limitation vs. a deliberate design choice without confirming with stakeholders first.
- **Multi-tenant accounts/billing, mobile native apps, real-time multi-user collaboration, bulk/batch comparison of more than two documents, internationalization.** None of these exist in the artifact and none are implied by any documented behavior.

---

# PART 2 — Recommended UI/UX Enhancements

Everything in this Part is **optional**. None of it may remove, hide, or silently change any behavior documented in Part 1 — these are additive improvements only, and several are explicitly framed as "close this gap" rather than "change this behavior."

## 13. Accessibility Improvements (closing real, known gaps)

- Replace the hand-rolled Add Data Modal with an accessible dialog primitive: focus trap, `role="dialog"`, `aria-modal="true"`, focus returned to the triggering "Add" button on close.
- Replace the JSON/Tree tab pair's manual active-state toggling with a proper `role="tablist"`/`role="tab"`/`aria-selected` pattern, keyboard-navigable with arrow keys.
- Ensure the gutter/minimap/highlight-pill controls have a keyboard-reachable equivalent — the existing clickable line tags (F-010.8) already provide one path; make sure it's in the tab order and discoverable via a visible focus ring.
- Audit every form control (filters, notes, Ignore Paths, curl inputs) for a properly associated `<label>`.
- Preserve the existing "color is not the sole differentiator" pattern (text tags alongside color) in any visual refresh — do not lose this while modernizing.
- Target WCAG 2.2 AA conformance; verify with an automated tool (e.g. axe) with zero critical/serious violations, plus a manual keyboard-only pass.

## 14. Performance & Responsiveness Enhancements

- Run the diff computation (F-007) off the main thread (e.g., a Web Worker) so large payloads never freeze the input panels — the artifact runs this synchronously today with no such guarantee.
- Add a clear "payload too large" guard (e.g., around 5 MB per panel) that shows an explicit message rather than letting a huge paste degrade the UI — the artifact has no such guard today.
- Debounce or defer the Tree view's re-parse-on-every-keystroke behavior (F-002) for large documents, rather than re-rendering the full tree on every character typed while that tab happens to be active.
- Consider virtualizing very long result tables or very large trees if real usage regularly produces thousands of rows/nodes.

## 15. Modernization Suggestions (visual/interaction polish)

- Replace any HTML-entity-based icons with a proper icon set for crisper, more consistent visuals.
- Consider refined micro-interactions (smoother transitions on section expand/collapse, a subtler flash animation) as long as the underlying force-open/scroll/flash *behavior* from F-013 is unchanged.
- Consider a more refined empty-state illustration/copy for the "no differences found" and "nothing to show yet" states, as long as the underlying condition and message intent are preserved.

## 16. Optional Product Improvements (flagged as decisions, not defaults)

These are genuine product-level questions, not something to decide unilaterally during implementation — surface them to stakeholders:

- Should Load Sample or Clear show a confirmation prompt before discarding existing work? The artifact has none today; adding one is a real behavior change, not a bug fix.
- Should the sample payload (F-015) use fully generic, non-brand-specific example data instead of its current partner/theme-color example content? Purely cosmetic, no functional impact either way.
- Should any of the four Known Quirks (§9) be fixed rather than preserved? Each has its own trade-off documented in §9 and must be decided individually, not defaulted to "fix everything" or "preserve everything."

---

# PART 3 — Technical Implementation Details

This Part is a **recommended** approach for building the standalone application — a sensible default, not a behavioral requirement. Everything in Part 1 must be true regardless of which stack builds it; Part 3 explains one well-reasoned way to build it.

## 17. Recommended Tech Stack

| Layer | Recommendation | Why |
|---|---|---|
| Framework | Next.js (App Router) + React, TypeScript (`strict` mode) | Server/Client Component split lets the static shell ship zero JS while the editors/diff tables become explicit client islands — a direct improvement over the artifact's one blocking inline `<script>`. No Route Handlers are needed for v1. |
| Styling | Tailwind CSS, CSS custom properties for the design-token/theme system | The artifact already hand-rolls a token system as CSS custom properties (light/dark palette, per-category diff colors) — Tailwind's token-driven approach maps onto this almost directly. The artifact's F-018 theme switch (`data-theme` attribute on the root element, explicit override in local storage, `prefers-color-scheme` as the fallback) is a pattern this maps to directly too — e.g. `next-themes`, or an equivalent small custom provider, wired to the same `data-theme` convention. |
| UI primitives | shadcn/ui (Radix UI underneath) | Accessible, keyboard-navigable `Dialog`, `Tabs`, `Select`, `Checkbox`, `Tooltip`, `Collapsible` — closes the accessibility gaps in §13 without hand-rolling ARIA behavior. |
| Client state | Zustand | All state is local UI/session state, not shared server data — a single typed store with selector-based subscriptions replaces the artifact's ad hoc top-level variables. |
| Diff engine execution | A Web Worker wrapping a pure, framework-free package | Keeps large-payload diffing off the main thread (§14) with zero code change to the algorithms themselves. |
| Validation | Zod | Runtime schema validation at the (few) trust boundaries that exist in v1 — primarily environment variables. |
| Testing | Vitest (unit + component), React Testing Library, Playwright (e2e), MSW (network mocking) | Standard, well-supported combination; Vitest for the diff-engine's pure functions (highest-value tests in the app), Playwright for full user journeys. |
| Error tracking | A client-side error-tracking SDK (e.g. Sentry's browser SDK) | Replaces the artifact's silently-swallowed exceptions (e.g. its CORS failure) with real visibility, without ever logging actual payload content. |
| Package manager / monorepo | pnpm workspaces | Manages the app package plus a separate, framework-free diff-engine package cleanly. |

**Explicitly deferred to a later phase, not built for v1:** any backend framework choice (Route Handlers/Server Actions are Next.js's built-in option if/when a backend is ever needed), a database/ORM, an auth provider, server-side logging/tracing. See §22 for the exact seam that keeps these addable later without a rewrite.

**Rejected for v1 (with reasoning):** a server-side fetch proxy (nothing in scope requires it yet — see §22); GraphQL (no multiple heterogeneous clients to justify it); a microservice split for the diff engine (it's pure and fast enough to run in a Worker); CSS-in-JS (Tailwind better matches the artifact's existing token approach); Redux Toolkit (no undo/redo or time-travel debugging requirement that would justify its ceremony over Zustand).

## 18. Suggested Architecture & Folder Structure

**Core principle: isolate the pure logic.** The diff engine, ignore-path matcher, curl parser, and Markdown report builder must never import React, the DOM, or any framework API — they are plain, framework-agnostic TypeScript, unit-tested in complete isolation, and callable from a Web Worker today or a server route later with zero duplication.

```
json-response-comparer/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── page.tsx                # the whole app's shell (F-001–F-016)
│       │   ├── layout.tsx
│       │   └── globals.css             # design tokens; light/dark palette values (F-018 switches
│       │   │                           #   which set is active via the data-theme attribute)
│       │   # no api/ directory in v1 — created only if a future backend is built
│       ├── components/
│       │   ├── ui/                     # generated shadcn/ui primitives — no domain logic
│       │   ├── panels/                 # F-001 (JsonPanel, JsonEditor, FindBar), F-002 (JsonTreeView)
│       │   ├── ignore-paths/           # F-006 (IgnorePathsField)
│       │   ├── results/                # F-009–F-013 (SummaryChips, MissingFieldsSection,
│       │   │                           #   StructureCompareSection, DifferencesSection, NoteEditor)
│       │   ├── modals/                 # F-003 (AddDataModal)
│       │   ├── export/                 # F-014 (ExportPreviewPanel)
│       │   └── theme/                  # F-018 (ThemeToggle button)
│       ├── lib/
│       │   ├── store.ts                # the Zustand store — see §20
│       │   ├── diff-worker.ts          # Web Worker wrapper around packages/diff-engine
│       │   ├── fetch-executor.ts       # the FetchExecutor interface — see §22
│       │   ├── theme.ts                # F-018: read/write the explicit override, apply data-theme
│       │   └── env.ts                  # validated environment variables
│       └── tests/
│           ├── components/
│           └── e2e/
├── packages/
│   └── diff-engine/                    # pure, framework-agnostic — the project's real IP
│       ├── src/
│       │   ├── canonical.ts            # order-independent stringification primitive
│       │   ├── diff-values.ts          # Missing Fields + Differences (F-007.1/.2)
│       │   ├── diff-shape.ts           # Structure Schema Compare (F-007.3)
│       │   ├── align-for-display.ts    # F-017's key-alignment transform — pure, no DOM,
│       │   │                           #   belongs here for the same reason the diff functions do
│       │   ├── ignore-paths.ts         # F-006's pattern matcher
│       │   ├── curl-parser.ts          # F-004
│       │   ├── line-map.ts             # F-007.4
│       │   ├── level-groups.ts         # F-010.4's group-filter generation
│       │   ├── markdown-report.ts      # F-014's report builder
│       │   └── types.ts
│       └── tests/                      # ≥90% line coverage target — see §23
├── docs/
│   ├── README.md                       # this document
│   ├── SRS.md / FEATURES.md / ARCHITECTURE.md / TECH_STACK.md / IMPLEMENTATION_PLAN.md
├── .github/workflows/ci.yml
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

**Directory rules (what must NOT live where):**

| Directory | Must NOT contain |
|---|---|
| `apps/web/app` | Any diff/ignore-path/report algorithm — those live in `packages/diff-engine` |
| `apps/web/components` | Direct global `fetch()` calls to third-party URLs (must go through `lib/fetch-executor.ts`) |
| `apps/web/lib` | Reimplementations of anything already in `packages/diff-engine`; server-only concerns |
| `packages/diff-engine` | React, the DOM, `fetch`, Next.js, or any state-management library — an import of any of these is an architecture violation, not a style nitpick |

## 19. State Management Design

A single Zustand store, organized by domain slice, directly encoding the state-persistence asymmetries from §6.2 (these asymmetries are the point — a "cleaner" implementation that resets everything uniformly is a real regression):

```ts
interface CompareStore {
  panelA: { raw: string; parsed: unknown | null; parseError: string | null; curlText: string };
  panelB: { raw: string; parsed: unknown | null; parseError: string | null; curlText: string };
  ignorePathsRaw: string;

  diffResult: {
    missing: MissingField[];
    changed: ChangedField[];
    structure: StructureFinding[];
    lineMapA: Map<string, number>;
    lineMapB: Map<string, number>;
  } | null;

  activeTab: { a: 'json' | 'tree'; b: 'json' | 'tree' };
  highlightToggles: { missing: boolean; structure: boolean; differences: boolean };
  missingFilters: { onlyA: boolean; onlyB: boolean; showIgnored: boolean; text: string; level1: Map<string, boolean>; level2: Map<string, boolean> };
  structureFilters: { missingInB: boolean; extraInB: boolean; inconsistentInA: boolean; showIgnored: boolean; text: string };
  differencesFilters: { showIgnored: boolean; text: string };
  selectedMissingPaths: Set<string>;
  notes: Map<string, { status: NoteStatus; text: string }>;

  setPanelRaw(target: 'a' | 'b', raw: string, source: 'type' | 'paste' | 'upload' | 'fetch' | 'sample'): void;
  // ^ `source` matters for F-017: only 'paste'/'upload'/'fetch'/'sample' may trigger
  //   maybeAlignPanels() below; 'type' (ordinary keystroke input) never does.
  maybeAlignPanels(): void;            // F-017 — no-ops unless both panels currently parse;
                                        // writes aligned+re-indented text into both panels' raw field
  runCompare(): Promise<void>;         // resets selection and level-groups; NOT notes or ignorePathsRaw;
                                        // calls maybeAlignPanels() as its first step (see §6.3)
  setIgnorePathsRaw(v: string): void;
  toggleHighlight(category: 'missing' | 'structure' | 'differences'): void;
  setNote(path: string, patch: Partial<{ status: NoteStatus; text: string }>): void;
  clearAll(): void;    // must NOT touch ignorePathsRaw or the theme override
  loadSample(): void;  // DOES overwrite ignorePathsRaw; also calls maybeAlignPanels()
}

// Theme (F-018) is deliberately its own tiny module, not part of CompareStore — it has no
// relationship to Compare/Clear/Load Sample and must never be reset by any of their actions.
interface ThemeState {
  override: 'light' | 'dark' | null;   // null = follow prefers-color-scheme; persisted to localStorage
  toggle(): void;                       // flips whichever theme is *currently in effect*
}
```

## 20. Component-to-Feature Mapping

| Feature | Component(s) |
|---|---|
| F-001 | `JsonPanel`, `JsonEditor`, `FindBar` |
| F-002 | `JsonTreeView` |
| F-003 | `AddDataModal` |
| F-004 | `curl-parser.ts` (pure, no component) |
| F-005 | `fetch-executor.ts` + `AddDataModal`/`InlineCurlBar` (callers) |
| F-006 | `IgnorePathsField` |
| F-007 | `packages/diff-engine` (pure) + `diff-worker.ts` (worker wrapper) + the Compare button |
| F-008 | Rendering logic inside `JsonEditor`/`JsonTreeView`, driven by store selectors |
| F-009 | `SummaryChips` |
| F-010 | `MissingFieldsSection`, `NoteEditor` |
| F-011 | `StructureCompareSection` |
| F-012 | `DifferencesSection` |
| F-013 | Shared `Collapsible` composition around F-010–F-012 |
| F-014 | `markdown-report.ts` (pure) + `ExportPreviewPanel` |
| F-015 | Toolbar buttons + store actions |
| F-016 | `ScrollTopButton`, `globals.css`, a shared status slice in the store |
| F-017 | `align-for-display.ts` (pure) + `maybeAlignPanels()` store action, called from `setPanelRaw` (paste/upload/fetch), `loadSample()`, and `runCompare()` |
| F-018 | `ThemeToggle` component + `lib/theme.ts` + `ThemeState` (its own small store, not part of `CompareStore`) |

## 21. Data Flow Diagrams (textual)

**Compare flow:** User pastes/uploads/fetches JSON into Panel A & B → store updates panel text → user clicks Compare → store validates both panels (JSON.parse) → on success, `maybeAlignPanels()` (F-017) runs against the two parsed values and writes the aligned, re-indented text back into both panels → the *original, unaligned* parsed values (not the aligned copies) and the now-aligned panel text (for line-map building) are posted to the diff Worker → the Worker runs the pure diff-engine functions against the unaligned values → the result is posted back and stored wholesale → every dependent component (Summary, the three result sections, both panels' highlight overlays) re-renders from the new store state.

**Aligned JSON Comparison flow (F-017), outside of Compare:** A paste/upload/fetch/Load-Sample action finishes updating one or both panels → `maybeAlignPanels()` checks whether both panels currently parse → if not, nothing further happens → if so, `alignForDisplay(parsedA, parsedB)` runs (pure, synchronous, no Worker needed — this is not the expensive diff step) → both panels' raw text is replaced with the aligned, re-indented result → each panel's gutter/tree view re-renders from its own new text, exactly as it would for any other text change.

**Fetch-via-curl flow:** User pastes a curl command/URL and clicks Go → the curl text is parsed synchronously, client-side, with zero network access → the parsed request is handed to the `FetchExecutor` → the executor calls the browser's `fetch()` directly → the response is read, JSON-sniffed, and the result (status/body/isJson) flows back to the UI → the panel is updated, `maybeAlignPanels()` runs (F-017), and the status line shows the result.

**Theme toggle flow (F-018):** User clicks the theme toggle → the store computes the theme currently in effect (explicit override, or the OS preference if none) → sets the opposite value as the new explicit override → writes it to local storage (best-effort; failures are swallowed) → sets the `data-theme` attribute on the document root → every component re-renders with the new CSS custom property values, with no component-level theme logic involved.

## 22. API/Service Layer — the FetchExecutor Seam

This is the single most important architectural decision for keeping v1 backend-free while leaving room to add one later without a rewrite. Rather than any component calling the browser's global `fetch()` directly, every caller depends on a small interface:

```ts
interface FetchRequest { url: string; method: string; headers: Record<string, string>; body: string | null }
interface FetchResult { status: number; statusText: string; bodyText: string; isJson: boolean }

interface FetchExecutor {
  execute(request: FetchRequest): Promise<FetchResult>; // throws on network/CORS failure
}

// v1's only implementation — a direct, unguarded browser fetch, matching the artifact exactly:
class BrowserFetchExecutor implements FetchExecutor {
  async execute(request: FetchRequest): Promise<FetchResult> {
    const res = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body ?? undefined });
    const bodyText = await res.text();
    const isJson = isJsonParseable(bodyText); // same JSON-sniffing rule as F-005
    return { status: res.status, statusText: res.statusText, bodyText, isJson };
  }
}

export const fetchExecutor: FetchExecutor = new BrowserFetchExecutor();
```

Every call site (`AddDataModal`, the inline curl bar) uses `fetchExecutor.execute(...)` — never the global `fetch()` directly. **This is the entire mechanism that keeps a future backend addable at zero cost:** if a real need ever emerges (see the trigger conditions in §12), a `ProxiedFetchExecutor` implementing the same interface (calling a server endpoint instead of `fetch()` directly) is written, and the exported singleton is swapped — no calling code changes.

**If a backend is ever built** (not part of v1), it would be exactly one endpoint: `POST /api/fetch-proxy`, validating the request shape, rejecting requests to loopback/link-local/private/cloud-metadata IP ranges before any outbound call, enforcing a timeout and a response-size cap, and never following a redirect into a blocked range without re-validating it. It would return a stable `{status, statusText, bodyText, isJson}` shape identical to what `BrowserFetchExecutor` already returns, or a typed `{error, message}` envelope — never a raw framework error page, and never logging request/response bodies or credential header values.

## 23. Testing Strategy

- **Unit (widest, fastest, most numerous):** every pure function in `packages/diff-engine`, table-driven against fixtures covering the documented edge cases — key/array reordering equivalence, all three Ignore Paths pattern forms (including the Known Quirks in §8, asserting whichever behavior was decided), Structure Schema Compare's baseline edge cases, the Markdown report's exact formatting, and the curl parser's documented flag handling (including its unknown-flag bug, per the same decision). Target ≥90% line coverage on this package specifically — it's the highest-value test surface in the app.
- **F-017's own non-interference test (specifically required, not optional):** for every diff-engine fixture already used to test F-007.1–F-007.3, additionally run `align-for-display.ts` against the same fixture pair and assert (a) the diff results computed from the pre-alignment values and from `alignForDisplay`'s output are identical, path-for-path, and (b) every array in the aligned output has exactly the same elements in exactly the same order as the corresponding input array. This is the regression test that would catch any future change accidentally letting alignment influence a comparison result.
- **Component:** every filter/toggle/selection interaction documented in Part 1 gets at least one test asserting the visible result; the fetch feature is tested against a mocked `FetchExecutor` or MSW, never a real network call; the Theme Toggle (F-018) is tested for: default follows a mocked `prefers-color-scheme`, clicking flips every themed CSS custom property, and the explicit choice survives a simulated reload from local storage.
- **End-to-end:** the three cross-feature flows from §3 (primary compare flow, fetch-via-curl flow, ignore-and-annotate flow), across the browsers targeted for support.
- **Accessibility:** an automated check (e.g. axe) with zero critical/serious violations, plus a manual keyboard-only pass covering the gaps in §13, run once per theme (light and dark) for contrast-dependent checks.

## 24. Setup, Development, and Build

```bash
pnpm install                 # install all workspace packages
pnpm dev                     # run the app locally (apps/web)
pnpm lint                    # ESLint across the workspace
pnpm typecheck               # TypeScript strict-mode check across the workspace
pnpm test                    # unit + component tests (Vitest)
pnpm test:e2e                # end-to-end tests (Playwright)
pnpm build                   # production build
```

Recommended `tsconfig` strictness: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. Recommended CI gate: lint → typecheck → unit → component → build → e2e, blocking merge on any failure.

## 25. CI/CD Pipeline

A standard PR-gated pipeline: install → lint + typecheck → unit tests → component tests → production build → e2e tests → merge allowed only if every stage is green. Deployment (to a managed platform or company-controlled infrastructure) is a separate, later decision — v1 has no server-side network-reachability requirement either way, since the fetch feature runs in each end user's own browser, not on the deployment host.

## 26. Environment Variables & Configuration

v1's environment surface is intentionally tiny, since there is no backend:

```
NEXT_PUBLIC_APP_ENV=development|preview|production
SENTRY_DSN=                     # client-side error tracking (optional but recommended)
```

Everything else (a future fetch-proxy's allow-list/timeout/size-cap config, a database URL, an auth secret) is future-scope only and should not be added speculatively.

## 27. Security Considerations

- Use the framework's default output escaping (e.g. React's JSX escaping) instead of manually building HTML strings — a strict, compiler-enforced improvement over the artifact's manual escaping approach.
- Validate environment variables at build/startup time; never commit or log secrets.
- Apply standard security headers (CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, HSTS) to the deployed frontend regardless of the backend decision.
- Because v1 has no server-side fetch, there is no new server-side attack surface to defend — the client-side `fetch()` is subject to exactly the same same-origin/CORS policy the artifact already has today. This is an accepted, unchanged risk profile, not a regression.
- Never send actual JSON payload content or note text to an error tracker's breadcrumbs/context — only sizes/shapes and the action being performed, since real usage will plausibly involve customer-identifying data (the sample payload already models this).

## 28. Deployment Options

Two reasonable options, both fully compatible with the architecture above — the choice matters far less for v1 (which is backend-free) than it would if a future backend is ever built:

- **A managed platform** (e.g. Vercel-style): fastest to stand up, free preview environments per PR, but a third-party host.
- **Company-controlled infrastructure** (containerized, deployed to existing internal platform): more setup, but keeps everything inside existing network boundaries — relevant mainly if a future backend needs to reach intranet-only APIs, which is moot for v1's client-side fetch.

## 29. Phased Implementation Plan

A recommended build order, sequenced so lower phases unblock higher ones without propagating errors upward:

1. **Foundation.** Stand up the monorepo (app package + a separate framework-free diff-engine package), TypeScript strict config, linting, CI skeleton. No feature logic yet.
2. **Core logic (no UI, no backend).** Port every pure algorithm — canonicalization, Missing Fields/Differences diffing, Structure Schema Compare, the F-017 key-alignment transform (`align-for-display.ts`, including its own non-interference test against the diff functions — see §23), the ignore-path matcher, the curl parser, the line-map builder, the Markdown report builder, and the `FetchExecutor` interface with its `BrowserFetchExecutor` implementation — fully typed and unit-tested in isolation, before any UI depends on them. Preserve every Known Quirk (§8) with a code comment pointing back to this document, pending the relevant decision.
3. **Core features (UI), in dependency order:**
   - 3.1 Input panels (paste/type, prettify, find, gutter, file upload).
   - 3.2 Curl/URL fetch into panels (wired to the `FetchExecutor` from step 2).
   - 3.3 Tree view and the JSON/Tree tab switch.
   - 3.4 Ignore Paths UI (wired to the pure logic from step 2).
   - 3.5 Compare trigger and the three result sections (Summary, Missing Fields, Structure, Differences), composed with collapsible behavior.
   - 3.6 Highlighting, minimap, gutter indicators, scroll-aware pills — including the direction-aware Missing Fields color split (F-008); move Compare execution into a Web Worker at this point.
   - 3.7 Export (Markdown report UI, wired to the pure report builder from step 2).
   - 3.8 Sample data, reset, scroll-to-top, Aligned JSON Comparison (F-017, wired to `align-for-display.ts` from step 2), the Theme Toggle (F-018), and the shared status element.
4. **(Conditional, not part of the baseline) Persistence module** — only if a real product decision adopts saved/shared comparisons; otherwise skip entirely.
5. **Testing.** Close any coverage gaps left after the incremental unit tests already required in step 2; add end-to-end coverage for the three cross-feature flows (§3); add automated accessibility checks; cross-browser pass; a large-payload performance test.
6. **Production readiness.** Error boundaries per major section; wire error tracking end-to-end (verify no payload content ever reaches it); security headers; a dependency vulnerability scan; verify load-performance targets under a production build; verify the payload-size guard shows a clear message rather than freezing the tab.
7. **Deployment.** Choose a hosting target (§28); wire the CI/CD deploy stage; document the rollback procedure.

**Standing rule across every phase:** if implementation surfaces a behavior in the artifact that this document doesn't cover, or a genuine ambiguity, stop and get an explicit decision rather than deciding it inline in code — this specification was built on a "do not invent missing behavior" principle, and that constraint extends to implementation, not just documentation.

## 30. Acceptance Criteria — Definition of Done for v1

- Every feature and sub-feature in Part 1 (§2–§4) has its documented acceptance criteria satisfied and covered by at least one automated test.
- Every Known Quirk (§8) has a recorded fix-or-preserve decision — not a silent choice made during coding.
- The diff-engine package has ≥90% line coverage and zero framework/DOM coupling (enforceable via a lint rule).
- F-017's non-interference test (§23) passes for every diff-engine fixture — proving alignment never changes a comparison result.
- F-018's theme toggle passes its default/switch/persist tests, and the automated accessibility audit's contrast checks pass in both light and dark themes.
- The `FetchExecutor`'s `BrowserFetchExecutor` is unit-tested against a mocked `fetch` for the success, non-2xx, non-JSON, and thrown-error (CORS-equivalent) cases.
- An automated accessibility audit passes with zero critical/serious violations on the main screen.
- CI blocks merge on lint/typecheck/unit/component/e2e failure.
- A deliberately-triggered client-side error is verified to appear in the error tracker with no payload content, in a staging environment.
- The production build is reachable over HTTPS with standard security headers present.
- Every open product question this document surfaces (the Known Quirks in §8, the optional improvements in §16) has either a documented answer or an explicit "deferred, tracked as ticket X" note before the phase it would block begins.

## 31. Open Questions Requiring a Product Decision (not answered by this document on purpose)

This document deliberately does not invent answers to questions the artifact's own behavior doesn't settle and the requester hasn't specified. Each should be resolved explicitly before or during the relevant implementation phase:

1. **Should the app require user accounts, or stay a no-login, anyone-with-the-link tool (matching the artifact)?** Affects whether any auth boundary is built at all.
2. **Is a persistence module (saved/shared comparisons, saved ignore-path presets) actually wanted**, or is the artifact's fully stateless, per-session model intentional and sufficient?
3. **Hosting target:** a managed platform vs. company-controlled infrastructure.
4. **Each of the four Known Quirks in §8:** fix, or preserve for byte-for-byte behavioral parity?
5. **Should the sample payload (F-015) be made fully generic/non-brand-specific?** Purely cosmetic.
6. **CI/CD platform** and **existing design-system/component-library standard** (if any) the organization already uses, which this build should adopt instead of a fresh setup.
7. **Where should error/observability data land** — a new tracking project, or an existing company observability backend?
8. **What condition would actually justify building the deferred backend layer** (§22)? Candidates: a security review flags the client-side fetch as unacceptable for production; a real user need for saved/shared comparisons emerges; a target API the tool must reach only works from a server network location. Building it speculatively, with no driving need, is exactly the kind of scope creep this document avoids.

---

## Appendix A — Glossary

- **Panel A / Panel B (Response A / Response B):** the two independent JSON input areas being compared. A is always the baseline for Structure Schema Compare.
- **Missing Fields:** fields present in exactly one of A/B.
- **Differences:** fields present in both A and B with different values.
- **Structure Schema Compare:** a presence-only (never value/type) comparison of array-item shape against A's first item as the baseline.
- **Ignore Paths:** user-supplied patterns that suppress matching findings from every result view and all highlighting.
- **Canonical form:** a recursively-sorted string representation of a value, used to pair array items across A/B independent of their index.
- **FetchExecutor:** the interface boundary that lets the fetch feature's implementation be swapped (direct browser fetch today, a server-side proxy later) with zero change to any calling code.
- **Aligned display (F-017):** the object-key-only reordering applied to each panel's *displayed* text so shared fields line up visually between A and B; never applied to array element order, and never fed into the diff algorithms — display-only, by design.
- **Direction-aware highlight color (F-008):** the Missing Fields category's two colors — red in Response A (present in A, missing from B) and green in Response B (present in B, missing from A) — both still controlled by the single Missing Fields toggle.
- **Theme override (F-018):** the user's explicit Light/Dark choice, stored client-side and applied via a `data-theme` attribute; absent by default, in which case the app follows `prefers-color-scheme`.

## Appendix B — Related Documents

The detailed working analysis this README consolidates remains available in this `docs/` folder for deeper traceability (requirement IDs, mermaid diagrams, full package-by-package rationale):

- `SRS.md` — the formal FR-xxx/NFR-xxx requirement statements and the canonical open-questions register.
- `FEATURES.md` — the original exhaustive feature inventory this README's Part 1 is drawn from, including a full feature-coverage traceability matrix.
- `ARCHITECTURE.md` — full system architecture, diagrams, package responsibility map, and the artifact-function-to-new-module migration table.
- `TECH_STACK.md` — the complete technology-decision rationale, alternatives considered, and trade-offs for every package in Part 3.
- `IMPLEMENTATION_PLAN.md` — the fully detailed, phase-by-phase build plan (this README's §29 is a condensed version of it).
