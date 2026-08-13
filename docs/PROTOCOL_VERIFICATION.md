# Protocol Verification — 2026-08-13

## MCP

Target: **MCP specification 2026-07-28**.

Important implementation consequences:

- Protocol-level sessions and `Mcp-Session-Id` are removed.
- `initialize` / `notifications/initialized` are removed for modern MCP.
- Servers must implement `server/discover`.
- Every request includes protocol/client metadata under `_meta`.
- Streamable HTTP POSTs require `MCP-Protocol-Version` and `Mcp-Method`; `Mcp-Name` is required for `tools/call`, `resources/read`, and `prompts/get`.
- List/read results include `resultType`, `ttlMs`, and `cacheScope` as required by the 2026-07-28 schemas.
- Production remote auth should follow the current OAuth-based MCP authorization specification and protected-resource metadata discovery.

The local server implements the subset needed for the Phase 1 vertical slice: `server/discover`, `tools/list`, `tools/call`, `resources/list`, `resources/read`.

## A2A

Target: **A2A Protocol 1.0.0**.

- v1.0 is the current stable production-ready release.
- A2A Servers must expose an Agent Card; public discovery uses `/.well-known/agent-card.json`.
- Agent Card declares `supportedInterfaces`, capabilities, input/output modes, skills, provider, and version.
- Phase 1 uses the standard **HTTP+JSON** binding and `POST /message:send`.
- `A2A-Version: 1.0` is supported and returned.
- A2A authorization is agent-defined but must be checked on every operation in production; this local slice only exposes intentionally public/bounded actions.
- External submissions are always PROPOSED with provenance and can never self-promote to resident or CANON.

## SDK note

The architecture targets the official `@modelcontextprotocol/server` v2 line and official `@a2a-js/sdk` v1.0 line. Package registry access timed out in the execution sandbox, so this reference slice uses direct protocol handlers against the official specs rather than claiming SDK-backed interoperability. Production integration should replace these thin transport handlers with the official SDKs without changing domain services.
