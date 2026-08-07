# Known Limitations

| Field        | Value                                                       |
| ------------ | ----------------------------------------------------------- |
| Purpose      | Document pilot limitations and intentionally deferred work. |
| Owner        | Principal Engineering                                       |
| Status       | Active                                                      |
| Last Updated | 2026-08-07                                                  |

## Table of Contents

- [Pilot Limitations](#pilot-limitations)
- [Technical Limitations](#technical-limitations)
- [Deferred Features](#deferred-features)

## Pilot Limitations

- Use a dedicated business/test WhatsApp number and activate only approved pilot chats.
- Demo data is realistic but synthetic, and older demo evidence may use placeholder storage keys.
- The pilot requires a named administrator and daily Operations health review.
- Expansion beyond the initial users and chats waits for the first telemetry review.

## Technical Limitations

- AI Decision Layer v2 is customer-visible with conservative recommendation gates; provider-backed evaluation does not substitute for live pilot precision monitoring.
- Primary-category accuracy is 88.37%; multi-signal precision and recall are 53.57% and 46.88%. Recommendation policy is deliberately optimized for precision while these extraction gaps are reviewed.
- Operations job totals retain historical failed records. Current health should use recent jobs, active queue depth, coordinator runs, and worker heartbeat together.
- WhatsApp uses Baileys and can experience short recoverable WhatsApp Web disconnects. It should remain on a dedicated pilot/test number.
- Legacy disconnected/error WhatsApp account records remain in production and should be archived or removed only through an explicit administrator decision.
- Existing pre-R2 media may need re-ingestion before previewing from production storage.
- Voice transcription requires a provider with audio transcription support.
- Per-conversation reporting cadence and holiday calendars are not yet configurable.
- Analytics events are stored but not yet visualized in a dashboard.

## Deferred Features

- Official Meta WhatsApp Cloud API connector.
- Automated Baileys credential backup and restoration.
- Server-side pagination for very large WhatsApp discovery catalogs.
- Tenant-level audit records for sensitive administration actions.
- Broad enterprise rollout until controlled-pilot evidence supports it.
