---
name: run-release-gates
description: Run the JSON Comparer release gates (format check, standards audit, tests, typecheck, lint, build) from the repository root and report a clear pass/fail/blocked summary. Use after finishing a code change in this repository, before calling a change complete, or when asked to check, verify, or validate the build.
allowed-tools: Bash
---

# Run Release Gates

Run this repository's non-negotiable release gates and report their real outcomes. This skill only observes and reports — it never edits code, tests, or configuration to force a gate to pass (Constitution Article VII.5, `.agents/CONSTITUTION.md`).

## When this runs

Invoke after finishing any code change in this repository, before telling the user a change is complete, or whenever asked to "check", "verify", "validate", or "run the gates".

## Steps

1. Confirm the working directory is the repository root (where `package.json` lives). `cd` there first if not.
2. Run every gate below, in this order, from the repository root. Run all of them even if an earlier one fails — a partial report understates risk:

   ```bash
   pnpm format:check
   pnpm standards:check
   pnpm test
   pnpm typecheck
   pnpm lint
   pnpm build
   ```

3. For each command, record its exit code and, on failure, the relevant error output (file, line, and message — not the full log dump).
4. If a command cannot run at all (missing dependency, no network, environment issue), record it as **BLOCKED** with the exact error. Do not report a blocked gate as a pass or a fail.
5. Do not modify source, tests, configuration, limits, or lint/type-check rules to make a gate pass as part of this skill. If a gate fails, report the failure; fixing it is a separate, explicit task.

## Output

A table with one row per gate — command, result (`PASS` / `FAIL` / `BLOCKED`), and for anything other than `PASS`, the exact error or blocker — followed by one line stating whether the change is release-ready.
