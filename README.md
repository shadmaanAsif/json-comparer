# JSON Comparer

A privacy-first, standalone web application for comparing JSON API responses. It was implemented from the product, architecture, technology, and delivery specifications in `Claude/json-response-comparer/docs`. Parsing and comparison run in a Web Worker in the browser; payloads are not uploaded.

## Documentation

- [FUNCTIONALITY.md](FUNCTIONALITY.md) is the authoritative, complete catalogue of implemented user-facing features and terminology.
- [docs/FEATURE_AUDIT.md](docs/FEATURE_AUDIT.md) records implemented, partial, and remaining source-specification coverage.
- [docs/reference/SRS.md](docs/reference/SRS.md) contains product requirements, including planned behavior that may not be implemented yet.
- [docs/reference/ARCHITECTURE.md](docs/reference/ARCHITECTURE.md) documents system boundaries, data flow, privacy, and security decisions.
- [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md), and [.agents/CONSTITUTION.md](.agents/CONSTITUTION.md) define engineering and agent-maintenance standards.
- [plugins/json-comparer-toolkit/README.md](plugins/json-comparer-toolkit/README.md) documents the repository-local Claude Code plugin (release-gate and remote-fetch-security review skills) and how to install, test, and publish it.

## Features

- Paste or upload two JSON documents.
- Ordered or unordered/multiset array comparison.
- Added, removed, changed, and type-changed findings.
- Unambiguous JSON Pointer paths plus readable display paths.
- Exact-path implicit subtrees, single-segment (`*`) child subtrees, and explicit recursive (`**`) ignore rules.
- Path/category filters, finding selection, and Markdown reports.
- Input-size, depth, and finding-count limits.
- Add data from a local file, bare URL, or supported cURL command through an SSRF-hardened server endpoint.
- Responsive, keyboard-accessible interface with reduced-motion support.

Remote URL/cURL import accepts public HTTPS hosts during local development through `.env.development`. The development-only `FETCH_PROXY_ALLOW_LOCALHOST=true` setting additionally permits `http://localhost:<port>`, `http://127.0.0.1:<port>`, and `http://[::1]:<port>` when the app itself is running on loopback. Public HTTP, private LAN targets, production localhost access, and non-loopback app origins remain blocked. Production requires an explicit `FETCH_PROXY_ALLOWLIST`.

## Development

### Prerequisites

- Node.js 24
- pnpm 11 (`corepack enable` can provide it with supported Node.js installations)

### Install and run

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001).

The checked-in `.env.development` enables loopback imports for local development. For example, Add Data can fetch `http://localhost:8080/api`. Restart `pnpm dev` after changing environment variables. To disable local API access, set `FETCH_PROXY_ALLOW_LOCALHOST=false`.

For a production run:

```bash
pnpm build
pnpm start
```

For production on Vercel, open **Project → Settings → Environment Variables**. Set `FETCH_PROXY_ALLOWLIST` to the exact API hostnames users may fetch, without protocols, paths, or ports. Add `NEXT_PUBLIC_APP_AUTHOR` to display an author name in the application header. Apply each variable to Production and, when required, Preview, then redeploy so the new values are included. The `*` value and `FETCH_PROXY_ALLOW_LOCALHOST=true` are rejected in production and on non-loopback application origins. `NEXT_PUBLIC_MAX_DOCUMENT_BYTES` changes the per-document byte limit.

Credential-bearing cURL commands are stripped of `Authorization` and `Cookie` headers by default. Only set `FETCH_PROXY_ALLOW_CREDENTIALS=true` in a controlled deployment after reviewing who can access the application and which hosts are allowlisted.

## Quality checks

```bash
pnpm format:check
pnpm standards:check
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

The reusable repository audit is documented in `.agents/skills/audit-project-standards/SKILL.md`. It checks naming, import direction, module boundaries, structure, and maintainability, then guides the manual ownership review that static checks cannot replace.

## Architecture

- `src/domain`: framework-independent comparison, structure, path, request parsing, and reporting logic.
- `src/workers`: serializable worker adapter that owns parsing/comparison execution.
- `src/features`: feature-owned React UI, hooks, browser API services, utilities, and styling.
- `src/server`: server-only outbound-fetch policy and execution.
- `app`: thin Next.js routes, metadata, document-level styling, and error boundary.

The source specifications are retained under `docs/reference/` for implementation traceability.

The implementation audit against the complete source README is in `docs/FEATURE_AUDIT.md`. The current release does not yet claim full artifact parity; that file distinguishes implemented, partial, and missing features.

## Privacy and limits

The application does not persist inputs. The default per-document limit is 10 MiB and can be lowered through `NEXT_PUBLIC_MAX_DOCUMENT_BYTES`. Reports can contain compared values; review them before sharing.
