# ADR-004: Narrow the default verification tier to scoped tests only

Date: 2026-09-17
Status: Accepted by explicit user approval

## Decision

Refines ADR-003's default tier. Agents working in this repository — interactive and
autonomous alike — now split verification into two tiers after making a change:

- **May run by default:** `pnpm test`, scoped to the specific test file(s) covering the
  change actually made. Nothing else.
- **Opt-in only, run when the user explicitly asks:** the full `pnpm test` suite, `pnpm
lint`, `pnpm format:check`, `pnpm standards:check`, `pnpm typecheck`, `pnpm build`, and
  any manual browser/preview check.

An agent makes the requested change, runs only the scoped test(s) directly covering it,
reports exactly what changed, and stops. The full command list lives in
`.agents/EFFICIENCY.md`.

This does not relax what verification requires when it does run: existing test/type/lint
coverage (Constitution Article VII.1-3) still applies in full, and agents still must not
weaken tests, limits, type safety, or lint rules to make a gate pass (Article VII.5).

## Rationale and consequences

ADR-003 kept `lint`, `format:check`, and `standards:check` on by default alongside tests,
reasoning they were cheap relative to `typecheck`/`build`/browser checks. In practice,
running them after every small edit still adds meaningful token and time cost across a
session with many incremental changes, most of which touch a small, already-known set of
files. The user narrowed the default tier further: only the test file(s) covering the
change run automatically; the full suite, lint, format, and the standards audit all move to
opt-in alongside typecheck/build/browser checks.

Consequence, stated plainly: lint errors, formatting drift, standards-audit violations, and
regressions outside the immediate change can go unnoticed for longer than under ADR-003,
until the user asks for a broader check or a wider gate (e.g. CI on a pull request, which
this decision does not touch) catches them. This is a deliberate, informed tradeoff, not an
oversight.

## Rollback

Ask for the wider default tier explicitly, or amend `.agents/CONSTITUTION.md` Article VII.4
back to ADR-003's split (or further, to a mandatory-before-done standard for all six gates)
and update `AGENTS.md`, `CLAUDE.md`, and `.agents/EFFICIENCY.md` to match. No data migration
is required.
