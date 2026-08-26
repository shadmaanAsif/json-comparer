# TECH_STACK.md — Technology Stack Specification

**Project:** JSON Response Comparer — standalone conversion
**Status:** Specification — implementation not started
**Last updated:** 2026-08-21

> This document is part of the implementation contract described in `SRS.md` and `ARCHITECTURE.md`. It specifies every technology and package selected for the standalone build, why each was selected, where each is used (cross-referenced to `FEATURES.md` F-IDs and `SRS.md` FR-IDs), what alternative was considered, and the trade-off accepted. Package majors reflect what was verifiable as current at the time of writing (August 2026); exact patch versions must be re-pinned at bootstrap time (`npm view <pkg> version`) rather than trusted from this document. Any decision that depends on information not available to this specification (existing company SSO, CI platform, hosting policy, data-classification policy) is listed in §7 and is **not** resolved here — see `SRS.md` §15, the single canonical Open Questions register.

---

## 1. Categorization key

Every technology below is tagged with exactly one of:

- **Core** — the application cannot be built without this; there is no scoped-down version of the product that omits it.
- **Required** — necessary for this specification's baseline (v1) scope as defined in `SRS.md` §1.3, but the product would still minimally function without it (e.g., a required security control).
- **Recommended** — the default choice for this project, actively advised, but a reasonable substitute exists and is named; adopting the substitute does not violate any requirement in `SRS.md` or `ARCHITECTURE.md`.
- **Optional** — only needed if a specific open question (`SRS.md` §15) is resolved in the direction that requires it (persistence, auth, a specific hosting target).
- **Development-only** — never ships in the production runtime bundle/server; build-time, test-time, or contributor-tooling only.

---

## 2. Technology decisions

### 2.1 Frontend framework — Next.js 16 (App Router, Turbopack) + React 19.2

**Category:** Core

**Purpose:** Application shell, file-based routing, server/client component boundary, build/bundling. Route Handlers are part of the framework but **unused in v1** — see §2.9.

**Why selected:** `SRS.md` §1.1 requires a "standalone, production-ready" rewrite of a tool that is currently a client-heavy editing surface (two live-edited panels, real-time diff, DOM-heavy tree views — F-001, F-002, F-007) wrapped in mostly-static chrome (toolbar, results shell). The App Router's Server/Client Component split lets the static shell ship zero JS while the editors, diff tables, and modals become explicit `"use client"` islands — a direct architectural improvement over the artifact, which ships and executes everything as one blocking inline `<script>`. **v1 has no Route Handlers at all** (`SRS.md` §1.3) — F-005's fetch feature runs entirely client-side, matching the artifact exactly (§2.9 explains why, and how the seam for a future proxy stays open).

**Where used:** Entire `apps/web` package — every feature F-001 through F-016, including F-005, renders/runs through this framework client-side; no `app/api/**` route exists in v1.

**Alternatives considered:**
- *Remix / React Router v7* — comparable Server/Client model; rejected only because Next.js has the deeper shadcn/ui and Vercel-deployment ecosystem overlap requested implicitly by the "prefer React/Next.js" instruction that originated this specification.
- *Vite + React SPA, with a small separate Express/Fastify proxy service* — a legitimate fallback if the team has zero interest in SSR and wants the simplest static deploy (e.g., internal tool behind a VPN with no need for server rendering). Documented as **Option B** in `ARCHITECTURE.md` §13.

**Trade-off accepted:** Next.js's opinionated conventions (file-based routing, the Server/Client boundary) cost some flexibility versus a bare SPA, in exchange for SSR, streaming, and a built-in API layer that removes the need for a second deployable.

---

### 2.2 Language — TypeScript 5.x, `strict` mode

**Category:** Core

**Purpose:** Static typing across the entire codebase, including the ported diff engine.

**Why selected:** The artifact's compare logic (`diffValues`, `diffArrays`, `diffShape`, `patternMatchesPath`, `buildLineMap` — F-006, F-007) is intricate, recursive, and currently has zero compile-time or test-time safety net; a mis-handled case silently mis-reports a difference. `strict: true` plus discriminated-union result types (`MissingField`, `ChangedField`, `StructureFinding` — see `ARCHITECTURE.md` §5) removes an entire class of "forgot to handle this branch" bugs before NFR-005's test-coverage requirement even runs.

