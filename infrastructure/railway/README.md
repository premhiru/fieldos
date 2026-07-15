# Railway Deployment

| Field        | Value                                                               |
| ------------ | ------------------------------------------------------------------- |
| Purpose      | Document Railway service configuration for FieldOS backend hosting. |
| Owner        | Founding Engineering                                                |
| Status       | Active                                                              |
| Last Updated | 2026-07-02                                                          |

## Table of Contents

- [Services](#services)
- [Required Variables](#required-variables)
- [Notes](#notes)

FieldOS uses Railway for the first backend hosting target because the API, worker, PostgreSQL, and Redis can live in one project.

## Services

- `fieldos-api`: Fastify API using `infrastructure/railway/api.railway.json`.
- `fieldos-worker`: long-running worker using `infrastructure/railway/worker.railway.json`.
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
CORS_ORIGIN=https://fieldos-sand.vercel.app
WHATSAPP_STORAGE_PATH=/data/whatsapp
WHATSAPP_SESSION_POLL_INTERVAL_MS=10000
```

Worker:

```text
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
OPENROUTER_API_KEY=<OpenRouter API key>
AI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=openrouter/free
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
- Attach a persistent volume to `fieldos-worker` at `/data`; `WHATSAPP_STORAGE_PATH=/data/whatsapp` keeps Baileys credentials across deployments.
- Cloudflare R2 stores evidence and generated reports. It does not replace the worker volume used by Baileys multi-file auth state.
