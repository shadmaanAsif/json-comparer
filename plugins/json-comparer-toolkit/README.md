# JSON Comparer Toolkit (Claude Code plugin)

A Claude Code plugin, versioned inside this repository, that packages two skills used to maintain the JSON Comparer app:

| Skill                          | Invocation                                            | Purpose                                                                                                                                     |
| ------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `run-release-gates`            | `/json-comparer-toolkit:run-release-gates`            | Runs the six release gates (`format:check`, `standards:check`, `test`, `typecheck`, `lint`, `build`) and reports pass/fail/blocked.         |
| `review-remote-fetch-security` | `/json-comparer-toolkit:review-remote-fetch-security` | Reviews changes under `src/server/fetch/`, `src/domain/fetch/`, and `app/api/fetch-proxy/` against Constitution Article IV (the SSRF gate). |

Both skills are documented for [`AGENTS.md`](../../AGENTS.md)/[`.agents/CONSTITUTION.md`](../../.agents/CONSTITUTION.md)-governed work; they read the constitution and existing tests rather than embedding their own copy of the rules, so they stay correct as those files evolve. They do not duplicate the repository's existing `.agents/skills/` (`audit-project-standards` is a naming/architecture audit; `maintain-json-comparer` is the general how-to-work-here guide) — these two are narrow, mechanical/specialist tasks those don't cover.

## Why these two, and why here instead of `.agents/skills/`

`.agents/skills/` is this repository's vendor-neutral skill location, written in the plain `name`/`description`-only frontmatter that any AGENTS.md-compatible agent (Claude Code, Codex, etc.) can read. This plugin is Claude-Code-specific: its `SKILL.md` files use Claude Code-only frontmatter (`allowed-tools`, `paths`) and it ships a `.claude-plugin/plugin.json` manifest that only Claude Code understands. Keeping it in `plugins/` avoids mixing a Claude-Code-only format into the cross-agent directory, and avoids ever having two active copies of the same skill.

## Folder structure

```text
plugins/json-comparer-toolkit/
├── .claude-plugin/
│   └── plugin.json                          # plugin manifest (required)
├── skills/
│   ├── run-release-gates/
│   │   └── SKILL.md
│   └── review-remote-fetch-security/
│       └── SKILL.md
└── README.md                                 # this file
```

`.claude-plugin/plugin.json` is required and must contain only the manifest — Claude Code does not scan `.claude-plugin/` for skills/agents/hooks, only for `plugin.json` itself. Every other directory (`skills/`, `commands/`, `agents/`, `hooks/`, …) lives at the plugin root, one level up.

## Installing and testing locally

Two ways to load this plugin, from the repository root:

**A. One-off session load (no persistence, no marketplace needed)**

```bash
claude --plugin-dir ./plugins/json-comparer-toolkit
```

Loads the plugin for that single session only. Nothing is written to disk. Good for a quick check.

**B. Through a marketplace (what installing "for real" looks like)**

The repository root already declares itself as a marketplace at [`.claude-plugin/marketplace.json`](../../.claude-plugin/marketplace.json). From the repo root:

```bash
claude plugin marketplace add ./ --scope local
claude plugin install json-comparer-toolkit@json-comparer-plugins --scope local
```

`--scope local` writes only to `.claude/settings.local.json`, which is git-ignored — this is a personal, machine-local install, not something that gets committed. Verify with:

```bash
claude plugin list
```

which should show `json-comparer-toolkit@json-comparer-plugins` as enabled. To remove it again:

```bash
claude plugin uninstall json-comparer-toolkit@json-comparer-plugins --scope local
claude plugin marketplace remove json-comparer-plugins
```

**Trying the skills:**

```bash
claude --plugin-dir ./plugins/json-comparer-toolkit -p "/json-comparer-toolkit:run-release-gates"
claude --plugin-dir ./plugins/json-comparer-toolkit -p "/json-comparer-toolkit:review-remote-fetch-security review the current state of src/server/fetch/"
```

(Or, without `-p`, type the same `/json-comparer-toolkit:...` command inside an interactive `claude` session that has the plugin loaded/installed.) Both skills can also trigger automatically — `run-release-gates` when you say things like "check/verify this change", and `review-remote-fetch-security` whenever a change touches one of its `paths`.

## Preparing for team distribution

Teammates get this plugin by cloning the repo (already true) and then, once, from the repo root:

```bash
claude plugin marketplace add ./ --scope project
claude plugin install json-comparer-toolkit@json-comparer-plugins --scope project
```

`--scope project` writes to the shared `.claude/settings.json` (committed to git), so once one person commits it, later clones show the plugin as configured — but Claude Code still requires each teammate to explicitly trust and load it; a plugin declared in a committed settings file does not silently auto-run for someone who hasn't installed/trusted it. There is no way to make an external teammate's plugin activate with zero action on their part — this is intentional, since plugins run with the user's full privileges.

## Publishing (instructions only — nothing below has been run)

This repo is already a valid GitHub-hosted marketplace (it has `.claude-plugin/marketplace.json` at its root). To let people outside the team install it:

