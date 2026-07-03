# FieldOS

| Field        | Value                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------ |
| Purpose      | Introduce the FieldOS engineering foundation, repository layout, and development workflow. |
| Owner        | Founding Engineering                                                                       |
| Status       | Active                                                                                     |
| Last Updated | 2026-07-03                                                                                 |

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Development Setup](#development-setup)
- [Commands](#commands)
- [Deployment](#deployment)
- [Repository Layout](#repository-layout)
- [Development Philosophy](#development-philosophy)
- [Tech Stack](#tech-stack)
- [Current Roadmap](#current-roadmap)
- [Contributing Guidelines](#contributing-guidelines)
- [License](#license)

## Overview

FieldOS is the AI Operating System for Field Operations.

The repository is a pnpm and Turborepo monorepo containing a Next.js dashboard, a Fastify API, a standalone Redis-backed worker, shared packages for UI, database access, authentication, messaging, AI classification, cross-cutting utilities, and a Baileys-based WhatsApp adapter.

## Architecture

FieldOS starts as a modular monolith with clear package boundaries. The current product slice supports JWT-cookie authentication, organization workspaces, organization memberships, projects, a channel-agnostic messaging foundation, a WhatsApp Web connector that feeds messages into the unified inbox, and a human-reviewed AI classification layer for active project messages.

```mermaid
flowchart TD
  Dashboard["apps/dashboard\nNext.js App Router"]
  API["apps/api\nFastify"]
  Worker["apps/worker\nNode Worker"]
  UI["packages/ui\nReusable UI"]
  DB["packages/db\nPrisma Client"]
  Shared["packages/shared\nEnv, Logger, Utilities"]
  Auth["packages/auth\nJWT, Passwords, Auth Schemas"]
  Messaging["packages/messaging\nConversations, Messages, Attachments"]
  AI["packages/ai\nMessage Classification, Suggestions"]
  WhatsApp["packages/integrations/whatsapp/baileys\nBaileys Adapter"]
  Postgres["PostgreSQL"]
  Redis["Redis"]
  Provider["OpenAI-compatible API"]

  Dashboard --> UI
  Dashboard --> Shared
  API --> DB
  API --> Shared
  API --> Messaging
  API --> AI
  Worker --> Shared
  Worker --> AI
  Worker --> WhatsApp
  WhatsApp --> DB
  WhatsApp --> Messaging
  WhatsApp --> AI
  AI --> Provider
  AI --> DB
  Worker --> Redis
  DB --> Postgres
  Auth --> Shared
```

## Development Setup

Prerequisites:

- Node.js 22 or newer
- pnpm 11 or newer
- Docker Desktop or a compatible Docker runtime

Install dependencies:

```bash
pnpm install
```

Start infrastructure:

```bash
docker compose up
```

Generate Prisma client and apply migrations:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Configure AI classification by setting `OPENAI_API_KEY`. `AI_MODEL` defaults to `gpt-4.1-mini` for local development.

Test the auth flow:

```bash
pnpm --filter @fieldos/api test
pnpm --filter @fieldos/dashboard test
```

Run the development servers:

```bash
pnpm dev
```

Default local services:

- Dashboard: `http://localhost:3000`
- API: `http://localhost:3001`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Deployment

FieldOS uses Vercel for the dashboard and Railway for the first backend hosting target.

- Dashboard: `https://fieldos-sand.vercel.app`
- API: `https://fieldos-api-production.up.railway.app`
- Worker: Railway service `fieldos-worker`
- PostgreSQL: Railway managed PostgreSQL service `Postgres`
- Redis: Railway managed Redis service `Redis`

See [docs/09_DEPLOYMENT.md](./docs/09_DEPLOYMENT.md) for the full deployment plan, service variables, and verification steps.

## Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm format
pnpm typecheck
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

## Repository Layout

```text
apps/
  dashboard/       Next.js App Router dashboard.
  api/             Fastify API service.
  worker/          Standalone Redis-backed worker.
packages/
  ui/              Shared UI components.
  db/              Prisma schema, migration, client, and database utilities.
  ai/              Message classification, extraction, and suggested task generation.
  auth/            JWT cookie auth, password hashing, and auth schemas.
  integrations/
    whatsapp/
      baileys/     WhatsApp Web adapter that ingests messages through Baileys.
  messaging/       Channel-agnostic conversation, message, and attachment services.
  shared/          Environment helpers, logger, constants, and utilities.
docs/              Product, architecture, UX, database, roadmap, and ADR docs.
tests/             Cross-cutting and end-to-end tests.
scripts/           Development and operations scripts.
infrastructure/    Infrastructure definitions.
.github/           GitHub templates, ownership, and CI workflows.
```

## Development Philosophy

- Prefer simple, explicit code over premature abstraction.
- Keep domain and package boundaries clear.
- Treat typing, linting, tests, and formatting as part of the product.
- Document architecture decisions when they constrain future choices.
- Build production habits early, but do not build speculative features.

## Tech Stack

- TypeScript
- Turborepo
- pnpm
- Next.js App Router
- TailwindCSS
- shadcn/ui-style components
- Fastify
- Prisma ORM
- PostgreSQL
- Redis
- Zod
- TanStack Query
- Zustand
- Vitest
- Playwright
- Docker
- GitHub Actions
- OpenAI-compatible Chat Completions API

## Auth and Tenancy

FieldOS uses JWT session tokens stored in HTTP-only cookies for the MVP. Passwords are hashed with bcrypt. The API owns session validation and tenant authorization.

Organizations are workspaces. Users access organizations through memberships with one of four roles: `OWNER`, `ADMIN`, `MEMBER`, or `VIEWER`.

Project creation is limited to `OWNER` and `ADMIN`. Project reads are scoped to organization membership.

## Messaging

FieldOS models all channel communication as conversations, participants, messages, and attachments. Messaging services are channel-agnostic. Channel adapters map external systems into the core model rather than changing the model itself.

Supported channel values are `WHATSAPP`, `EMAIL`, `SLACK`, `TEAMS`, and `SMS`.

## WhatsApp Connector

The current WhatsApp connector uses the maintained Baileys package for WhatsApp Web pairing. Accounts are created and managed from dashboard settings. QR payloads are exchanged through Redis, session files and media are stored under `.storage`, and inbound messages are normalized into the generic messaging tables only after an admin activates the chat or group.

FieldOS discovers WhatsApp chat and group metadata first. Discovered, ignored, and archived chats are not shown in the Inbox and do not store message bodies or attachments. Admins must map a chat/group to a project and activate it before new incoming messages are ingested.

Use dedicated business numbers only. Do not connect personal WhatsApp accounts. FieldOS will add the official Meta WhatsApp Cloud API path for production enterprise deployments later.

## AI Classification

FieldOS classifies only messages that already passed the WhatsApp activation gate and belong to a project. Classification runs asynchronously in the worker so message ingestion is never blocked by the AI provider.

The AI layer can classify a message, summarize it, extract a location and priority, and create a suggested task. Suggested tasks remain `PENDING` until a user accepts or rejects them; FieldOS does not automatically create operational work from AI output.

## Current Roadmap

1. Validate WhatsApp QR pairing and explicit chat activation with dedicated business test numbers.
2. Add invite and membership management.
3. Add operational observability and deployment automation.
4. Expand AI-assisted triage into human-approved operational tasks, reports, and official Meta WhatsApp Cloud API support after core workflow boundaries are stable.

## Contributing Guidelines

- Use Conventional Commits.
- Create pull requests for changes to `main`.
- Keep changes focused and update documentation when behavior or architecture changes.
- Ensure lint, typecheck, test, and build pass before merging.
- Add ADRs for architecture-impacting decisions.

## License

FieldOS is licensed under the MIT License. See [LICENSE](./LICENSE).
