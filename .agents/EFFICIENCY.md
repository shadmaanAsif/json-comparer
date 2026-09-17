# Agent Efficiency Guide

Read once per session, not once per task. This trims token and time cost without cutting
correctness corners — every requirement in `.agents/CONSTITUTION.md` still applies; only
*when* you verify and *what* you read changes.

## Setup (once per session)

- Run `nvm use` (reads `.nvmrc`) before any `pnpm` command. Skipping this fails with a
  cryptic `node:sqlite` error that looks unrelated to the Node version.

## What to read, for what

| Question | Read |
|---|---|
| What ships today, from a user's perspective? | `FUNCTIONALITY.md` |
| Is a specific behavior implemented, partial, or missing? | `docs/FEATURE_AUDIT.md` |
| What's the requirement or priority behind a feature? | `docs/reference/SRS.md` |
| Where does a concern live; what are the module boundaries? | `CLAUDE.md`, then `.agents/skills/maintain-json-comparer/references/project-map.md` |
| Why was a security/privacy/architecture call made this way? | `docs/decisions/ADR-*.md`, then the amendment record in `.agents/CONSTITUTION.md` |
| What's the dependency/deployment stack? | `docs/reference/TECH_STACK.md` |
| Sequencing of the original build-out? | `docs/reference/IMPLEMENTATION_PLAN.md` — rarely needed post-MVP |
| Why did the *old* pre-Next.js artifact behave a certain way? | `docs/archive/` — only when tracing a historical decision, never for current behavior |

If the table doesn't name a doc for your question, you probably don't need to open one —
read the code instead.

## Verification: scoped tests by default, everything else opt-in

Split verification into two tiers, for every agent, interactive or autonomous — not just
live sessions where someone's watching:

**May run by default** — only the test file(s) that directly cover the change:
```bash
pnpm exec vitest run <path/to/the/specific/test/file.test.ts>
```
Nothing else runs unasked — not the full `pnpm test` suite, not `pnpm lint`,
`pnpm format:check`, or `pnpm standards:check`.

**Opt-in only — run when the user explicitly asks:**
```bash
pnpm test          # full suite
pnpm lint
pnpm format:check
pnpm standards:check
pnpm typecheck
pnpm build
```
Plus: starting a dev server, navigating, or screenshotting to manually verify a UI change
in a browser.

Make the change, run the scoped test(s) covering it, report exactly what changed, and
stop. Don't reach for the full suite, lint, format, standards, `typecheck`, `build`, or a
browser check unless asked for it (or for "the full gate sequence" / "verify this").

This is a deliberate tradeoff (see `docs/decisions/ADR-003-opt-in-verification.md`, refined
by `docs/decisions/ADR-004-scoped-tests-only-by-default.md`): lint errors, formatting
drift, standards-audit violations, a type error, a broken production build, or a UI
regression only visible in the browser can all sit unnoticed until someone explicitly
checks or a wider gate (e.g. CI on a pull request) catches them. Coverage requirements are
otherwise unchanged — write the tests a behavior change calls for.

A narrower ask ("run the tests for this file") means running only that; a broader one ("run
everything," "the full gate sequence," "verify this") means running the opt-in tier too. If
a gate can't run, say so with the exact blocker. Never claim a gate passed without running
it.

## Commits and PR descriptions

Keep both concise by default:

- Commit messages: a short summary line stating what changed and why. Add a body only
  when the reasoning genuinely isn't obvious from the diff — skip multi-paragraph
  walkthroughs of every file touched.
- PR descriptions: a few bullets covering what changed and why, not an exhaustive
  section-by-section narration. Point at the diff for detail instead of restating it.

Expand only when the user asks for more detail.

## Token and Execution Optimization

Scope rules for reading and verification. These refine the tiers above — they decide *how
narrowly* something runs, not *whether* an opt-in gate is authorized.

- Inspect only files relevant to the requested change.
- Prefer targeted searches over repository-wide exploration.
- Read only the necessary sections of large files.
- Do not inspect `node_modules`, generated files, build output, or unrelated directories
  unless required.
- For a change confined to files you've already identified, read and edit them directly —
  don't open a broad exploration pass for a location you already know. Reserve wider
  research (multiple search agents, several reference docs) for genuinely ambiguous scope,
  where the right file isn't known yet.

### Testing

- Run only the specific test file(s) that cover the changed code by default.
- Do not run the full test suite unless explicitly requested — not even for a
  cross-cutting or shared/core change; flag the risk in the report instead and let the
  user decide whether to ask for the full suite.
- Do not repeatedly run the same tests after unrelated changes.

### Build

- Do not run a full build by default.
- Run a build only when the change affects compilation, bundling, configuration,
  dependencies, or production behavior.
- If a targeted validation is sufficient, prefer it over a full build.

### Lint / Type Check

- Do not run lint or type checks by default — both are opt-in; run them only when
  explicitly requested.

### Documentation / Source

- Do not inspect or modify documentation/source files unless they are relevant to the
  requested change.
- Treat documentation as out of scope unless explicitly requested or required to understand
  the implementation.
- Do not update unrelated documentation.

### Validation

- Start with the smallest validation that provides confidence.
- Expand validation only when the change or failure justifies it.
- Avoid redundant commands and repeated repository-wide operations.

## Known accepted findings — don't re-investigate

- `pnpm standards:check` reports `src/features/comparer/Comparer.tsx` over the 650-line
  module-size threshold. Accepted on manual review as still cohesive, not a new problem to
  re-diagnose each run. Only revisit if the file's *responsibilities* — not just its length
  — start to blur.
- `pnpm lint` reports `'author' is assigned a value but never used` in
  `src/features/comparer/Comparer.tsx` (the `ComparerProps.author` prop, currently
  unwired pending a future author-display feature). Accepted; don't re-flag or attempt to
  fix it each run. Only revisit when that feature is actually implemented or the prop is
  deliberately removed.