1. Bump `version` in [`plugin.json`](.claude-plugin/plugin.json) and in the plugin's entry in the root [`marketplace.json`](../../.claude-plugin/marketplace.json) (see Versioning below).
2. Commit and push to `main` (or tag a release — see below).
3. Anyone can then run:

   ```bash
   claude plugin marketplace add shadmaanAsif/json-comparer
   claude plugin install json-comparer-toolkit@json-comparer-plugins
   ```

   Claude Code clones the repo and reads `.claude-plugin/marketplace.json` — no separate plugin-only repo or Anthropic-side registration is required for this "share by GitHub repo" tier.

4. Optionally validate first: `claude plugin validate ./plugins/json-comparer-toolkit --strict` and `claude plugin validate . --strict` (marketplace).

**This is distinct from submitting to Anthropic's curated/community marketplaces**, which is a separate, optional step (see the top-level plugin walkthrough for the distinction) and was not done here.

## Versioning and releasing updates

1. Change the skill(s) or manifest.
2. Bump `version` in `.claude-plugin/plugin.json` (semantic version) — and, if you want the marketplace catalog to advertise the new version without a fresh clone, bump the matching `version` in the root `marketplace.json` plugin entry too.
3. Commit. Optionally tag the release: `claude plugin tag ./plugins/json-comparer-toolkit` creates a `json-comparer-toolkit--vX.Y.Z` git tag after checking `plugin.json` and the marketplace entry agree.
4. Anyone with the marketplace already added picks up the change with:

   ```bash
   claude plugin marketplace update json-comparer-plugins
   claude plugin update json-comparer-toolkit@json-comparer-plugins
   ```

   (a restart of the session is required to apply an update, per `claude plugin update --help`).

## Verification log

This plugin was not just written and assumed to work — every claim above was checked against the installed `claude` CLI (v2.1.251) before this README was finalized:

```bash
claude plugin validate ./plugins/json-comparer-toolkit --strict   # ✔ Validation passed
claude plugin validate .                                          # ✔ Validation passed (marketplace)

claude --plugin-dir ./plugins/json-comparer-toolkit -p "list skills"
# → confirmed both skills register as json-comparer-toolkit:run-release-gates
#   and json-comparer-toolkit:review-remote-fetch-security

claude --plugin-dir ./plugins/json-comparer-toolkit -p "/json-comparer-toolkit:run-release-gates"
# → ran all 6 gates for real: PASS on format:check, standards:check, test,
#   typecheck, lint, build. "Release-ready: yes."

claude --plugin-dir ./plugins/json-comparer-toolkit -p \
  "/json-comparer-toolkit:review-remote-fetch-security review src/server/fetch/"
# → produced a full Article IV checklist against the real, already-shipped code

claude plugin marketplace add ./ --scope local
claude plugin install json-comparer-toolkit@json-comparer-plugins --scope local
claude plugin list        # → enabled, scope local
claude -p "list plugin skills"   # → confirmed reachable via the normal installed
                                  #   path too, not just --plugin-dir

claude plugin uninstall json-comparer-toolkit@json-comparer-plugins --scope local
claude plugin marketplace remove json-comparer-plugins   # test state cleaned up
```

`pnpm format:check` and `pnpm standards:check` were also run against the new files themselves (see the repository root `package.json` scripts); the audit script does not scan `plugins/`, so it was unaffected.

**Provenance note:** running `review-remote-fetch-security` against the _existing_ `src/server/fetch/` code (not a hypothetical change) surfaced three real findings against Article IV — an IPv6 address-blocklist bypass, an ungated `FETCH_PROXY_ALLOW_CREDENTIALS` escape hatch, and a spoofable rate-limit key. No code was changed to fix these as part of building this plugin; they were routed to a separate task, since the constitution requires explicit approval for security-affecting changes.

## Troubleshooting

- **`claude plugin validate` fails on the manifest** — read the reported field name; `plugin.json`'s only required field is `name` (kebab-case, no spaces).
- **Skill doesn't show up in `/` or auto-invoke** — confirm the plugin is actually loaded (`claude plugin list`, or you used `--plugin-dir`), and that `SKILL.md` starts with a line that is exactly `---`.
- **`claude plugin marketplace add .` fails with "Invalid marketplace source format"** — a bare `.` is rejected; use `./` (or an absolute path).
- **A teammate says the plugin "isn't there" after pulling a commit that adds it to `.claude/settings.json`** — expected; they still need to run the one-time `claude plugin install ...` themselves (see "Preparing for team distribution" above).
- **`pnpm` commands fail inside a skill with a `node:sqlite` error** — this is a local Node-version issue (pnpm here needs Node ≥ 22.13), unrelated to the plugin; switch Node versions (e.g. `nvm use 24`) before invoking `run-release-gates`.

## Official documentation

- Skills: https://code.claude.com/docs/en/skills.md
- Plugins: https://code.claude.com/docs/en/plugins.md
- Plugin manifest reference: https://code.claude.com/docs/en/plugins-reference.md
- Marketplaces: https://code.claude.com/docs/en/plugin-marketplaces.md
- Discovering/installing plugins: https://code.claude.com/docs/en/discover-plugins.md
- CLI reference (`--plugin-dir`, `claude plugin ...`): https://code.claude.com/docs/en/cli-reference.md
