# ADR 0006: Human-Approved AI Action Items

| Field        | Value                                                                        |
| ------------ | ---------------------------------------------------------------------------- |
| Purpose      | Record the decision to keep AI-generated Action Items behind human approval. |
| Owner        | Engineering                                                                  |
| Status       | Accepted                                                                     |
| Last Updated | 2026-07-03                                                                   |

## Table of Contents

- [Context](#context)
- [Decision](#decision)
- [Reason](#reason)
- [Consequences](#consequences)
- [Review Triggers](#review-triggers)

## Context

FieldOS now classifies active project messages and can identify follow-up work from field communications. These classifications are useful for triage, but provider output can be incomplete, stale, or wrong.

## Decision

AI may create `ActionItem` records from message classifications, but those records remain review artifacts until a user explicitly accepts or ignores them.

Accepted suggestions do not yet become first-class operational tasks. They only record human approval until the task domain is implemented.

## Reason

Field operations work can affect safety, cost, schedule, and customer commitments. The system should reduce coordination work without silently creating operational obligations from probabilistic model output.

## Consequences

The worker may classify messages and create pending Action Items asynchronously. The dashboard may show these suggestions on message and project surfaces. Users must make the final decision before the suggestion can influence operational task workflows.

This keeps AI support useful while preserving accountability and leaving a clean path to future task conversion.

## Review Triggers

Revisit this decision when FieldOS adds first-class project tasks, automatic routing rules, customer-facing actions, or tenant policies that allow limited automation under explicit admin control.
