# ADR 0007: MVP Simplification

| Field        | Value                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| Purpose      | Document Sprint 1.5 naming, AI extraction, event model, and project suggestion stabilization decisions. |
| Owner        | Engineering                                                                                             |
| Status       | Accepted                                                                                                |
| Last Updated | 2026-07-03                                                                                              |

## Table of Contents

- [Context](#context)
- [Decision](#decision)
- [Reason](#reason)
- [Consequences](#consequences)
- [Review Triggers](#review-triggers)

## Context

Tasks 001 through 007 established the FieldOS foundation, authentication, projects, messaging, WhatsApp integration, and AI classification. Before adding the next product feature, the codebase needed a simpler shared vocabulary and a smaller AI data contract.

The previous "SuggestedTask" language implied that every recommendation should become an operational task. That is not true for the MVP. Many recommendations are review prompts, routing suggestions, or lightweight follow-ups.

## Decision

FieldOS will use `ActionItem` as the canonical term for human-reviewable recommendations.

AI classification output is limited to:

- `category`
- `summary`
- `location`
- `actionRequired`
- `confidence`

The system may also store `reasoningSummary`, a short user-facing explanation. It must not store chain-of-thought or raw model output.

Timeline preparation will use a generic `Event` model with source type, source id, event type, title, description, and timestamps.

Project suggestions will be represented as `ActionItem` records with type `PROJECT_SUGGESTION`. Accepting a suggestion may update the conversation and connector mapping. Ignoring a suggestion records the decision. FieldOS will not automatically reassign projects from AI output.

## Reason

`ActionItem` better matches the product reality: some recommendations become tasks later, while others remain review-only nudges. A smaller AI extraction contract is easier to test, cheaper to maintain, and less likely to create stale or unused fields.

The generic `Event` model lets Task 008 build an activity timeline without coupling timeline storage to messaging, AI, reports, or WhatsApp internals.

Human-approved project reassignment protects organization data quality. A wrong automatic reassignment could move field communication into the wrong project context.

## Consequences

Database, API, UI, services, and documentation must use `ActionItem` terminology.

Confidence should be presented as a user-facing state first: High Confidence, Needs Review, or Low Confidence. Numeric confidence can remain available in details or internal views.

The AI provider prompt stays compact and deterministic. Any future extraction field must have a current product surface or operational reason.

Task 008 can consume `Event` records but should not assume every historical record has already been backfilled.

## Review Triggers

Revisit this decision when FieldOS introduces first-class project tasks, customer-facing automation, full activity timeline backfills, or tenant-configurable automatic routing policies.
