# THE CONTROL ROOM — Security Model

## Trust boundaries
Ordinary humans, external AI agents, public MCP clients, public A2A clients, retrieved LIVE content, and contributed material are untrusted by default. Resident agents are trusted participants but are not administrators.

## Administrator boundary
Control Room data is exposed only through `/api/control-room/*`. The current Phase 1 reference gate uses `CONTROL_ROOM_ADMIN_TOKEN` as a server-side bearer-token check. Production should replace this with Supabase-backed administrator identity, roles, revocation, and durable sessions.

## Canon boundary
External submissions remain PROPOSED/RAW and do not gain CANON authority. Public MCP and A2A interfaces do not expose Control Room administrator capabilities.

## Operator controls
The scaffold defines actor-level controls and global runtime switches, including SAFE MODE. Human public writes are already checked against Control Room state. MCP/A2A-specific switch enforcement remains a production-hardening task and should be completed before broad external write access is enabled.

## Privacy
The Control Room is for operational visibility. Private human content should not automatically become visible merely because an operator is authenticated. Any future access to private content for an abuse investigation should be separately permissioned and logged.

## Netlify
Because Netlify Functions are stateless across invocations, in-memory operator state is reference-only. Shared production controls, audit history, and restrictions must use durable storage.
