# Project Status

| Field        | Value                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| Purpose      | Track FieldOS milestone progress, task completion, technical debt, architecture decisions, and deployment readiness. |
| Owner        | Founding Engineering                                                                                                 |
| Status       | Active                                                                                                               |
| Last Updated | 2026-07-01                                                                                                           |

## Table of Contents

- [Current Milestone](#current-milestone)
- [Completed Tasks](#completed-tasks)
- [In-Progress Tasks](#in-progress-tasks)
- [Known Technical Debt](#known-technical-debt)
- [Upcoming Milestones](#upcoming-milestones)
- [Architecture Decisions Made](#architecture-decisions-made)
- [Deployment Status](#deployment-status)

## Current Milestone

Explicit WhatsApp chat activation implemented and ready for live QR pairing validation.

## Completed Tasks

- Task 001: Initialize the FieldOS Repository.
  - Local repository created at `C:/Users/Admin/OneDrive/Documents/Atlas/fieldos`.
  - Git initialized on `main`.
  - Repository structure created.
  - pnpm workspace configured.
  - Turborepo, TypeScript, ESLint, Prettier, Husky, lint-staged, and Changesets configured.
  - GitHub pull request templates, issue templates, CODEOWNERS, and CI workflows created.
  - Documentation skeleton created.
  - Initial commit created: `d18eb96 chore: initialize FieldOS engineering foundation`.
  - Repository pushed to GitHub: `https://github.com/premhiru/fieldos`.
- Task 002: Build the Engineering Foundation.
  - Dashboard, API, worker, and shared packages are implemented.
  - Code-level validation passes for format, lint, typecheck, tests, and build.
  - Dashboard startup verified at `http://127.0.0.1:3000`.
  - API startup verified at `http://127.0.0.1:3001`.
  - API endpoints verified:
    - `GET /` returns `{"service":"FieldOS API"}`.
    - `GET /health` returns `{"status":"ok"}`.
  - GitHub Release created: `v0.0.1-foundation`.
  - Docker Compose verified with PostgreSQL and Redis healthy locally.
  - Worker Redis startup verified locally.
- Task 003: Authentication, Organizations, and Projects.
  - JWT cookie auth implemented in the API.
  - Signup, login, logout, and current-user endpoints implemented.
  - Organization creation and membership-scoped organization reads implemented.
  - Project creation, list, and detail reads implemented.
  - Dashboard auth pages, onboarding, project list, and project detail pages implemented.
  - Code-level validation passes for format, lint, typecheck, tests, and build.
  - Prisma migrations verified against local PostgreSQL.
  - Dashboard routes verified locally: `/`, `/login`, `/signup`, `/projects`, and `/settings`.
  - API health verified locally at `http://127.0.0.1:3001/health`.
- Task 005: Build the Messaging Platform.
  - Channel-agnostic conversations, participants, messages, and attachments implemented.
  - `packages/messaging` added with services, repository interfaces, validation, and tests.
  - Messaging API endpoints implemented for conversation listing/detail, messages, attachments, and message deletion.
  - Dashboard inbox list, search, conversation detail, message display, disabled composer, and attachment list implemented.
  - Seed data script added for one organization, three projects, five conversations, twenty messages, and attachments.
  - ADR 0003 documents the channel-agnostic messaging platform decision.
- Task 006: Build the Baileys WhatsApp Connector.
  - Baileys adapter package added under `packages/integrations/whatsapp/baileys`.
  - WhatsApp accounts and chat-to-project mappings added to Prisma.
  - Worker starts and reconciles Baileys sessions, stores QR payloads in Redis, and ingests inbound messages into the unified inbox.
  - API endpoints added for WhatsApp account lifecycle, QR retrieval, chat listing, and project mapping.
  - Dashboard settings page now supports WhatsApp connection management, QR display, connection status, and chat-to-project assignment.
  - ADR 0004 documents the Baileys adapter decision.
- Task 006B: Add Explicit WhatsApp Chat/Group Activation.
  - WhatsApp chat mappings now support `DISCOVERED`, `ACTIVE`, `IGNORED`, and `ARCHIVED` states.
  - Discovery stores metadata only and does not create inbox conversations or message records.
  - Worker ingestion skips non-active or unmapped chats before message normalization, body storage, attachment storage, or future AI processing.
  - Dashboard settings now requires admins to select a project and activate each chat/group explicitly.
  - Inbox listing excludes WhatsApp conversations unless their mapping is `ACTIVE` and mapped to a project.
  - ADR 0005 documents the explicit activation requirement.

## In-Progress Tasks

- None.

## Known Technical Debt

- CODEOWNERS references `@fieldos/engineering`, which must be replaced or backed by a real GitHub team after the organization is created.
- Git author identity is configured locally as `FieldOS Engineering <engineering@fieldos.local>` and should be replaced with the company identity when available.
- Vitest is configured with `--passWithNoTests`; real tests should be added with the first product and infrastructure behavior.
- Auth sessions do not yet support server-side revocation.
- Invite, membership administration, password reset, and email verification flows are not implemented yet.
- Messaging is not real-time yet.
- Message sending is internal/development-only until channel adapters exist.
- Baileys is a WhatsApp Web adapter and should be used only with dedicated business test numbers until official Meta Cloud API support is implemented.
- WhatsApp media storage is local filesystem-backed under `.storage` and needs object storage before production deployment.
- Live WhatsApp QR pairing and activation needs a dedicated test number before production confidence.

## Upcoming Milestones

- Configure branch protection for `main` and `develop`.
- Create `develop` branch after remote setup.
- Define product requirements and initial domain boundaries.
- Add invite and membership management after the basic auth/org/project slice is verified.
- Validate WhatsApp QR pairing, chat discovery, explicit activation, and inbound message ingestion with a dedicated business test number.
- Add official Meta WhatsApp Cloud API support for enterprise production deployments.

## Architecture Decisions Made

- ADR 0001: Build FieldOS as a modular monolith first, with clear package boundaries that can later evolve into services.
- Prisma 7 is configured with the PostgreSQL driver adapter via `@prisma/adapter-pg`.
- The API exposes health endpoints without eagerly opening a database connection, so health checks remain available during dependency outages.
- ADR 0002: Use JWT session tokens in HTTP-only cookies for MVP authentication.
- ADR 0003: Build messaging as a channel-agnostic platform and plug channel adapters into it.
- ADR 0004: Use Baileys as the first WhatsApp adapter while keeping WhatsApp logic outside the messaging core.
- ADR 0005: Discover WhatsApp chats/groups but require explicit admin activation before ingestion.

## Deployment Status

- Not deployed.
- Dashboard, API, worker, auth, projects, messaging, and Baileys WhatsApp connector application slices exist.
- Local code validation passed for format, lint, typecheck, tests, and build.
- GitHub Release `v0.0.1-foundation` exists.
- Docker runtime validation passed locally with PostgreSQL and Redis healthy.
- Prisma migrations are applied locally.
- Dashboard is running locally at `http://localhost:3000`.
- API is running locally at `http://localhost:3001`.
- Worker Redis startup has been verified locally.
- Task 003 is not deployed.
- Task 003 local verification is complete.
- Task 005 is not deployed.
- Task 005 local verification is complete: migrations, seed data, tests, build, and dashboard route checks pass.
- Task 006 is not deployed.
  - Task 006 local verification is complete for migration, code checks, dashboard startup, API health, and worker startup.
  - Live WhatsApp QR scanning was not performed because no dedicated business test number was provided in this environment.
- Task 006B is not deployed.
  - Task 006B local verification is complete for migration, format, lint, typecheck, tests, and build.
  - Live WhatsApp activation was not performed because no dedicated business test number was provided in this environment.
