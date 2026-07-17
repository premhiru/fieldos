# Railway Deployment

| Field        | Value                                                               |
| ------------ | ------------------------------------------------------------------- |
| Purpose      | Document Railway service configuration for FieldOS backend hosting. |
| Owner        | Founding Engineering                                                |
| Status       | Active                                                              |
| Last Updated | 2026-07-16                                                          |

## Table of Contents

- [Services](#services)
- [Required Variables](#required-variables)
- [Notes](#notes)

FieldOS uses Railway for the first backend hosting target because the API, worker, PostgreSQL, and Redis can live in one project.

## Services

- `fieldos-api`: Fastify API using `infrastructure/railway/api.railway.json`.
- `fieldos-worker`: long-running worker using `infrastructure/railway/worker.railway.json`.
- `fieldos-coordinator-cron`: short-lived source-backed cron service using `infrastructure/railway/coordinator-cron/railway.json`.
- `Postgres`: managed PostgreSQL.
- `Redis`: managed Redis.

Public API URL:

```text
https://fieldos-api-production.up.railway.app
```

## Required Variables

API:

```text
NODE_ENV=production
PORT=${{PORT}}
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=<generated secret, at least 16 characters>
CRON_SECRET=<generated secret, at least 16 characters>
CORS_ORIGIN=https://fieldos-sand.vercel.app
KIMI_API_KEY=<Kimi API key>
KIMI_BASE_URL=https://api.moonshot.ai/v1
KIMI_MODEL=kimi-k2.6
OPENROUTER_API_KEY=<OpenRouter fallback API key>
AI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=openrouter/free
WHATSAPP_STORAGE_PATH=/data/whatsapp
WHATSAPP_SESSION_POLL_INTERVAL_MS=10000
MILESTONE_COORDINATOR_MIN_INTERVAL_MS=12000
```

Coordinator cron:

```text
CRON_SECRET=<same value as fieldos-api>
COORDINATOR_SCAN_URL=https://fieldos-api-production.up.railway.app
```

Worker:

```text
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
KIMI_API_KEY=<Kimi API key>
KIMI_BASE_URL=https://api.moonshot.ai/v1
KIMI_MODEL=kimi-k2.6
KIMI_VISION_MODEL=kimi-k2.6
OPENROUTER_API_KEY=<OpenRouter fallback API key>
AI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=openrouter/free
VISION_MODEL=openrouter/free
WHATSAPP_STORAGE_PATH=/data/whatsapp
WHATSAPP_SESSION_POLL_INTERVAL_MS=10000
```

Dashboard on Vercel:

```text
NEXT_PUBLIC_API_URL=https://fieldos-api-production.up.railway.app
```

## Notes

- The API start command applies Prisma migrations before booting.
- The worker is a long-running service and should not be deployed to Vercel serverless.
- Railway runs `fieldos-coordinator-cron` at `0 */4 * * *` UTC. The API applies a 55-minute Redis lock and queues only projects whose local time is between 07:00 and 19:00.
- Attach a persistent volume to `fieldos-worker` at `/data`; `WHATSAPP_STORAGE_PATH=/data/whatsapp` keeps Baileys credentials across deployments.
- Cloudflare R2 stores evidence and generated reports. It does not replace the worker volume used by Baileys multi-file auth state.
