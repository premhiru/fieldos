# Technical Debt

| Field        | Value                                                                                  |
| ------------ | -------------------------------------------------------------------------------------- |
| Purpose      | Track known technical debt, deferred features, risks, and next-sprint recommendations. |
| Owner        | Engineering                                                                            |
| Status       | Active                                                                                 |
| Last Updated | 2026-07-03                                                                             |

## Table of Contents

- [High Priority](#high-priority)
- [Medium Priority](#medium-priority)
- [Low Priority](#low-priority)
- [Deferred Features](#deferred-features)
- [Risks](#risks)
- [Recommended Next Sprint](#recommended-next-sprint)

## High Priority

- Move WhatsApp auth state and media from local `.storage` to managed secret and object storage before production customer use.
- Add server-side session revocation, password reset, and email verification before broad external testing.
- Formalize pagination contracts for conversations, messages, and chat mappings before importing large tenants.
- Add production observability around worker retries, WhatsApp disconnect reasons, AI provider failures, and queue lag.

## Medium Priority

- Generate an OpenAPI contract or shared route schemas so dashboard and API response envelopes cannot drift.
- Add tenant-level audit records for sensitive actions such as WhatsApp reconnect, chat activation, project suggestion acceptance, and membership changes.
- Expand integration tests around project suggestion acceptance against a real PostgreSQL database.
- Replace placeholder GitHub ownership values with real FieldOS GitHub teams.

## Low Priority

- Reduce noisy request logging in API tests.
- Add screenshots or Playwright smoke coverage for confidence states and ActionItem flows.
- Backfill `Event` records for historical messages and ActionItems when the timeline UI is ready.
- Add richer UI affordances for numeric confidence details.

## Deferred Features

- Official Meta WhatsApp Cloud API connector.
- First-class operational task model and conversion from accepted ActionItems.
- Activity Timeline UI.
- Invite, membership administration, role management, and organization settings.
- Real-time inbox updates.
- Full text or semantic search.

## Risks

- Baileys remains a WhatsApp Web adapter and can be affected by upstream protocol changes.
- Active unmapped WhatsApp chats now ingest content after explicit activation; admins must understand activation scope.
- Deterministic project suggestions are conservative and will miss ambiguous references until richer project context is added.
- AI classification depends on provider availability and configured production credentials.

## Recommended Next Sprint

- Build Task 008 on top of the `Event` model.
- Add timeline read APIs with pagination from the start.
- Add audit coverage for ActionItem and project suggestion decisions.
- Keep the dashboard presentation-oriented and preserve the API as the authorization and business logic boundary.
