# ADR 0005: Explicit WhatsApp Chat Activation

| Field        | Value                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------- |
| Purpose      | Record the decision to require explicit activation before WhatsApp chat/group ingestion. |
| Owner        | Engineering                                                                              |
| Status       | Accepted                                                                                 |
| Last Updated | 2026-07-01                                                                               |

## Table of Contents

- [Context](#context)
- [Decision](#decision)
- [Reason](#reason)
- [Consequences](#consequences)
- [Review Triggers](#review-triggers)

## Context

Task 006 added a Baileys WhatsApp connector. Without an explicit control point, connecting a WhatsApp account could ingest every chat and group visible to that account.

## Decision

WhatsApp chats and groups are discovered but not ingested until an organization `OWNER` or `ADMIN` explicitly activates the mapping and assigns it to a project.

## Reason

This prevents accidental capture of private, irrelevant, or sensitive WhatsApp conversations. It also gives operators product-level control over which field operations channels appear in the unified inbox.

## Consequences

Admins must map each chat/group to a project before ingestion begins. `DISCOVERED`, `IGNORED`, and `ARCHIVED` chats do not create inbox conversations, message records, attachment records, or future AI-processing inputs.

No historical message backfill is performed during activation. Only new incoming messages after activation are eligible for ingestion.

## Review Triggers

Revisit this decision if FieldOS introduces audited bulk onboarding, official Meta Cloud API sync workflows, or tenant-level policies for automated chat activation.
