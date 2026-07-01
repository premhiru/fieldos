# ADR 0003: Unified Messaging Platform

| Field        | Value                                                                             |
| ------------ | --------------------------------------------------------------------------------- |
| Purpose      | Record the messaging model decision for conversations, messages, and attachments. |
| Owner        | Engineering                                                                       |
| Status       | Accepted                                                                          |
| Last Updated | 2026-06-30                                                                        |

## Table of Contents

- [Context](#context)
- [Decision](#decision)
- [Reason](#reason)
- [Alternatives Considered](#alternatives-considered)
- [Tradeoffs](#tradeoffs)
- [Review Triggers](#review-triggers)

## Context

FieldOS needs a unified inbox for field operations. The first channel adapter will arrive later, but the core application should not be coupled to any single communication provider.

## Decision

Build messaging as a channel-agnostic platform. FieldOS stores all communications as conversations, participants, messages, and attachments. Channel adapters translate external events into this model.

## Reason

A generic messaging core keeps product workflows stable as new channels are added. Future adapters can map external identifiers, sender metadata, message bodies, and attachments into FieldOS without changing inbox, project, authorization, or message display logic.

## Alternatives Considered

- Build directly around the first channel adapter: rejected because it would leak provider assumptions into the product model.
- Create separate message tables per channel: rejected because it would fragment inbox logic and make cross-channel product features harder.
- Wait until all future channels are known: rejected because the current field operations workflow needs a usable inbox foundation now.

## Tradeoffs

The generic model may not expose every provider-specific capability immediately. Adapter packages can keep provider-specific metadata outside the core messaging services until the product has a clear reason to promote a field into the shared model.

## Review Triggers

Revisit this decision if provider-specific workflows require first-class data that cannot be represented as conversations, participants, messages, attachments, or channel adapter metadata.
