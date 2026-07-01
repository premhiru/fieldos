# ADR 0004: Baileys WhatsApp Connector

| Field        | Value                                                                                   |
| ------------ | --------------------------------------------------------------------------------------- |
| Purpose      | Record the decision to use Baileys as the first WhatsApp adapter for the unified inbox. |
| Owner        | Engineering                                                                             |
| Status       | Accepted                                                                                |
| Last Updated | 2026-07-01                                                                              |

## Table of Contents

- [Context](#context)
- [Decision](#decision)
- [Reason](#reason)
- [Alternatives Considered](#alternatives-considered)
- [Tradeoffs](#tradeoffs)
- [Review Triggers](#review-triggers)

## Context

FieldOS needs a WhatsApp connector so field operations messages can enter the unified inbox. The messaging core is already channel-agnostic, so WhatsApp-specific pairing, session state, identifiers, and media handling must stay outside `packages/messaging`.

## Decision

Use the maintained Baileys package as the first WhatsApp adapter. Place adapter code in `packages/integrations/whatsapp/baileys`, run sessions from `apps/worker`, share QR payloads through Redis, and persist inbound events into the generic conversation, participant, message, and attachment tables.

The adapter owns WhatsApp-specific models:

- `WhatsAppAccount` for organization-owned connector accounts and session status.
- `WhatsAppChatMapping` for linking WhatsApp JIDs to generic conversations and optional projects.

## Reason

Baileys gives FieldOS a pragmatic development connector before official Meta WhatsApp Cloud API onboarding is complete. Keeping it in an adapter package preserves the unified inbox design: the dashboard and messaging services continue to work with conversations and messages, not provider-specific objects.

## Alternatives Considered

- Build directly on the official Meta WhatsApp Cloud API now: deferred because it requires production sender onboarding and would slow local product iteration.
- Put WhatsApp fields directly on `Conversation` and `Message`: rejected because it would leak channel-specific assumptions into the messaging core.
- Run Baileys inside the API process: rejected because long-lived connector sessions belong in the worker process, not the request path.

## Tradeoffs

Baileys uses WhatsApp Web pairing and should be treated as a development and early validation adapter, not the final enterprise production integration path. Session material and media are filesystem-backed for now, which is simple locally but not production-ready.

## Review Triggers

Revisit this decision when FieldOS needs production WhatsApp onboarding, multi-region workers, managed media storage, official Meta Cloud API support, or stronger controls around WhatsApp session material.
