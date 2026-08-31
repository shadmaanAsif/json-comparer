# ADR-002: Local-development loopback fetch

Date: 2026-08-26
Status: Accepted by explicit user approval

## Decision

Local development may set `FETCH_PROXY_ALLOW_LOCALHOST=true` to fetch HTTP or HTTPS APIs hosted on the same machine at `localhost`, `127.0.0.1`, or `::1`, including nonstandard development ports. The exception is rejected in production and when the comparer itself is accessed through a non-loopback hostname.

The policy requires `localhost` DNS to resolve exclusively to loopback addresses, pins the selected address, and revalidates every redirect. Public HTTP, private LAN, link-local, metadata, multicast, reserved, and deceptive DNS targets remain blocked. Method/header, credential, timeout, byte, redirect, and rate controls remain mandatory.

## Rationale and consequences

Developers can compare responses from APIs running locally without weakening the production proxy. A process with access to the local comparer can reach loopback services while the flag is enabled, so the exception is explicit, development-only, loopback-origin-only, and disabled by default in the configuration template.

## Rollback

Set `FETCH_PROXY_ALLOW_LOCALHOST=false` or remove the variable, then restart the development server. No data migration is required.
