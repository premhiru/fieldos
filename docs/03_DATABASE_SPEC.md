# Database Specification

| Field        | Value                                                                                  |
| ------------ | -------------------------------------------------------------------------------------- |
| Purpose      | Define the data model, ownership boundaries, migration policy, and database standards. |
| Owner        | Engineering                                                                            |
| Status       | Draft                                                                                  |
| Last Updated | 2026-07-01                                                                             |

## Table of Contents

- [Data Principles](#data-principles)
- [Domain Model](#domain-model)
- [Messaging Model](#messaging-model)
- [WhatsApp Connector Model](#whatsapp-connector-model)
- [Schema Ownership](#schema-ownership)
- [Migration Policy](#migration-policy)
- [Retention and Compliance](#retention-and-compliance)
- [Open Questions](#open-questions)

## Data Principles

Placeholder.

## Domain Model

Current MVP models:

- `User`: Authenticated product user with email, name, password hash, and timestamps.
- `Organization`: Workspace boundary for projects and memberships.
- `Membership`: Join model between users and organizations with a role.
- `Project`: Work container belonging to an organization.
- `Conversation`: Channel-agnostic communication thread owned by an organization and optionally linked to a project.
- `Participant`: Sender or actor inside a conversation.
- `Message`: Inbound, outbound, or system event inside a conversation.
- `Attachment`: File metadata attached to a message.
- `WhatsAppAccount`: A WhatsApp connector account owned by an organization.
- `WhatsAppChatMapping`: Connector-specific mapping between a WhatsApp chat JID, a generic conversation, and an optional project.

Membership roles:

- `OWNER`: Full organization control for the MVP.
- `ADMIN`: Can create projects.
- `MEMBER`: Can view projects.
- `VIEWER`: Can view projects and cannot create or edit.

Project statuses:

- `ACTIVE`
- `PAUSED`
- `COMPLETED`
- `ARCHIVED`

## Messaging Model

Messaging is intentionally generic. The database stores channel values as data, while connector-specific behavior lives outside the core messaging model.

Supported conversation channels:

- `WHATSAPP`
- `EMAIL`
- `SLACK`
- `TEAMS`
- `SMS`

Message directions:

- `INBOUND`
- `OUTBOUND`

Message types:

- `TEXT`
- `IMAGE`
- `DOCUMENT`
- `VOICE`
- `VIDEO`
- `SYSTEM`

Key constraints:

- `Conversation` belongs to one `Organization`.
- `Conversation.projectId` is nullable.
- `Conversation.externalId` is unique per organization and channel.
- `Participant.externalIdentifier` is unique per conversation.
- `Message.externalMessageId` is unique per conversation when present.
- Attachments cascade with their messages.

## WhatsApp Connector Model

WhatsApp connector data is intentionally separate from the generic messaging model.

`WhatsAppAccount` fields:

- `organizationId`: Owning organization.
- `displayName`: Operator-facing account label.
- `phoneNumber`: Populated after a successful WhatsApp connection when available.
- `connectorType`: `BAILEYS` now, with `META_CLOUD` reserved for the official API path.
- `status`: `PENDING_QR`, `CONNECTING`, `CONNECTED`, `DISCONNECTED`, or `ERROR`.
- `sessionKey`: Stable storage key for session material.
- `lastConnectedAt`, `lastDisconnectedAt`, and `lastMessageAt`: Operational timestamps.

`WhatsAppChatMapping` fields:

- `organizationId`: Owning organization.
- `whatsappAccountId`: Source WhatsApp account.
- `conversationId`: Generic conversation created from the WhatsApp chat.
- `projectId`: Optional project assignment.
- `jid`: WhatsApp chat JID.
- `chatName`: Last known chat or group display name.
- `isGroup`: Whether the JID is a group chat.
- `status`: `DISCOVERED`, `ACTIVE`, `IGNORED`, or `ARCHIVED`.
- `activatedAt`: Timestamp set when an admin activates the chat/group.
- `activatedByUserId`: User who activated the chat/group.

Key constraints:

- `WhatsAppAccount.sessionKey` is unique.
- `WhatsAppChatMapping` is unique by `whatsappAccountId` and `jid`.
- `WhatsAppChatMapping.conversationId` is nullable until activation and first ingested message.
- A generic conversation can have only one WhatsApp chat mapping when present.
- Chat mappings cascade with their account and conversation.

Status meanings:

- `DISCOVERED`: Metadata detected; no messages are ingested.
- `ACTIVE`: New messages may be ingested if `projectId` is set.
- `IGNORED`: Admin chose not to use this chat/group.
- `ARCHIVED`: Previously used chat/group is no longer ingesting.

## Schema Ownership

`packages/db/prisma/schema.prisma` is the source of truth for the database schema. Migrations live in `packages/db/prisma/migrations`.

## Migration Policy

Generate the Prisma client before local development:

```bash
pnpm db:generate
```

Apply migrations to PostgreSQL:

```bash
pnpm db:migrate
```

Development migrations should be reviewed before merging and should keep data scope minimal.

## Retention and Compliance

Placeholder.

## Open Questions

- Invite flow and membership management are not implemented yet.
- Session revocation and password reset tables are not implemented yet.
- Production object storage tables or metadata are not implemented yet.
