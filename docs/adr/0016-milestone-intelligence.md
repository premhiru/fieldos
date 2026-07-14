# ADR 0016: Milestone Intelligence

| Field        | Value                                                                                |
| ------------ | ------------------------------------------------------------------------------------ |
| Purpose      | Record how FieldOS derives and approves milestone changes from operational evidence. |
| Owner        | Product Engineering                                                                  |
| Status       | Accepted                                                                             |
| Last Updated | 2026-07-13                                                                           |

## Table of Contents

- [Context](#context)
- [Decision](#decision)
- [Consequences](#consequences)
- [Alternatives Considered](#alternatives-considered)

## Context

Field messages often contain reliable project checkpoint information, but wording, relative dates, and milestone names vary. Silently applying model output would make schedules difficult to trust and could turn an ambiguous chat message into authoritative project state.

ADR number `0015` is already assigned to team invitations and project access. This decision uses `0016` to preserve the existing architecture record.

## Decision

FieldOS will create milestone recommendations from classified messages, voice transcripts, existing milestones, and project date context. Humans must approve every create or update.

Deterministic parsing and normalized title matching run first. Matching an existing milestone is preferred over creating another record. A strict, versioned AI prompt is used only when deterministic extraction cannot resolve a clear result.

Relative dates are resolved from the evidence `occurredAt` timestamp and project timezone. The recommendation stores and displays both the original phrase and resolved date. Ambiguous dates remain unset and require review.

Approval creates or changes a milestone transactionally, marks the recommendation complete, and creates a user-facing business timeline event such as `Milestone completed: Foundation Pour`. It then rebuilds Project State. Connector and messaging packages remain unaware of milestone rules.

## Consequences

- Project managers retain control over authoritative schedule state.
- Evidence, explanation, and confidence remain visible during review.
- Duplicate milestones and pending recommendations are reduced through deterministic normalization and deduplication keys.
- Approval adds a small interaction cost, accepted in exchange for trust and auditability.
- Scheduling dependencies, recurrence, and resource planning remain deferred.

## Alternatives Considered

- Automatically mutate milestones at high confidence: rejected because confidence does not replace accountable approval.
- Always create a new milestone: rejected because field terminology frequently describes an existing checkpoint.
- Let AI resolve every date and title: rejected because deterministic rules are cheaper, testable, and easier to explain.
- Store only a technical audit event: rejected because project timelines need meaningful business language.
