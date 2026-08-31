---
name: maintain-json-comparer
description: Safely analyze, implement, refactor, test, review, or document changes in the JSON Comparer Next.js and TypeScript project. Use for comparison algorithms, JSON Pointer or ignore-rule behavior, Web Worker messaging, React comparer UI, exports, privacy and security controls, dependencies, architecture changes, accessibility, and release verification in this repository.
---

# Maintain JSON Comparer

## Start with project authority

1. Read `AGENTS.md` at the repository root.
2. Read `.agents/CONSTITUTION.md` completely and obey its gates.
3. Inspect affected source and tests before editing.
4. Read only the relevant reference:
   - Requirements or acceptance behavior: `docs/reference/SRS.md`
   - Boundaries, data flow, security, or deployment: `docs/reference/ARCHITECTURE.md`
   - Packages or platform choices: `docs/reference/TECH_STACK.md`
   - Phasing or risk sequencing: `docs/reference/IMPLEMENTATION_PLAN.md`
5. Use [`references/project-map.md`](references/project-map.md) for fast source routing.

## Classify the change

- **Domain behavior:** Work in `src/domain`; preserve framework independence and add direct tests.
- **Worker behavior:** Keep messages serializable, job-scoped, stale-response safe, bounded, and error-safe.
- **UI behavior:** Preserve native semantics, keyboard access, focus visibility, live status, responsive reflow, and privacy copy.
- **Dependency or configuration:** Justify need, prefer existing capabilities, update the lockfile, and verify supported versions.
- **Remote communication, persistence, auth, or telemetry:** Stop and apply the constitution's approval and security gates before implementation.
- **Development fetch exceptions:** Permit the public-host wildcard or exact loopback HTTP/HTTPS only when explicitly approved, restricted to non-production loopback origins, and covered by tests proving private LAN, metadata, public HTTP, deceptive DNS, redirects, and production remain blocked.
- **Architecture or accepted requirement:** Update the relevant reference and record assumptions or unresolved decisions.

## Implement safely

1. Reproduce behavior or define a failing test first when fixing a defect.
2. Make the smallest coherent change at the correct boundary.
3. Never create a second comparison implementation in a component or worker.
4. Keep ignored findings in the result model; filter them only in projections and reports.
5. Preserve explicit array mode, duplicate multiset semantics, JSON Pointer identity, limits, truncation visibility, and privacy warnings.
6. Treat JSON, paths, filenames, notes, and reports as untrusted display content.
7. Do not log or transmit user content.

## Verify and hand off

Run from the repository root:

```bash
pnpm format:check
pnpm standards:check
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Add focused accessibility, performance, or security tests when a change affects those surfaces. Report changed behavior, files, verification results, and residual risk. Never claim a gate passed when it did not run.
