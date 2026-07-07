# Demo Notes

| Field        | Value                                                          |
| ------------ | -------------------------------------------------------------- |
| Purpose      | Capture demo steps and verification notes for FieldOS changes. |
| Owner        | Product Engineering                                            |
| Status       | Active                                                         |
| Last Updated | 2026-07-07                                                     |

## Table of Contents

- [Task 011: Unified Evidence Processing](#task-011-unified-evidence-processing)
- [Task 010B: Operations Health](#task-010b-operations-health)

## Task 011: Unified Evidence Processing

What changed:

- Text, photos, voice notes, PDFs, and videos are grouped as one message-level evidence update.
- AI classification receives `UnifiedEvidenceContext` instead of only message text.
- Voice transcripts are used when available; transcription failures do not block AI classification.
- Inbox messages show Evidence Summary and expandable media details.
- Recent Evidence in the command center opens the grouped inbox update when available.
- Search indexes message text, voice transcript text, and attachment filenames.

How to test:

1. Pair a WhatsApp test line.
2. Activate a chat or group and map it to a project.
3. Send one update containing text, photo, voice note, and PDF evidence.
4. Open the inbox conversation.
5. Confirm the message shows an Evidence Summary and expandable media list.
6. Confirm the voice transcript appears when transcription succeeds, or a retryable failure appears in operations health.
7. Confirm AI classification summarizes the whole update.
8. Search for transcript text or a PDF filename and confirm the message appears.

Current limitation:

- Photos, PDFs, and videos are metadata-only. OCR, image recognition, document extraction, and video analysis are deferred.

## Task 010B: Operations Health

What changed:

- Search indexing now runs asynchronously in the worker.
- Owners and admins can open `/admin/operations`.
- The page shows worker heartbeat, job metrics, WhatsApp connection counts, AI queue health, search queue health, and media/transcription placeholders.
- Failed jobs can be retried individually or in bulk.

How to test:

1. Sign in as an organization owner or admin.
2. Open `/admin/operations`.
3. Confirm the worker appears with an online heartbeat after Railway worker deployment.
4. Create or receive a message.
5. Confirm a Search Index job appears and then completes.
6. Trigger message classification.
7. Confirm an AI Classification job appears and then completes or fails with a retry option.

Operational improvements:

- API search endpoints are read-only.
- Job failures are visible without inspecting the database directly.
- Worker heartbeat makes stale or offline worker state visible from the dashboard.
