# Changelog

| Field        | Value                                            |
| ------------ | ------------------------------------------------ |
| Purpose      | Track notable FieldOS product and platform work. |
| Owner        | Engineering                                      |
| Status       | Active                                           |
| Last Updated | 2026-07-07                                       |

## Table of Contents

- [Unreleased](#unreleased)

## Unreleased

### Changed

- AI classification now receives a `UnifiedEvidenceContext` containing message text, project/conversation/sender metadata, attachment metadata, and available voice transcripts.
- Inbox and command-center evidence displays now group media by operational update instead of individual files.
- Message search indexing now includes available voice transcripts and attachment filenames.
- Moved search indexing from API search requests to worker-owned background jobs.
- Added lightweight `ProcessingJob` observability for search indexing, AI classification, future voice transcription, and future media download work.
- Added worker heartbeat persistence through `WorkerHeartbeat`.
- Added `Message.processingStatus` for support/debug visibility.

### Added

- Added runtime unified evidence context builder and evidence summary API endpoints for messages.
- Added attachment-level voice transcription status, transcript, and error fields.
- Added worker-owned voice transcription processing with non-blocking failure handling.
- Added ADR 0011 for unified evidence processing.
- Added `/admin/operations` dashboard page for owners and admins.
- Added admin API endpoints for operations health, job listing, worker listing, individual job retry, and bulk failed-job retry.
- Added ADR 0010B for background processing observability.
