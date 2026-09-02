---
name: review-remote-fetch-security
description: Review changes to the JSON Comparer's remote fetch/cURL import path against the project constitution's Article IV SSRF security gate before they are treated as safe to merge. Use when code in src/server/fetch/, src/domain/fetch/, or app/api/fetch-proxy/ changes, or when asked to review, audit, or approve a remote-fetch, cURL-import, or SSRF-related change.
paths:
  - "src/server/fetch/**"
  - "src/domain/fetch/**"
  - "app/api/fetch-proxy/**"
---

# Review Remote Fetch Security

Check any change to the remote URL/cURL import path against `.agents/CONSTITUTION.md` Article IV before treating it as safe. This is the highest-risk surface in the JSON Comparer: it is the only feature allowed to reach the network, and the constitution gates it behind a specific, enumerated control list.

## When this runs

Automatically when a change touches `src/server/fetch/`, `src/domain/fetch/`, or `app/api/fetch-proxy/`. Also invoke directly when asked to review, audit, or approve a remote-fetch, cURL-import, or SSRF-related change.

## Steps

1. Read `.agents/CONSTITUTION.md` Article IV in full before judging anything — its wording is the authority, not memory of a prior read.
2. Read the changed file(s) together with their paired test file(s):
   - `src/server/fetch/security.ts` / `security.test.ts`
   - `src/server/fetch/executor.ts` / `executor.test.ts`
   - `src/server/fetch/rate-limit.ts` / `rate-limit.test.ts`
   - `src/domain/fetch/curl.ts` / `curl.test.ts`
   - `app/api/fetch-proxy/route.ts` / `route.test.ts`
3. Check the diff against every control Article IV requires, and mark each **present**, **regressed**, or **not touched by this change**:
   - strict request schema and method/header allowlists
   - HTTPS/scheme/port policy
   - DNS resolution and revalidation of every redirect
   - denial of loopback, private, link-local, multicast, reserved, and metadata addresses (IPv4 and IPv6) — except the two explicit, reversible development exceptions below
   - rebinding-resistant connection behavior or controlled egress
   - credential warnings, header stripping (`Authorization`, `Cookie`), and zero credential logging/persistence
   - timeout, decompressed-byte, redirect, request-body, and rate limits
   - abort behavior and stable, safe error messages that do not leak internal detail
4. If the change touches either development-only exception, confirm it still fails closed in production and on non-loopback application origins, and does not weaken the other exception:
   - the public-host wildcard (`FETCH_PROXY_ALLOWLIST=*`, local development only)
   - the loopback exception (`FETCH_PROXY_ALLOW_LOCALHOST=true`: exact `localhost`, `127.0.0.1`, `::1` only)
5. Confirm adversarial test coverage exists for anything changed: private LAN, link-local, metadata address, multicast, reserved range, public HTTP, DNS rebinding/redirect-to-private, and — if touched — the two development exceptions and their production/non-loopback failure paths.
6. If any control is missing, weakened, or untested, treat the change as **not safe to merge**, regardless of whether it otherwise builds or passes unrelated tests.
7. If the review implies changing what Article IV actually requires (not just how it is implemented), stop — that needs an explicit user-approved constitution amendment and an ADR under `docs/decisions/`, per the constitution's governance section, not a code review.

## Output

A checklist (one line per Article IV control: present / regressed / not touched), the test files that cover each changed control, and an explicit verdict: **safe to merge**, **not safe — missing/regressed controls: …**, or **needs a constitution amendment, not a code change**.
