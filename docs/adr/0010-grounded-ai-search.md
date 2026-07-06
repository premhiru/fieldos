# ADR 0010: Grounded AI Search

| Field        | Value                                                                        |
| ------------ | ---------------------------------------------------------------------------- |
| Purpose      | Document the grounded search index, source citation, and AI answer behavior. |
| Owner        | Engineering                                                                  |
| Status       | Accepted                                                                     |
| Last Updated | 2026-07-06                                                                   |

## Table of Contents

- [Context](#context)
- [Decision](#decision)
- [Reason](#reason)
- [Consequences](#consequences)
- [Review Triggers](#review-triggers)

## Context

FieldOS needs operators to ask practical questions across messages, projects, AI classifications, Action Items, and activity records without losing tenant isolation or source traceability.

AI search must not become an ungrounded assistant. Answers must be based on FieldOS records and must cite the source records used to produce the answer.

## Decision

FieldOS will implement search through a generic `SearchDocument` index owned by the API and database layer.

The index stores organization-scoped and optionally project-scoped source documents for:

- `PROJECT`
- `MESSAGE`
- `TIMELINE_EVENT`
- `ACTION_ITEM`
- `AI_CLASSIFICATION`

Keyword search uses PostgreSQL text search. AI answers retrieve a small set of relevant source records, send only those snippets to the AI provider, and return the answer with cited sources.

When there is not enough matching evidence, FieldOS returns a deterministic fallback: `I could not find enough information in FieldOS to answer that.`

## Reason

A single search index keeps the dashboard simple and avoids duplicating query logic across product surfaces.

PostgreSQL text search is sufficient for the MVP and avoids introducing vector infrastructure before there is real search telemetry.

Grounding every answer in retrieved records protects user trust and keeps AI output auditable.

## Consequences

Search results can lag source records until the index is refreshed by API-owned synchronization.

The dashboard must show sources beside AI answers and should treat citations as part of the answer contract.

Future semantic search can add embeddings or pgvector behind the same API without changing the dashboard contract.

## Review Triggers

Revisit this decision when search volume requires asynchronous indexing, when semantic recall becomes necessary, or when source-specific ranking rules need dedicated tuning.
