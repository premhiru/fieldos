# ADR 0010B: Background Processing Observability

| Field        | Value                                                                               |
| ------------ | ----------------------------------------------------------------------------------- |
| Purpose      | Document FieldOS background processing, search indexing, and operations visibility. |
| Owner        | Platform Engineering                                                                |
| Status       | Accepted                                                                            |
| Last Updated | 2026-07-06                                                                          |

## Table of Contents

- [Context](#context)
- [Decision](#decision)
- [Consequences](#consequences)
- [Alternatives Considered](#alternatives-considered)

## Context

Tasks 001-010 introduced asynchronous work: WhatsApp ingestion, AI classification, Action Item creation, event creation, and grounded search indexing. Search indexing previously happened during API search requests, which made search endpoints mutate state and hid operational failures from developers and support engineers.

FieldOS needs basic visibility into worker health, queued work, failed work, and retry behavior before the platform adds more asynchronous features.

## Decision

FieldOS will use a lightweight database-backed `ProcessingJob` table for MVP background processing visibility and retries.

Search indexing will move to worker-owned `SEARCH_INDEX` jobs. API search endpoints are read-only and never rebuild the index synchronously.

Messages will store a support-facing `processingStatus` value so operators can inspect whether a message is waiting on media, transcription, search, AI, or has failed.

Workers will update `WorkerHeartbeat` every 30 seconds with worker name, version, status, and last heartbeat timestamp.

The dashboard will expose `/admin/operations` for organization `OWNER` and `ADMIN` users only. The page shows worker status, job summary, WhatsApp account health, AI health, search indexing health, media placeholders, and retry controls for failed jobs.

## Consequences

Search results may lag behind writes until the worker processes indexing jobs. This is acceptable for the MVP and makes failures visible.

Failed background work can be retried without database surgery.

The database remains the source of truth for job visibility, which keeps local development and Railway deployment simple.

`ProcessingJob` is not a full workflow engine. Complex orchestration, fan-out, delayed scheduling, and distributed locking can be revisited when production load proves the need.

## Alternatives Considered

Temporal, Bull Board, and external orchestration platforms were intentionally deferred. They add operational surface area before FieldOS has enough workflow complexity to justify them.

Redis-only queues were also deferred because they do not provide durable, queryable job history as simply as the existing PostgreSQL database.
