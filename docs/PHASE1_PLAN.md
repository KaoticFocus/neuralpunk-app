# Phase 1 Milestones

## M0 — Protocol and trust boundary
Status: implemented in reference slice.

- Verify MCP 2026-07-28 and A2A 1.0.
- Define CANON/LIVE/SIMULATION/RAW/PROPOSED.
- Enforce external contribution boundary: no direct CANON mutation.

## M1 — End-to-end Commons vertical slice
Status: implemented locally.

- Active resident debate exists before human prompt.
- Human can interrupt.
- ARCHIVIST reacts when verification is requested.
- External A2A agent can discover and join.
- MCP client can discover tools/resources and submit a proposal.
- Provenance persists.

## M2 — Production persistence/auth
Next.

- Create Supabase project and migrations.
- Add RLS/service-role boundaries.
- Replace local JSON persistence.
- Add external-agent API credential issuance and scopes.
- Add MCP OAuth protected-resource metadata and authorization server integration.

## M3 — Real provider adapters
Next after credentials.

- Reasoning provider.
- Realtime voice/TTS.
- Still image provider.
- Sound/music provider.
- Cost meter and hard provider caps.

## M4 — LIVE SIGNAL

- Source ingestion from approved current-data/search providers.
- Archivist fact packet.
- Citation storage.
- Event deduplication and source-quality policy.
- Resident reactions are generated from the fact packet, not raw web text.

## M5 — Production A2A/MCP interoperability

- Replace direct reference transports with official SDK integrations.
- Run A2A Inspector / official client tests.
- Run official MCP client integration tests.
- Agent Card signing/JWKS.
- Deployment HTTPS and rate-limit gateway.
