# Architecture Health Report

| Field        | Value                                                      |
| ------------ | ---------------------------------------------------------- |
| Purpose      | Summarize architecture health, risks, and pilot readiness. |
| Owner        | Engineering                                                |
| Status       | Active                                                     |
| Last Updated | 2026-07-08                                                 |

## Table of Contents

- [Strengths](#strengths)
- [Weaknesses](#weaknesses)
- [Technical Debt](#technical-debt)
- [Security Review](#security-review)
- [Performance Review](#performance-review)
- [Scalability Review](#scalability-review)
- [Recommended Improvements](#recommended-improvements)
- [Postponed Until After MVP](#postponed-until-after-mvp)

## Strengths

- Package boundaries are mostly clear: dashboard renders product surfaces, API owns auth and tenant authorization, worker owns background processing, AI logic lives in `packages/ai`, and WhatsApp code stays inside the integration package.
- Messaging remains channel-agnostic. WhatsApp-specific state is modeled through connector tables and adapter code.
- ActionItem terminology better matches the product and avoids prematurely committing recommendations to task semantics.
- AI extraction is smaller, deterministic, and avoids raw model output or chain-of-thought storage.
- The new `Event` model prepares the timeline without forcing the timeline feature into this sprint.
- Pilot readiness primitives are small and tenant-scoped: demo data, feedback, notifications, and analytics stay behind existing auth boundaries.
- Worker-owned jobs, R2 storage, and signed media URLs are aligned with the current production deployment model.

## Weaknesses

- Dashboard and API still share route contracts manually through TypeScript types rather than generated schemas.
- Some high-volume list endpoints use implicit limits or no explicit pagination contract.
- API request logs are useful but noisy in tests and can obscure failures.
- Production deployment still depends on environment configuration and managed storage work outside this sprint.
- The product tour is intentionally lightweight and does not yet include a full guided overlay or per-user completion state.

## Technical Debt

- WhatsApp media and auth storage are local filesystem-backed.
- Baileys auth session storage remains filesystem-backed, although new media/report storage now uses R2 in production.
- Server-side auth revocation and account recovery flows are missing.
- Observability is basic and should include queue lag, retry counts, and connector session state.
- Historical data is not backfilled into `Event` yet.

## Security Review

- API routes consistently enforce authentication and organization membership for organization-owned resources reviewed in this sprint.
- Project suggestions require explicit acceptance before changing conversation or connector project assignment.
- The worker avoids logging message bodies, QR payloads, cookies, JWTs, and raw AI provider output.
- Sensitive media URLs are short-lived and authorized by the API before being returned to the dashboard.
- Demo reset deletes only demo organizations owned by the signed-in user.

## Performance Review

- Common organization-scoped queries now have supporting indexes for conversations, messages, ActionItems, classifications, events, WhatsApp accounts, and chat mappings.
- Duplicate WhatsApp message protection uses the external message uniqueness constraint plus create-time conflict handling.
- Worker AI retries use bounded exponential backoff to avoid hot-looping during provider outages.

## Scalability Review

- The modular monolith remains appropriate for the current stage.
- The package boundaries leave room to extract the worker, connector, AI processor, or API modules later if load requires it.
- Pagination and observability should be strengthened before onboarding large organizations or importing large WhatsApp histories.
- Product analytics are captured as internal events but do not yet have aggregation dashboards.

## Recommended Improvements

- Add OpenAPI generation or shared response schemas.
- Add PostgreSQL-backed integration tests for ActionItem project suggestion acceptance.
- Add timeline read APIs with pagination and organization scoping in Task 008.
- Move connector state and media to production-grade storage.
- Replace static quick-start screenshot references with live production captures after deployment.
- Add audit events for sensitive admin decisions.

## Postponed Until After MVP

- Automatic project reassignment.
- Automatic task creation from AI output.
- Official Meta WhatsApp Cloud API production path.
- Real-time inbox and timeline streaming.
- Historical Event backfills.
- Full product analytics dashboard.
