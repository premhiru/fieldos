# Known Limitations

| Field        | Value                                                       |
| ------------ | ----------------------------------------------------------- |
| Purpose      | Document pilot limitations and intentionally deferred work. |
| Owner        | Principal Engineering                                       |
| Status       | Active                                                      |
| Last Updated | 2026-07-24                                                  |

## Table of Contents

- [Pilot Limitations](#pilot-limitations)
- [Technical Limitations](#technical-limitations)
- [Deferred Features](#deferred-features)

## Pilot Limitations

- Demo data is realistic but synthetic.
- Demo evidence uses metadata records and placeholder storage keys.
- Product tour is lightweight and page-based rather than a full overlay walkthrough.

## Technical Limitations

- AI Decision Layer v2 remains in shadow mode; provider-backed synthetic evaluation does not substitute for live pilot precision monitoring.
- Per-conversation reporting cadence and holiday calendars are not yet configurable.
- Primary-category accuracy is 88.37%; multi-signal precision and recall are 53.57% and 46.88%. Recommendation policy is deliberately optimized for precision while these extraction gaps are reviewed.
- Operations job totals currently retain historical failed records, so an all-time failure count can remain non-zero after the worker has recovered. Current health should use recent jobs, active queue depth, coordinator runs, and worker heartbeat together.
- One stale WhatsApp account remains in QR-pairing state and can produce recurring QR timeout logs until an administrator retries or removes that account.

- WhatsApp uses Baileys and should remain on a dedicated pilot/test number.
- WhatsApp-native recommendation delivery, replies, participant sync, and invitations are dark-launched and must remain disabled globally until real test-account validation passes.
- Baileys cannot provide authoritative phone numbers, complete metadata, or reliable read receipts for every identity; FieldOS stores JID/LID separately and reports only confirmed send state.
- Identity merge is admin-reviewed and intentionally avoids fuzzy name matching. Bulk review and merge reversal UI are deferred.
- A discovered external contact must complete secure account activation before approving recommendations. Unauthenticated external-approver actions are deferred until the recommendation actor model can attribute them without impersonating a platform user.
- Existing pre-R2 media may need re-ingestion before previewing from production storage.
- Voice transcription requires a provider with audio transcription support.
- Analytics events are stored but not yet visualized in a dashboard.

## Deferred Features

- Full timeline UI.
- Formal customer onboarding email flow.
- Invite and membership administration.
- Official Meta WhatsApp Cloud API connector.
- Semantic/vector search.
