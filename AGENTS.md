# Agent Operating Guide

This file applies to the entire repository.

Before changing the project:

1. Read [`.agents/CONSTITUTION.md`](.agents/CONSTITUTION.md).
2. Use the repository-local `maintain-json-comparer` skill at [`.agents/skills/maintain-json-comparer/SKILL.md`](.agents/skills/maintain-json-comparer/SKILL.md).
3. Read only the relevant documents under [`docs/reference/`](docs/reference/): requirements in `SRS.md`, boundaries in `ARCHITECTURE.md`, dependencies in `TECH_STACK.md`, and sequencing in `IMPLEMENTATION_PLAN.md`.

## Non-negotiable commands

For a code change, run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

If a command cannot run, report the exact blocker. Do not claim verification that did not occur.

## Scope rules

- Keep JSON parsing and comparison local to the browser unless an approved requirement explicitly changes the privacy model.
- Do not add remote URL/cURL fetching without the constitution's security gate. The `*` public-host wildcard and explicit localhost exception are local-development-only and must fail closed in production and on non-loopback origins. Localhost mode never permits private LAN or metadata targets.
- Keep `src/domain` independent of React, Next.js, DOM, storage, logging, and network libraries.
- Preserve explicit array modes, JSON Pointer identity, resource limits, accessible workflows, and report privacy warnings.
- Add or update tests for every behavior change.
- Do not introduce accounts, databases, analytics, telemetry, or persistence by implication.
- Update reference documentation and the constitution when an accepted decision changes them.
