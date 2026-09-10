# FEATURES.md — Exhaustive Feature Inventory

**Project:** JSON Response Comparer — standalone, production-ready conversion
**Source artifact:** single-file HTML/CSS/JS Cowork artifact (`json-response-comparer`), fully read line-by-line (all ~2,629 lines) across this analysis — not inferred from the rendered UI alone.
**Companion docs:** `SRS.md` (FR-xxx/NFR-xxx requirements this inventory is derived from and cites back to), `ARCHITECTURE.md`, `TECH_STACK.md`, `IMPLEMENTATION_PLAN.md`
**Status:** Specification — implementation has not started

> **How to read this document.** Every feature (`F-00X`) is documented with the full template (definition, entry conditions, user flow, UI behavior, data, business logic, validation, states, edge cases, dependencies, acceptance criteria). Sub-features (`F-00X.Y`) are documented compactly in a per-feature table, because most of their entry conditions/data/dependencies are inherited directly from the parent feature — repeating the full nine-part template for all ~70 sub-features would balloon this document without adding traceability; the table format still gives every sub-feature its own ID, behavior summary, edge cases, and acceptance criteria, which is what the Feature Coverage Matrix (§17) keys off. Edge cases marked **⚠ ARTIFACT QUIRK** are real behaviors or bugs found by reading the artifact's actual logic, not just its visible UI — see §16 for why each matters and whether it should be fixed or preserved.

---

## Feature index

