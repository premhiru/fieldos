# ADR 0009: Operations Command Center

| Field        | Value                                                                                  |
| ------------ | -------------------------------------------------------------------------------------- |
| Purpose      | Document the dashboard aggregation, health calculation, and milestone modeling choice. |
| Owner        | Engineering                                                                            |
| Status       | Accepted                                                                               |
| Last Updated | 2026-07-06                                                                             |

## Table of Contents

- [Context](#context)
- [Decision](#decision)
- [Reason](#reason)
- [Consequences](#consequences)
- [Review Triggers](#review-triggers)

## Context

FieldOS needs a global post-login homepage that gives operators immediate visibility into project health, current work, recent activity, upcoming deadlines, and AI review load.

The dashboard should not become a business logic layer. Health, ranking, and organization scoping must be consistent across API consumers.

## Decision

FieldOS will implement the Operations Command Center as an API-owned aggregate consumed by the dashboard.

The command center includes:

- Deterministic operations summary metrics.
- Ranked projects requiring attention.
- Action Items assigned to the current user, grouped by priority.
- Recent business events.
- Lightweight upcoming milestones.
- A daily brief with a deterministic fallback.

Project health is calculated from explicit rules and thresholds:

- `CRITICAL`: safety issue, several urgent Action Items, or multiple overdue milestones.
- `NEEDS_ATTENTION`: high-priority Action Items, delivery or inspection signals, or overdue work.
- `HEALTHY`: no critical Action Items, no safety events, and no overdue milestones.

Milestones are modeled with a small `Milestone` table instead of a full planning or scheduling system.

## Reason

The command center is a read-heavy cross-domain view. Keeping aggregation in the API preserves tenant authorization, avoids duplicating logic in React, and keeps the homepage deterministic.

The lightweight milestone model gives the homepage enough deadline awareness without prematurely building dependencies, recurrence, calendars, or resource planning.

AI can help summarize known facts, but it must not determine project health or invent operational status.

## Consequences

Dashboard screens should call the dashboard API endpoints rather than recomputing health locally.

The API must maintain stable response shapes for summary, project ranking, Action Item groups, recent activity, milestones, and brief data.

Future provider-backed brief generation must use only known FieldOS records and retain the deterministic fallback.

## Review Triggers

Revisit this decision when FieldOS adds a full scheduling domain, first-class task assignment, generated OpenAPI route contracts, or tenant-configurable health thresholds.