**Where used:** `packages/diff-engine` (all logic), `apps/web` (all components, routes, store).

**Alternatives considered:** None credible for a specification whose explicit non-negotiable is "production-ready" — plain JavaScript was not evaluated as a serious option.

**Trade-off accepted:** None material; the type-authoring overhead is the intended cost of NFR-012 (developer-experience gates).

---

### 2.3 Styling — Tailwind CSS v4

**Category:** Core

**Purpose:** Utility-first styling; design tokens for the light/dark, spacing, and per-diff-category color system.

**Why selected:** The artifact already hand-rolls a complete design-token system as CSS custom properties (light/dark palette, spacing scale, colors per diff category — F-008, F-016.2). Tailwind v4's CSS-first configuration (`@theme` in CSS, no `tailwind.config.js` required) maps almost directly onto the existing `:root` custom properties, making the migration mechanical rather than a redesign.

**Where used:** Every component in `apps/web`; `app/globals.css` for the theme tokens (NFR-006 contrast requirements are enforced at this layer).

**Alternatives considered:** CSS Modules, vanilla-extract, styled-components — all rejected as the default because none map as directly onto the artifact's existing token system, and CSS-in-JS specifically adds a runtime style-injection cost Tailwind avoids.

**Trade-off accepted:** Utility-class verbosity in JSX versus a semantic-class stylesheet; accepted because it keeps styling colocated with the component and matches the shadcn/ui component convention below.

---

### 2.4 UI components — shadcn/ui (Radix UI primitives)

**Category:** Required

