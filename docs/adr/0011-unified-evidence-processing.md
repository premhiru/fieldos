# ADR 0011: Unified Evidence Processing

| Field        | Value                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------- |
| Purpose      | Document how FieldOS groups message text, media metadata, and voice transcripts for AI and search. |
| Owner        | AI and Media Engineering                                                                           |
| Status       | Accepted                                                                                           |
| Last Updated | 2026-07-07                                                                                         |

## Table of Contents

- [Context](#context)
- [Decision](#decision)
- [Consequences](#consequences)
- [Alternatives Considered](#alternatives-considered)

## Context

Field operations updates often arrive as one WhatsApp update with text, photos, voice notes, and PDFs. Treating each attachment as a separate AI input fragments the operational context and creates noisy UI surfaces.

FieldOS needs the AI, search index, inbox, and command center to understand the same update as one evidence package.

## Decision

FieldOS will build a runtime `UnifiedEvidenceContext` before AI classification and message search indexing.

The context includes project, conversation, sender, timestamp, message text, available voice transcript, attachment metadata, evidence summary counts, and message processing metadata.

`UnifiedEvidenceContext` is not a database table. The source of truth remains the existing message and attachment records. Voice transcripts are stored on `Attachment` rows because they belong to a voice attachment and must be retryable independently.

Photos, PDFs, documents, and videos remain independent attachment records. AI receives filenames, MIME types, sizes, counts, and explicit notes that no image, video, OCR, or document extraction has been performed.

Timeline and command-center surfaces group evidence by message/update. Search indexes message text, voice transcripts, document filenames, photo filenames, and evidence summary labels, but never binary file content.

## Consequences

AI classification receives one complete context package, which should improve summaries and Action Items without coupling AI to WhatsApp-specific logic.

Media failures do not lose the message. Failed voice transcription records an attachment-level error and keeps a failed job retryable, while AI classification continues with available context.

The inbox can show a compact Evidence Summary and an expandable media section without duplicating media metadata.

OCR, image recognition, vision models, and document extraction are explicitly deferred until customer evidence volume and use cases justify them.

## Alternatives Considered

Persisting a separate evidence table was deferred because it would duplicate attachment metadata before the product needs a distinct evidence lifecycle.

Running AI separately for text, each photo, each PDF, and each voice note was rejected because it fragments context and creates too much UI noise.

Implementing OCR, computer vision, and PDF extraction now was rejected because the MVP only needs metadata-aware triage and voice transcript integration.
