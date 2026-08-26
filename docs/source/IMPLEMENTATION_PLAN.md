# IMPLEMENTATION_PLAN.md — Phased Implementation Plan

**Project:** JSON Response Comparer — standalone conversion
**Status:** Specification — implementation not started
**Last updated:** 2026-08-21

> This document sequences the work specified in `SRS.md`, `FEATURES.md`, `ARCHITECTURE.md`, and `TECH_STACK.md` into seven ordered phases. It is written as an implementation contract for a future engineer or AI coding agent, not a status report — no phase described here has been executed. Phase and sub-phase numbers in this document are the same numbers already cited in `FEATURES.md` §17's Feature Coverage Matrix "Implementation Phase" column; the two documents are kept in sync deliberately, and any future edit to phase numbering here must also update that column.

---

## 0. How to read this plan

Each phase lists: **Objectives**, **Features covered** (F-IDs, cross-referenced to `FEATURES.md`), **Tasks**, **Dependencies** (what must be true before this phase can start), **Expected output** (concrete artifacts), and **Validation criteria** (how to know the phase is actually done — not just "code written"). Phases 1 and 2 are strictly sequential prerequisites. Within Phase 3, sub-phases 3.1–3.8 have internal ordering (each depends on the previous) but the whole of Phase 3 depends only on Phase 2 being complete. Phase 4 is conditionally scoped — see its Objectives. Phases 5–7 depend on Phases 1–4 (or the in-scope subset of Phase 4) being complete, but Phase 5's test-writing can and should begin incrementally alongside Phases 2–4 rather than purely afterward (see §8, Agent Implementation Guidance).

---

## Phase 1 — Foundation

**Objectives:** Stand up the monorepo, tooling, and CI skeleton that every later phase builds on. No feature logic is implemented in this phase.

**Features covered:** None directly — this phase is infrastructure for all of F-001–F-016.

**Tasks:**
1. Initialize the pnpm workspace: `apps/web` (Next.js 16, App Router, Turbopack, TypeScript, Tailwind v4, ESLint) and `packages/diff-engine` (framework-free TypeScript package — see `ARCHITECTURE.md` §5 for the boundary rule this package must respect from day one).
2. Pin every Core and Required package from `TECH_STACK.md` §6 to a current stable version (`npm view <pkg> version`); do not defer this to later phases, since transitive version drift compounds.
3. Configure `tsconfig.base.json` with `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true` (per NFR-012), extended by both packages.
4. Configure ESLint (`eslint-config-next` + `typescript-eslint`), Prettier, Husky + lint-staged pre-commit hook.
5. Add `@t3-oss/env-nextjs` with an initial `env.ts` covering v1's small schema (`NEXT_PUBLIC_APP_ENV`, a client-side Sentry DSN — `ARCHITECTURE.md` §15); it grows only if the Future Scope backend work is ever undertaken.
6. Set up `.github/workflows/ci.yml` (or the confirmed alternative CI platform — `SRS.md` §15.5) running: install → lint → typecheck → build. Test steps are added in Phase 5 once there is something to test.
7. Root `README.md` documenting the workspace layout and how to run `pnpm dev`/`pnpm build`/`pnpm lint`/`pnpm typecheck`.

**Dependencies:** None — this is the starting phase.

**Expected output:** A buildable, lintable, type-checked empty Next.js shell with no feature UI, plus a stub `packages/diff-engine` exporting nothing yet (or empty placeholder types only), plus a green CI pipeline on an empty app.

**Validation criteria:**
- `pnpm install && pnpm lint && pnpm typecheck && pnpm build` all succeed with zero errors from a clean checkout.
- CI runs the same four commands and is green on the initial commit.
- No `next/font/google` or other build-time external-network dependency is introduced (see `ARCHITECTURE.md` note on this — required for CI environments with restricted egress).

---

## Phase 2 — Core Architecture (pure logic, no UI, no backend)

