# Production Readiness

| Field        | Value                                                   |
| ------------ | ------------------------------------------------------- |
| Purpose      | Track production readiness for the first FieldOS pilot. |
| Owner        | Principal Engineering                                   |
| Status       | Active                                                  |
| Last Updated | 2026-07-14                                              |

## Table of Contents

- [Readiness Score](#readiness-score)
- [Verified](#verified)
- [Checks Required Before Pilot](#checks-required-before-pilot)
- [Operational Runbook](#operational-runbook)

## Readiness Score

Overall readiness: 88%.

- Product demo readiness: 92%.
- Backend reliability: 88%.
- Data safety: 88%.
- Observability: 86%.
- Deployment confidence: 86%.

## Verified

- API health endpoint exists.
- Worker heartbeat and job monitoring exist.
- Coordinator run metrics and pending recommendation metrics exist in Operations Health.
- AI Recommendations and Project Coordinator panels are implemented with human approval controls.
- WhatsApp draft sends are queued by the API and delivered by the worker through the active Baileys session.
- R2-backed durable storage is configured for production media and reports.
- Demo workspace data is tenant-scoped and marked as demo.
- Feedback, notifications, onboarding, and analytics primitives are implemented.
- Local validation covers format, lint, typecheck, tests, build, and Prisma migrations before deployment.
- WhatsApp connection-loss alerts are durable, deduplicated, and isolated from the Baileys reconnect loop through worker-owned jobs.
- A controlled production outage/recovery pair completed successfully, both emails reached Resend's `delivered` state, and replay did not change the recovery send marker.

## Checks Required Before Pilot

- Apply the go-live QA migration in production.
- Deploy API, worker, and dashboard after this commit.
- Verify `GET /health`.
- Verify Railway worker heartbeat on `/admin/operations`.
- Verify coordinator scheduled scan queues `PROJECT_COORDINATOR` jobs at most hourly.
- Verify a project state rebuild and recommendation approval flow in production.
- Pair the dedicated WhatsApp pilot line and verify one `WHATSAPP_DRAFT_SEND` job succeeds.
- Reset demo workspace in production and confirm dashboard data loads.
- Confirm no sensitive tokens are printed in logs.
- Confirm Vercel has deployed the latest GitHub `main` commit.

## Operational Runbook

Use Railway deployment logs for API/worker errors, `/admin/operations` for job and worker health, and R2 object listing for media/report storage verification. WhatsApp connection alert delivery is represented by `WHATSAPP_CONNECTION_ALERT` jobs; inspect their retry state without logging recipient addresses or Resend credentials. Roll back by redeploying the previous successful Railway/Vercel deployment and restoring the previous database migration state only if required.
