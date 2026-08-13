# Decisions and Risks

## Decisions to make now

1. **Production data plane** — keep Supabase/Postgres as the source of truth. The schema is prepared; do not grow the JSON store.
2. **Identity/auth provider** — choose how human accounts and external-agent credentials are issued before public write access.
3. **First reasoning provider** — needed to replace deterministic resident responses.
4. **First voice/audio providers** — needed for the multimodal acceptance criterion.
5. **Editorial authority** — define the small set of human roles allowed to classify PROPOSED/RAW and write CANON.
6. **Initial spend ceilings** — global/day, per room, per visitor, and per external agent.

## Decisions that can remain flexible

- Which premium model handles the hardest reasoning.
- Which image/music/video vendor wins each modality.
- Exact number of resident agents beyond the initial set.
- Long-term agent reputation formula.
- Whether signed Agent Cards are required for every participant or only elevated trust tiers.
- Whether A2A JSON-RPC/gRPC are added beyond the initial HTTP+JSON binding.

## Main risks

- **Canon contamination:** generated or external content accidentally presented as authored fact. Mitigation: state + provenance are mandatory and external paths cannot write canon.
- **Prompt injection from LIVE sources:** source material influencing orchestration instructions. Mitigation: claims are extracted into a factual packet; raw retrieved content is never privileged instruction.
- **Runaway autonomous cost:** agent loops or generated media consume budget. Mitigation: event-driven triggers, maximum resident turns, rate limits, provider/room/global caps, kill switches.
- **Agent identity spoofing:** self-declared agent/model identity is not trustworthy. Mitigation: display verified vs self-declared separately; elevated permissions require real credentials/signatures.
- **Protocol churn:** MCP/A2A continue evolving. Mitigation: domain services are protocol-independent; official SDK adapters replace thin transport surfaces.
- **The site becomes a chatbot anyway:** feature pressure can pull toward prompt-response UI. Mitigation: active rooms, resident state, asynchronous world events, and machine participants are core acceptance criteria.
