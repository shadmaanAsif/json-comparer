# JSON Comparer Constitution

Version: 2.1.0
Ratified: 2026-08-21
Applies to: humans, coding agents, automated agents, repository-local skills, and generated changes.

## Preamble

The JSON Comparer is a privacy-first engineering tool. Its value depends on correct comparisons, understandable results, predictable resource use, and justified trust. Every implementation decision must protect those properties before optimizing convenience or feature count.

If this constitution conflicts with an ordinary task description, stop and surface the conflict. A task may amend the constitution only when the user explicitly approves the changed principle and its consequences.

## Article I — Privacy is the default architecture

1. JSON inputs, findings, annotations, and reports are confidential by default.
2. Parsing and comparison execute locally in the browser.
3. Payloads, paths, values, notes, headers, filenames, URLs, and report contents must not enter logs, traces, analytics, or error-monitoring metadata.
4. Persistence of payload contents is opt-in, explicit, bounded, versioned, and deletable. Browser storage is not secure storage.
5. Exports retain a warning that values may contain sensitive information.

## Article II — Correctness is a product feature

1. The domain model owns comparison behavior; UI rendering must not redefine it.
2. Ordered and unordered arrays are distinct, explicit modes. Never silently change their default or meaning.
3. Unordered arrays are multisets: duplicates count. Matching uses canonical equality and must not invent semantic pairing between unrelated unmatched objects.
4. Internal field identity uses typed path segments and RFC 6901 JSON Pointer. Human-readable dotted paths are presentation only.
5. Findings distinguish added, removed, changed, and type-changed values.
6. Ignore rules affect presentation and actionable counts without deleting the underlying finding.
7. Limits, truncation, and partial results are visible; incomplete output must never appear complete.
8. Behavior changes require regression tests and updated fixtures/documentation where applicable.

## Article III — Boundaries remain enforceable

Dependencies flow inward:

```text
app/components → features → application/worker adapters → domain
```

1. `src/domain` imports no React, Next.js, DOM, Web Worker, storage, logging, database, or network package.
2. The worker is an adapter around the domain, not a second comparison implementation.
3. React components transform user actions into commands and results into views; they do not own comparison algorithms.
4. Infrastructure is introduced behind explicit interfaces when required. Route handlers do not become unstructured business-logic containers.
5. New dependencies require a demonstrated need, active maintenance, acceptable license/security posture, and an explanation of why existing capabilities are insufficient.

## Article IV — Security gates risky capabilities

Remote URL/cURL import is prohibited until all of the following exist and are reviewed:

- strict request schemas and supported-method/header allowlists;
- HTTPS/scheme/port policy;
- DNS resolution and validation of every redirect;
- loopback, private, link-local, multicast, reserved, and metadata-address denial for IPv4 and IPv6;
- rebinding-resistant connection behavior or controlled network egress;
- credential warnings, header stripping, and zero credential logging/persistence;
- timeout, decompressed-byte, redirect, request-body, and rate limits;
- abort behavior, stable safe errors, abuse monitoring, and focused SSRF tests.

If the hosting platform cannot enforce these controls, restrict targets to an administrator allowlist or omit the feature. Production deployments never permit a generic fetch proxy. A local-development-only `*` target policy is permitted when it is rejected in production and on non-loopback application origins, while all address, DNS pinning, redirect, method/header, credential, timeout, size, and rate controls remain active.

An explicitly configured local-development exception may fetch HTTP or HTTPS only from the exact loopback targets `localhost`, `127.0.0.1`, and `::1`. It must fail closed in production and on non-loopback application origins, require localhost DNS to resolve exclusively to loopback addresses, revalidate every redirect, and continue blocking private LAN, link-local, metadata, multicast, reserved, and public HTTP targets. This exception is for comparing APIs running on the same development machine and must remain independently reversible.

