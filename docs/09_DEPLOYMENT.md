# Deployment

| Field        | Value                                                              |
| ------------ | ------------------------------------------------------------------ |
| Purpose      | Define the first production hosting approach for FieldOS services. |
| Owner        | Founding Engineering                                               |
| Status       | Proposed                                                           |
| Last Updated | 2026-07-02                                                         |

## Table of Contents

- [Overview](#overview)
- [Hosting Targets](#hosting-targets)
- [Railway Services](#railway-services)
- [Environment Variables](#environment-variables)
- [Deployment Flow](#deployment-flow)
- [Operations Notes](#operations-notes)
- [Open Items](#open-items)

## Overview

FieldOS uses Vercel for the Next.js dashboard and Railway for the backend runtime layer.

The dashboard is already deployed to Vercel. The API, worker, PostgreSQL, and Redis should be deployed together in Railway so the worker can stay long-running and the backend services can share managed infrastructure.

## Hosting Targets

| Component | Target  | Reason                                      |
| --------- | ------- | ------------------------------------------- |
| Dashboard | Vercel  | Native Next.js hosting and preview deploys. |
| API       | Railway | Long-running Node service with healthcheck. |
| Worker    | Railway | Long-running process with Redis access.     |
| Database  | Railway | Managed PostgreSQL near API and worker.     |
| Cache     | Railway | Managed Redis near API and worker.          |

## Railway Services

Create one Railway project named `fieldos` with four services:

- `fieldos-api`
- `fieldos-worker`
- `fieldos-postgres`
- `fieldos-redis`

The service config files live in `infrastructure/railway/`.

Use `infrastructure/railway/api.railway.json` for the API service.
Use `infrastructure/railway/worker.railway.json` for the worker service.

## Environment Variables

API service:

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

Worker service:

```text
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
WHATSAPP_STORAGE_PATH=/data/whatsapp
WHATSAPP_SESSION_POLL_INTERVAL_MS=10000
```

Vercel dashboard:

```text
NEXT_PUBLIC_API_URL=https://<fieldos-api>.up.railway.app
```

## Deployment Flow

1. Authenticate Railway locally with `railway login` or set `RAILWAY_TOKEN`.
2. Create the Railway project and services.
3. Attach PostgreSQL and Redis.
4. Configure API and worker environment variables.
5. Deploy `fieldos-api` from `main`.
6. Deploy `fieldos-worker` from `main`.
7. Set `NEXT_PUBLIC_API_URL` in Vercel to the Railway API public URL.
8. Redeploy the Vercel dashboard.
9. Verify `GET /health` on the public API URL.
10. Verify dashboard login/signup flows against the hosted API.

## Operations Notes

- The API deployment runs Prisma migrations before startup.
- Railway should run the API healthcheck against `/health`.
- The worker should restart on failure.
- Keep Postgres and Redis private to Railway services where possible.
- Use a dedicated business WhatsApp test number before live pairing.

## Open Items

- Railway authentication is required before cloud resources can be created from this environment.
- Baileys session files need a persistent Railway volume or object storage before live WhatsApp pairing.
- Production secrets should be generated and stored only in provider-managed environment variables.
