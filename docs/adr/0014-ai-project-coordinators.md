# ADR 0014: AI Project Coordinators

| Field        | Value                                                                |
| ------------ | -------------------------------------------------------------------- |
| Purpose      | Document the AI Project Coordinator and recommendation architecture. |
| Owner        | Engineering                                                          |
| Status       | Accepted                                                             |
| Last Updated | 2026-07-08                                                           |

## Table of Contents

- [Context](#context)
- [Decision](#decision)
- [Consequences](#consequences)

## Context

FieldOS already captures messages, evidence, photo analysis, voice transcripts, timeline events, search documents, and reports. Project managers need an active system that says what changed, what needs attention, and what should happen next without forcing manual search.

## Decision

FieldOS will use AI Project Coordinators backed by a deterministic `ProjectState` snapshot and first-class `Recommendation` records.

The MVP includes:

- Progress Coordinator.
- Follow-up Coordinator.
- Inspection Coordinator.
- Report Coordinator.

Recommendations require human approval. FieldOS may create an Action Item, queue a report, or create a WhatsApp draft after approval, but WhatsApp drafts still require a final send action. FieldOS does not send messages, reassign projects, close work, or escalate issues automatically.

Coordinator logic is deterministic-first. AI may be used for concise summaries and draft wording, but not for hidden chain-of-thought or ungrounded operational claims.

## Consequences

Positive:

- Project managers get a prioritized recommendation queue.
- Coordinators can run from worker jobs and on demand from project pages.
- `CoordinatorRun` gives operations visibility into failures and output.
- `ProjectState` reduces repeated full-history scans.

Tradeoffs:

- Recommendation deduplication is intentionally simple for MVP.
- WhatsApp draft sending needs a real outbound connector before production sends can be verified.
- Completion percentage is advisory and deterministic, not a contractual schedule metric.
