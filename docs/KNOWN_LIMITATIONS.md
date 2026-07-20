# Known Limitations

| Field        | Value                                                       |
| ------------ | ----------------------------------------------------------- |
| Purpose      | Document pilot limitations and intentionally deferred work. |
| Owner        | Principal Engineering                                       |
| Status       | Active                                                      |
| Last Updated | 2026-07-18                                                  |

## Table of Contents

- [Pilot Limitations](#pilot-limitations)
- [Technical Limitations](#technical-limitations)
- [Deferred Features](#deferred-features)

## Pilot Limitations

- Demo data is realistic but synthetic.
- Demo evidence uses metadata records and placeholder storage keys.
- Product tour is lightweight and page-based rather than a full overlay walkthrough.

## Technical Limitations

- AI Decision Layer v2 begins in shadow mode; offline metrics do not substitute for live pilot precision monitoring.
- Per-conversation reporting cadence and holiday calendars are not yet configurable.
- Multi-signal recall is intentionally conservative and measured at 60% in the current acceptance harness.

- WhatsApp uses Baileys and should remain on a dedicated pilot/test number.
- Existing pre-R2 media may need re-ingestion before previewing from production storage.
- Voice transcription requires a provider with audio transcription support.
- Analytics events are stored but not yet visualized in a dashboard.

## Deferred Features

- Full timeline UI.
- Formal customer onboarding email flow.
- Invite and membership administration.
- Official Meta WhatsApp Cloud API connector.
- Semantic/vector search.
