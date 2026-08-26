# JSON Comparer Development Guide

This repository is a privacy-first Next.js application. Read `AGENTS.md` and `.agents/CONSTITUTION.md` before changing behavior or architecture. Those files are authoritative when this guide is incomplete.

## Architecture and dependency direction

Dependencies flow inward:

```text
app/API adapters → feature UI and services → worker/application adapters → domain
```

- `app/` contains Next.js route composition, metadata, global styling, error boundaries, and thin API route adapters.
- `src/features/<feature>/` owns a user-facing workflow. Keep its components, hooks, browser-facing services, feature types, constants, and utilities together.
- `src/components/` is reserved for genuinely reusable UI primitives used by more than one feature. Do not move a component there speculatively.
- `src/domain/` owns framework-independent business rules and serializable types. It must not import React, Next.js, DOM, network, storage, or server modules.
- `src/workers/` adapts domain operations to Web Workers. It must not reimplement comparison rules.
- `src/server/` owns server-only policy and infrastructure such as secure outbound fetch. API route handlers validate/map HTTP and delegate to these modules.

Never import outward from the domain. Keep remote fetching out of UI components and comparison algorithms out of React components.

## Feature organization

Use the shallowest structure that gives a clear responsibility:

```text
src/features/comparer/
├── components/       # comparer-specific presentation and interaction
├── services/         # browser/API boundary operations
├── utils/            # small pure feature adapters
├── Comparer.tsx      # workflow composition and state orchestration
├── constants.ts      # stable feature configuration/sample values
└── types.ts          # feature UI/state contracts
```

Create a hook only when it owns a reusable stateful lifecycle. Create a service only for an I/O boundary. Put reusable business behavior in `src/domain`, not in a feature utility. Avoid barrel files, deep nesting, pass-through wrappers, and one-use abstractions that obscure ownership.

### Current comparer boundaries

- `Comparer.tsx` composes the workflow, owns top-level state, and coordinates worker/API/browser side effects.
- `components/JsonInputPane.tsx` owns one JSON editor surface and its navigation/highlight presentation.
- `components/ComparisonControls.tsx` owns comparison settings and action controls.
- `components/ComparisonResults.tsx` owns result filtering, sections, selection, and review presentation.
- `components/ExportPreview.tsx` owns the report-preview surface.
- `comparer.css` owns comparer-specific styling; `app/globals.css` is limited to theme tokens and document-level defaults.
- `services/remote-fetch.ts` is the browser-to-API boundary.
- `src/domain/comparison/engine.ts` compares values; `structure.ts` compares schema shape.

Keep these boundaries unless a measured responsibility change justifies moving them.

## Naming conventions

- React components and their files use `PascalCase` (`AddDataModal.tsx`).
- Hooks use `useCamelCase` and live in `hooks/` only when a hook is warranted.
- Services, utilities, constants, tests, and domain modules use descriptive kebab-case filenames (`display-alignment.ts`).
- Types and interfaces use `PascalCase`; functions and variables use `camelCase`; immutable module constants use `UPPER_SNAKE_CASE`.
- Name actions by intent (`runComparison`, `updateImportedInput`) and avoid generic containers such as `helpers.ts` or `common.ts`.
- Name UI state by scope and purpose (`WorkspaceStatus`, `ReviewNote`), not generic names such as `Status` or `Data`.
- Name request/response contracts after their boundary (`RemoteFetchRequest`, `RemoteFetchResponse`).

## Imports, exports, and compatibility

- `@/*` maps to `src/*`. Use it for imports that cross domain, feature, worker, or server boundaries.
- Use short relative imports within the same cohesive folder. Do not use `@/src/*` or relative paths that climb three or more levels.
- Prefer direct imports from the module that owns a symbol. Do not add speculative barrel files.
- Keep module internals unexported. Export only contracts used by another module or required by tests.
- When renaming an existing exported symbol, preserve a deprecated type alias or re-export when practical. Remove compatibility shims only in an explicitly approved breaking change.

## Module design and maintainability

- A module should have one reason to change. Split files when UI, orchestration, business rules, and I/O policy are mixed—not solely because of line count.
- Treat roughly 650 lines for a cohesive UI module, 400 for domain/server logic, 180 for an API handler, and 1500 for a stylesheet as review triggers. They are not automatic failures.
- Keep route handlers focused on validation, rate limiting, response mapping, and delegation. Put outbound request execution and security policy in `src/server/`.
- Colocate unit tests with the module they protect. Put only cross-module or end-to-end suites in a top-level test directory.
- Promote feature code to `src/components/` or another shared module only after at least two real consumers establish a stable shared contract.
- Prefer simple functions and explicit props over factories, registries, generic wrappers, or new dependencies that do not remove real duplication.

## Comparison and display rules

- Compute findings from the original parsed values. Presentation transforms must never affect results.
- `alignForDisplay()` is domain-owned and returns new values. Response A defines shared object-key order; keys unique to a side keep their positions; array elements are never reordered.
- `formatAlignedForDisplay()` renders the aligned values into equal-height paired line blocks. A one-sided field or subtree becomes JSON-safe blank lines on the opposite side, with placeholder path metadata for highlighting and navigation.
- Structurally aligned editors synchronize the same vertical line offset. Use proportional scroll only as a fallback while manual input is temporarily unaligned.
- Keep raw JSON editors unwrapped and derive highlight, gutter, visibility, and navigation geometry from rendered textarea metrics. Centralize shared line-height and padding CSS variables; do not introduce independent pixel estimates or fixed navigation offsets.
- Center programmatic finding navigation within the current editor viewport, focus with scroll prevention, and explicitly synchronize the partner editor so compact and expanded modes behave identically.
- Apply automatic display alignment only after explicit whole-value actions (Compare, paste, upload, remote fetch, Load Sample) and only when both panels contain valid JSON. Ordinary typing must remain uninterrupted.
- Preserve ordered/unordered array modes, typed paths, JSON Pointer identity, ignore behavior, limits, and truncation signals.
- Ignore matching is prefix-based: an exact path includes its descendants, `*` consumes one segment and includes the matched child subtree when terminal, and terminal `**` remains an explicit recursive form. Preserve dotted-path and JSON Pointer support.

## UI and API practices

- Keep components semantic, keyboard-operable, responsive, and safe for untrusted JSON/text. Do not render raw HTML.
- Use native fieldsets and radio inputs for mutually exclusive review statuses; keep every row's group uniquely named and visibly keyboard-focusable.
- Keep derived result projections memoizable instead of duplicating them in state.
- Keep API handlers thin. Fetch security policy, DNS/IP restrictions, redirect validation, pinning, limits, and safe error mapping remain in `src/server/fetch/`.
- Never log or persist payloads, URLs with query strings, headers, credentials, notes, or report contents.
- Do not add dependencies unless existing platform capabilities are insufficient and the dependency is justified.

## Change workflow

1. Inspect existing ownership and nearby tests before editing.
2. Add a regression test for behavior changes at the lowest responsible boundary.
3. Make the smallest coherent change and update affected imports/docs.
4. Run the existing formatting/lint tooling; do not introduce a second formatter.
5. Run the project-standards audit. Investigate every finding; thresholds are prompts for review.
6. Run all release gates from the project root:

```bash
pnpm format:check
pnpm standards:check
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Document any gate that could not run and its exact blocker.

For periodic architecture and naming reviews, use `.agents/skills/audit-project-standards/SKILL.md`. Its script provides deterministic checks; the skill also requires a manual ownership and duplication review.
