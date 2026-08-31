# ADR-001: Local development public-host wildcard

Date: 2026-08-25
Status: Accepted by explicit user direction

## Decision

Local development may configure `FETCH_PROXY_ALLOWLIST=*` so the comparer can fetch any public HTTPS/443 host. The route rejects wildcard mode in production and when accessed through a non-loopback application hostname. DNS validation, pinned resolved addresses, redirect revalidation, restricted-address denial, safe method/header policy, credential stripping, timeouts, byte limits, and rate limiting remain mandatory.

## Rationale and consequences

This enables short-lived local API testing without editing configuration for every public host. It must not be deployed as an open proxy. Private, link-local, metadata, multicast, and reserved targets remain unreachable, including through redirects or DNS results. Loopback remains unreachable under this wildcard; the independent, explicitly configured exception in [ADR-002](ADR-002-localhost-fetch.md) governs local-machine APIs.

## Rollback

Remove `.env.development` or replace `*` with explicit hostnames. No data migration is required.
