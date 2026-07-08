# Production Readiness

| Field        | Value                                                   |
| ------------ | ------------------------------------------------------- |
| Purpose      | Track production readiness for the first FieldOS pilot. |
| Owner        | Principal Engineering                                   |
| Status       | Active                                                  |
| Last Updated | 2026-07-08                                              |

## Table of Contents

- [Readiness Score](#readiness-score)
- [Verified](#verified)
- [Checks Required Before Pilot](#checks-required-before-pilot)
- [Operational Runbook](#operational-runbook)

## Readiness Score

Overall readiness: 82%.

- Product demo readiness: 88%.
- Backend reliability: 82%.
- Data safety: 85%.
- Observability: 78%.
- Deployment confidence: 78%.

## Verified

- API health endpoint exists.
- Worker heartbeat and job monitoring exist.
- R2-backed durable storage is configured for production media and reports.
- Demo workspace data is tenant-scoped and marked as demo.
- Feedback, notifications, onboarding, and analytics primitives are implemented.

## Checks Required Before Pilot

- Apply the pilot readiness migration in production.
- Deploy API, worker, and dashboard after this commit.
- Verify `GET /health`.
- Verify Railway worker heartbeat on `/admin/operations`.
- Reset demo workspace in production and confirm dashboard data loads.
- Confirm no sensitive tokens are printed in logs.

## Operational Runbook

Use Railway deployment logs for API/worker errors, `/admin/operations` for job and worker health, and R2 object listing for media/report storage verification. Roll back by redeploying the previous successful Railway/Vercel deployment and restoring the previous database migration state only if required.