**Purpose:** Accessible, keyboard-navigable primitives: `Dialog` (F-003's Add Data Modal), `Tabs` (F-001.6 JSON/Tree switch), `Select` (F-010.6 notes status dropdown), `Checkbox` (F-010, F-011, F-012 filter checkboxes), `Tooltip`, `Collapsible` (F-013 result sections).

**Why selected:** NFR-006 requires WCAG 2.2 AA conformance, and `FEATURES.md` §18's Documentation Coverage Audit flags the artifact's hand-rolled modal/tabs/dropdown as accessibility-incomplete (missing focus trapping, incomplete ARIA wiring in places). shadcn/ui is not a black-box library dependency — components are generated into the repo (`npx shadcn add dialog tabs select checkbox tooltip collapsible`) on top of Radix UI primitives, giving correct ARIA behavior out of the box while leaving full ownership of the component source for the diff-specific styling (add/remove/changed row coloring, gutter, minimap) that has no shadcn equivalent.

**Where used:** `AddDataModal.tsx` (F-003), `JsonPanel.tsx` tabs (F-001.6), `NoteEditor.tsx` (F-010.6), filter checkboxes across `MissingFieldsSection.tsx` / `StructureCompareSection.tsx` / `DifferencesSection.tsx` (F-010, F-011, F-012), `ResultsWrap` collapsible sections (F-013).

**Alternatives considered:** MUI, Chakra UI, Ark UI — rejected as default because they impose their own styling engine and visual language, fighting rather than extending the artifact's existing token system. Any of the three remains reasonable if the organization already standardizes on one (open question, `SRS.md` §15.6).

**Trade-off accepted:** Generated-in-repo components must be manually updated when shadcn/ui ships upstream fixes (no automatic dependency-update path) — accepted in exchange for full styling control.

---

### 2.5 Client state — Zustand

**Category:** Core

**Purpose:** Central client state store: both panels' text, parsed diff results, active filters, ignore-path patterns, per-row notes, selection state, active tab per panel — the store interface specified in full in `ARCHITECTURE.md` §3.6.

**Why selected:** All of this state is local UI/session state, not shared server data — a textbook Zustand use case: a small number of stores, no reducer boilerplate, selector-based subscriptions so, e.g., the gutter (F-001.8) re-renders on scroll without re-rendering the whole results table (F-010–F-012). This directly replaces the artifact's ad hoc top-level `let` globals (`lastMissing`, `lastNotes`, etc. — see `ARCHITECTURE.md` §17 migration table) with a single typed, testable store.

**Where used:** `apps/web/lib/store/` — consumed by every interactive component (F-001 through F-013, F-015).

**Alternatives considered:**
- *Redux Toolkit* — rejected as default: its slice/thunk/`configureStore` ceremony buys little here since there is no undo/redo or time-travel debugging requirement.
- *Jotai* — a better fit for large forms with many independent atomic fields; this app's state is closer to a handful of cohesive documents, which Zustand's "one store, selector-based reads" model expresses more directly.
- *Plain React Context* — rejected: re-render granularity would be too coarse for the scroll-synced gutter/minimap features (F-001.8–F-001.11).

**Trade-off accepted:** None material; either named alternative is an acceptable substitute if the team already standardizes on one.

---

### 2.6 Server/data cache — TanStack Query (React Query) v5

**Category:** Optional (gated on `SRS.md` §15.2 — persistence module adoption)

**Purpose:** Owns server-derived data (fetch, cache, retry, invalidate) for the optional saved-comparisons/presets APIs (FR-046–FR-048), keeping a clean line between "data from the server" and Zustand's local UI state.

**Where used:** Only inside the optional persistence module UI (`apps/web/app/(app)/history/*`, preset management) — not used anywhere in the v1 baseline (FR-001–FR-045).

**Alternatives considered:** SWR, RTK Query — both reasonable; TanStack Query preferred for its wider adoption and richer devtools as of 2026.

**Trade-off accepted:** N/A while unused; adds a dependency only if the persistence module ships.

---

### 2.7 Validation — Zod v4

**Category:** Core

**Purpose:** Runtime schema validation at every trust boundary: pasted/uploaded JSON structure (F-001.1, F-001.2), the ignore-path pattern syntax (F-006), the fetch-proxy request body (F-005, FR-044), and environment variables (§2.12 below).

**Why selected:** The artifact currently validates almost nothing at its trust boundaries beyond a bare `JSON.parse` try/catch (FR-016). Zod remains the default for TypeScript-first schema validation in 2026, with the deepest ecosystem integration relevant here: React Hook Form resolvers (§2.8), `@t3-oss/env-nextjs` (§2.12), and — if the persistence module is adopted — `drizzle-zod`.

**Where used:** `packages/diff-engine` (input-shape guards where practical without adding a runtime dependency to the pure-logic package — see `ARCHITECTURE.md` §5 for the boundary decision), `app/api/fetch-proxy/route.ts` request validation (FR-044), `env.ts` (§2.12).

**Alternatives considered:** Valibot (smaller bundle, faster hot-path validation — worth revisiting only if client bundle size becomes a measured problem, which is unlikely since the editor/tree UI already dominates bundle size), ArkType (newer, smaller ecosystem, not mature enough to default to today).

**Trade-off accepted:** Zod's bundle weight versus Valibot's; accepted because validation is not the bundle-size bottleneck in this application.

---

### 2.8 Forms — React Hook Form + `@hookform/resolvers` (Zod)

**Category:** Optional (gated on `SRS.md` §15.2 — persistence module and/or any settings forms beyond the two JSON panels)

**Purpose:** Form state/validation for save-comparison naming, preset naming, or any settings form introduced by the optional persistence module.

**Where used:** Only inside the optional persistence module UI.

**Alternatives considered:** Formik (heavier re-render model), native `<form>` + Server Actions only (viable for very simple single-field forms, but loses client-side validation ergonomics RHF+Zod provides).

**Trade-off accepted:** N/A while unused.

---

### 2.9 Backend/API layer — Next.js Route Handlers + Server Actions

**Category:** Future scope — deferred, not built for v1 (`SRS.md` §1.3/§2.9/§15.12)

**Decision (supersedes this document's earlier draft):** v1 ships with **zero backend**. F-005's curl/URL fetch runs as a direct client-side `fetch()`, exactly matching the artifact, behind the `FetchExecutor` interface (`ARCHITECTURE.md` §3.10). Route Handlers and Server Actions are not used anywhere in v1 — not for the fetch feature, and not for anything else, since nothing else in the v1 feature set (`FEATURES.md` F-001–F-016) needs a server at all.

**Purpose (if and when built):** `POST /api/fetch-proxy` would execute the curl/URL fetch server-side instead of client-side, fixing the CORS limitation permanently and hosting the SSRF/timeout/size-cap controls specified by FR-044/FR-045 (`SRS.md` §2.9). If the optional persistence module is also adopted, its mutations (save comparison, save preset) would be a natural fit for Server Actions.

**Where used:** Nowhere in v1. If built: `app/api/fetch-proxy/route.ts` (F-005, future scope); optionally `app/actions/*.ts` for persistence mutations.

**Why deferred rather than built now:** the artifact's own fetch feature is client-side and has shipped and been used as such; nothing in scope demands it become server-side for v1 to be complete or shippable. Building a server-side proxy with no driving requirement would be exactly the kind of speculative infrastructure `ARCHITECTURE.md` §1 principle 5 warns against. The `FetchExecutor` interface (`ARCHITECTURE.md` §3.10) is the one piece of forward-looking design actually built now — a few lines of abstraction — specifically so this deferral costs nothing later: adding the backend when/if `SRS.md` §15.12's trigger condition is met means writing a new `ProxiedFetchExecutor` and a Route Handler, not touching any existing call site.

**Alternatives considered (for when/if this is built):** tRPC layered on top of Route Handlers — a reasonable *addition*, not a replacement, if the team later wants end-to-end type-safe client-server calls beyond typed Server Actions; not adopted by default to avoid introducing a concept the scope doesn't require. A standalone NestJS/Express API service — would still be rejected even if the backend is built: no second team/client would consume this API, so a second deployable buys nothing.

**Trade-off accepted:** If the organization already runs a shared internal API/BFF platform, a future fetch-proxy or persistence endpoints likely belong there instead (open question, `SRS.md` §15.10) — moot for v1, relevant only once/if this layer is actually built.

---

### 2.10 Diff engine execution — Web Worker

**Category:** Required

**Purpose:** Runs the ported, pure `packages/diff-engine` logic (F-007) off the browser main thread.

**Why selected:** NFR-001 explicitly requires diffing not to freeze input panels for large payloads (up to the 5 MB guard in NFR-003) — a **new** requirement versus the artifact's synchronous main-thread diff, which has no such guard today. Because `packages/diff-engine` is deliberately framework/DOM-free (`ARCHITECTURE.md` §5, §8), it can run identically inside a Worker or on the main thread with no code change — only the call site differs.

**Where used:** `apps/web/lib/hooks/useDiffWorker.ts` (`ARCHITECTURE.md` §3.5), wrapping `packages/diff-engine`'s `runCompare`.

**Alternatives considered:** Main-thread execution (the artifact's current approach) — rejected as the production default because it directly violates NFR-001 for large payloads; remains acceptable as a same-thread fallback path for environments without Worker support, if that becomes a requirement.

**Trade-off accepted:** Worker message-passing (structured-clone cost for large payload transfer) versus main-thread blocking; accepted because NFR-001's non-freezing requirement is explicit and non-negotiable.

---

### 2.11 Database & ORM — PostgreSQL + Drizzle ORM

**Category:** Optional (gated on `SRS.md` §15.2)

**Purpose:** Storage for `Comparison`, `IgnorePathPreset`, and related entities (`SRS.md` §5) if the optional persistence module (FR-046–FR-048) is adopted. The current artifact is entirely stateless/client-only — there is nothing to persist in the v1 baseline.

**Where used:** `packages/db` (optional package) only.

**Why Drizzle over Prisma:** Drizzle's SQL-first API has a thinner runtime and faster cold starts, relevant on serverless/edge functions where Prisma's engine binary has historically added startup latency; its schema-as-TypeScript approach keeps migrations and types in one file. Prisma remains a fully reasonable alternative, particularly for its more polished migration UX (`prisma migrate`) and visual data browser (`prisma studio`) — this is a genuine toss-up, not a strong recommendation.

**Why PostgreSQL, and specifically Neon or Supabase:** cheap to run, branch-per-PR environments (Neon), and works well with serverless/edge deploy targets consistent with §2.1's framework choice.

**Trade-off accepted:** Committing to this module before §15.2 and §15.4 (data-classification policy for the customer-identifying content the sample payloads already model) are answered risks building storage for data the organization may not want persisted at all — hence "optional," not "recommended."

---

### 2.12 Auth — open decision (Better Auth / Auth.js / company SSO / none)

**Category:** Optional (gated on `SRS.md` §15.1)

**Purpose:** Authentication and session management, needed only if the persistence module ships or if network-layer access control (VPN/internal-only deployment) is judged insufficient.

**Options, not a recommendation:**
1. **Federate into an existing company SSO/IdP via OIDC** — almost certainly correct for an internal engineering tool if Almosafer already centralizes internal-tool auth this way; not assumed here because the IdP is unknown (`SRS.md` §15.1).
2. **Better Auth** — modern, self-hosted, framework-agnostic, first-class Next.js support, OIDC/SSO plugin; the default *if* there is no existing SSO to plug into.
3. **Auth.js (NextAuth) v5** — mature, free, included for completeness; reasonable if the team already has NextAuth expertise/infra.
4. **Clerk** — fully managed, fastest to ship, but adds a paid third-party dependency and off-site user-data storage; better suited to a customer-facing product than an internal tool.
5. **No auth** — matches the artifact's current "anyone with the link can use it" model; legitimate for v1 if access is gated at the network layer instead. This is the only option compatible with skipping the persistence module entirely.

**Where used:** Only if a persistence module or access-control requirement is adopted; none of F-001–F-016 (the v1 baseline) require it.

**Trade-off accepted:** Deferred entirely — no default is asserted, per the "do not invent missing behavior" instruction governing this specification.

---

### 2.13 Env/config validation — `@t3-oss/env-nextjs`

**Category:** Required

**Purpose:** Validates `process.env` against a Zod schema at build/startup time.

**Why selected:** Even v1's small env surface (`NEXT_PUBLIC_APP_ENV`, a client-side Sentry DSN — `ARCHITECTURE.md` §15) benefits from failing fast and loud at boot rather than a confusing runtime error. The schema is deliberately tiny for v1 and grows only if the future backend layer (§2.9) adds real server env vars (an allow-listed proxy domain list for FR-044, an auth secret if §2.12 is adopted). Built specifically for Next.js's client/server env split; Zod-backed, consistent with §2.7.

**Where used:** `apps/web/lib/env.ts`.

**Alternatives considered:** Manual `process.env` access — rejected: no fail-fast guarantee, no type safety.

**Trade-off accepted:** None material.

---

### 2.14 Testing — Vitest, React Testing Library, Playwright, MSW

**Category:** Development-only (Required within that category — NFR-005 makes test coverage a hard gate, not an optional nicety)

**Purpose:**
- **Vitest** — unit test runner for `packages/diff-engine`'s pure functions (the highest-value tests in the whole codebase, per `ARCHITECTURE.md` §11) and component tests for `apps/web`.
- **React Testing Library** — component tests (editor panel behavior, filter interactions, notes editing), testing user-visible behavior over implementation details.
- **Playwright** — end-to-end coverage of full flows: compare → filter → export (F-007→F-014), fetch-via-curl (F-004/F-005 — a client-only flow in v1, tested against a local mock target rather than a proxy), across Chromium/Firefox/WebKit.
- **MSW** — mocks the F-005 target request itself (there is no fetch-proxy endpoint to mock in v1) and, if the future backend layer is built, would mock that endpoint too, so tests never depend on real network calls.

**Where used:** `packages/diff-engine/tests/**`, `apps/web/**/*.test.tsx`, `apps/web/e2e/**`.

**Alternatives considered:** Jest + RTL (Vitest preferred for faster ESM-native watch mode in a Next.js/Vite-adjacent toolchain); Cypress (Playwright preferred for native multi-browser/multi-tab support and generally lower CI flakiness).

**Trade-off accepted:** None material — this category is a hard requirement of NFR-005, not a discretionary pick.

---

### 2.15 Logging & observability — `@sentry/nextjs` (v1); pino, OpenTelemetry (future scope only)

**Category:** Required (`@sentry/nextjs`, client-side only in v1) / Future scope, deferred (`pino`, OpenTelemetry — no server exists in v1 to instrument)

**Purpose:** v1: error tracking and performance monitoring (`@sentry/nextjs`'s client-side SDK) replacing the artifact's silent `catch` blocks (e.g., its swallowed CORS failure) with real production visibility into what end users actually hit. *(Future scope, if the backend layer is built):* structured server-side logs (`pino`) satisfying NFR-010's correlation-ID/tracing requirement without ever logging payload content or credential header values (FR-045, NFR-008, NFR-013); OpenTelemetry instrumentation (`instrumentation.ts`) for server-side spans, exportable to whichever observability backend the organization already runs.

**Where used:** v1: client-side error boundaries only. Future scope: `app/api/fetch-proxy/route.ts` and any persistence Route Handlers/Server Actions, if built.

**Alternatives considered:** `winston` (pino preferred for lower overhead), console-only logging (rejected: not queryable, not correlated), Highlight.io or a self-hosted Grafana stack instead of Sentry (reasonable if the organization already standardizes on one — open question, `SRS.md` §15.11).

**Trade-off accepted:** Where traces should ultimately land (Sentry itself as OTel backend vs. an existing company backend) is unresolved — see `SRS.md` §15.11; this document specifies the instrumentation layer, not the destination.

---

### 2.16 Package manager & build tooling — pnpm + Turbopack

**Category:** Development-only

**Purpose:** Monorepo dependency management (`apps/web` + `packages/diff-engine` + optional `packages/db`) and application bundling.

**Why selected:** pnpm's strict, non-flattened `node_modules` catches "phantom dependency" bugs (importing a package only transitively installed) earlier — relevant once the dependency list grows past the artifact's current zero. Turbopack ships as Next.js 16's default bundler/dev server; no separate choice to make there.

**Where used:** Repository root (`pnpm-workspace.yaml`) and every workspace package.

**Alternatives considered:** npm, Yarn (Berry) — both viable; pnpm preferred for disk efficiency and the phantom-dependency guarantee.

**Trade-off accepted:** None material.

---

### 2.17 Linting, formatting, git hooks — ESLint, Prettier, Husky + lint-staged

**Category:** Development-only

**Purpose:** Enforces NFR-012's CI gate (lint blocks merge on failure) and pre-commit consistency.

**Where used:** Repository-wide; `.github/workflows/ci.yml`; `.husky/pre-commit`.

**Alternatives considered:** Biome (faster, but less mature Next.js-specific rule coverage as of this writing) as a future revisit, not a current default.

**Trade-off accepted:** None material.

---

### 2.18 CI/CD platform — GitHub Actions (assumption, not a confirmed fact)

**Category:** Required, pending confirmation — see `SRS.md` §15.5

**Purpose:** Runs lint → typecheck → build → test on every PR, per NFR-012.

**Why assumed:** Broad industry default; no confirmation available of the organization's actual VCS/CI platform. **This is explicitly an assumption, not a researched fact** — GitLab CI, Bitbucket Pipelines, and Jenkins are equally plausible and require no architectural change if substituted, only a pipeline-file rewrite.

**Where used:** `.github/workflows/ci.yml`.

**Trade-off accepted:** Building against the wrong CI platform costs a pipeline-file rewrite, not a re-architecture — low-risk assumption.

---

### 2.19 Deployment target — Vercel *or* Docker (two options, undecided)

**Category:** Required (one of the two must be chosen), decision deferred — see `SRS.md` §15.3

**Option A — Vercel:** zero-config Next.js deploys, preview URLs per PR, built-in edge network, trivial rollback. Fastest path to production; introduces a third-party hosting dependency and, depending on plan, cost — a material consideration given NFR-013's data-sensitivity concern if this tool ever processes customer-identifying payloads.

**Option B — Docker on the company's existing platform** (Kubernetes, ECS, internal PaaS): more setup (Dockerfile, health checks, log shipping config) but keeps the app inside existing infra/network boundaries — relevant only once/if a future backend layer (§2.9) needs to reach internal-only APIs, or if company policy restricts external hosting for tools that may touch customer data via the (also future-scope) persistence module. **v1 itself has no server-side network-reachability requirement either way** — F-005's fetch runs in the end user's browser, not on whichever host is chosen.

**Where used:** Deployment pipeline only; no code-level difference between the two beyond a `Dockerfile` for Option B (full detail in `ARCHITECTURE.md` §13).

**Trade-off accepted:** Left as an open, unresolved infrastructure question rather than defaulted, per this specification's "do not invent missing behavior" instruction — see `SRS.md` §15.3.

---

## 3. Package research table

Runtime (**R**) vs. development (**D**) dependency noted per package. This table is a flat index into the decisions above; see the relevant §2.x subsection for full rationale.

| Package | Category | R/D | Purpose | Cross-ref |
|---|---|---|---|---|
| `next` | Core | R | App framework, routing, bundling (Route Handlers unused in v1) | §2.1 |
| `react`, `react-dom` | Core | R | UI runtime | §2.1 |
| `typescript` | Core | D | Static typing | §2.2 |
| `tailwindcss` (v4), `@tailwindcss/postcss` | Core | D | Utility-first styling | §2.3 |
| `shadcn` CLI + generated `components/ui/*` | Required | R* | Accessible UI primitives | §2.4 |
| `@radix-ui/*` | Required | R | Underlying primitives for shadcn/ui | §2.4 |
| `class-variance-authority` | Required | R | Typed style-variant composition | §2.4 |
| `tailwind-merge` | Required | R | Safe conditional-class merging | §2.4 |
| `lucide-react` | Recommended | R | Icon set (replaces HTML-entity icons) | §2.4 |
| `zustand` | Core | R | Client state store | §2.5 |
| `@tanstack/react-query` | Optional, future scope | R | Server-state cache (persistence module) | §2.6 |
| `zod` | Core | R | Runtime schema validation (v1: env vars only — no backend request to validate) | §2.7 |
| `react-hook-form`, `@hookform/resolvers` | Optional, future scope | R | Form state/validation (persistence module) | §2.8 |
| *(none — Route Handlers/Server Actions themselves are part of `next`, not a separate package)* | Future scope, deferred | — | Backend/API layer — not built for v1 | §2.9 |
| `drizzle-orm`, `drizzle-kit` | Optional, future scope | R / D | Database schema, queries, migrations | §2.11 |
| `postgres` / `@neondatabase/serverless` | Optional, future scope | R | Postgres driver | §2.11 |
| `better-auth` | Optional, future scope | R | Auth (if no company SSO) | §2.12 |
| `pino`, `pino-pretty` (dev) | Future scope, deferred | R / D | Structured server logging — no server exists in v1 | §2.15 |
| `@sentry/nextjs` | Required | R | Error tracking (v1: client-side SDK only) | §2.15 |
| `@t3-oss/env-nextjs` | Required | R | Typed, validated env vars (a small schema in v1) | §2.13 |
| `vitest`, `@vitejs/plugin-react` | Development-only | D | Unit/component test runner (incl. `lib/fetch-executor.ts`'s `BrowserFetchExecutor`) | §2.14 |
| `@testing-library/react`, `@testing-library/user-event` | Development-only | D | Component testing utilities | §2.14 |
| `@playwright/test` | Development-only | D | End-to-end testing | §2.14 |
| `msw` | Development-only | D | Mocks F-005's target request in tests (no fetch-proxy exists in v1 to mock) | §2.14 |
| `eslint`, `eslint-config-next`, `typescript-eslint` | Development-only | D | Linting (NFR-012 CI gate) | §2.17 |
| `prettier` | Development-only | D | Formatting | §2.17 |
| `husky`, `lint-staged` | Development-only | D | Pre-commit hooks | §2.17 |
| `@changesets/cli` | Development-only, optional | D | Version/changelog mgmt, only if `diff-engine` is ever published as a shared internal package | — |

\* The shadcn/ui CLI itself is a dev-time code generator, not a runtime dependency; the components it writes into the repo (`components/ui/*`) do ship at runtime, hence "R".

---

## 4. Explicitly rejected choices

- **A server-side fetch-proxy for v1** — not rejected outright, but **deferred** (§2.9): nothing in scope requires it, and building it speculatively would be exactly the kind of infrastructure-without-a-driving-need this section otherwise warns against. Unlike the items below, this one is designed to be added later cheaply (`ARCHITECTURE.md` §3.10) — it's a "not yet," not a "no."
- **GraphQL API layer** — rejected: no multiple heterogeneous clients (mobile app, third-party integrators) exist to justify it; if a backend is ever built, Route Handlers/Server Actions would be simpler and sufficient for the narrow API surface `SRS.md` §6 describes.
- **Microservice split (separate diff-engine network service)** — rejected: `packages/diff-engine` is pure and fast enough to run in a Web Worker in-browser (§2.10) or, if the future backend layer is ever built, inside a Route Handler; a network hop buys nothing at this scale either way.
- **CSS-in-JS (styled-components/Emotion)** — rejected: Tailwind + shadcn/ui better matches the artifact's existing utility-token approach and avoids runtime style-injection cost.
- **Redux Toolkit** — rejected as default (§2.5); acceptable if the organization has existing Redux conventions it wants followed instead.

---

## 5. Version pinning note

Exact semver ranges are deliberately omitted from this document. At project bootstrap (Phase 1 of `IMPLEMENTATION_PLAN.md`), pin every package listed in §3 to its then-current stable major/minor via `npm view <pkg> version`, record the pinned versions in the generated lockfile, and re-verify Next.js/React pairing compatibility at that time — the JavaScript ecosystem moves fast enough that any version number stated here would likely be stale by the time implementation begins.

---

## 6. Categorization summary

| Category | Technologies |
|---|---|
| Core | Next.js (frontend capabilities only), React, TypeScript, Tailwind CSS, Zustand, Zod |
| Required | shadcn/ui + Radix UI, `class-variance-authority`, `tailwind-merge`, Web Worker execution, `@t3-oss/env-nextjs`, `@sentry/nextjs` (client-side), one of {Vercel, Docker}, one of {GitHub Actions, confirmed alternative} |
| Recommended | `lucide-react`, pnpm, Turbopack (bundled with Next.js — no separate choice), ESLint/Prettier/Husky stack |
| Optional, future scope | TanStack Query, React Hook Form, Drizzle ORM + PostgreSQL, Better Auth / Auth.js / company SSO / Clerk |
| Future scope, deferred (not built for v1 — `SRS.md` §2.9/§15.12) | Next.js Route Handlers/Server Actions, `pino`, OpenTelemetry, `@sentry/nextjs`'s server-side wiring |
| Development-only | Vitest, React Testing Library, Playwright, MSW, ESLint, Prettier, Husky, lint-staged, `@changesets/cli` |

---

## 7. Open questions raised by this document

All open questions are tracked centrally in `SRS.md` §15 to avoid duplication/drift. The items in this document's scope are §15.1 (SSO/IdP), §15.2 (persistence adoption), §15.3 (hosting policy), §15.4 (data-classification/retention policy), §15.5 (CI/CD platform), §15.6 (existing design-system/component-library standard), §15.10 (existing internal API/BFF platform), §15.11 (observability backend destination), and §15.12 (the condition that would trigger building the deferred backend layer described in §2.9 at all). §15.10, §15.11, and §15.12 were added during cross-reference passes over this document set — genuine open questions the technology decisions here surfaced, not present in `SRS.md`'s first draft of §15 — and have been folded into that single canonical register rather than kept as a separate list here.

---

## 8. Related documents

- `SRS.md` — functional/non-functional requirements (FR-xxx/NFR-xxx) referenced throughout; §15 is the canonical Open Questions register.
- `FEATURES.md` — feature definitions (F-xxx) referenced throughout; §17 Feature Coverage Matrix maps each feature to the components these technologies build.
- `ARCHITECTURE.md` — §8 Package Responsibility Map (component-level "must not contain" boundaries per package), §13 deployment architecture (Vercel/Docker detail), §11 testing architecture.
- `IMPLEMENTATION_PLAN.md` — phase sequencing in which these technologies are introduced; Phase 1 is where every Core/Required package from §6 above is installed and pinned.
