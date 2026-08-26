# Project map

| Area | Location | Contract |
|---|---|---|
| Next.js adapters | `app/` | Metadata, document styles, thin routes, error boundary |
| Comparer orchestration | `src/features/comparer/Comparer.tsx` | Workspace state, worker/API/browser coordination |
| Comparer UI | `src/features/comparer/components/` | Input, controls, results, preview, modal, tree/value presentation |
| Comparer adapters | `src/features/comparer/{hooks,services,utils}/` | Stateful lifecycles, browser API calls, pure display adapters |
| Comparer styles | `src/features/comparer/comparer.css` | Feature-owned visual and responsive rules |
| Comparison types | `src/domain/comparison/types.ts` | Serializable domain contracts and options |
| Value comparison | `src/domain/comparison/engine.ts` | Framework-free ordered/unordered comparison and limits |
| Structure comparison | `src/domain/comparison/structure.ts` | Recursive schema/shape findings |
| Paired display formatting | `src/domain/comparison/display-format.ts` | Equal-height JSON lines, path maps, placeholder gaps |
| Paths and ignore rules | `src/domain/comparison/path.ts` | Typed segments, JSON Pointer, display paths, matching |
| Parsing | `src/domain/comparison/parse.ts` | Side-aware validation, byte limits, formatting |
| Remote-request parsing | `src/domain/fetch/curl.ts` | Framework-free URL/cURL request parsing |
| Reports | `src/domain/reporting/` | Privacy-marked output adapters |
| Worker | `src/workers/comparison.worker.ts` | Off-main-thread parse/compare adapter |
| Secure remote fetch | `src/server/fetch/` | DNS/IP/redirect policy, pinning, limits, execution |
| Tests | colocated `*.test.ts` | Domain regression evidence |
| Standards audit | `.agents/skills/audit-project-standards/` | Periodic naming and architecture verification |
| Normative rules | `.agents/CONSTITUTION.md` | Privacy, correctness, security, boundaries, governance |
| Detailed references | `docs/reference/` | SRS, architecture, stack, implementation sequencing |

Use `rg` and `rg --files` to inspect actual ownership before editing. This map is a route, not a substitute for reading affected code.
