# Pilot Readiness Report

| Field        | Value                                                                      |
| ------------ | -------------------------------------------------------------------------- |
| Purpose      | Summarize controlled-pilot readiness, launch controls, and remaining risk. |
| Owner        | Principal Product Engineering                                              |
| Status       | Controlled Pilot Active                                                    |
| Last Updated | 2026-08-07                                                                 |

## Table of Contents

- [Summary](#summary)
- [Strengths](#strengths)
- [Weaknesses](#weaknesses)
- [Security Review](#security-review)
- [Performance Review](#performance-review)
- [Scalability Review](#scalability-review)
- [Launch Controls](#launch-controls)
- [Production Verification](#production-verification)
- [Readiness Scores](#readiness-scores)
- [Postponed](#postponed)

## Summary

Caladrona entered a controlled production pilot on 2026-08-07. The approved scope uses a dedicated WhatsApp business/test number, named workspace administrators, explicit chat activation, and monitored background processing.

AI Decision Layer v2 is customer-visible in production with high-value recommendation gates, duplicate suppression, cooldowns, bounded project budgets, and `legacy` retained as the immediate rollback mode.

The 86-case provider-backed Kimi evaluation completed with no provider failures, 100% recommendation precision and recall, and zero inspection, follow-up, or duplicate false positives. Lower category and multi-signal extraction metrics remain an explicit live-review concern.

## Strengths

- Core workflows are tenant-scoped.
- R2 durable storage is in place for new media and generated reports.
- Background jobs and worker heartbeat provide operational visibility.
- AI features are asynchronous and bounded by retry and rate-limit controls.
- WhatsApp discovery does not ingest content until an administrator explicitly activates a chat.
- Recommendations and WhatsApp drafts retain human approval boundaries.

## Weaknesses

- Baileys remains a WhatsApp Web adapter and is not the final enterprise WhatsApp architecture.
- The active session experienced short recoverable `428` and `503` disconnects during preflight. Each reconnected automatically within seconds, but connection stability remains a monitored pilot risk.
- Voice transcription still depends on a provider with audio transcription support.
- Analytics are internal database events, not yet a full analytics dashboard.
- The Operations view retains historical failures and does not yet distinguish them clearly from the current health window.

## Security Review

Sensitive media access uses authorization plus short-lived signed URLs. Feedback and notifications are organization-scoped. Baileys auth storage is isolated on a persistent worker volume, while media and reports use R2. Automated Baileys credential backup and restoration remain hardening work.

## Performance Review

Pilot endpoints use indexed organization and user access paths. Dashboard polling remains lightweight, AI work is queued, and provider calls are throttled. These controls are appropriate for the limited pilot scope and should be revisited before larger onboarding waves.

## Scalability Review

The modular monolith remains appropriate for the pilot stage. Database-backed background processing is simple and observable. A dedicated queue, server-side WhatsApp catalog pagination, and the official Meta connector should be introduced when measured traffic justifies them.

## Launch Controls

- Use only a dedicated business/test WhatsApp number during the pilot.
- Activate only approved project chats and groups; discovery alone does not ingest message content.
- Keep a named organization owner responsible for chat activation, project mapping, and connection recovery.
- Review Operations health daily for worker heartbeat, recent failed jobs, queue depth, WhatsApp status, and coordinator activity.
- Keep recommendations human-approved; WhatsApp drafts require an explicit send action.
- Pause onboarding and investigate if the line cannot reconnect, recent failed jobs appear, or organization isolation is in doubt.

## Production Verification

The launch preflight on 2026-08-07 confirmed:

- Public site, login, API, PostgreSQL, Redis, worker, and coordinator services healthy.
- One active pilot WhatsApp line connected with eight explicitly active chat mappings.
- Twenty-one WhatsApp messages ingested in the preceding 24 hours.
- Twenty-one AI classifications, one photo analysis, and ninety-seven total background jobs completed in that window.
- Zero recent failed jobs and an online worker heartbeat.
- GitHub lint, typecheck, tests, and build checks passed on the release baseline.

## Readiness Scores

- Controlled-pilot readiness: 85%.
- Broad enterprise rollout readiness: 65%.
- Onboarding: 85%.
- Observability: 82%.
- Error UX: 80%.
- Mobile readiness: 82%.
- Accessibility: 80%.
- Deployment readiness: 86%.

## Postponed

- Full product analytics dashboard.
- Official Meta WhatsApp Cloud API.
- Automated Baileys credential backup and restoration.
- Server-side pagination for very large WhatsApp discovery catalogs.
- Broader customer rollout until pilot telemetry is reviewed.
