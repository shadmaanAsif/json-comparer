---
name: audit-project-standards
description: Audit a React/Next.js TypeScript repository for naming, modularity, architecture boundaries, folder structure, imports, duplication, consistency, and maintainability. Use for full-codebase engineering-standards reviews, architecture health checks, refactoring assessments, or periodic consistency verification; do not use for an ordinary isolated feature change unless the user also requests a project-wide standards review.
---

# Audit Project Standards

Use this skill to produce an evidence-based repository audit and, when authorized, apply the smallest safe improvements without changing behavior.

## Workflow

1. Locate the project root from the target path or nearest `package.json`.
2. Read the repository's authority files completely: `AGENTS.md`, `CLAUDE.md`, constitutions, and any directly applicable local skills.
3. Inspect the real source tree, package scripts, TypeScript aliases, lint/format configuration, public entry points, and colocated tests before recommending a target structure.
4. Run the deterministic audit:

   ```bash
   node .agents/skills/audit-project-standards/scripts/audit-project.mjs [project-root]
   ```

   Add `--strict` when the repository is expected to have no warnings. Static findings are leads, not substitutes for reading the affected module.
5. Inspect responsibilities manually:
   - UI components render and delegate; workflow components orchestrate state and side effects.
   - Hooks own reusable stateful lifecycles.
   - Services own I/O boundaries.
   - Domain modules own framework-independent business rules.
   - API routes validate/map HTTP and delegate to server modules.
   - Shared modules are promoted only after genuine multi-feature reuse.
6. Look for duplicated algorithms, repeated policy, mixed UI/business/I/O responsibilities, speculative barrels, pass-through wrappers, deep nesting, misleading names, stale docs, and files that are large because they own unrelated concerns.
7. Report each violation with severity, file evidence, the rule it violates, and the smallest recommended correction. Separate confirmed violations from judgment calls.
8. If implementation is authorized, refactor incrementally, preserve public imports with temporary deprecated aliases or re-exports when needed, update tests/docs, and avoid new dependencies unless justified.
9. Run the repository's formatter/check, tests, typecheck, lint, production build, and the strict standards audit. Report exact blockers for any gate that cannot run.

## Review principles

- Prefer current-project conventions over imposing a generic folder template.
- Treat file-size thresholds as review triggers, not automatic reasons to split cohesive code.
- Prefer direct imports from owning modules; avoid barrel files that hide dependency direction.
- Use aliases for cross-boundary imports and short relative imports within the same feature/module.
- Preserve runtime behavior and backward compatibility unless the user explicitly approves a breaking change.
- Do not move code merely to satisfy aesthetics. Every move must clarify ownership or dependency direction.
- Do not claim duplication or architectural violations without pointing to concrete files or symbols.

## Output

Summarize:

- architecture and naming health;
- confirmed violations grouped by severity;
- improvements applied or recommended;
- compatibility measures;
- verification commands and results;
- remaining intentional exceptions or follow-up debt.