**Objectives:** Port every framework-free algorithm from the artifact into `packages/diff-engine`, and build the client-side `FetchExecutor` boundary, fully typed and unit-testable in isolation, before any UI is built on top of it. This ordering exists because `ARCHITECTURE.md` §5 designates `packages/diff-engine` as the single most important architectural boundary in the whole system — building UI against it before it is correct and typed would propagate errors upward. **This phase builds no backend of any kind** — v1 ships with zero server surface (`SRS.md` §1.3); see the Future Scope section at the end of this document for the backend work this phase's `FetchExecutor` boundary is designed to receive later, if ever needed.

**Features covered:** F-004 (curl parsing), F-005 (fetch execution — client-side only in v1), F-006 (ignore paths), F-007 and all of F-007.1–F-007.6 (compare engine), F-014's non-UI half (markdown report generation).

**Tasks:**
1. Port `canonical()` (order-independent stringification) — no behavior change from the artifact; this is the primitive every other diff function composes.
2. Port `diffArrays`/`diffValues` (FR-018, FR-019) with discriminated-union result types (`MissingField`, `ChangedField`).
3. Port `diffShape` (FR-020 — Structure Schema Compare, A-baseline algorithm) including the `inconsistent-in-a`/`a-empty-array` shared-filter behavior exactly as documented in `FEATURES.md` F-011, pending the fix-or-preserve decision in `SRS.md` §15.7 — implement the artifact's current (quirky) behavior by default and leave a code comment pointing at §15.7, do not silently "fix" it.
4. Port `parseIgnorePatterns`/`pathSegments`/`patternMatchesPath`/`isIgnoredPath` (FR-014, FR-015), including the bare-`*` and compound-path (`tags[0]`/`tags[2]`) behaviors flagged in `FEATURES.md` as ARTIFACT QUIRK items — same rule as above: preserve and comment, do not silently fix.
5. Port `buildLineMap` (FR-021).
6. Port `getPathLevels` (FR-028's level-1/level-2 grouping).
7. Port `renderMissingMarkdown` and related report-building functions (FR-036–FR-038's non-UI half).
8. Port `formatValuePreview` (FR-031's 70-character truncation rule).
9. Write `runCompare(a, b)` as the single typed entry point the UI (Phase 3) and the Web Worker wrapper (Phase 3.6) will call.
10. Implement the curl-command parser (F-004, FR-013), preserving the artifact's documented unknown-flag URL-swallowing bug as an ARTIFACT QUIRK pending `SRS.md` §15.7, unless that decision is made before this task executes.
11. Implement `lib/fetch-executor.ts` (F-005, FR-003): define the `FetchExecutor` interface and its v1 `BrowserFetchExecutor` implementation exactly as specified in `ARCHITECTURE.md` §3.10 — a thin, direct wrapper around the browser's global `fetch()`, matching the artifact's `executeFetchInto` behavior with no added guarding, timeout, or size cap (those are future-scope only, see below). Export the `fetchExecutor` singleton every UI call site will import. **Do not build `app/api/fetch-proxy/route.ts`, `ssrf-guard.ts`, or any other backend file in this phase** — there is no backend in v1.
12. Write unit tests alongside each ported function as it is written (do not defer all testing to Phase 5 for this package specifically — see the Agent Implementation Guidance section), including a test of `BrowserFetchExecutor` against a mocked global `fetch` covering the JSON/non-JSON/non-2xx/thrown-error cases from `FEATURES.md` F-005's acceptance criteria.

**Dependencies:** Phase 1 complete (workspace, TypeScript config, `packages/diff-engine` scaffolded).

**Expected output:** A complete, typed, unit-tested `packages/diff-engine` with zero React/DOM/Next.js imports (verified, not assumed — see validation below), and a working, tested `lib/fetch-executor.ts` with no UI calling it yet and no backend route anywhere in the repository.

**Validation criteria:**
- `packages/diff-engine` has zero imports from `react`, `react-dom`, `next`, or any DOM global — enforceable with an ESLint `no-restricted-imports` rule scoped to that package, added in this phase.
- Unit test coverage on `packages/diff-engine` meets or exceeds NFR-005's 90% line-coverage bar before Phase 2 is considered done (do not defer this to Phase 5).
- `lib/fetch-executor.ts`'s `BrowserFetchExecutor` is unit-tested against a mocked `fetch` for the success, non-2xx, non-JSON, and thrown-error (CORS-equivalent) cases — matching `FEATURES.md` F-005's acceptance criteria, none of which involve a blocked-host or timeout case in v1.
- No `app/api/**` directory, no `ssrf-guard.ts`, and no server-side logging exist anywhere in the repository at the end of this phase — a passing CI check (e.g., a simple `find`/glob assertion in CI) can enforce this if desired, since its absence is itself part of what "done" means for v1.
- Every ARTIFACT QUIRK behavior ported in this phase has an accompanying code comment citing the relevant `FEATURES.md` finding and `SRS.md` §15.7.

---

## Phase 3 — Core Features (UI, built on Phase 2's logic)

**Objectives:** Build every user-facing surface, sub-phased so that lower-numbered sub-phases unblock higher-numbered ones, matching the dependency chains already recorded in `FEATURES.md` §17.

**Dependencies:** Phase 2 complete.

### Phase 3.1 — Input panels (baseline)

**Features covered:** F-001, F-001.1, F-001.2, F-001.4, F-001.5, F-001.8, F-003.1.

**Tasks:** Build `JsonPanel.tsx`/`JsonEditor.tsx` (direct paste/type, FR-001); wire the Zustand store's panel-text state (`ARCHITECTURE.md` §3.6); implement prettify-in-place (FR-004); implement the line-number gutter synced to wrapped lines (FR-008); implement in-panel case-insensitive find with match count and next/previous navigation via `FindBar.tsx` (FR-005); implement the file-upload leg of `AddDataModal.tsx` (FR-002).

**Expected output:** Two independent, editable JSON panels with prettify, find, gutter, and file upload — no fetch, no tree view, no diff yet.

**Validation criteria:** Component tests cover FR-001/FR-002/FR-004/FR-005/FR-008's acceptance criteria as stated in `SRS.md` §2.1 and `FEATURES.md` F-001's per-sub-feature Acceptance Criteria.

### Phase 3.2 — Curl/URL fetch into panels

**Features covered:** F-001.3, F-001.7, F-003.2.

**Tasks:** Wire `AddDataModal.tsx`'s curl/URL leg to call `fetchExecutor.execute(...)` (the `BrowserFetchExecutor` built in Phase 2) — never the global `fetch()` directly; build the persistent, editable inline curl bar (`InlineCurlBar.tsx`, FR-007) that appears once a fetch has populated a panel.

**Dependencies:** Phase 2's `FetchExecutor`/`BrowserFetchExecutor` and curl parser; Phase 3.1's panels.

**Expected output:** Either panel can be populated via a pasted curl command or bare URL, with the response status and pretty-printed (or raw) body landing in the panel, and an editable re-run bar left in place — entirely client-side, no server involved.

**Validation criteria:** Component/integration test (a test double implementing `FetchExecutor`, or MSW mocking the target request itself) covers FR-003/F-005's acceptance criteria; a cross-origin target without permissive CORS headers surfaces the artifact's existing "usually a CORS restriction" message — this is v1's actual failure path, not a blocked-host case (there is no such case in v1).

### Phase 3.3 — Tree view

**Features covered:** F-001.6, F-002, F-002.1–F-002.6.

**Tasks:** Build `JsonTreeView.tsx` (read-only, expandable/collapsible tree per FR-010/FR-011); wire the JSON/Tree tab switch in `JsonPanel.tsx` using shadcn `Tabs` (FR-006), re-parsing on switch and on edit.

**Dependencies:** Phase 3.1 (panel text must exist to render a tree from).

**Expected output:** Each panel can toggle between raw JSON and Tree view without losing underlying text.

**Validation criteria:** Component test confirms switching views never mutates or loses the panel's text (FR-006's acceptance criterion).

### Phase 3.4 — Ignore Paths UI

**Features covered:** F-006 (UI half — logic already ported in Phase 2).

**Tasks:** Build `IgnorePathsField.tsx` wiring the Phase-2 `parseIgnorePatterns`/`isIgnoredPath` functions to the store, with the generic example paths already established in the artifact's help text/placeholder.

**Dependencies:** Phase 2 (ignore-path logic); Phase 3.1 (store shape).

**Expected output:** A working Ignore Paths input that immediately affects downstream result filtering once Phase 3.5 exists.

**Validation criteria:** Component test confirms a pattern change updates derived ignore-state without requiring a re-Compare (FR-014's acceptance criterion) — full end-to-end confirmation completes once Phase 3.5's result sections exist.

### Phase 3.5 — Compare trigger + result sections

**Features covered:** F-009, F-010 (+ F-010.1–F-010.12), F-011, F-012, F-013.

**Tasks:** Wire the Compare action to `runCompare` (Phase 2) via the Web Worker (built in Phase 3.6 — note the ordering nuance: a synchronous main-thread call is an acceptable temporary stand-in here if 3.6 has not landed yet, since NFR-001's non-freezing requirement is validated at 3.6, not 3.5); build `SummaryChips.tsx` (F-009, FR-026); build `MissingFieldsSection.tsx` with side/show-ignored/free-text filters, level-group filters, per-row selection, notes editor, and truncation (F-010.1–F-010.9, FR-027–FR-032); build `StructureCompareSection.tsx` (F-011, FR-033) and `DifferencesSection.tsx` (F-012, FR-034); compose all three into the collapsible `ResultsWrap` (F-013, FR-035) with the documented default-open/closed and jump-to-and-flash behavior.

**Dependencies:** Phase 2 (compare engine); Phase 3.1 (panels); Phase 3.4 (ignore paths, since result sections must respect them from first render).

**Expected output:** A full compare → filter → review workflow, minus export and minus the off-main-thread guarantee.

**Validation criteria:** Component tests cover the full filter-composition matrix (AND semantics, FR-027); a fixture test confirms priority-ordered exclusivity is not needed here (that's Phase 3.6/highlighting) but that ignored findings are excluded from all three sections' counts (FR-024's data-layer half).

### Phase 3.6 — Highlighting, minimap, gutter indicators, scroll-aware pills

**Features covered:** F-001.9, F-001.10, F-001.11, F-008, F-002.5, F-002.6 (and: promote the Phase 3.5 Compare call from synchronous to the `useDiffWorker` hook here).

**Tasks:** Implement the three independent highlight toggles (Missing/Structure/Differences) with Missing > Structure > Differences priority ordering when a line/node qualifies for more than one (FR-022, FR-023); exclude ignore-matched findings from highlighting under any toggle state (FR-024); build the minimap, gutter diff indicators, and scroll-aware "N more above/below" pills (FR-009); move the diff computation into `useDiffWorker.ts` running `packages/diff-engine`'s `runCompare` inside a Web Worker.

**Dependencies:** Phase 3.5 (result data must exist to highlight); Phase 2 (the pure engine, now also proven safe to run inside a Worker due to its DOM-free boundary).

**Expected output:** Full highlighting parity with the artifact, plus the NFR-001 off-main-thread guarantee the artifact itself lacks.

**Validation criteria:** A fixture test with a line qualifying for two highlight categories simultaneously confirms exactly one wins, in priority order (FR-023's stated verification method); a large-payload (approaching the NFR-003 5 MB guard) performance test confirms input panels remain responsive during diffing (NFR-001).

### Phase 3.7 — Export

**Features covered:** F-014 (UI half — report-building logic already ported in Phase 2), F-010.10–F-010.12.

**Tasks:** Build `ExportPreviewPanel.tsx`: full-list export and selected-rows-only export, both guarded on compare-completion (and, for selected-only, a non-empty selection), triggering an automatic file download and showing an in-page preview with copy-to-clipboard (with manual-select fallback on clipboard failure) and a "download again" action.

**Dependencies:** Phase 2 (`renderMissingMarkdown`); Phase 3.5 (row selection state).

**Expected output:** Working Markdown export matching the artifact's exact report structure (FR-036–FR-038).

**Validation criteria:** Snapshot test confirms report structure matches `FEATURES.md` F-014's specification exactly, including conditional sections; a simulated clipboard-write failure test confirms the manual-select fallback still leaves content copyable.

### Phase 3.8 — Sample data, reset, and miscellaneous UI

**Features covered:** F-015, F-016 (+ F-016.1–F-016.3).

**Tasks:** Implement "Load sample" (fixed, key/array-order-shuffled demo payloads and matching Ignore Paths value, no confirmation prompt — FR-039); implement "Clear" (resets panels and all derived compare state, explicitly **not** Ignore Paths, no confirmation prompt — FR-040); implement the scroll-to-top control (FR-041); implement OS/browser `prefers-color-scheme` theming with no in-app override (FR-042); implement the single, non-queued, shared status/error element (FR-043).

**Dependencies:** Phase 3.1–3.7 (this phase touches state owned by all of them).

**Expected output:** Feature-complete v1 baseline UI (F-001 through F-016, all sub-features).

**Validation criteria:** A test confirms Clear resets everything the acceptance criterion lists except Ignore Paths, which must retain its value; a test confirms two guard failures in quick succession leave only the latest message visible (FR-043).

---

## Phase 4 — Remaining Features (optional persistence module — conditionally scoped)

**Objectives:** Implement FR-046–FR-048 (saved comparisons, ignore-path presets, comparison history/sharing) **only if** `SRS.md` §15.2 is resolved in favor of adopting the persistence module. This phase is explicitly blocked on a product decision, not a technical one — do not begin it speculatively. **Note:** this phase is gated on §15.2 specifically (persistence), which is a separate decision from §15.12 (the fetch-proxy hardening described in the Future Scope section below). If Phase 4 is unblocked, it does create an `app/api/**` directory and a real Next.js backend for the first time — but that backend exists to serve persistence, not to change F-005's fetch behavior; F-005 stays on the client-side `FetchExecutor` from Phase 2 unless §15.12 is *also* separately resolved.

**Features covered:** The "optional persistence module" row in `FEATURES.md` §17 (no F-ID assigned; extends F-006 and F-010), FR-046, FR-047, FR-048.

**Tasks (only if unblocked):**
1. Resolve `SRS.md` §15.1 (auth/SSO decision) as a hard prerequisite — persistence requires knowing who owns a saved comparison.
2. Stand up `packages/db` (Drizzle schema for `Comparison`, `IgnorePathPreset` per `SRS.md` §5).
3. Implement `POST/GET /api/comparisons` and `POST/GET /api/presets` (`SRS.md` §6).
4. Wire save/retrieve/share UI, integrated into the Phase 3 UI without disrupting the no-persistence baseline flow (the app must remain fully usable with this module absent, per `SRS.md` §1.3's out-of-scope note).
5. Apply the data-classification/retention treatment resolved in `SRS.md` §15.4 to any stored payload/note content.

**Dependencies:** Phases 1–3 complete; `SRS.md` §15.1, §15.2, §15.4 all resolved.

**Expected output:** Optional saved-comparison, preset, and sharing functionality, or — if §15.2 resolves "no" — this phase is formally skipped and the plan proceeds to Phase 5 with the v1 baseline only.

**Validation criteria:** A saved comparison round-trips byte-for-byte on both panels' text through save → reload (FR-046's acceptance criterion); a saved preset applies identically to typing its patterns manually (FR-047); a shared comparison is viewable by the recipient and not independently discoverable by ID guessing (FR-048).

---

## Phase 5 — Testing

**Objectives:** Close any remaining coverage gaps left after the incremental testing already required in Phases 2–4, and add the cross-cutting test types that don't belong to a single feature (accessibility, cross-browser, performance/load).

**Features covered:** Cross-cutting — NFR-005, NFR-006, NFR-009.

**Tasks:**
1. Audit `packages/diff-engine` coverage against NFR-005's 90% line-coverage bar; backfill any gap.
2. Audit component test coverage against `FEATURES.md`'s claim that "every filter/toggle interaction... has at least one component test" (NFR-005) — this is a completeness check against the Feature Coverage Matrix (§17), not a from-scratch test-writing pass.
3. Add/complete the Playwright e2e suite: primary compare flow, fetch-via-curl flow, and — if Phase 4 shipped — save/retrieve flow (`SRS.md` §4.1–§4.3).
4. Add axe-core (or equivalent) automated accessibility checks against NFR-006's WCAG 2.2 AA target, covering the specific gaps enumerated in `SRS.md` §7/`ARCHITECTURE.md` accessibility notes.
5. Cross-browser pass across the last two major versions of Chrome, Firefox, Safari, and Edge (NFR-009), via Playwright's multi-browser projects.
6. Load/perf test: a payload near the NFR-003 5 MB guard, confirming the NFR-001 timing targets (<300ms typical, <1.5s large) and that the Worker-based diff (Phase 3.6) keeps panels responsive throughout.

**Dependencies:** Phases 1–3 complete (Phase 4's tests only if Phase 4 shipped).

**Expected output:** A CI-enforced test suite (unit + component + e2e + accessibility) covering every FR/NFR this specification defines, with coverage numbers reported, not asserted.

**Validation criteria:** CI's test stage is green; a coverage report is attached to the CI run showing `packages/diff-engine` at ≥90% line coverage; the e2e suite passes on all four target browsers in Playwright's matrix.

---

## Phase 6 — Production Readiness

**Objectives:** Everything required for NFR-004 (fault isolation), NFR-007/NFR-013 (security/data-sensitivity, client-side scope for v1), and NFR-002 (load performance) to actually hold under real conditions, not just in unit tests. NFR-008/NFR-010's server-side logging requirements are future-scope-only (§2.9 in `SRS.md`) and are not part of this phase's validation criteria for v1.

**Features covered:** Cross-cutting — no new F-IDs; this phase hardens what Phases 2–5 built.

**Tasks:**
1. Add error boundaries per major UI section (panels, results sections, export) so a single malformed input or rendering exception in one section cannot crash the whole page (NFR-004).
2. Wire `@sentry/nextjs`'s client-side SDK end to end, confirming no payload/note content ever reaches an error report (NFR-013) — this must be tested, not just configured, via new tests for the UI-level error boundaries. There is no server-side OpenTelemetry/`pino` wiring in this phase — no server exists in v1 (see Future Scope).
3. Add standard security headers and a Content Security Policy appropriate to this app's asset/script sources (`ARCHITECTURE.md` §12).
4. Run a dependency vulnerability scan (e.g., `pnpm audit` or an equivalent SCA tool) and resolve or explicitly accept-and-document any findings — the scan surface is deliberately small in v1, since there is no backend dependency tree to scan.
5. Verify Largest Contentful Paint on the empty shell is under 2s on a broadband connection (NFR-002), and re-verify NFR-001's diff timing targets under production build output (not dev mode).
6. Confirm the 5 MB payload guard (NFR-003) shows a clear "payload too large" message rather than freezing the tab, in a production build.

**Dependencies:** Phases 1–5 complete.

**Expected output:** A production build that meets every v1-applicable NFR in `SRS.md` §3, verified rather than assumed.

**Validation criteria:** A deliberately-triggered client-side exception (e.g., forcing a rendering error in a results section) is caught by its error boundary and reported to the error tracker with no sensitive content, per `SRS.md` §9/§11's verification method; Lighthouse (or equivalent) confirms the LCP target; the dependency scan report is clean or has documented accepted risks.

---

## Phase 7 — Deployment

**Objectives:** Ship the application to the chosen target, with the CI/CD pipeline fully wired end to end.

**Features covered:** None new — infrastructure only.

**Tasks:**
1. Resolve `SRS.md` §15.3 (Vercel vs. Docker/company-platform) — this phase cannot meaningfully begin until this decision is made; if it is not made in time, proceed with whichever option the team designates as the interim/staging target and flag production deployment as still blocked.
2. **If Vercel (Option A):** configure the project, environment variables (per `TECH_STACK.md` §2.13's `env.ts` schema), and preview-deployment-per-PR wiring.
3. **If Docker (Option B):** write the `Dockerfile`, health-check endpoint, and log-shipping configuration to integrate with the company's existing platform (Kubernetes/ECS/internal PaaS).
4. Extend `.github/workflows/ci.yml` (or the confirmed CI platform) with a deploy stage gated on the full green pipeline (lint → typecheck → build → test) from Phases 1–6.
5. Document the rollback procedure for whichever target was chosen.

**Dependencies:** Phases 1–6 complete; `SRS.md` §15.3 resolved (or an interim target designated).

**Expected output:** A live, deployed application reachable at a production (or interim staging) URL, with a working CI/CD pipeline from commit to deploy. **Note:** v1 has no backend network-reachability concern to verify here — F-005's fetch runs in each end user's own browser, not from the deployment host, so there is no outbound-network-policy check analogous to what a server-side proxy would need (that check belongs to the Future Scope work below, if it is ever built).

**Validation criteria:** A deploy triggered through the pipeline succeeds and the live URL serves the application; a rollback is exercised at least once in a non-production environment to confirm the documented procedure actually works.

---

## Future Scope — Backend Layer (Deferred, Not Part of the 7-Phase v1 Plan)

**This section describes work that is not scheduled in Phases 1–7 above and must not be started as part of implementing v1.** It exists so that, if `SRS.md` §15.12's trigger condition is ever met (a security review flags the client-side fetch, a real need for saved/shared comparisons emerges, or a target API only works from a server network location), the backend layer gets built from a real design instead of improvised later. This is the implementation-plan counterpart to `ARCHITECTURE.md` §4 (full architectural design) and `SRS.md` §2.9 (the deferred FR-044/FR-045 requirements) — read those two for the *what*; this section is the *how to sequence it* if the day comes.

**Trigger:** `SRS.md` §15.12 answered, or Phase 4 (persistence) unblocked — either one independently justifies standing up `app/api/**` for the first time (see the note on Phase 4 above distinguishing the two triggers).

**If triggered, suggested tasks (numbered independently of Phases 1–7 — think of this as "Phase 8," deliberately not folded into the 7-phase structure the original specification calls for, so it stays visibly optional):**

1. Implement `ssrf-guard.ts` and `guarded-fetch-executor.ts` exactly as specified in `ARCHITECTURE.md` §4.3, unit-tested in isolation before wiring them to any route — this is the single most security-critical code in the project once it exists, and deserves the same "logic before UI" discipline Phase 2 applied to `packages/diff-engine`.
2. Implement `app/api/fetch-proxy/route.ts` (`ARCHITECTURE.md` §4.2) calling the guard and executor, mapping errors to the typed envelope (FR-045).
3. Write a `ProxiedFetchExecutor` implementing the same `FetchExecutor` interface Phase 2 already defined, and swap the exported `fetchExecutor` singleton to use it. **This step should require zero changes to `AddDataModal.tsx`, `InlineCurlBar.tsx`, or any existing test written against the `FetchExecutor` interface** — if it does require such changes, that is a signal the Phase 2 interface was not designed correctly, not that this step is simply "extra work."
4. Add the SSRF-specific tests deferred from Phase 2: a request to `169.254.169.254` (and other blocked ranges, including via a redirect) rejected pre-connect, verified by asserting the outbound `fetch` is never invoked for a blocked target (FR-044's acceptance criterion).
5. Add `pino` structured logging and OpenTelemetry instrumentation (`TECH_STACK.md` §2.15), verified to never log request/response bodies or credential header values (FR-045, NFR-008).
6. Re-run Phase 7's deployment validation with the now-real backend-network-reachability question: confirm the deployed environment's outbound network policy actually permits (or correctly blocks) the fetch-proxy's intended targets.
7. If Phase 4 (persistence) is being built at the same time, follow its own task list — the two share the same `app/api/**` infrastructure but are independent features with independent acceptance criteria.

**Validation criteria (only meaningful once this work is actually undertaken):** every criterion listed under `SRS.md` §2.9's FR-044/FR-045 rows, and `ARCHITECTURE.md` §11's fetch-proxy-specific test descriptions.

---

## 8. Agent Implementation Guidance

This section is written directly for a future AI coding agent (or engineer) picking up this specification with no other context. For **every** feature in `FEATURES.md`, before writing code, resolve the following in order:

1. **What to build** — read the feature's full entry in `FEATURES.md` (Feature Definition through Acceptance Criteria), not just its one-line Feature Index summary. The Index exists for navigation, not for scoping a task.
2. **Why it exists** — read the feature's Feature Definition and, where present, its cross-referenced FR-ID(s) in `SRS.md` for the requirement-level "why," and any ARTIFACT QUIRK callout for the historical "why it behaves this specific, sometimes-odd way."
3. **How it must behave** — read the feature's User Flow, UI Behavior, Business Logic, and Validation subsections in full; these are the actual specification, not the Feature Definition's summary sentence.
4. **Where it belongs** — check `ARCHITECTURE.md` §3.3's feature-module-to-component mapping table and §8's Package Responsibility Map for which package/component owns this code and, just as important, what that component must **not** contain (e.g., `packages/diff-engine` must never import React or touch the DOM).
5. **What data it requires** — check the feature's Data subsection and, if it touches persistence, `SRS.md` §5's data model.
6. **Which packages to use** — check `TECH_STACK.md` §2's per-decision rationale for the *why*, not just §3's flat package list, before introducing any dependency not already named there. If a task seems to need a package not in `TECH_STACK.md`, stop and treat that as a new open question rather than silently adding a dependency — append it to `SRS.md` §15 rather than deciding unilaterally.
7. **How it interacts with other features** — check the feature's Dependencies subsection and `FEATURES.md` §17's Feature Coverage Matrix "Dependencies" column; do not build a feature whose listed dependencies are not yet implemented, even if it looks technically possible to stub around them — the stub will diverge from the real dependency's eventual behavior.
8. **What states must be supported** — check the feature's Application States subsection; every listed state (loading, empty, error, partial-result, etc.) needs a corresponding UI/logic branch, not just the happy path.
9. **What edge cases must be handled** — check the feature's Edge Cases subsection, and specifically check whether the edge case is an ARTIFACT QUIRK flagged for a fix-or-preserve decision in `SRS.md` §15.7. If it is, **preserve the artifact's current behavior and comment the code with a pointer to §15.7** — do not silently fix it, and do not silently preserve it without a comment either, since a future reader needs to know it was a deliberate choice, not an oversight.
10. **How to test it** — check the feature's Acceptance Criteria; these are written to be directly translatable into test assertions, and in several cases (e.g., F-006, F-011, F-023) name the exact fixture condition that proves correct behavior.
11. **How to know it's done** — a feature is done when its Acceptance Criteria pass under test, its Feature Coverage Matrix row's Dependencies are genuinely implemented (not stubbed), and no ARTIFACT QUIRK or Open Question touching it has been silently resolved by the implementation instead of by an explicit product decision.

**Standing rule across all phases:** if implementation surfaces a behavior in the artifact that no existing `FEATURES.md` entry documents, or a genuine ambiguity `SRS.md` §15 does not already cover, stop and add it to `SRS.md` §15 rather than deciding it inline in code. This specification was built on an explicit "do not invent missing behavior" instruction, and that constraint extends to implementation, not just documentation.

**Standing rule on ARTIFACT QUIRKs specifically:** every quirk currently defaults to "preserve, and comment the preservation" (see Phase 2, tasks 3–4, and Phase 3.8) until `SRS.md` §15.7 is explicitly answered. If §15.7 is answered mid-implementation, update the affected code and remove the quirk comment in the same change that resolves the SRS entry — do not let the two drift.

---

## 9. Related documents

- `SRS.md` — FR-xxx/NFR-xxx definitions cited throughout; §15 is the canonical Open Questions register that gates Phase 4 and parts of Phase 7.
- `FEATURES.md` — F-xxx feature definitions this plan builds, in the order specified here; §17's Feature Coverage Matrix "Implementation Phase" column must stay in sync with this document's phase numbers.
- `ARCHITECTURE.md` — component/package boundaries (§3, §8), deployment options in detail (§13), migration-mapping table (§17) showing exactly which artifact function becomes which new module in which phase.
- `TECH_STACK.md` — the package decisions this plan installs (Phase 1) and progressively adopts (Phases 2–4).
