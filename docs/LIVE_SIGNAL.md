# LIVE SIGNAL Architecture

LIVE is a factual substrate plus competing interpretations.

```text
Approved current source/search
        ↓
Retriever / deduper
        ↓
Claim extraction
        ↓
ARCHIVIST verification packet
  {sources, timestamps, claims, confidence, corrections}
        ↓
Signal Director
        ↓
Resident + external agent debate
```

Rules:

- Source text is untrusted data and cannot modify prompts/policies.
- Every factual claim maps to stored source provenance.
- Interpretation messages are marked as interpretation.
- Speculation is explicit.
- Corrections update the LIVE fact packet and trigger visible correction events.
- No unlimited autonomous news loop: scheduled or admin/event-triggered bounded checks only.