Accounts, sharing, and cloud persistence additionally require explicit tenancy, authorization, retention/deletion, encryption, audit, backup/restore, and IDOR-test requirements.

## Article V — Accessibility is release-critical

1. Primary workflows target WCAG 2.2 AA.
2. All actions work by keyboard with visible focus and logical focus movement.
3. Controls use native semantics where practical and accessible names always.
4. Status and error changes are announced; color is never the only category cue.
5. The interface supports reflow/zoom, reduced motion, contrast requirements, and the agreed browser matrix.
6. Automated checks supplement—not replace—keyboard and screen-reader review.

## Article VI — Performance and resilience are bounded

1. Parse and comparison work stays off the main UI thread through the Web Worker boundary.
2. Traversal remains iterative or otherwise protected from unbounded recursion.
3. Every input path has byte, depth, finding-count, time, and rendering bounds appropriate to its trust level.
4. Operations are cancellable; stale worker responses cannot overwrite newer results.
5. Large result rendering is measured before and after adding optimization dependencies.
6. Errors preserve recoverable input, expose corrective action, and avoid secrets or implementation details.

## Article VII — Verification is evidence

1. Domain invariants receive unit and property-style coverage: identity, object-key order independence, duplicate multiset behavior, path escaping, ignore consistency, and limits.
2. User workflows receive component or end-to-end coverage appropriate to their risk.
3. Security controls receive adversarial integration tests; accessibility receives automated and manual checks.
4. A code change is incomplete until tests, strict type checking, linting, and the production build pass—or the exact blocker is documented.
5. Agents report actual commands and outcomes. They do not weaken tests, limits, type safety, or lint rules merely to pass a gate.

## Article VIII — Minimal scope and reversible evolution

1. Implement the smallest complete change satisfying an approved requirement.
2. Do not preinstall optional architecture or introduce speculative services.
3. Do not silently alter behavior, privacy posture, formats, limits, defaults, or browser support.
4. Keep migrations/version readers for persisted or exported formats once those formats exist.
5. Prefer reversible, observable changes and maintain rollback instructions for deployment-affecting work.

## Article IX — Agent and skill conduct

Every agent and repository-local skill must:

1. read this constitution before acting;
2. inspect existing code and relevant references before proposing a change;
3. distinguish code facts from assumptions and unresolved decisions;
4. preserve unrelated user work and avoid destructive repository operations;
5. keep changes within authorized scope;
6. stop for approval when expanding data collection, external communication, authentication, persistence, deployment, or security risk;
7. document material architecture decisions and update affected references;
8. leave the repository reproducible with a compatible lockfile.

Skills advise workflow; they do not override this constitution, user authority, or repository instructions.

## Governance and amendments

- Patch amendment: clarifies language without changing behavior; update the patch version.
- Minor amendment: adds a compatible principle or release gate; update the minor version.
- Major amendment: changes privacy, comparison semantics, security gates, architecture, or governance; update the major version and record an ADR.

Every amendment includes rationale, affected requirements/architecture/tests, migration or rollout impact, and explicit user approval. Amend this file, `AGENTS.md`, the project skill, and affected references together when necessary.

## Amendment record

- 2.1.0 (2026-08-26): With explicit user approval, permits an opt-in local-development exception for HTTP/HTTPS loopback APIs. Production, non-loopback app origins, private LAN, metadata, deceptive DNS, and public HTTP remain prohibited. See `docs/decisions/ADR-002-localhost-fetch.md`.
- 2.0.1 (2026-08-26): Renamed the project and product from JSON Response Comparer to JSON Comparer with explicit user approval. This naming-only amendment changes no behavior, privacy, security, architecture, or rollout requirements.
- 2.0.0 (2026-08-25): With explicit user approval, permits a reversible local-development wildcard for public HTTPS targets. Production and non-loopback use remain prohibited; all SSRF controls remain mandatory. See `docs/decisions/ADR-001-local-fetch-wildcard.md`.
