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

## Verification: fast checks by default, expensive checks opt-in

Split verification into two tiers, for every agent, interactive or autonomous — not just
live sessions where someone's watching:

**May run by default** — fast, local, non-compiling:
```bash
pnpm test          # scoped to what you touched; full suite per the Testing rules below
pnpm lint          # prefer targeting changed files where supported
pnpm format:check
pnpm standards:check
```

**Opt-in only — run when the user explicitly asks:**
```bash
pnpm typecheck
pnpm build
```
Plus: starting a dev server, navigating, or screenshotting to manually verify a UI change
in a browser.

Make the change, report exactly what changed, run the default tier if useful, and stop.
Don't reach for `typecheck`, `build`, or a browser check unless asked for it (or for "the
full gate sequence" / "verify this").

This is a deliberate tradeoff (see `docs/decisions/ADR-003-opt-in-verification.md`): a type
error, a broken production build, or a UI regression only visible in the browser can sit
unnoticed until someone explicitly checks. Coverage requirements are otherwise unchanged —
write the tests a behavior change calls for.

A narrower ask ("run the tests for this file") means running only that. If a gate can't
run, say so with the exact blocker. Never claim a gate passed without running it.

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

- Test only the changed code and directly affected functionality by default.
- Run targeted unit/component tests first.
- Do not run the full test suite unless:
  - the change is cross-cutting,
  - shared/core functionality is modified,
  - targeted tests are insufficient, or
  - explicitly requested.
- Do not repeatedly run the same tests after unrelated changes.

### Build

- Do not run a full build by default.
- Run a build only when the change affects compilation, bundling, configuration,
  dependencies, or production behavior.
- If a targeted validation is sufficient, prefer it over a full build.

### Lint / Type Check

- Run lint/type checks only when relevant to the changed files.
- Prefer targeted checks where supported.

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