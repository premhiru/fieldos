# Project Status

| Field        | Value                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| Purpose      | Track FieldOS milestone progress, task completion, technical debt, architecture decisions, and deployment readiness. |
| Owner        | Founding Engineering                                                                                                 |
| Status       | Active                                                                                                               |
| Last Updated | 2026-07-07                                                                                                           |

## Table of Contents

- [Current Milestone](#current-milestone)
- [Completed Tasks](#completed-tasks)
- [In-Progress Tasks](#in-progress-tasks)
- [Known Technical Debt](#known-technical-debt)
- [Upcoming Milestones](#upcoming-milestones)
- [Architecture Decisions Made](#architecture-decisions-made)
- [Deployment Status](#deployment-status)

## Current Milestone

Task 011 Unified Evidence Processing is deployed to production. Live WhatsApp mixed-evidence verification is pending QR pairing and an audio transcription key.

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
- Deployment preparation: Railway backend hosting plan.
  - Added Railway service configs for API and worker.
  - Added deployment documentation for Vercel dashboard plus Railway API, worker, PostgreSQL, and Redis.
  - Added Railway-specific API and worker start scripts.
- Production WhatsApp connector hardening.
  - Baileys pairing restart disconnects now restart cleanly after QR scan.
  - WhatsApp full-history sync is enabled for broader chat discovery after pairing.
  - History sync now records discovered chats from chat and message history payloads.
  - Common WhatsApp payloads such as stickers, locations, contacts, polls, events, reactions, and protocol sync messages are handled without showing an unsupported-message placeholder.
  - Dashboard reconnect flow now keeps a dedicated WhatsApp pairing panel above the chat/group list so the QR code remains visible.
- Task 007: AI Message Classification and Action Items.
  - `packages/ai` added with an OpenAI-compatible message classifier, strict JSON validation, prompt versioning, and worker processor.
  - Prisma models added for `AIMessageClassification` and `ActionItem`.
  - Active project messages are queued asynchronously for classification without blocking WhatsApp ingestion.
  - API endpoints added for message classification, project AI insights, action item listing, and accept/ignore actions.
  - Dashboard inbox message panels now show classification status, category, summary, location, confidence state, and Action Items.
  - Project detail pages now show AI Insights and human-reviewed Action Items.
  - ADR 0006 documents the human-approval requirement for AI Action Items.
- Sprint 1.5: Architecture Stabilization, UX Refinement, and Technical Debt.
  - `SuggestedTask` terminology standardized to `ActionItem`.
  - AI extraction simplified to category, summary, location, actionRequired, confidence, and concise reasoning.
  - Raw confidence percentages replaced with user-facing confidence states.
  - Generic `Event` model prepared for the future activity timeline.
  - Project suggestion Action Items implemented for active unmapped or mismatched messages.
  - Worker retry, graceful shutdown, and duplicate message protection improved.
  - API error payloads and ActionItem routes standardized.
  - Database indexes and organization-scoped query paths reviewed.
  - Architecture health and technical debt reports added.
- Pre-Task-008 usability and AI provider polish.
  - WhatsApp chats/groups in Settings can now be filtered by search, type, status, and project assignment.
  - AI classification now defaults to OpenRouter's `openrouter/free` model through `https://openrouter.ai/api/v1`.
  - `OPENROUTER_API_KEY` is now the primary AI provider key; `OPENAI_API_KEY` remains a fallback for OpenAI-compatible providers.
  - Railway production worker has `OPENROUTER_API_KEY`, `AI_BASE_URL`, and `AI_MODEL` configured.
- Task 009: Operations Command Center.
  - Authenticated homepage replaced with the Operations Command Center.
  - Deterministic operations summary cards added for project health, Action Items, activity, and pending AI reviews.
  - Projects Requiring Attention ranks active projects by criticality and open operational issues.
  - My Action Items groups assigned items by urgent, high, medium, and low priority with accept, complete, and dismiss actions.
  - Recent Activity shows business events across projects.
  - Lightweight `Milestone` model added for upcoming and overdue project deadlines.
  - API endpoints added for dashboard aggregate, summary, projects, action items, recent activity, and daily brief.
  - ADR 0009 documents the command-center aggregation and deterministic health decision.
- Task 010: AI Search.
  - Grounded `SearchDocument` retrieval index added for projects, messages, timeline events, Action Items, and AI classifications.
  - Organization and project-scoped search endpoints added.
  - Grounded AI answer endpoints added with source citations and deterministic fallback behavior.
  - Dashboard Search page added with project, source type, and date filters.
  - Project detail pages now include a scoped `Ask about this project` panel.
  - API tests cover search document creation, message search, timeline event search, Action Item search, scoped search, cross-organization isolation, AI answer citations, fallback, and invalid questions.
  - ADR 0010 documents grounded AI search.
- Task 010B: Operations Health and Background Job Monitoring.
  - Search indexing moved out of API search requests and into worker-owned `SEARCH_INDEX` jobs.
  - `ProcessingJob`, `WorkerHeartbeat`, and `Message.processingStatus` added to Prisma.
  - Worker now updates heartbeat, processes search/AI jobs, logs job IDs, correlation IDs, organization IDs, project IDs, durations, and outcomes.
  - Admin API endpoints added for operations health, jobs, worker heartbeat, individual retry, and bulk retry.
  - Dashboard `/admin/operations` page added for organization owners and admins.
  - ADR 0010B documents the lightweight observability approach.
- Task 011: Unified Evidence Processing.
  - `UnifiedEvidenceContext` added as a runtime context package for message text, project metadata, conversation metadata, sender, attachments, voice transcripts, and evidence summary.
  - Attachment-level transcript, transcription status, and transcription error fields added for voice notes.
  - AI classification now receives the unified evidence context instead of message text alone.
  - Worker now processes voice transcription jobs and continues AI classification when transcription fails.
  - Message search indexing now includes message text, voice transcripts, evidence summary labels, and attachment filenames.
  - Inbox messages now show Evidence Summary, expandable media details, and visible voice transcript status.
  - Command center Recent Evidence now opens grouped message updates when available.
  - API endpoints added for message context and evidence summary.
  - ADR 0011 documents the unified evidence processing decision.
  - Production migration, API, worker, and dashboard deployment completed.

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
- Existing WhatsApp message rows created before this fix may need data cleanup if unsupported placeholders were already stored.
- AI Action Items are not converted into first-class project tasks yet; accepted follow-up Action Items only record human approval.
- Milestones are lightweight command-center records; full scheduling dependencies and recurrence are intentionally deferred.
- The AI Daily Brief currently has a deterministic fallback path and should be connected to provider-backed generation after production prompt telemetry is available.
- AI provider failures are recorded on the classification row; worker retries now use bounded exponential backoff, but provider-specific retry policy remains intentionally minimal.
- Pagination is still limited to the highest-volume AI and ActionItem project views; conversation and message pagination should be formalized before large customer imports.
- API route response envelopes are improved but not yet generated from a shared OpenAPI contract.
- Production environments must set `OPENROUTER_API_KEY` and confirm the intended `AI_MODEL` before AI classification can run. `OPENAI_API_KEY` remains a fallback for OpenAI-compatible providers.
- Voice transcription uses OpenAI audio transcription when `OPENAI_API_KEY` is configured; OpenRouter chat keys do not provide audio transcription.
- WhatsApp media is still filesystem-backed, so Railway worker redeploys may lose local media unless object storage is added.
- Search uses PostgreSQL keyword search for the MVP; semantic/vector search is intentionally deferred until search telemetry proves the need.

## Upcoming Milestones

- Pair the WhatsApp line again and validate live mixed-evidence ingestion, voice transcription, AI classification, and search indexing.
- Configure `OPENAI_API_KEY` for production voice transcription if voice transcript generation is required.
- Configure branch protection for `main` and `develop`.
- Create `develop` branch after remote setup.
- Add invite and membership management after the basic auth/org/project slice is verified.
- Validate WhatsApp QR pairing, chat discovery, explicit activation, and inbound message ingestion with a dedicated business test number.
- Validate AI classifications and project suggestions with real active WhatsApp project messages.
- Convert accepted Action Items into first-class operational task records after the task domain exists.
- Build Task 008 activity timeline on top of the generic `Event` model.
- Add CRUD surfaces for milestones when project planning workflows are defined.
- Add official Meta WhatsApp Cloud API support for enterprise production deployments.

## Architecture Decisions Made

- ADR 0001: Build FieldOS as a modular monolith first, with clear package boundaries that can later evolve into services.
- Prisma 7 is configured with the PostgreSQL driver adapter via `@prisma/adapter-pg`.
- The API exposes health endpoints without eagerly opening a database connection, so health checks remain available during dependency outages.
- ADR 0002: Use JWT session tokens in HTTP-only cookies for MVP authentication.
- ADR 0003: Build messaging as a channel-agnostic platform and plug channel adapters into it.
- ADR 0004: Use Baileys as the first WhatsApp adapter while keeping WhatsApp logic outside the messaging core.
- ADR 0005: Discover WhatsApp chats/groups but require explicit admin activation before ingestion.
- ADR 0006: AI may create Action Items, but humans must accept or ignore them before they become operational work.
- ADR 0007: Simplify the MVP around ActionItems, compact AI extraction, event-driven timeline preparation, and human-approved project suggestions.
- ADR 0009: Use an API-owned Operations Command Center with deterministic health rules and lightweight milestones.
- ADR 0010: Use PostgreSQL-backed grounded retrieval with cited sources for AI search.
- ADR 0010B: Use lightweight database-backed background jobs and worker heartbeat for operations observability.
- ADR 0011: Use runtime unified evidence context for grouped operational updates.

## Deployment Status

- Dashboard deployed to Vercel production: `https://fieldos-sand.vercel.app`.
- Latest Vercel deployment URL: `https://fieldos-a1qlu1bqq-premhirus-projects.vercel.app`.
- Backend deployed to Railway.
  - API deployed at `https://fieldos-api-production.up.railway.app`.
  - API health verified at `https://fieldos-api-production.up.railway.app/health`.
  - Worker deployed and verified running with startup log: `worker started and waiting for jobs`.
  - Railway PostgreSQL service `Postgres` is deployed and migrations are applied.
  - Railway Redis service `Redis` is deployed.
- Production login cookie fix completed.
  - Cross-origin auth cookies now use `SameSite=None; Secure` in production.
  - API tests assert production cookie attributes.
- WhatsApp pairing issue under investigation.
  - Dashboard API requests now avoid sending `Content-Type: application/json` when there is no request body.
  - Worker logs WhatsApp session start, QR generation, successful connection, and disconnect status codes.
  - Baileys restart-required disconnects now restart the session instead of leaving the account in `ERROR`.
  - Baileys recoverable transport disconnects such as `428 connectionClosed` now restart instead of leaving the account in `ERROR`.
- WhatsApp chat discovery and message normalization hardening completed.
  - Worker requests full desktop-style WhatsApp history via Baileys.
  - Worker consumes `messaging-history.set` to discover chats beyond the small live-update subset.
  - Inbox messages no longer use the `Unsupported WhatsApp message type` placeholder for common WhatsApp event/media payloads.
- WhatsApp reconnect UI hardening completed.
  - Settings starts QR polling immediately after Connect/Reconnect is clicked.
  - The QR pairing panel is shown above existing chats/groups while reconnecting.
  - Dashboard redeployed and aliased to `https://fieldos-sand.vercel.app`.
- WhatsApp reconnect QR backend fix completed.
  - Connect/Reconnect now rotates the WhatsApp account session key.
  - The Baileys worker now uses the database `sessionKey` as the auth-state folder, forcing fresh QR generation after a user-initiated reconnect.
  - The Baileys worker now auto-rotates stale pre-pairing sessions that close before a QR is generated, preventing a reconnect loop from leaving the UI stuck on `Waiting for QR code`.
  - Baileys upgraded to `7.0.0-rc13` to use the current WhatsApp Web protocol runtime after repeated pre-QR `428 connectionClosed` disconnects.
  - Pairing sessions now use a lighter browser/history profile until credentials are registered, then switch back to desktop full-history sync after pairing.
- Vercel `NEXT_PUBLIC_API_URL` is configured for production.
- Dashboard redeployed to Vercel production with the Railway API URL.
- Dashboard, API, worker, auth, projects, messaging, and Baileys WhatsApp connector application slices exist.
- Local code validation passed for format, lint, typecheck, tests, and build.
- GitHub Release `v0.0.1-foundation` exists.
- Docker runtime validation passed locally with PostgreSQL and Redis healthy.
- Prisma migrations are applied locally.
- Dashboard is running locally at `http://localhost:3000`.
- API is running locally at `http://localhost:3001`.
- Worker Redis startup has been verified locally.
- Railway config-as-code was evaluated but not committed because the generated TypeScript SDK import failed on Windows in this environment.
- Task 003, Task 005, Task 006, and Task 006B application code is included in the deployed dashboard, API, and worker services.
- Sprint 1.5 code has passed local validation; production deployment requires environment variable review and a deployment trigger.
- Task 007 code is validated locally; the Railway worker now has OpenRouter environment variables configured for provider-backed classification.
- Task 009 code is deployed to Railway and migrations are applied.
- Task 010B is deployed.
  - Background processing migration `20260706020000_background_processing_observability` applied to Railway PostgreSQL.
  - API deployment `39ee02a5-fb29-4136-9975-e0f4b18c4998` succeeded.
  - Worker deployment `3dce9681-8f45-4d63-8ee1-f7c86bbd3404` succeeded.
  - Dashboard deployed to Vercel and aliased to `https://fieldos-sand.vercel.app`.
  - API health verified at `https://fieldos-api-production.up.railway.app/health`.
  - Worker heartbeat verified in `WorkerHeartbeat` with status `ONLINE`.
  - A production `SEARCH_INDEX` job was queued and completed by the worker.
  - Live WhatsApp sample-message verification is pending because the connected line is currently waiting for QR pairing.
- Task 011 is deployed.
  - Migration `20260707010000_unified_evidence_processing` applied to Railway PostgreSQL.
  - API deployment `d00084bf-ebf3-41b0-be38-ffb118459587` succeeded.
  - Worker deployment `643f5843-845e-4d76-9be2-66bea781f7dc` succeeded.
  - Dashboard deployment `dpl_8wBoSaf3jDUZR5kLK3o8axEPjhoe` deployed and aliased to `https://fieldos-sand.vercel.app`.
  - API health verified at `https://fieldos-api-production.up.railway.app/health`.
  - Dashboard route `/admin/operations` returned HTTP 200.
  - Production attachment transcript columns verified in Railway PostgreSQL.
  - Worker heartbeat verified in `WorkerHeartbeat` with status `ONLINE`.
  - Live mixed WhatsApp evidence verification is pending because the WhatsApp line must be paired again.
  - Production voice transcription requires `OPENAI_API_KEY`; OpenRouter is configured for chat classification, but not audio transcription.