| ID | Name |
|---|---|
| [F-001](#f-001--dual-json-input-panels) | Dual JSON Input Panels |
| [F-002](#f-002--json-tree-view) | JSON Tree View |
| [F-003](#f-003--add-data-modal) | Add Data Modal |
| [F-004](#f-004--curl-command-parsing) | Curl Command Parsing |
| [F-005](#f-005--fetch-execution) | Fetch Execution |
| [F-006](#f-006--ignore-paths) | Ignore Paths |
| [F-007](#f-007--compare-engine) | Compare Engine |
| [F-008](#f-008--highlighting-system) | Highlighting System |
| [F-009](#f-009--results-summary) | Results Summary |
| [F-010](#f-010--missing-fields-section) | Missing Fields Section |
| [F-011](#f-011--structure-schema-compare-section) | Structure Schema Compare Section |
| [F-012](#f-012--differences-section) | Differences Section |
| [F-013](#f-013--collapsible-result-sections) | Collapsible Result Sections |
| [F-014](#f-014--markdown-export) | Markdown Export |
| [F-015](#f-015--sample-data--reset) | Sample Data / Reset |
| [F-016](#f-016--miscellaneous-ui) | Miscellaneous UI |

---

## F-001 — Dual JSON Input Panels

**Purpose / user problem:** The user needs to get two JSON payloads (Response A, Response B) into the tool by whatever means is convenient — typing, pasting, uploading a file, or fetching live from an API — and then read/edit them comfortably, including in large, deeply-nested documents.
**Related requirements:** FR-001, FR-002, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009

**Entry conditions:** App loaded; no data or prior compare required. Each panel (A, B) is independent and always available.

**User flow:**
1. User action: click/focus into the Response A or B text area → paste or type JSON.
   Processing: none until Prettify or Compare is triggered (raw text is held as-is).
   State change: panel's raw text updates; gutter line count recalculates.
   UI response: gutter renumbers; if the Tree tab is active, tree re-parses on every keystroke (see F-002).
2. Alternative entry: user clicks "Add" → Add Data Modal (F-003) → file upload or curl/URL fetch (F-005) → panel populated.
3. User clicks "Prettify" → text re-indented via `JSON.stringify(parsed, null, 2)` if valid, else an inline error naming the parse failure.

**UI behavior:**
- Two side-by-side panels (stacked on narrow viewports), each with: a label, "Find," "Prettify," and "Add" buttons in the panel header; a JSON/Tree tab pair; the editor itself; and (once a fetch has run) a persistent inline curl bar.
- The editor has a synced line-number gutter that scrolls with the text area and renumbers on every input/resize.
- Gutter/editor also carries the diff highlight overlay described in F-008 once a compare has run.

**Data:**
- Input: raw text (unconstrained; not required to be valid JSON until Compare/Prettify is invoked).
- Output/derived: parsed JSON value (on successful Prettify/Compare), a per-panel line→path map (F-007.4) used by result-row line tags.
- Nothing persists beyond the current session in the baseline (no-persistence) scope — see `SRS.md` §15.2.

**Business logic & validation:**
- Prettify: `JSON.parse` then `JSON.stringify(_, null, 2)`. **⚠ ARTIFACT QUIRK:** Prettify on an empty panel is a silent no-op (`if (!raw) return null` before any status message) — no error, nothing happens. This must be preserved deliberately, not "fixed" into an error message, unless a product decision says otherwise (see `SRS.md` §15 open questions).
- Compare (F-007) also re-prettifies both panels **in place** as a side effect — the visible text in each panel changes to the pretty-printed form even though the user's original formatting is otherwise irrelevant to the diff. This is a real, visible behavior (not just an implementation detail) and must be preserved for parity.

**Application states:**
| State | Trigger | UI |
|---|---|---|
| Empty | Initial load / after Clear | Placeholder text shown (`{"status":"ok","data":{"amount":100}}` style example) |
| Populated, unvalidated | User has typed/pasted/uploaded/fetched text | Gutter shows line numbers; no parse attempted yet |
| Valid, prettified | Prettify or Compare succeeded | Text reformatted; no error shown |
| Invalid | Prettify or Compare attempted on unparsable text | Inline error naming the panel and the `JSON.parse` error message; text is left untouched (not partially reformatted) |

**Edge cases:**
- Extremely large payloads: no client-side size guard exists in the artifact today — a genuinely huge paste can degrade textarea/gutter responsiveness. `SRS.md` NFR-003 proposes a 5 MB guard as a **new** requirement for the standalone build, not present in the artifact.
- Pasting non-JSON text is allowed (no immediate validation) — only surfaces as an error when Prettify/Compare is clicked.
- **⚠ ARTIFACT QUIRK:** If only one of A/B is empty when Compare is clicked, the error message ("Paste both responses before comparing.") does not say *which* panel is empty.

**Dependencies:** F-002 (Tree tab shares the same underlying raw text), F-003/F-005 (alternative population routes), F-007 (Compare consumes and mutates panel text), F-008 (highlight overlay renders into this component).

**Acceptance criteria:**
- [ ] Typing/pasting into either panel updates that panel only, immediately, with no lag perceptible to the user for payloads under 1 MB.
- [ ] Prettify on valid JSON reformats to 2-space-indented `JSON.stringify` output; on invalid JSON, shows the specific parser error and panel name, and does not alter the panel's text.
- [ ] Prettify on an empty panel does nothing (no error, no state change).
- [ ] Gutter line numbers always match the visible text exactly, including after paste, upload, fetch, prettify, and manual edits.

### Sub-features

| ID | Name | Behavior | Edge cases | Acceptance criteria |
|---|---|---|---|---|
| F-001.1 | Direct paste/type | Freeform text entry into a `<textarea>`-equivalent; no character limit enforced client-side today. | Pasting extremely long single lines (no newlines) still renders correctly if soft-wrap is supported (see F-001.8). | Text entered appears exactly as typed/pasted, with no transformation until Prettify/Compare. |
| F-001.2 | File upload | Via Add Data Modal (F-003.1): `FileReader.readAsText`, `.json`/`.txt`/`text/plain` accept hint (not enforced). | Binary file upload renders garbled text with no explicit error; empty file yields an empty panel. | Selecting a valid `.json` file replaces the target panel's content exactly with the file's text content. |
| F-001.3 | Curl/URL fetch into panel | Via Add Data Modal (F-003.2) or the persistent inline curl bar (F-001.7\*, cross-listed) — see F-004/F-005 for parsing/execution details. | See F-005 edge cases (client-side, CORS-limited in both the artifact and the v1 standalone build — no server-side proxy in v1). | Successful fetch replaces panel content with the pretty-printed (if JSON) or raw (otherwise) response body, and shows the HTTP status. |
| F-001.4 | Prettify | Re-indents valid JSON in place; see Business logic above for the empty-input no-op quirk. | See parent Edge Cases. | See parent Acceptance criteria. |
| F-001.5 | In-panel Find | Case-insensitive substring search within the panel's raw text; next/prev navigation; match count display (`i/N`); Enter = next, Shift+Enter = previous, Escape = close. Input retains focus while typing (does not steal focus to the textarea mid-keystroke). | Zero matches shows `0/0` and tints the input red; search term persists per-panel while the bar is open. | Typing a search term highlights/selects the first match in the panel and scrolls it into view; Next/Prev cycle through all matches including wraparound. |
| F-001.6 | JSON/Tree tab switch | Toggles which of the two views is visible for that panel; switching to Tree re-parses the current raw text fresh every time. | Switching to Tree on invalid JSON shows a tree-panel error state (F-002), not a silent blank. | The correct view is visible after each click; the hidden view's controls (e.g., Find bar) are hidden, not just visually covered. |
| F-001.7 | Persistent inline curl bar | Appears only after a fetch has populated the panel (from either the modal or this bar itself); pre-filled with the curl/URL text used; editable; Ctrl/Cmd+Enter re-runs it; a close (×) button hides it (does not clear panel content). | Editing the curl text without pressing Go/Ctrl+Enter has no effect — plain Enter is reserved for multi-line editing, matching curl commands that span lines. | Editing and re-running the curl bar re-fetches and replaces the panel's content, and updates the status line with the new result. |
| F-001.8 | Line-number gutter (soft-wrap aware) | Measures each logical line's rendered visual-row height (via a hidden mirror element matching the textarea's font metrics and wrap width) so a long, wrapped line still gets exactly one gutter number, with blank continuation rows beneath it. Recomputes on input, window resize, and textarea resize (`ResizeObserver`). | A line consisting only of whitespace still gets a gutter number (uses a non-breaking space during measurement to avoid collapsing to zero height). | Gutter numbers stay correctly aligned with their text row at any zoom level, panel width, or after a wrapped line is edited to no longer wrap (or vice versa). |
| F-001.9 | Minimap overview | A slim, fixed-height strip to the right of the editor showing proportionally-positioned markers for every currently-highlighted line across the *entire* document (not just the visible viewport); clicking a marker scrolls that line to view-center. | With zero highlights (no compare run, or all categories toggled off), the strip renders empty. | Every highlighted line in F-008 has a corresponding, correctly-positioned, clickable marker in the minimap regardless of scroll position. |
| F-001.10 | Gutter diff indicators | Small colored bars on the gutter's right edge, one per highlighted line, scroll-synced with the gutter itself (unlike the minimap, which is scroll-independent); clicking scrolls that line into the top third of the viewport. | Two indicators for adjacent lines render distinctly (not merged) down to a 3px minimum height. | Clicking a gutter indicator scrolls the corresponding line into view within the same panel. |
| F-001.11 | Scroll-aware "N more above/below" pills | Floating pills at the top/bottom of the editor (and, separately, of the Tree view) reporting how many highlighted lines/nodes are currently scrolled out of view in that direction, with small category-colored dots; clicking jumps to the nearest one in that direction. Recomputed on scroll, on highlight-toggle change, and after every Compare. | With all highlights currently on-screen, neither pill is shown. | Scrolling away from a highlighted line makes the correct pill appear with an accurate count and category dots; clicking it jumps to the next off-screen highlight in that direction, not an arbitrary one. |

---

## F-002 — JSON Tree View

**Purpose / user problem:** Raw indented JSON is hard to scan for structure in a deeply nested payload; a collapsible tree lets the user explore shape without losing their place, and shows the same diff highlighting as the raw JSON view.
**Related requirements:** FR-010, FR-011

**Entry conditions:** A panel has non-empty text and its Tree tab is selected (F-001.6).

**User flow:**
1. User clicks the "Tree" tab for a panel → current raw text is parsed fresh.
2. Success: a fully-expanded, collapsible node tree renders (every `<details>` node defaults `open`).
3. User clicks a node's disclosure triangle → that subtree collapses/expands independently of siblings.
4. If a compare has run and a highlight category is on, matching nodes are visually flagged (F-008.5) and a navigation strip appears (F-008.6).

**UI behavior:**
- Objects render as `{ N field(s) }` with an expandable list of `key: value` children; arrays as `[ N item(s) )]` similarly; empty object/array render inline as `{}`/`[]` with no expander.
- Leaf values are type-styled (string/number/boolean/null get distinct colors, matching the same category colors used for JSON highlighting so the tool reads as one system).
- A vertical navigation strip (proportional dot markers) appears on the right edge of the tree container only when there's at least one highlight to show.

**Data:** Input is the panel's current raw text, re-parsed on every keystroke while the Tree tab is active (not cached) and on every tab switch to Tree. No separate data model beyond the parsed JSON value itself plus the highlight map from F-008.

**Business logic & validation:**
- Empty raw text → "Nothing to show yet — paste or load JSON on the JSON tab first."
- Invalid JSON → shows the specific `JSON.parse` error message inline, styled as an error, instead of a tree.
- Every node and leaf carries a canonical dot/bracket path (e.g., `config.partner.id`, `tags[0]`) used both for `data-path` highlighting lookups and (implicitly) matching the same path notation the diff engine and ignore-path matcher use elsewhere.

**Application states:** Empty (no input) · Error (invalid JSON) · Rendered (valid JSON, all nodes default-expanded) · Highlighted (rendered + one or more highlight categories active).

**Edge cases:**
- Re-parsing on every keystroke (rather than only on tab-activation) means typing while the Tree tab happens to be active re-renders the whole tree per character — a real performance consideration for large documents, not just a hypothetical; the standalone build should debounce or defer this (flagged for the implementation plan, not silently fixed without note).
- A tree with thousands of nodes has no virtualization in the artifact — acceptable for typical payloads, a stated risk for very large ones (see `SRS.md` NFR-003).

**Dependencies:** F-001 (shares raw text with the JSON tab), F-008 (highlight categories drive node styling + nav strip).

**Acceptance criteria:**
- [ ] Switching to the Tree tab on valid JSON renders a fully expanded, accurate structural mirror of the parsed value.
- [ ] Collapsing a node hides only its descendants, not siblings.
- [ ] Invalid JSON shows the parser's exact error message, not a generic failure.
- [ ] Highlighted nodes visually match the same categories/colors as the JSON view's line highlights for the same path.

### Sub-features

| ID | Name | Behavior | Edge cases | Acceptance criteria |
|---|---|---|---|---|
| F-002.1 | Recursive expand/collapse | Native disclosure-widget semantics per node, independent state per node. | Deeply nested (10+ levels) structures still render and collapse correctly. | Expand/collapse state is per-node and doesn't reset on an unrelated re-render (e.g., a sibling's highlight toggling). |
| F-002.2 | Type-aware leaf styling | string/number/boolean/null each get a distinct, theme-aware color. | `NaN`/`Infinity` don't occur (not valid JSON) — no special-case needed. | Each leaf type is visually distinguishable at a glance, consistent between light/dark themes. |
| F-002.3 | Empty object/array display | Renders `{}`/`[]` inline, no expander shown. | An array containing only empty objects (`[{}, {}]`) still shows a real expander (has 2 items) even though each item is itself an empty-object leaf. | `{}` and `[]` never show a (non-functional) disclosure triangle. |
| F-002.4 | Tree node highlighting | Adds category-colored background/outline to the node matching a highlighted path. | A node whose *path* matches a highlight but whose *displayed* key differs due to array reindexing (see F-007 edge cases) may fail to highlight — inherits the same underlying path-matching limitation. | Every leaf/branch whose exact path appears in the current highlight map is visually flagged. |
| F-002.5 | Tree navigation strip | Proportional clickable dots on the tree's right edge; click scrolls the node to center. | Strip is absent (not just empty) when there are zero highlights. | Clicking a nav-strip dot scrolls the corresponding node into the vertical center of the tree viewport. |
| F-002.6 | Tree scroll indicators | Same "N more above/below" pill pattern as F-001.11, scoped to the Tree view. | Only rendered while the Tree tab is the active view. | Matches F-001.11's acceptance criteria, scoped to tree nodes instead of gutter lines. |

---

## F-003 — Add Data Modal

**Purpose / user problem:** A single, consistent entry point for "get data into this panel" regardless of source (local file vs. live API), rather than separate disconvnected controls.
**Related requirements:** FR-002, FR-012

**Entry conditions:** User clicks the "Add" button on either panel's header.

**User flow:**
1. User clicks "Add" on Response A or B → modal opens, titled "Add data to Response A/B", target panel remembered for the session of the modal being open.
2. User either (a) picks a local file, or (b) pastes a curl command/URL into the modal's fetch field and clicks "Go" (or Ctrl/Cmd+Enter).
3. On file selection: content loads immediately and the modal closes.
4. On fetch: modal shows in-progress status; on success, closes automatically and leaves the persistent inline curl bar (F-001.7) visible in the target panel; on failure, modal stays open showing the error so the user can correct and retry.

**UI behavior:** Backdrop-dimmed centered dialog; close via the × button, clicking the backdrop, or Escape; two clearly divided sections ("Upload a file" / "or" / "Paste a curl command or URL") within one modal rather than separate modals.

**Data:** Ephemeral — file contents or fetch response are written directly into the target panel's state; the modal itself holds no persistent data.

**Business logic & validation:** No file-type validation beyond the `accept` attribute hint (browser-enforced only, not app-enforced); no URL validation before submit — the request is simply attempted client-side (F-005), and a rejection (a non-2xx response, a network error, or a CORS failure) surfaces through the modal's existing error messaging. *(Future scope only, not v1: if the backend layer is built, a blocked-host rejection would instead come back from the server-side proxy — same UI handling, different source.)*

**Application states:** Closed · Open (idle) · Open (fetch in progress, Go button disabled) · Open (fetch failed, error shown, retry available) · Closed (success).

**Edge cases:**
- Opening the modal for panel A, then closing without action, then opening for panel B correctly retargets — the "currently targeted panel" state must not leak between the two.
- Rapid double-click on "Go" — the artifact disables the Go button for the duration of the in-flight request, preventing duplicate submissions.

**Dependencies:** F-001 (writes into a panel), F-004 (parses the modal's curl input), F-005 (executes it).

**Acceptance criteria:**
- [ ] The modal always opens targeting the panel whose "Add" button was clicked, shown correctly in its title.
- [ ] Escape, backdrop click, and the × button all close the modal without side effects when idle.
- [ ] A successful file upload or fetch closes the modal and updates the correct panel; a failed fetch keeps the modal open with a specific error message.

### Sub-features

| ID | Name | Behavior | Edge cases | Acceptance criteria |
|---|---|---|---|---|
| F-003.1 | File upload leg | `<input type="file">` + `FileReader.readAsText`; on load, writes to target panel, refreshes gutter/tree, shows a success status, closes modal. | `FileReader` error (unreadable file) shows the reader's error message and does not close the modal. | Selecting a file always either populates the panel and closes the modal, or shows a specific read error and stays open. |
| F-003.2 | Curl/URL fetch leg | Multi-line textarea input; "Go" button and Ctrl/Cmd+Enter both submit. | Submitting an empty field shows "Enter a URL or a curl command first." and does not attempt a request. | Submitting valid input always results in either a populated panel + closed modal, or a specific, visible error with the modal still open. |

---

## F-004 — Curl Command Parsing

**Purpose / user problem:** Engineers routinely copy "Copy as cURL" from browser DevTools when debugging an API call; pasting that directly (instead of manually re-extracting the URL/headers/method) is the actual workflow this feature optimizes for.
**Related requirements:** FR-013

**Entry conditions:** Any text has been entered into a curl/URL input (modal or inline bar) and submission (Go / Ctrl+Enter) is triggered. Parsing itself is a pure, client-side, synchronous function — no network access.

**User flow:** User pastes text → `parseCurlCommand(input)` runs synchronously → returns `{url, method, headers, body}` or `null` (empty input) → consumed by F-005's execution step.

**UI behavior:** N/A directly (this is a pure parsing step with no UI of its own) — its output/failure surfaces through F-003/F-005's status messaging.

**Data:**
- Input: raw pasted string.
- Output: `{ url: string, method: 'GET'|'POST'|..., headers: Record<string,string>, body: string|null }`, or `null` for empty input.

**Business logic & validation (exact rules, ported from the artifact):**
- If the trimmed input doesn't start with `curl` (case-insensitive), it's treated as a bare URL: `{url: trimmed, method: 'GET', headers: {}, body: null}`.
- Otherwise, tokenizes shell-style, respecting single/double-quoted strings, with backslash-escaped double quotes supported *inside double-quoted strings only* (single-quoted strings do not support any escaping — a real, current limitation, see Edge Cases).
- Recognized flags: `-X`/`--request` (method), `-H`/`--header` (adds one header, split on first `:`), `-d`/`--data`/`--data-raw`/`--data-binary`/`--data-ascii` (appends to body, joining multiple with `&`), `-u`/`--user` (sets `Authorization: Basic <base64(value-as-given)>` — **does not** insert a missing `:` if the value isn't already `user:pass`), `-A`/`--user-agent` (sets `User-Agent` header), `-b`/`--cookie` (sets `Cookie` header).
- No-op flags consumed with no argument: `--compressed`, `-s`/`--silent`, `-k`/`--insecure`, `-L`/`--location`, `-v`/`--verbose`.
- Method defaults to `POST` if a body was set, else `GET`, unless explicitly overridden by `-X`.
- The first non-flag token is taken as the URL, but only if a URL hasn't already been set (`!url` guard).

**Application states:** N/A (pure function; success = valid parse result, "failure" = empty-input `null`, which the caller turns into a status message).

**Edge cases (found by reading the tokenizer/flag-loop logic, not just observing the UI):**
- **⚠ ARTIFACT QUIRK — real bug:** the comment above the "unknown flag" branch says the code should "skip it, and skip its value if it looks like one wasn't already consumed" — but the actual code for an unrecognized flag (`tok.startsWith('-')`) does **nothing**, including not skipping that flag's value token. If that value token doesn't itself start with `-`, the *next* loop iteration's `else if (!url) url = tok` branch will incorrectly capture it as the URL — silently discarding the real URL that appears later in the command. Example: `curl --foo bar https://example.com` parses `url = "bar"`, not `https://example.com`. This is a genuine parsing defect inherited from the artifact, not a hypothetical — see `SRS.md` §15 open question on whether to fix it (recommended) or preserve it for byte-for-byte behavioral parity.
- Single-quoted strings do not support escaping at all (`'it\'s'` inside a single-quoted argument will terminate the string early at the unescaped `'`), while double-quoted strings do support `\"` — an intentional-looking asymmetry worth preserving as-is (it matches a common, if incomplete, simplification of real shell quoting) unless product direction says to fully match shell semantics.
- `-u user` with no colon produces `Authorization: Basic <base64("user")>`, which is not a valid Basic-auth value per RFC 7617 (which requires `user:password`) — preserved as-is; flagged as a known limitation, not silently "corrected" to insert a colon (that would be inventing behavior the artifact never had).

**Dependencies:** Consumed by F-003.2 and F-001.7; feeds F-005.

**Acceptance criteria:**
- [ ] A bare URL (no `curl` prefix) parses to a GET request with no headers/body.
- [ ] Method, headers, body, Basic auth, User-Agent, and Cookie all parse correctly from a realistic "Copy as cURL" command (verified against a real DevTools-copied example as a fixture).
- [ ] The unknown-flag URL-swallowing bug (above) is either fixed (with a regression test proving `curl --foo bar https://example.com` now resolves to `https://example.com`) or explicitly, deliberately preserved — this must be a recorded decision, not an accident either way.

---

## F-005 — Fetch Execution

**Purpose / user problem:** Actually perform the parsed request and get its response body into the target panel. **Decision (superseding this document's earlier draft):** the standalone v1 build keeps this entirely client-side, matching the artifact's own model exactly — no server-side proxy is built for v1. A server-side proxy remains a designed, documented future option (`ARCHITECTURE.md` §3.10/§4, `SRS.md` §2.9/§15.12) behind a swappable interface, but it is not part of what ships now.
**Related requirements:** FR-003 (v1); FR-044/FR-045 (deferred — future scope only)

**Entry conditions:** F-004 has produced a non-null result with a non-empty `url`.

**User flow (artifact, and v1 standalone build — identical):**
1. Browser calls `fetch(url, {method, headers, body})` directly from the page, via the `FetchExecutor` interface's v1 implementation (`ARCHITECTURE.md` §3.10) — a thin wrapper with no added logic, kept only so the call site never talks to the browser `fetch` API directly and can be redirected to a server-backed implementation later with no caller changes.
2. Response text is read; if it parses as JSON, it's pretty-printed into the target panel; otherwise the raw text is inserted as-is.
3. Status line shows `Fetched <status> <statusText> into Response A/B.` (success class) or `Server responded <status> <statusText> — body loaded into Response A/B anyway.` (error class, but the body is still shown) or, on a thrown exception (typically CORS), `Fetch failed: <message>. This is usually a CORS restriction...`.

**Future scope only, not built for v1 (`SRS.md` §2.9/§15.12):** if the deferred backend layer is adopted, the same `FetchExecutor` interface gets a second implementation that calls `POST /api/fetch-proxy` instead of the browser's `fetch()` — the client sends `{url, method, headers, body}` to that endpoint and receives back `{status, statusText, bodyText, isJson}` or a typed error, rendered through the exact same UI code path described above. No component above the `FetchExecutor` boundary needs to change when this happens.

**UI behavior:** Status text appears in the modal (if fetched from there) or the inline curl bar's own status line (if re-run from there); the Go button is disabled for the duration of the request either way.

**Data:** Request: method/headers/body from F-004. Response: HTTP status/statusText/body text, read directly from the browser's `Response` object in v1.

**Business logic & validation:**
- A non-2xx HTTP response is **not** treated as a failure for the purpose of populating the panel — the body is shown regardless, with the status communicated separately. This is a deliberate, useful behavior (seeing a 4xx/5xx error body is often exactly what the user is debugging) and must be preserved.
- JSON-ness is detected by attempting `JSON.parse` on the response text, not by trusting the `Content-Type` response header (a response that says `text/plain` but is valid JSON is still pretty-printed).

**Application states:** Idle · In-flight (Go disabled, "Fetching into Response A/B..." shown) · Success (2xx or non-2xx, body loaded either way) · Network/CORS failure (v1: the same client-side limitation the artifact has today — a target without permissive CORS headers fails, and the UI says so explicitly). *(Future scope only, not v1: a proxy-side blocked-host/timeout/oversized-response error class, and an SSRF-policy-blocked state — see `SRS.md` §2.9.)*

**Edge cases:**
- **v1 accepts the artifact's own CORS limitation as-is, by decision, not by oversight.** A target API without permissive CORS headers cannot be reached from the browser in v1 — exactly as in the artifact today. This is documented and accepted, not silently worked around; if a real workflow needs it fixed, that is the trigger condition tracked in `SRS.md` §15.12 for building the deferred server-side proxy, whose whole purpose is removing this exact limitation by changing the request's network origin.
- Because v1 has no server-side proxy, there is no server-side redirect-handling, size-cap, or timeout requirement for this feature — the browser's own `fetch()` defaults apply, identical to the artifact's current behavior. These protections are fully specified for if/when the future-scope implementation is built (`SRS.md` §2.9's FR-044/FR-045), but are out of scope for v1's acceptance criteria below.
- Extremely large response bodies: bounded only by browser memory, matching the artifact exactly — no new cap is introduced in v1 (a server-side size cap is a future-scope-only concern, since only a server request can be "tied up" by a slow/huge response; a client-only fetch only affects the user's own tab, same as today).

**Dependencies:** F-004 (provides the parsed request), F-003/F-001.7 (UI entry points), `ARCHITECTURE.md` §3.10 (the `FetchExecutor` interface and its v1/future implementations).

**Acceptance criteria:**
- [ ] A successful fetch of a JSON-returning endpoint pretty-prints the body into the target panel and shows the HTTP status.
- [ ] A successful fetch of a non-JSON-returning endpoint inserts the raw text body, not an error.
- [ ] A non-2xx response still loads its body into the panel while clearly communicating the non-success status.
- [ ] A cross-origin target without permissive CORS headers fails with the artifact's existing "usually a CORS restriction" message — this is an accepted v1 limitation, not a bug to chase.
- [ ] *(Future scope only, not part of v1 acceptance)* If the backend layer is built: a request to a blocked-by-policy host is rejected before any outbound network call, and a request that never completes within the configured timeout surfaces a specific timeout error.

---

## F-006 — Ignore Paths

**Purpose / user problem:** Real API responses often contain fields that are expected to differ (timestamps, request IDs, per-partner theming values) — the user needs to say "don't tell me about these" once, and have it apply everywhere in the tool consistently and immediately.
**Related requirements:** FR-014, FR-015

**Entry conditions:** Any time; independent of whether a compare has run yet (patterns are stored/edited regardless, but only visibly affect anything once results exist).

**User flow:**
1. User types a comma-separated pattern list into the Ignore Paths field.
2. On every keystroke (if a compare has already run — `hasCompared` gate), the app re-filters Missing Fields, Structure Schema Compare, Differences, and re-renders both panels' highlight overlays and tree highlights — **without** re-running Compare itself.

**UI behavior:** Single field with inline help text and a placeholder showing example patterns (already revised, in an earlier session, to lead with generic examples — `user.password`, `items.*.internalId`, `metadata.*` — alongside the original partner-config example, for clarity to readers unfamiliar with this specific app's domain).

**Data:** A single raw string, split on commas and trimmed into a pattern list (`parseIgnorePatterns`); no structure beyond that in the baseline (no-persistence) scope. The optional persistence module (`SRS.md` §4.8) proposes named, reusable presets — not part of the artifact's own behavior, called out explicitly as a **should-have**, not baseline.

**Business logic & validation (exact matching rules):**
1. A pattern with no wildcard matches that exact path **and** every path nested beneath it (no `.*` suffix needed) — e.g. `user.password` matches `user.password` and `user.password.hash`.
2. A `*` segment matches exactly one path segment at that position — e.g. `items.*.internalId`.
3. A pattern ending in `.*` matches that prefix and everything beneath it at any depth — functionally sugar for rule 1, since rule 1 already covers "and everything beneath."
4. Matching is checked against the *exact string* of a finding's `path` field (see Edge Cases below for where this string isn't always what a naive reader would expect).

**Application states:** No patterns entered (nothing filtered) · Patterns entered, no compare run yet (stored, inert) · Patterns entered, compare run, live filtering active.

**Edge cases:**
- **⚠ ARTIFACT QUIRK — real, testable, surprising behavior:** a pattern consisting of exactly `*` (just the wildcard, no other segments) matches **every** path in the document — because the trailing-`*`-stripping rule reduces it to zero pattern segments, and an empty pattern-segment list vacuously matches any path via `Array.prototype.every` on an empty array. In effect, typing `*` alone silently ignores the entire comparison. This needs an explicit product decision (`SRS.md` §15): is "ignore literally everything" useful/intended, should it require confirmation, or should a bare `*` be rejected as invalid input? **Not decided here — flagged, not fixed, per this document's instructions.**
- **⚠ ARTIFACT QUIRK:** for a "changed" finding whose array item was both reindexed *and* changed in value, the diff engine stores a compound display path like `tags[0] / tags[2]` in that finding's `path` field (see F-007 Edge Cases) — the ignore-path matcher tokenizes that entire compound string as one path, producing nonsensical segments, so an ignore pattern that should logically match (e.g. `tags[0]`) **will not** reliably match this specific finding. This is a real, narrow gap in the artifact's own correctness, not a standalone-build regression — flagged for a fix-or-preserve decision alongside the bare-`*` issue.
- Clearing the field does not require re-running Compare — previously-hidden findings reappear immediately.
- **⚠ ARTIFACT QUIRK, intentional-looking, must be preserved:** the "Clear" action (F-015.2) does **not** reset the Ignore Paths field — only "Load Sample" overwrites it (with its own demo value). A rebuild that "helpfully" clears Ignore Paths on Clear would be a real behavior regression, not an improvement, unless a product decision explicitly changes this.

**Dependencies:** F-007 (findings this filters), F-008 (highlighting this suppresses), F-010/F-011/F-012 (the three result sections, each independently filtered), F-014 (export report's "Ignored Paths" section).

**Acceptance criteria:**
- [ ] An exact-match pattern hides that field and everything nested under it, everywhere (results tables, highlights, export) simultaneously.
- [ ] A `*`-wildcard pattern matches only at the specific segment position specified, not at any depth.
- [ ] A `.*`-suffixed pattern matches its prefix and every depth beneath it.
- [ ] Editing the Ignore Paths field after a compare has run updates all filtered views and highlights live, without requiring the user to click Compare again.
- [ ] The bare-`*` and compound-path matching quirks above have an explicit, recorded product decision (fix or preserve) before this feature is implemented — not a silent choice made during coding.

---

## F-007 — Compare Engine

**Purpose / user problem:** The actual value proposition of the tool — take two JSON documents and tell the user precisely what's missing, what changed, and (separately) whether the two documents even have the same *shape*, regardless of key/array ordering noise.
**Related requirements:** FR-016 through FR-021

**Entry conditions:** Both panels contain text; user clicks "Compare."

**User flow:**
1. User clicks Compare.
2. System validates both panels are non-empty (F-007.6) → if not, shows a status error and stops.
3. System prettifies both panels in place (F-001, business logic note) → if either fails to parse, shows the specific panel + parse error and stops (neither panel is compared, even if the *other* one is valid).
4. System builds a line-number map for each now-prettified panel (F-007.4).
5. System runs the Missing Fields diff (F-007.1... wait, listed as sub-feature below), the Differences diff, and the Structure Schema Compare, over the two parsed values.
6. System resets row selection (`selectedMissingPaths`) but **not** notes (`lastNotes`) — see Edge Cases.
7. System rebuilds the level-1/level-2 group filters (F-010.4) fresh, discarding any prior group-filter selections.
8. Results render (F-009 through F-013); highlights render (F-008).

**UI behavior:** No dedicated UI beyond the Compare button and the resulting sections — this feature's "UI" *is* F-009 through F-013.

**Data:**
- Input: two parsed JSON values (any valid JSON type at the root — object, array, or primitive).
- Output: `missing: MissingField[]`, `changed: ChangedField[]`, `structure: StructureFinding[]`, plus two line-number maps (one per panel).

**Business logic (exact semantics — this is the highest-value logic in the whole app and must be ported precisely, not "improved" or re-derived from scratch):**
- **Missing Fields:** object comparison is key-set-based and inherently order-independent (`Object.keys` carries no meaningful order for this purpose). Array comparison canonicalizes each item (a string form where object keys and array elements are recursively sorted) and pairs items across A/B by matching canonical form — **not by index** — so a reordered array with identical items produces zero missing/changed findings. Items that can't be paired become "missing" (if one side has strictly more unmatched items) or "changed" (if both sides have an unmatched item left over at the same position in their respective unmatched lists — see the compound-path edge case below).
- **Differences:** for fields present in both sides, a value is "changed" if `JSON.stringify(a) !== JSON.stringify(b)` (for non-object/array leaves) or if the two sides disagree on being an array vs. a plain object at the same path (reported at that path as a whole-value change, not descended into further).
- **Structure Schema Compare:** presence-only — never inspects value or type. Response A is always the baseline. For arrays, **every** item on both sides is checked against `A[0]`'s field set specifically (not "the array's own average shape," not each B item against its position-matched A item) — this baseline choice is a deliberate simplification worth calling out explicitly since a naive re-implementation might reach for "compare A[i] to B[i]" instead. Also flags internal inconsistency *within* A itself (an A item whose fields differ from `A[0]`) and the specific edge case of an empty A array paired with a non-empty B array (reported once, at the array's own path, since there's no baseline to check individual B items against).
- **Pre-compare validation:** both panels must be non-empty and independently valid JSON; the whole Compare aborts (no partial result) if either fails.

**Validation:** see "Pre-compare validation" above — this is the entirety of Compare's input validation; there's no further schema/shape requirement (a JSON primitive at the root, e.g., comparing the bare string `"ok"` against `"ok"`, is valid input and produces "no differences").

**Application states:** Not yet compared (`hasCompared = false`, results area hidden) · Comparing (synchronous today — the standalone build's Web Worker offload, `ARCHITECTURE.md` §3.3, is a **new**, non-artifact behavior for large-payload responsiveness) · Compared, results shown · Blocked (validation failure, no results shown, prior results if any remain exactly as they were — **not** cleared by a failed re-compare attempt).

**Edge cases:**
- **⚠ ARTIFACT QUIRK — the same compound-path issue flagged under F-006:** when an array item is both reordered *and* changed in value between A and B, the resulting "changed" finding's `path` is a compound string (`tags[0] / tags[2]`) rather than a single clean path. This affects: the Differences table's Field Path column display (arguably fine/informative there), ignore-path matching against that finding (broken, see F-006), and highlighting (the line-highlight lookup uses `aPath`/`bPath` separately for gutter/tree highlighting, which *are* clean single paths — so highlighting itself is unaffected; only the ignore-matching and the report/table's raw `path` field are affected). This nuance — some consumers use the compound `path`, others use the clean `aPath`/`bPath` — must be preserved exactly as-is in the port, since accidentally unifying them would change which findings can be ignored.
- A root-level type mismatch (A is an object, B is an array, or vice versa) is reported as a single "changed" finding at path `(root)`, not descended into.
- Comparing two primitives at the root (e.g., a bare JSON number or string on each side) is valid and simply reports a "changed" finding at `(root)` if they differ, or no findings if they match.
- Structure Schema Compare produces **zero** findings for an array with 0 or 1 items on the A side beyond the "empty baseline, non-empty B" case — the "inconsistent within A" check specifically requires `A.length > 1`.
- Level-1/level-2 group filters (F-010.4) are rebuilt from scratch on every Compare, discarding the user's prior group-filter selections — while Notes (F-010.6) and Ignore Paths (F-006) are **not** reset by Compare. This asymmetry (some state survives re-compare, some doesn't) is a real, specific behavior to preserve, not an oversight to "fix" by making everything consistently persist or consistently reset.

**Dependencies:** F-001 (source panels), F-006 (ignore-path filtering happens downstream of this, not inside it — Compare itself is unaware of ignore rules), F-008 through F-013 (everything downstream of this feature's output).

**Acceptance criteria:**
- [ ] Comparing two documents with identical content but different key order and different array element order for equal item sets produces zero Missing Fields and zero Differences.
- [ ] A field present only in A (or only in B) appears exactly once in Missing Fields, tagged with the correct side.
- [ ] A field present in both with a different value appears exactly once in Differences, with both raw values shown.
- [ ] Structure Schema Compare correctly identifies fields missing/extra relative to `A[0]` across every item in B's array, and correctly flags an A item whose own fields diverge from `A[0]`.
- [ ] An invalid-JSON panel blocks the entire Compare with a specific error naming the panel and parse failure; any *previous* successful compare's results remain visible and unchanged.
- [ ] Row selection resets on every successful Compare; Notes and Ignore Paths do not.

### Sub-features

| ID | Name | Behavior | Acceptance criteria |
|---|---|---|---|
| F-007.1 | Missing Fields diff | See Business logic above. | See parent criteria. |
| F-007.2 | Differences diff | See Business logic above. | See parent criteria. |
| F-007.3 | Structure Schema Compare | See Business logic above. | See parent criteria. |
| F-007.4 | Line-map building | Parses the now-prettified `JSON.stringify(_, null, 2)` text line-by-line via a small stack-based parser (not a general JSON parser) to recover a path→line-number map per panel, used only for the result tables' clickable line tags (F-010.8/F-012.2). | Every path present in the parsed value that also appears as its own line in the 2-space-indented output resolves to the correct 1-indexed line number. |
| F-007.5 | Auto-prettify on compare | Both panels are reformatted to `JSON.stringify(_, null, 2)` as a side effect of clicking Compare — see F-001 Business logic. | Comparing minified input results in both panels visibly showing pretty-printed JSON afterward, with no change to the underlying data. |
| F-007.6 | Pre-compare validation | Both panels non-empty and independently parseable; see Business logic. | Compare never partially proceeds — it's all-or-nothing per attempt. |

---

## F-008 — Highlighting System

**Purpose / user problem:** Once Compare has identified findings, the user needs to *see where they are* in the original JSON/Tree, not just read them in a separate table — this closes the loop between "what differs" and "where, in context."
**Related requirements:** FR-022 through FR-025

**Entry conditions:** A compare has run (`lastMissing`/`lastChanged`/`lastStructureFindings` populated) and at least one of the three highlight toggles is on. (The toggles themselves are always visible and interactive regardless of compare state, but have no visible effect until there's a result to highlight.)

**User flow:**
1. User checks/unchecks one of "Missing Fields" / "Structure Schema Compare" / "Differences."
2. Both panels' JSON views and Tree views recompute their highlight sets and re-render the overlay (line bands, gutter indicators, minimap markers, tree node classes, tree nav strip, scroll pills) for both panels simultaneously.

**UI behavior:** Three checkboxes with colored legend dots, directly above the Ignore Paths field, with explanatory copy pointing at the minimap strip.

**Data:** No new data — this feature is purely a *rendering* pass over the already-computed `missing`/`changed`/`structure` arrays plus the per-panel line maps (F-007.4) and the current ignore patterns (F-006).

**Business logic & validation:**
- **Priority order when multiple categories would highlight the same line:** Missing Fields > Structure Schema Compare > Differences — a line is painted with whichever of these, in this order, is both checked and applicable; it is never painted with more than one category at once.
- A finding whose path matches an active ignore rule (F-006) is excluded from highlighting **regardless of toggle state** — ignore rules are a hard filter applied before highlight computation runs, not a separate, overridable layer.
- Tree-view highlighting matches on exact path string against each rendered node's `data-path` — inherits the same compound-path limitation noted in F-007/F-006 for the narrow "reordered + changed array item" case.

**Application states:** All toggles off (no highlight overlay, checkboxes still interactive) · One or more toggles on, no compare run yet (no visible effect — nothing to highlight) · One or more toggles on, compare run (overlay active).

**Edge cases:**
- Toggling a highlight category does not require re-running Compare and has no effect on the result tables' own filters (F-010–F-012) — these are two independent filtering/display systems that happen to share the same underlying ignore-path exclusion rule.
- Toggle checked-state itself is never reset by Compare, Clear, or Load Sample — it's pure UI preference that persists across all of those actions for the duration of the session.

**Dependencies:** F-006 (exclusion), F-007 (source data + line maps), F-001.8–F-001.11 (JSON-view rendering surfaces), F-002.4–F-002.6 (Tree-view rendering surfaces).

**Acceptance criteria:**
- [ ] Each of the three toggles independently controls only its own category's highlights, additively (multiple can be on at once).
- [ ] A line/node matching more than one active category is painted with exactly one color, following the documented priority order.
- [ ] An ignored-path finding is never highlighted, in any toggle combination.
- [ ] Turning all toggles off removes every highlight from both panels' JSON and Tree views without altering the underlying result tables.

---

## F-009 — Results Summary

**Purpose / user problem:** A single-glance answer to "are these the same?" before diving into three separate detailed tables, with one-click navigation into whichever category has something interesting.
**Related requirements:** FR-026

**Entry conditions:** A compare has run.

**User flow:**
1. Compare completes → summary chips render immediately above the three result sections.
2. User clicks a non-empty chip → the relevant section's filters are pre-set (for the two Missing Fields chips specifically — see Business logic) and the page scrolls to that section, which briefly flashes its border.

**UI behavior:** A horizontal row of pill-shaped chips: `-N in A, not in B` (red), `+N in B, not in A` (green), `~N changed` (amber), `◆N structure` (purple), and, only if non-zero, `N ignored` (neutral, non-clickable). Chips with a zero count render disabled (non-interactive, visually muted) rather than being hidden.

**Data:** Purely derived — counts recomputed from `missing`/`changed`/`structure` filtered through the current ignore patterns (so the summary always reflects *actionable* counts, with the ignored total shown separately, never double-counted into the other four).

**Business logic & validation:**
- If literally every count (onlyA, onlyB, changed, structure) is zero, the summary collapses to a single "No differences found — responses match on all fields." message (plus the ignored-count chip if applicable) instead of showing four zero-value chips.
- Clicking the "-N in A, not in B" chip sets the Missing Fields section's filters to show only the "onlyA" side (and hides "onlyB"); clicking "+N in B, not in A" does the mirror opposite. Clicking "~N changed" or "◆N structure" only scrolls/flashes — it does not alter those sections' own filters.

**Application states:** No compare run (summary not rendered at all) · All-zero (single "no differences" message) · Mixed (chip row, some enabled some disabled per count).

**Edge cases:** The ignored-count chip is never clickable/interactive — it's informational only, unlike the four actionable chips.

**Dependencies:** F-006 (ignored total), F-007 (source counts), F-010/F-011/F-012 (scroll-and-filter targets), F-013 (the flash/scroll mechanism operates on these sections' collapsible wrappers).

**Acceptance criteria:**
- [ ] Chip counts always match the actual number of rows visible in each corresponding table *after* ignore-path filtering (not before).
- [ ] A zero-count chip is visibly disabled and does not respond to clicks.
- [ ] Clicking "-N in A, not in B" or "+N in B, not in A" both scrolls to Missing Fields *and* sets its side filters accordingly; clicking the other two chips only scrolls.
- [ ] The all-zero state shows the single summary message, not four disabled chips.

---

## F-010 — Missing Fields Section

**Purpose / user problem:** The primary triage surface — for every field present on only one side, let the user filter down to what matters, mark rows as reviewed/needed/ignorable with a note, and select a subset to export.
**Related requirements:** FR-027 through FR-032, FR-036, FR-037

**Entry conditions:** A compare has run; section is open by default (F-013).

**User flow:**
1. Section renders all non-ignored (unless "Show ignored" is checked) Missing Fields rows matching the current side/text/level-group filters.
2. User can: toggle side filters, toggle "show ignored," type a path filter, toggle level-1/level-2 group checkboxes, check individual rows (or "select all" — scoped to currently *visible* rows only), pick a status per row, type a free-text note per row, expand a long value's "show more," click a line tag to jump to source, or export (all, or selection-only).

**UI behavior:** Filter row (checkboxes + text input + two export buttons) → optional level-1/level-2 group-filter rows (only shown when more than one distinct group exists at that level) → a "Showing X of Y fields · Z selected" counter line → the table itself, columns: select-checkbox, Field Path (+ side tag + ignored tag if applicable), Response A value, Response B value, Notes (status dropdown + text input).

**Data:**
- Row shape: `{path, aPath, bPath, a, b, side}` from F-007.1, joined at render time with `notes.get(path)` (`{status, text}`, default `unreviewed`/empty) and `selectedMissingPaths.has(path)`.
- Persistence: none in the baseline scope — notes/selection live only in memory for the session (survive re-Compare for notes; reset on re-Compare for selection; both wiped on Clear).

**Business logic & validation:**
- "Select all" is scoped to the *currently filtered/visible* rows — checking it while a text filter is narrowing the list does not silently select hidden rows; its checkbox shows an indeterminate state when some-but-not-all visible rows are selected.
- Level-1/level-2 filter rows are generated fresh from the *current* result set every Compare and only rendered if there's more than one distinct group at that level (a single-group level adds no useful filtering, so it's hidden rather than shown-but-useless).
- Note edits (status change, text typing) are applied via event delegation on the table body rather than a full re-render per keystroke — this is a **performance/UX behavior**, not just an implementation detail: it exists specifically so that typing a note doesn't lose focus/cursor position, which a naive "re-render the whole table on every keystroke" implementation would break. This must be preserved (functionally — the resulting UX guarantee, not necessarily the exact DOM-event-delegation mechanism) in the React port.

**Validation:** No required fields — notes are entirely optional free text; there's no character limit or format constraint on the note text field.

**Application states:** No rows (either zero Missing Fields overall, or all filtered out — two distinct empty-state messages: "No missing fields at all" is actually shown via the parent Summary's all-zero message, while "No missing fields match the current filters" is this section's own empty state when filters exclude everything) · Rows present, unfiltered · Rows present, filtered (with the ignored-hidden-count note shown if applicable) · Rows present, with a selection · Export triggered without having compared yet ("Run a comparison first.") · Export Selected triggered with an empty selection ("No fields selected...").

**Edge cases:**
- A row's Notes status and text are independent of that row's ignored-state — a row can be individually marked "Needed" even while it's also excluded by an Ignore Path rule (it just won't be visible unless "Show ignored" is also checked).
- Very long values truncate to 70 characters with a "show more"/"show less" inline expander rather than breaking the table's layout — this threshold (`VALUE_PREVIEW_LIMIT = 70`) is a specific, documented constant, not an arbitrary approximation.

**Dependencies:** F-006 (ignore filtering), F-007.1 (source rows), F-007.4 (line tags), F-009 (summary chip cross-filtering), F-014 (export consumes this section's rows/notes/selection).

**Acceptance criteria:**
- [ ] All documented filter combinations (side × ignored-visibility × text × level-1 × level-2) compose correctly (AND semantics across all active filters).
- [ ] Selection persists across filter changes (a row selected, then hidden by a new filter, then re-shown by removing that filter, is still selected) but resets on every new Compare.
- [ ] A note's status and text persist across filter changes, tab switches, and re-Compare (but not across Clear).
- [ ] Editing a note's text never causes the input to lose focus or cursor position mid-keystroke.
- [ ] The "select all" checkbox accurately reflects checked/unchecked/indeterminate relative to only the currently visible rows.

### Sub-features

| ID | Name | Behavior | Acceptance criteria |
|---|---|---|---|
| F-010.1 | Side filters | "Present in A, missing from B" / "Present in B, missing from A" independent checkboxes, both default checked. | Unchecking one hides only that side's rows. |
| F-010.2 | Show ignored toggle | Reveals ignore-matched rows (visually tagged "ignored," row dimmed) instead of hiding them entirely. | Toggling shows/hides exactly the ignore-matched rows, with an accurate hidden-count note when off. |
| F-010.3 | Free-text path filter | Case-insensitive substring match against the field path. | Filtering by a partial path segment correctly narrows the table. |
| F-010.4 | Level 1/2 group filters | Dynamically generated checkboxes per distinct path prefix; "All"/"None" bulk actions per level. | Unchecking a level-1 group hides every row under that prefix, including across multiple level-2 subgroups. |
| F-010.5 | Row selection + select-all | Per-row checkbox; header checkbox is select-all-visible with indeterminate tri-state. | See parent criteria. |
| F-010.6 | Notes (status + text) | Per-path status enum (`unreviewed`/`reviewed`/`needed`/`ignore`) + free text, delegated event handling. | See parent criteria. |
| F-010.7 | Value display/truncation | 70-char preview + show-more/less for both A and B value cells independently. | A value exactly at 70 characters does not truncate; 71+ does. |
| F-010.8 | Line tags | Clickable `Ln N` tag next to each side's value, present only if that path resolved to a line in that panel's line map. | Clicking a line tag scrolls the correct panel to the correct line. |
| F-010.9 | Result counter | "Showing X of Y fields · Z selected" text, updates with every filter/selection change. | Counter values always match the actual rendered row count and selection size. |
| F-010.10 | Ignored-hidden-count note | Shows only when ≥1 row is hidden specifically by ignore rules (not by other filters). | Note text uses correct singular/plural ("1 field" vs. "N fields"). |
| F-010.11 | Export Missing Fields (.md) | Exports the *full* Missing Fields list (all rows, not just filtered-visible ones) per F-014. | Guarded: requires a completed compare. |
| F-010.12 | Export Selected (.md) | Exports only `selectedMissingPaths` rows per F-014. | Guarded: requires a completed compare **and** a non-empty selection. |

---

## F-011 — Structure Schema Compare Section

**Purpose / user problem:** Separates "does B have all the fields A's schema implies it should" from "do the values match" — valuable specifically when comparing, e.g., a paginated list where item *count* differs but each item's *shape* should still match a baseline.
**Related requirements:** FR-033

**Entry conditions:** A compare has run; section is closed by default (F-013).

**User flow:** Renders all findings from F-007.3, filterable by kind/ignored-visibility/text, same interaction pattern as F-010 minus selection/notes/export.

**UI behavior:** Filter row (three kind checkboxes + show-ignored + text filter) → table: Field Path, Issue (tag), Detail.

**Data:** Row shape: `{path, kind, detail?}` from F-007.3; no notes/selection concept for this section.

**Business logic & validation:**
- **⚠ ARTIFACT QUIRK, must be preserved deliberately:** the "Inconsistent within A" filter checkbox controls **both** the `inconsistent-in-a` **and** `a-empty-array` finding kinds — two semantically distinct issues share one filter toggle (`STRUCTURE_KIND_TO_CHECKBOX` maps both kinds to the same checkbox id). A rebuild that "cleanly" splits these into separate filters would be a scope-creep UI change, not a faithful port, unless explicitly decided otherwise.
- `missing-in-b`/`extra-in-b` findings show fixed, generic detail text regardless of the specific field; only `inconsistent-in-a`/`a-empty-array` carry a dynamic, finding-specific detail string.

**Application states:** No findings (either none exist, or all filtered out) · Findings present, filtered · Findings present, with ignored-hidden-count note.

**Edge cases:** See F-007's Structure Schema Compare business-logic notes (A-as-baseline, `A.length>1` gate for internal-consistency checks) — this section is a pure display layer over those semantics and introduces no new edge cases of its own.

**Dependencies:** F-006 (ignore filtering), F-007.3 (source data), F-009 (summary chip scroll target).

**Acceptance criteria:**
- [ ] All four finding kinds render with correct, distinct tag styling and correct detail text per kind.
- [ ] The "Inconsistent within A" checkbox shows/hides both `inconsistent-in-a` and `a-empty-array` findings together (preserving the shared-checkbox quirk, unless a product decision changes it).
- [ ] Text/ignored filters behave identically in structure to their Missing Fields counterparts.

---

## F-012 — Differences Section

**Purpose / user problem:** For fields that exist on both sides but disagree in value — the most "classically expected" diff view.
**Related requirements:** FR-034

**Entry conditions:** A compare has run; section is closed by default (F-013).

**User flow:** Renders all findings from F-007.2, filterable by ignored-visibility/text.

**UI behavior:** Filter row (show-ignored + text filter) → table: Field Path, Response A value, Response B value (both with the same truncation/line-tag treatment as F-010.7/F-010.8).

**Data:** Row shape: `{path, aPath, bPath, a, b}` from F-007.2.

**Business logic & validation:** No additional rules beyond F-007.2's diff semantics and F-006's ignore filtering — this section, like F-011, is a display layer.

**Application states:** No findings · Findings present, filtered · Findings present, with ignored-hidden-count note.

**Edge cases:** Inherits the compound-path display (`tags[0] / tags[2]`) noted under F-007 for reordered+changed array items — here it's arguably *useful* information (it tells the user the item moved *and* changed) rather than purely a defect, unlike its effect on ignore-matching.

**Dependencies:** F-006, F-007.2, F-009.

**Acceptance criteria:**
- [ ] Every field present in both documents with an unequal value appears exactly once, with both original values visible (truncated if long).
- [ ] Text/ignored filters behave identically to their counterparts in the other two sections.

---

## F-013 — Collapsible Result Sections

**Purpose / user problem:** Three potentially-long tables shouldn't all be open by default competing for attention — Missing Fields (usually the most actionable) starts open; the other two start closed but are one click away.
**Related requirements:** FR-035

**Entry conditions:** A compare has run (this feature has no meaning before results exist).

**User flow:** User clicks a section's header (or a Summary chip, F-009) → section toggles open/closed (or is forced open + scrolled-to + flashed, if triggered via a chip/line-tag jump even if it was previously closed).

**UI behavior:** Native disclosure-widget pattern (chevron rotates 45°→-45°/vice versa) for each of the three sections; Missing Fields `open` by default, the other two closed by default; a jump-to action (from a Summary chip) always force-opens the target section even if the user had manually closed it, then scrolls and flashes its border briefly.

**Data:** No data of its own — pure UI/disclosure state, one boolean per section, never persisted.

**Business logic & validation:** A jump-to action must open a closed section before scrolling to it — scrolling to a closed, height-collapsed element would otherwise land on the wrong scroll position or show nothing.

**Application states:** Open · Closed · Open + freshly jumped-to (flash animation playing).

**Edge cases:** Rapidly clicking a Summary chip multiple times restarts the flash animation each time (a forced reflow before re-adding the animation class ensures the CSS animation replays rather than being a no-op on an already-present class).

**Dependencies:** F-009 (triggers jump-to), F-010/F-011/F-012 (the sections themselves).

**Acceptance criteria:**
- [ ] Missing Fields is open and the other two are closed immediately after every fresh Compare.
- [ ] Manually closing/opening a section is independent of the other two.
- [ ] Jumping to a closed section via a Summary chip or line tag force-opens it, scrolls it into view, and plays the flash animation, every time (including repeatedly).

---

## F-014 — Markdown Export

**Purpose / user problem:** The user needs to take findings out of the tool — into a PR description, a Jira comment, a Slack message — as a structured, readable artifact rather than a screenshot.
**Related requirements:** FR-036, FR-037, FR-038

**Entry conditions:** A compare has run (both export buttons); for "Export Selected," at least one Missing Fields row must also be currently selected.

**User flow:**
1. User clicks "Export Missing Fields (.md)" or "Export Selected (.md)."
2. Guard check (see Business logic) — on failure, a specific status error shows and nothing is generated.
3. On success: a Markdown string is built, a file download is triggered automatically (Blob + anchor click), **and** an in-page preview panel opens showing the same content in a read-only textarea with its own Copy/Download-again/Close controls.

**UI behavior:** Preview panel appears below the result sections (auto-scrolled into view), titled "Export preview — `<filename>`," with explanatory copy about why it exists (some sandboxed contexts silently block the automatic download).

**Data:**
- Input: the full (or selected-only) Missing Fields list, current notes map, current ignore patterns.
- Output: a Markdown string with this exact structure (must be preserved byte-for-structure, not just "similar"):
  1. `# <Title>` ("Missing Fields Report" or "Selected Missing Fields Report")
  2. "Generated by JSON Response Comparer."
  3. `## Comparison Summary`, broken into three subsections:
     - `### Source (A) — Missing Fields` — `Total Missing`, `Ignored`, `Requires Review` (the last two always sum to the first, for A's rows only)
     - `### Local (B) — Missing Fields` — same three counts, for B's rows only
     - `### Overall Status` — `Total Differences`, `Ignored Paths`, `Actionable / Requires Review` (the combined A+B totals), followed by a one-line prose sentence: `Summary: Out of N total differences, M are intentionally ignored and K require review or action.` (singular "difference"/"is" when N/M is 1)
  4. `## Ignore Path Rules` — the literal configured patterns, or "None configured."
  5. `## Missing Fields (Actionable)` — one block per non-ignored row, in this exact order, followed by a `---` rule before the next entry:
     - `### \`<path>\`` (heading — the field's path, no numbering)
     - `**Presence**`, then `* Source (A): ✅ Present` or `❌ Missing`, `* Local (B): ✅ Present` or `❌ Missing`
     - `**Classification**`, then `* Ignore Path: No`, `* Status:` one of `🟡 Not Reviewed` / `🟢 Reviewed` / `🔴 Needs Action` / `🟢 Expected Difference` (mapped 1:1 from the row's in-app note status — unreviewed/reviewed/needed/ignore respectively), `* Actionable: Yes` only when the status is Needs Action, `* Requires Review: Yes` only when the status is Not Reviewed
     - `Reason: <text>` — the note's free text if one was written, otherwise an auto-generated sentence describing which side the field is present/missing on, phrased for that status
     - `Action: <text>` — a fixed sentence per status (e.g. "✅ No action required." for Expected Difference, "⚠️ Action required — see notes for details." for Needs Action, "🔍 Pending review." for Not Reviewed)
  6. `## Ignored Paths` (only present if ≥1 ignored row exists) — same per-entry block format, with `Ignore Path: Yes`

**Business logic & validation:**
- "Export Missing Fields" exports **every** Missing Fields row regardless of the table's current filters (only Ignore Paths affects the actionable/ignored split — text/side/level filters are display-only and do not affect what gets exported).
- "Export Selected" requires `hasCompared` **and** a non-empty selection; "Export Missing Fields" requires only `hasCompared`.
- If every row happens to be ignored, the Actionable section shows a specific message ("No actionable missing fields — all N matched an Ignore Path rule...") rather than the generic empty message.

**Application states:** Guard failed (not compared / empty selection) — status error shown, no file/preview · Success — file download attempted + preview shown · Preview open (Copy succeeded / Copy blocked, falls back to text-selection + manual-copy instructions) · Preview closed.

**Edge cases:**
- Clipboard write failure (blocked by a sandboxed context) falls back to programmatically selecting the preview textarea's content and instructing the user to press Ctrl/Cmd+C manually — this fallback path is a real, necessary behavior for the artifact's original Cowork-artifact sandboxed context and should be preserved for the standalone build too, since some corporate/locked-down browser policies produce the same restriction.
- "Download again" in the preview re-triggers the same Blob/anchor download using the already-generated content — it does not regenerate the report (so it reflects the state *at export time*, not any notes/selection edits made after the fact, until the user exports again).

**Dependencies:** F-006 (ignore split), F-010 (source rows, notes, selection).

**Acceptance criteria:**
- [ ] The exported Markdown matches the documented structure exactly, including correct singular/plural phrasing and the conditional presence of the Ignored Paths section.
- [ ] "Export Missing Fields" always includes all rows (ignoring current table filters); "Export Selected" includes only the currently selected rows.
- [ ] Both guards produce their specific, correct error message and prevent any file/preview from being generated.
- [ ] A blocked clipboard write falls back to a usable manual-copy state rather than failing silently.

---

## F-015 — Sample Data / Reset

**Purpose / user problem:** A zero-effort way to see the tool actually do something (Load Sample) and a full reset when starting a new comparison (Clear).
**Related requirements:** FR-039, FR-040

**Entry conditions:** Always available.

**User flow (Load Sample):** Click → both panels populate with a fixed example pair (deliberately shuffled key/array order between A and B, to demonstrate order-independence) → Ignore Paths field is overwritten with a matching demo pattern → gutters/tree views refresh. No compare is run automatically — the user must still click Compare.

**User flow (Clear):** Click → both panels empty → all diff state, notes, selection, level-group filters cleared → results area hidden → status line cleared. **Ignore Paths field is deliberately left untouched** (see F-006 Edge Cases).

**UI behavior:** Two buttons in the main toolbar alongside Compare.

**Data (sample payload, exact):** Response A: `status`, `user{id,name,plan}`, `data{amount,currency}`, `tags[]`, `notes` (free text resembling a support-call summary), `config{partner{id,tier}, region, partnerConfig{<partner-name>: {themeColors:{aqua, amGradient}}} for two example partners}`, `countries[]`. Response B: same fields reordered, `user.plan` changed, `data.amount` changed, an added `meta.cached` field, an extended `notes` string, `config.partner.contractRef` added, `config.region` removed, `partnerConfig` theme colors emptied out, and a third `countries` entry with a differently-named field (`isoName` instead of `name`) to also demonstrate a Structure Schema Compare finding.

**Business logic & validation:** None beyond the fixed seed data and the explicit ignore-paths overwrite noted above.

**Application states:** N/A (both actions are instantaneous, synchronous state resets).

**Edge cases:**
- Loading Sample while existing data/results are present silently overwrites both panels and all derived state with no confirmation prompt — there is no "are you sure, you'll lose your current comparison" guard in the artifact.
- Clear likewise has no confirmation prompt.
- `SRS.md` FR-037 (Sample data) proposes, as a **should-have** (not required for parity), applying the same "generic, non-brand-specific example data" principle already applied to the Ignore Paths help text to the sample *payload* itself — flagged as an open, optional improvement, not a behavior change to make silently.

**Dependencies:** F-001 (target of both actions), F-006 (Ignore Paths — overwritten by Sample, preserved by Clear), F-007 (diff state cleared by Clear), F-010 (notes/selection/level-groups cleared by Clear).

**Acceptance criteria:**
- [ ] Load Sample always produces the exact documented payload pair and Ignore Paths value, regardless of prior state.
- [ ] Clear always empties both panels and every piece of derived compare state, while leaving the Ignore Paths field's current value untouched.
- [ ] Neither action prompts for confirmation (preserving the artifact's current no-confirmation behavior, unless a product decision adds one).

---

## F-016 — Miscellaneous UI

**Purpose / user problem:** Small pieces of UX polish that don't belong to any single feature above but are still real, specified behavior.
**Related requirements:** FR-041, FR-042, FR-043

**Entry conditions:** Always active.

**User flow / behavior:**
- **Scroll-to-top button (F-016.1):** a floating circular button appears once the page has scrolled more than 300px, and smooth-scrolls to the top on click; hidden otherwise.
- **Light/dark theming (F-016.2):** the entire color system is driven by CSS custom properties with a `prefers-color-scheme: light` override block — there is no in-app theme toggle; the app always follows the OS/browser preference.
- **Status/error messaging (F-016.3):** a single shared status text element (not a toast/notification stack) is reused across Compare validation errors, Prettify errors, and Export guard failures — only one status message is ever visible at a time, and a new one simply replaces whatever was showing.

**Data:** None beyond the current status message string and its error/non-error styling class.

**Business logic & validation:** N/A — these are presentational behaviors, not business rules.

**Application states:** Scroll button hidden/visible; status empty/info/error.

**Edge cases:** Because status messaging is a single shared element, two different validation failures in quick succession simply overwrite each other — there is no message queue or history.

**Dependencies:** Cross-cutting — referenced by F-001 (Prettify errors), F-007 (Compare validation errors), F-014 (Export guard errors).

**Acceptance criteria:**
- [ ] The scroll-to-top button appears/disappears at exactly the documented threshold and scroll direction.
- [ ] The app's colors switch correctly between light/dark purely based on OS-level preference, with no persisted in-app override.
- [ ] Every error-producing action in the app writes to the same single status element, replacing any prior message.

---

## 17. Feature Coverage Matrix

| Feature | Sub-feature | SRS Requirement | Architecture Component | Acceptance Criteria Ref. | Dependencies | Implementation Phase |
|---|---|---|---|---|---|---|
| F-001 | — | FR-001, FR-002, FR-004–FR-009 | `components/panels/JsonPanel.tsx`, `JsonEditor.tsx` | F-001 AC | F-002, F-003, F-007, F-008 | Phase 3.1 |
| F-001.1 | Direct paste/type | FR-001 | `JsonEditor.tsx` | F-001.1 AC | — | Phase 3.1 |
| F-001.2 | File upload | FR-002 | `AddDataModal.tsx` | F-001.2 AC | F-003.1 | Phase 3.1 |
| F-001.3 | Curl/URL fetch into panel | FR-003 | `AddDataModal.tsx`, `lib/fetch-executor.ts` (client-side) | F-001.3 AC | F-004, F-005 | Phase 3.2 |
| F-001.4 | Prettify | FR-004 | `JsonEditor.tsx` | F-001.4 AC | — | Phase 3.1 |
| F-001.5 | In-panel Find | FR-005 | `FindBar.tsx` | F-001.5 AC | — | Phase 3.1 |
| F-001.6 | JSON/Tree tab switch | FR-006 | `JsonPanel.tsx` (shadcn `Tabs`) | F-001.6 AC | F-002 | Phase 3.3 |
| F-001.7 | Persistent inline curl bar | FR-007 | `InlineCurlBar.tsx` | F-001.7 AC | F-004, F-005 | Phase 3.2 |
| F-001.8 | Line-number gutter | FR-008 | `JsonEditor.tsx` | F-001.8 AC | — | Phase 3.1 |
| F-001.9 | Minimap overview | FR-009 | `JsonEditor.tsx` | F-001.9 AC | F-008 | Phase 3.6 |
| F-001.10 | Gutter diff indicators | FR-009 | `JsonEditor.tsx` | F-001.10 AC | F-008 | Phase 3.6 |
| F-001.11 | Scroll-aware pills | FR-009 | `JsonEditor.tsx`, `JsonTreeView.tsx` | F-001.11 AC | F-008 | Phase 3.6 |
| F-002 | — | FR-010, FR-011 | `components/panels/JsonTreeView.tsx` | F-002 AC | F-001, F-008 | Phase 3.3 |
| F-002.1–F-002.6 | (see table above) | FR-010, FR-011 | `JsonTreeView.tsx` | per-row | F-001, F-008 | Phase 3.3 / 3.6 |
| F-003 | — | FR-002, FR-012 | `components/modals/AddDataModal.tsx` | F-003 AC | F-001, F-004, F-005 | Phase 3.1 / 3.2 |
| F-003.1 | File upload leg | FR-002 | `AddDataModal.tsx` | F-003.1 AC | — | Phase 3.1 |
| F-003.2 | Curl/URL fetch leg | FR-012 | `AddDataModal.tsx` | F-003.2 AC | F-004, F-005 | Phase 3.2 |
| F-004 | — | FR-013 | `packages/diff-engine` or `apps/web/lib/curl-parser.ts` | F-004 AC | — | Phase 2 |
| F-005 | — | FR-003 (v1); FR-044/FR-045 (deferred — future scope) | `lib/fetch-executor.ts` (client-side `BrowserFetchExecutor`, v1) | F-005 AC | F-004 | Phase 2 |
| F-006 | — | FR-014, FR-015 | `packages/diff-engine/src/ignore-paths.ts`, `IgnorePathsField.tsx` | F-006 AC | F-007, F-008 | Phase 2 (logic) / 3.4 (UI) |
| F-007 | — | FR-016–FR-021 | `packages/diff-engine/src/diff-values.ts`, `diff-shape.ts`, `line-map.ts` | F-007 AC | F-001, F-006 | Phase 2 |
| F-007.1–F-007.6 | (see table above) | FR-016–FR-021 | `diff-engine` | per-row | — | Phase 2 |
| F-008 | — | FR-022–FR-025 | `JsonEditor.tsx`, `JsonTreeView.tsx`, store selectors | F-008 AC | F-006, F-007 | Phase 3.6 |
| F-009 | — | FR-026 | `components/results/SummaryChips.tsx` | F-009 AC | F-006, F-007, F-010–F-013 | Phase 3.5 |
| F-010 | — | FR-027–FR-032, FR-036, FR-037 | `MissingFieldsSection.tsx`, `NoteEditor.tsx` | F-010 AC | F-006, F-007, F-014 | Phase 3.5 |
| F-010.1–F-010.12 | (see table above) | FR-027–FR-032, FR-036, FR-037 | `MissingFieldsSection.tsx` | per-row | — | Phase 3.5 / 3.7 |
| F-011 | — | FR-033 | `StructureCompareSection.tsx` | F-011 AC | F-006, F-007 | Phase 3.5 |
| F-012 | — | FR-034 | `DifferencesSection.tsx` | F-012 AC | F-006, F-007 | Phase 3.5 |
| F-013 | — | FR-035 | `ResultsWrap` composition (shadcn `Collapsible`/native `<details>`) | F-013 AC | F-009–F-012 | Phase 3.5 |
| F-014 | — | FR-036–FR-038 | `packages/diff-engine/src/markdown-report.ts`, `ExportPreviewPanel.tsx` | F-014 AC | F-006, F-010 | Phase 2 (logic) / 3.7 (UI) |
| F-015 | — | FR-039, FR-040 | `CompareToolbar.tsx`, store actions | F-015 AC | F-001, F-006, F-007, F-010 | Phase 3.8 |
| F-016 | — | FR-041–FR-043 | `ScrollTopButton.tsx`, `globals.css`, shared status state in store | F-016 AC | cross-cutting | Phase 3.8 |
| — (new, deferred) | Fetch-proxy SSRF guard | FR-044, NFR-007 | `app/api/fetch-proxy/route.ts` (future scope only — not built for v1) | `SRS.md` §14 checklist | F-005 | Future Scope (triggered by `SRS.md` §15.12, not scheduled in any v1 phase) |
| — (new, optional) | Persistence module | FR-046–FR-048 | `packages/db`, `/api/comparisons`, `/api/presets` | `SRS.md` §4.8 | Auth, F-006, F-010 | Phase 4 (blocked by decision) |

---

## 18. Documentation Coverage Audit

A second pass through the artifact's actual source (not just its rendered UI) was performed specifically to populate this section, per this document's own methodology requirement.

| Area | Status | Notes |
|---|---|---|
| Pages/routes | Fully Documented | The artifact is single-page; the standalone build's single route (`/`) is specified in `ARCHITECTURE.md` §3/§17. No hidden routes exist in the artifact. |
| Every button/action | Fully Documented | Cross-checked against every `addEventListener('click', ...)` in the source: Compare, Prettify (×2), Add (×2), Load sample, Clear, scroll-to-top, modal close/backdrop, find toggle/prev/next/close (×2), inline curl Go/close (×2), export ×2, export preview copy/download/close, level filter All/None (×4), summary chips (×4), notes-status/row-select delegation. All accounted for above. |
| Component behavior | Fully Documented | Gutter math, minimap, scroll pills, tree rendering, and highlight computation were traced through their actual implementations (not assumed from visual behavior) — see F-001/F-002/F-008. |
| Business rules | Fully Documented | Diff semantics (order-independence, A-baseline structure compare), ignore-path matching rules, and their several edge cases are documented in F-006/F-007 with the exact underlying algorithm, not a paraphrase. |
| Validation | Fully Documented | The only validation in the artifact is JSON parseability at Prettify/Compare time and the two export guards — both fully covered (F-001, F-007.6, F-014). |
| API interactions | Fully Documented. v1 has zero backend API surface — the fetch feature stays client-side `fetch()`, identical to the artifact's own behavior. A server-side replacement is fully designed as future scope only (`ARCHITECTURE.md` §3.10/§4, `SRS.md` §2.9/§8/§11.3/§15.12) but is explicitly not built or required for v1. |
| State transitions | Fully Documented | Including the specific asymmetries (selection resets on Compare, notes don't; Ignore Paths survives Clear but not a fresh page load) called out explicitly in F-006/F-007/F-010/F-015. |
| Loading/empty/error states | Fully Documented | Enumerated per-feature in each "Application states" subsection. |
| Configuration | Fully Documented (for the artifact — it has none; all state is in-memory only). Standalone-build configuration (env vars) is specified in `ARCHITECTURE.md` §15. |
| Persistence | Fully Documented (for the artifact — none exists). The proposed standalone persistence module is explicitly marked should-have/optional in `SRS.md` §4.8/§6, not baseline. |
| Permissions | Not Applicable — the artifact has no auth/permission concept at all; the standalone build's auth question is an open, undecided item (`SRS.md` §15.1), not something this audit can mark "documented" since it doesn't exist yet to document. |
| Edge cases | Fully Documented, including four genuine artifact-level defects/quirks found by reading the actual matching/parsing logic rather than the UI: the bare-`*` ignore-everything behavior (F-006), the compound-path ignore/matching gap for reordered+changed array items (F-006/F-007), the curl-parser's unknown-flag URL-swallowing bug (F-004), and the shared filter checkbox for two distinct Structure Schema Compare finding kinds (F-011). Each is flagged for a fix-or-preserve decision, not silently resolved. |
| Hidden/indirect functionality | Fully Documented — see the "⚠ ARTIFACT QUIRK" callouts throughout, plus: Compare's side-effect of re-prettifying both panels in place; Clear intentionally not touching Ignore Paths while Load Sample does overwrite it; notes surviving re-Compare while selection does not; level-group filters resetting on every Compare. |
| Accessibility | Partially Documented for the artifact (known gaps listed in `SRS.md` §12); Fully Documented as *requirements* for the standalone build (same section). |
| Responsive behavior | Fully Documented — the artifact's `@media (max-width:800px)` breakpoint collapsing the two-column panel layout to one column is its only responsive behavior; no other breakpoints exist. |

**Overall assessment:** no artifact-visible feature, button, state, or business rule was left undocumented. The items marked "Not Applicable" (permissions) and "Partially Documented" (accessibility, inherited from the artifact's own real gaps rather than a documentation gap) are named explicitly rather than glossed over.

---

## 19. Related documents

- `SRS.md` — the FR-xxx/NFR-xxx requirements this inventory cites, plus the canonical Open Questions register (§15).
- `ARCHITECTURE.md` — where each feature's implementation lives (components, routes, packages) and the cross-cutting concerns (security, observability, testing) that apply across all of them.
- `TECH_STACK.md` — technology choices referenced by the Feature Coverage Matrix's "Architecture Component" column.
- `IMPLEMENTATION_PLAN.md` — phase sequencing referenced by the Feature Coverage Matrix's "Implementation Phase" column, and the Agent Implementation Guidance section for how to actually build each feature from this document.
