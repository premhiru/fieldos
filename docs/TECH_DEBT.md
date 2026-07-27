# Technical Debt

| Field        | Value                                                                                  |
| ------------ | -------------------------------------------------------------------------------------- |
| Purpose      | Track known technical debt, deferred features, risks, and next-sprint recommendations. |
| Owner        | Engineering                                                                            |
| Status       | Active                                                                                 |
| Last Updated | 2026-07-24                                                                             |

## Table of Contents

- [High Priority](#high-priority)
- [Medium Priority](#medium-priority)
- [Low Priority](#low-priority)
- [Deferred Features](#deferred-features)
- [Risks](#risks)
- [Recommended Next Sprint](#recommended-next-sprint)

## High Priority

- Complete dedicated test-number validation before enabling WhatsApp-native delivery, replies, participant synchronization, or invitations.
- Add email verification before broad external self-service registration.
- Formalize pagination contracts for conversations, messages, and chat mappings before importing large tenants.
- Add alert thresholds around worker retries, unknown-result WhatsApp sends, disconnect reasons, AI provider failures, and queue lag.
- Replace placeholder quick-start screenshots with production screenshots after the pilot deployment is live.

## Medium Priority

- Generate an OpenAPI contract or shared route schemas so dashboard and API response envelopes cannot drift.
- Complete tenant-level audit coverage for legacy membership changes and project suggestion acceptance; WhatsApp-native recommendation, identity, participant, and invitation operations are audited.
- Expand integration tests around project suggestion acceptance against a real PostgreSQL database.
- Replace placeholder GitHub ownership values with real FieldOS GitHub teams.

## Low Priority

- Add a digest design for low-priority WhatsApp recommendations; they remain platform-only until a real batch can be delivered.
- Add screenshots or Playwright smoke coverage for confidence states and ActionItem flows.
- Add a product analytics dashboard for the new internal analytics event stream.
- Backfill `Event` records for historical messages and ActionItems when the timeline UI is ready.
- Add richer UI affordances for numeric confidence details.

## Deferred Features

- Official Meta WhatsApp Cloud API connector.
- First-class operational task model and conversion from accepted ActionItems.
- Activity Timeline UI.
- Full interactive product tour overlay.
- Real-time inbox updates.
- Full text or semantic search.
- Email-verification flow.

## Risks

- Baileys remains a WhatsApp Web adapter and can be affected by upstream protocol changes.
- Conservative participant synchronization may retain stale people until WhatsApp returns a complete authoritative roster; partial snapshots never remove access or participation.
- A worker interruption after WhatsApp accepts a send but before FieldOS persists the provider key produces an unknown-result failure that requires manual review to avoid duplicate delivery.
- Active unmapped WhatsApp chats now ingest content after explicit activation; admins must understand activation scope.
- Deterministic project suggestions are conservative and will miss ambiguous references until richer project context is added.
- AI classification depends on provider availability and configured production credentials.
- Demo evidence uses metadata records and placeholder storage keys; it is sufficient for walkthroughs but not a substitute for live media validation.

## Recommended Next Sprint

- Run a production pilot smoke test after deployment.
- Capture real quick-start screenshots from production.
- Run the WhatsApp-native test matrix with a dedicated account before enabling any rollout flag.
- Add remaining audit coverage for ActionItem, feedback, demo reset, and project suggestion decisions.
- Prioritize official customer feedback from the first pilot before adding major features.
