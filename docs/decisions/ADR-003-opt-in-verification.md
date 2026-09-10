# ADR-003: Verification is split into default and opt-in checks

Date: 2026-09-09
Status: Accepted by explicit user approval

## Decision

Agents working in this repository — interactive and autonomous alike — split verification
into two tiers after making a change:

- **May run by default:** `pnpm test` (scoped to what changed, or the full suite), `pnpm
lint`, `pnpm format:check`, `pnpm standards:check`. These are fast, local, non-compiling
  checks.
- **Opt-in only, run when the user explicitly asks:** `pnpm typecheck`, `pnpm build`, and
  any manual browser/preview check (starting a dev server, navigating, screenshotting).

An agent makes the requested change, reports exactly what changed, and stops — running the
opt-in tier only on explicit request. The full command list lives in
`.agents/EFFICIENCY.md`.

This does not relax what verification requires when it does run: existing test/type/lint
coverage (Constitution Article VII.1-3) still applies in full, and agents still must not
weaken tests, limits, type safety, or lint rules to make a gate pass (Article VII.5).

## Rationale and consequences

Running the full gate sequence after every change is thorough but costly in time and
tokens, especially for small or exploratory edits. `pnpm typecheck`, `pnpm build`, and a
manual browser check are the most expensive of the six (full project compilation, static
generation, or an interactive session) relative to the fast local checks, so they're the
ones deferred to explicit request; tests and the cheap static checks stay on by default
since they catch real regressions at low cost. The user chose this split deliberately,
extending it to background, scheduled, and autonomous agents as well as interactive
sessions — not just the cases where a human is watching in real time.

Consequence, stated plainly: a type error, a broken production build, or a UI regression
only visible in the browser can go unnoticed until someone explicitly asks for that
specific check or it otherwise runs (for example, in CI on a pull request, which this
decision does not touch). This is a deliberate, informed tradeoff, not an oversight.

## Rollback

Ask for the opt-in checks explicitly on any change going forward, or amend
`.agents/CONSTITUTION.md` Article VII.4 back to a mandatory-before-done standard for all six
gates and update `AGENTS.md`, `CLAUDE.md`, and `.agents/EFFICIENCY.md` to match. No data
migration is required.
