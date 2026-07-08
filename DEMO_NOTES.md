# Demo Notes

| Field        | Value                                                          |
| ------------ | -------------------------------------------------------------- |
| Purpose      | Capture demo steps and verification notes for FieldOS changes. |
| Owner        | Product Engineering                                            |
| Status       | Active                                                         |
| Last Updated | 2026-07-08                                                     |

## Table of Contents

- [Task 013: Project Intelligence and Automated Reporting](#task-013-project-intelligence-and-automated-reporting)
- [Task 012: Photo Intelligence](#task-012-photo-intelligence)
- [Task 011: Unified Evidence Processing](#task-011-unified-evidence-processing)
- [Task 010B: Operations Health](#task-010b-operations-health)

## Task 013: Project Intelligence and Automated Reporting

What changed:

- Project pages now link to a Project Intelligence workspace.
- FieldOS generates morning briefs, daily summaries, weekly progress reports, risk summaries, and pending decisions from stored project evidence.
- Weekly reports can be exported as Markdown or PDF.
- Weekly report generation can be queued for the worker and cached as a `ProjectReport`.
- The Evidence Viewer can preview images, PDFs, and audio through signed URLs while showing transcript, vision analysis, source WhatsApp message, timeline references, and linked Action Items.
- Generated reports are indexed for search after worker completion.

How to test:

1. Sign in and open a project with messages, Action Items, timeline events, photo analysis, or milestones.
2. Open `/projects/<projectId>/intelligence`.
3. Confirm Morning Brief, Daily Summary, Weekly Report, Risk Summary, Pending Decisions, and Evidence Gallery render.
4. Click `Markdown` and confirm a report downloads.
5. Click `PDF` and confirm a PDF report downloads.
6. Click `Generate Report` and confirm a `REPORT_GENERATION` job is queued.
7. Open an evidence item and confirm the Evidence Viewer shows the signed media preview plus source context.
8. Open `/admin/operations` and confirm Report Generation appears in job metrics after jobs exist.

Current limitation:

- Local signed media URLs work when the API can read the stored file. Production API and worker services need shared object storage, such as S3, R2, or MinIO, before live WhatsApp media previews and worker-generated PDF links are fully reliable across separate services.

## Task 012: Photo Intelligence

What changed:

- Image attachments from active WhatsApp conversations queue `PHOTO_ANALYSIS` jobs.
- The worker sends stored photos to the configured OpenAI-compatible vision provider.
- FieldOS stores concise summaries, detected objects, possible issues, confidence, and tags.
- Inbox image attachments show visual summaries when analysis completes.
- Project detail pages show recent photo intelligence for the project.
- Command center Recent Evidence can surface visual summary snippets.
- AI Search can retrieve photo analysis results by summary, objects, issues, and tags.
- Admin Operations shows pending Photo Analysis jobs.

How to test:

1. Confirm `OPENROUTER_API_KEY` is configured and `VISION_MODEL` points to a multimodal model.
2. Pair a WhatsApp test line.
3. Activate a chat or group and map it to a project.
4. Send a site photo into the active chat.
5. Open `/admin/operations` and confirm a Photo Analysis job is queued and completes.
6. Open the inbox conversation and expand the image attachment.
7. Confirm the visual summary, confidence state, tags, and possible issues appear.
8. Open the project detail page and confirm the photo appears under Photo Intelligence.
9. Search for a visible object or tag and confirm a Photo Analysis result appears.

Current limitation:

- Original image preview uses the stored attachment metadata and placeholder UI until production object storage and media-serving are added.
- Vision results are advisory and require human review before operational decisions.

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

- PDFs and videos remain metadata-only. OCR, document extraction, and video analysis are deferred.

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
