# Technical Debt

| Field        | Value                                                                                  |
| ------------ | -------------------------------------------------------------------------------------- |
| Purpose      | Track known technical debt, deferred features, risks, and next-sprint recommendations. |
| Owner        | Engineering                                                                            |
| Status       | Active                                                                                 |
| Last Updated | 2026-07-13                                                                             |

## Table of Contents

- [High Priority](#high-priority)
- [Medium Priority](#medium-priority)
- [Low Priority](#low-priority)
- [Deferred Features](#deferred-features)
- [Risks](#risks)
- [Recommended Next Sprint](#recommended-next-sprint)

## High Priority

- Move WhatsApp auth state from local `.storage` to managed secret or durable state storage before broader production customer use.
- Add password-reset request rate limiting and email verification before broad external testing.
- Formalize pagination contracts for conversations, messages, and chat mappings before importing large tenants.
- Add production observability around worker retries, WhatsApp disconnect reasons, AI provider failures, and queue lag.
- Replace placeholder quick-start screenshots with production screenshots after the pilot deployment is live.

## Medium Priority

- Generate an OpenAPI contract or shared route schemas so dashboard and API response envelopes cannot drift.
- Add tenant-level audit records for sensitive actions such as WhatsApp reconnect, chat activation, project suggestion acceptance, and membership changes.
- Expand integration tests around project suggestion acceptance against a real PostgreSQL database.
- Replace placeholder GitHub ownership values with real FieldOS GitHub teams.

## Low Priority

- Reduce noisy request logging in API tests.
- Add screenshots or Playwright smoke coverage for confidence states and ActionItem flows.
- Add a product analytics dashboard for the new internal analytics event stream.
- Backfill `Event` records for historical messages and ActionItems when the timeline UI is ready.
- Add richer UI affordances for numeric confidence details.

## Deferred Features

- Official Meta WhatsApp Cloud API connector.
- First-class operational task model and conversion from accepted ActionItems.
- Activity Timeline UI.
- Full interactive product tour overlay.
- Invite, membership administration, role management, and organization settings.
- Real-time inbox updates.
- Full text or semantic search.
- Invite and email-verification flows.

## Risks

- Baileys remains a WhatsApp Web adapter and can be affected by upstream protocol changes.
- Active unmapped WhatsApp chats now ingest content after explicit activation; admins must understand activation scope.
- Deterministic project suggestions are conservative and will miss ambiguous references until richer project context is added.
- AI classification depends on provider availability and configured production credentials.
- Demo evidence uses metadata records and placeholder storage keys; it is sufficient for walkthroughs but not a substitute for live media validation.

## Recommended Next Sprint

- Run a production pilot smoke test after deployment.
- Capture real quick-start screenshots from production.
- Add audit coverage for ActionItem, feedback, demo reset, and project suggestion decisions.
- Prioritize official customer feedback from the first pilot before adding major features.
