# Changelog

| Field        | Value                                            |
| ------------ | ------------------------------------------------ |
| Purpose      | Track notable FieldOS product and platform work. |
| Owner        | Engineering                                      |
| Status       | Active                                           |
| Last Updated | 2026-07-06                                       |

## Table of Contents

- [Unreleased](#unreleased)

## Unreleased

### Changed

- Moved search indexing from API search requests to worker-owned background jobs.
- Added lightweight `ProcessingJob` observability for search indexing, AI classification, future voice transcription, and future media download work.
- Added worker heartbeat persistence through `WorkerHeartbeat`.
- Added `Message.processingStatus` for support/debug visibility.

### Added

- Added `/admin/operations` dashboard page for owners and admins.
- Added admin API endpoints for operations health, job listing, worker listing, individual job retry, and bulk failed-job retry.
- Added ADR 0010B for background processing observability.
