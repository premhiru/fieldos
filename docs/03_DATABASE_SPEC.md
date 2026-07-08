# Database Specification

| Field        | Value                                                                                  |
| ------------ | -------------------------------------------------------------------------------------- |
| Purpose      | Define the data model, ownership boundaries, migration policy, and database standards. |
| Owner        | Engineering                                                                            |
| Status       | Draft                                                                                  |
| Last Updated | 2026-07-08                                                                             |

## Table of Contents

- [Data Principles](#data-principles)
- [Domain Model](#domain-model)
- [Messaging Model](#messaging-model)
- [Unified Evidence Processing](#unified-evidence-processing)
- [Photo Intelligence Model](#photo-intelligence-model)
- [Project Report Model](#project-report-model)
- [WhatsApp Connector Model](#whatsapp-connector-model)
- [AI Classification Model](#ai-classification-model)
- [Event Model](#event-model)
- [Milestone Model](#milestone-model)
- [Search Model](#search-model)
- [Background Processing Model](#background-processing-model)
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
- `PhotoAnalysis`: Advisory visual analysis linked one-to-one with an image attachment.
- `ProjectReport`: Cached generated project intelligence report with export metadata.
- `AIMessageClassification`: AI-derived classification, summary, extracted fields, and processing status for one message.
- `ActionItem`: Human-reviewable recommendation derived from an AI classification or deterministic project suggestion.
- `Event`: Generic organization-scoped activity record prepared for timeline features.
- `Milestone`: Lightweight project deadline used by the Operations Command Center.
- `SearchDocument`: Grounded search index entry for retrievable FieldOS records.
- `ProcessingJob`: Lightweight background job record used for search indexing, AI classification, and future media/transcription work.
- `WorkerHeartbeat`: Operational heartbeat record for deployed worker processes.
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

Message processing statuses:

- `RECEIVED`
- `MEDIA_PENDING`
- `MEDIA_COMPLETE`
- `TRANSCRIPTION_PENDING`
- `TRANSCRIPTION_COMPLETE`
- `SEARCH_PENDING`
- `SEARCH_COMPLETE`
- `AI_PENDING`
- `AI_COMPLETE`
- `FAILED`

Key constraints:

- `Conversation` belongs to one `Organization`.
- `Conversation.projectId` is nullable.
- `Conversation.externalId` is unique per organization and channel.
- `Participant.externalIdentifier` is unique per conversation.
- `Message.externalMessageId` is unique per conversation when present.
- Attachments cascade with their messages.

Attachment transcription fields:

- `transcript`: Nullable text transcript for voice notes.
- `transcriptionStatus`: `NOT_REQUIRED`, `PENDING`, `COMPLETED`, or `FAILED`.
- `transcriptionError`: Nullable last transcription failure reason.

Key attachment indexes:

- `conversationId`
- `messageId`
- `transcriptionStatus, createdAt`

## Unified Evidence Processing

`UnifiedEvidenceContext` is not persisted as a database table. It is built dynamically from `Message`, `Conversation`, `Participant`, `Project`, `Attachment`, and linked `PhotoAnalysis` records when available.

The database keeps media metadata independent:

- Photos use `Attachment` filename, MIME type, storage key, size, and timestamps.
- Photo visual summaries use `PhotoAnalysis` when the worker has processed the image.
- PDFs/documents use the same `Attachment` metadata.
- Voice notes use `Attachment` metadata plus transcript status and transcript text when available.
- Videos remain metadata-only for the MVP.

This avoids duplicating media metadata while allowing AI classification, search indexing, inbox display, and command-center recent evidence to consume the same runtime context.

Message search documents include message text, voice transcripts, document filenames, photo filenames, and evidence summary labels. Photo analysis search documents index visual summaries, detected objects, possible issues, tags, and confidence metadata. Binary files are not indexed.

## Photo Intelligence Model

`PhotoAnalysis` stores worker-generated, advisory visual analysis for an image attachment.

Fields:

- `id`: Primary key.
- `evidenceId`: Unique attachment reference.
- `organizationId`: Owning organization for authorization and indexing.
- `projectId`: Optional project scope copied from the source conversation.
- `conversationId`: Source conversation.
- `messageId`: Source message.
- `provider`: Vision provider identifier.
- `summary`: Concise user-facing visual summary.
- `detectedObjects`: JSON string array of visible objects or field elements.
- `possibleIssues`: JSON string array of possible issues that require human review.
- `confidence`: Numeric provider confidence used to derive user-facing confidence states.
- `tags`: JSON string array for filtering and search.
- `createdAt`: Analysis creation timestamp.

Key constraints and indexes:

- `evidenceId` is unique so one attachment has at most one current analysis.
- `PhotoAnalysis` cascades when its attachment is deleted.
- `organizationId, createdAt` supports organization-scoped recent evidence queries.
- `projectId, createdAt` supports project detail pages.
- `messageId` and `conversationId` support inbox and evidence lookups.

Vision analysis is not a source of truth. It is an advisory enrichment for operators and must not automatically certify completion, safety, compliance, or defect presence.

## Project Report Model

`ProjectReport` stores cached report-generation output for project intelligence.

Fields:

- `id`: Primary key.
- `organizationId`: Required tenant scope.
- `projectId`: Owning project.
- `type`: Report type. The MVP supports `WEEKLY_PROGRESS`.
- `status`: `PENDING`, `RUNNING`, `FAILED`, or `COMPLETED`.
- `title`: User-facing report title.
- `content`: JSON report payload for structured reuse.
- `markdown`: Markdown export text.
- `pdfStorageKey`: Storage provider key for worker-generated PDF output.
- `contentHash`: Hash of the generated Markdown payload.
- `periodStart` and `periodEnd`: Reporting window.
- `generatedAt`: Completion timestamp.
- `errorMessage`: Last generation failure.
- `createdAt` and `updatedAt`: Persistence timestamps.

Key constraints and indexes:

- `organizationId, createdAt` supports organization-scoped report lists.
- `projectId, type, status, createdAt` supports project intelligence lookups.
- `status, createdAt` supports worker polling and operations health.

Completed reports are indexed as `SearchDocument` records with source type `PROJECT_REPORT`.

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
- `projectId`: Optional project assignment. Active unmapped chats can ingest messages so FieldOS can suggest a project assignment without automatically changing state.
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
- `ACTIVE`: New messages may be ingested. Project mapping can be accepted later through a project suggestion ActionItem.
- `IGNORED`: Admin chose not to use this chat/group.
- `ARCHIVED`: Previously used chat/group is no longer ingesting.

## AI Classification Model

`AIMessageClassification` stores one classification job/result per message. It belongs to an organization, optionally belongs to a project, and is unique by `messageId`.

Classification statuses:

- `PENDING`: Waiting for worker processing.
- `COMPLETED`: Provider output was validated and stored.
- `FAILED`: Provider call or output validation failed.
- `NEEDS_REVIEW`: Reserved for future policy-based manual review.

Classification categories:

- `GENERAL`
- `REQUEST`
- `ISSUE`
- `DELAY`
- `DEFECT`
- `SAFETY`
- `DOCUMENTATION`
- `SCHEDULING`
- `COST`
- `MATERIAL`
- `UNKNOWN`

Stored extraction fields are deliberately small:

- `category`: A constrained classification category.
- `summary`: Concise user-facing summary.
- `location`: Short location text when present.
- `actionRequired`: Whether human follow-up is required.
- `confidence`: Numeric confidence for internal and details views.
- `reasoningSummary`: Short user-facing reason. Chain-of-thought and raw model output are not stored.

`ActionItem` stores a reviewable recommendation from a completed classification or project suggestion. It is not a project task. It remains a review artifact until a user accepts or ignores it.

ActionItem types:

- `FOLLOW_UP`: A human should review or act on the message.
- `PROJECT_SUGGESTION`: The message may belong to a suggested project.

ActionItem statuses:

- `PENDING`: Awaiting human decision.
- `ACCEPTED`: Approved by a user.
- `COMPLETED`: Completed by a user.
- `IGNORED`: Dismissed by a user.
- `CONVERTED`: Reserved for future conversion into a first-class task.

ActionItem priorities:

- `LOW`
- `MEDIUM`
- `HIGH`
- `URGENT`

Key constraints:

- `AIMessageClassification.messageId` is unique.
- Classification rows cascade with messages, projects, and organizations.
- Action Items cascade with their source message and optional classification.
- `assignedToUserId`, `acceptedByUserId`, and `ignoredByUserId` are nullable user references.
- Organization, project, status, priority, assignee, message, classification, and suggested-project query paths are indexed.

## Event Model

`Event` prepares the database for a generic Activity Timeline without adding the full feature yet.

Supported source types:

- `MESSAGE`
- `ACTION_ITEM`
- `REPORT`
- `SYSTEM`

Key fields:

- `organizationId`: Required tenant scope.
- `projectId`: Optional project scope.
- `sourceType` and `sourceId`: Reference the source domain without a hard foreign key.
- `eventType`: Compact event name such as `action_item.created`.
- `title` and `description`: User-facing timeline text.
- `occurredAt` and `createdAt`: Timeline ordering and persistence timestamps.

Key indexes:

- `organizationId, occurredAt`
- `projectId, occurredAt`
- `sourceType, sourceId`

## Milestone Model

`Milestone` is intentionally lightweight. It supports command-center visibility into upcoming and overdue project deadlines without introducing a full scheduling domain.

Fields:

- `organizationId`: Required tenant scope.
- `projectId`: Owning project.
- `title`: User-facing milestone name.
- `dueDate`: Deadline used for ordering and overdue checks.
- `status`: `UPCOMING`, `DUE_SOON`, `OVERDUE`, or `COMPLETED`.

Key indexes:

- `organizationId, dueDate`
- `projectId, dueDate`
- `status, dueDate`

## Search Model

`SearchDocument` is a generic retrieval index used by keyword search and grounded AI answers.

Search documents are written only by background `SEARCH_INDEX` jobs. API search routes read the index and do not rebuild it synchronously.

Message search content includes message text, available voice transcripts, attachment filenames, and evidence summary labels. Photo analysis content is indexed separately after vision processing. OCR, document extraction, and video analysis are not part of the MVP search index.

Supported source types:

- `PROJECT`
- `MESSAGE`
- `TIMELINE_EVENT`
- `ACTION_ITEM`
- `AI_CLASSIFICATION`
- `PHOTO_ANALYSIS`
- `PROJECT_REPORT`

Fields:

- `organizationId`: Required tenant scope.
- `projectId`: Optional project scope.
- `sourceType`: Type of source record.
- `sourceId`: Identifier of the source record.
- `title`: Short searchable label.
- `content`: Searchable source text.
- `metadata`: JSON payload for source-specific navigation and display.
- `occurredAt`: Optional source occurrence time.
- `createdAt` and `updatedAt`: Index row timestamps.

Key constraints and indexes:

- `sourceType, sourceId` is unique.
- `organizationId, createdAt` supports organization-scoped browsing.
- `organizationId, projectId, createdAt` supports project-scoped search.
- `organizationId, sourceType, createdAt` supports type filters.
- `projectId, createdAt` supports project detail surfaces.
- A PostgreSQL GIN full-text index supports keyword search over title and content.

## Background Processing Model

`ProcessingJob` is the MVP background queue and observability table. It is intentionally simple and avoids a separate workflow/orchestration platform.

Job types:

- `SEARCH_INDEX`
- `AI_CLASSIFICATION`
- `VOICE_TRANSCRIPTION`
- `MEDIA_DOWNLOAD`
- `PHOTO_ANALYSIS`
- `REPORT_GENERATION`

Job statuses:

- `PENDING`
- `RUNNING`
- `FAILED`
- `COMPLETED`

Fields:

- `organizationId`: Required tenant scope.
- `projectId`: Optional project scope for filtering and logs.
- `type`: Job kind.
- `status`: Current queue state.
- `sourceType` and `sourceId`: Source record to process.
- `attempts` and `maxAttempts`: Bounded retry tracking.
- `errorMessage`: Last failure reason.
- `correlationId`: Stable trace identifier.
- `startedAt`, `completedAt`, and `failedAt`: Processing timestamps.

Key constraints and indexes:

- `type, sourceType, sourceId` is unique to keep queueing idempotent.
- `organizationId, status, createdAt` supports operations views.
- `organizationId, type, status` supports job metrics.
- `projectId, status, createdAt` supports project-scoped debugging.

`WorkerHeartbeat` stores worker liveness:

- `workerName`: Unique worker identifier.
- `version`: Deployment version or commit.
- `status`: `ONLINE`, `OFFLINE`, `STARTING`, or `STOPPING`.
- `lastHeartbeatAt`: Updated every 30 seconds by the worker.

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
- Project report caching exists, but retention, scheduled report generation, and multi-format storage policy are not implemented yet.
