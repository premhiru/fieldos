# Changelog

| Field        | Value                                            |
| ------------ | ------------------------------------------------ |
| Purpose      | Track notable FieldOS product and platform work. |
| Owner        | Engineering                                      |
| Status       | Active                                           |
| Last Updated | 2026-07-08                                       |

## Table of Contents

- [Unreleased](#unreleased)

## Unreleased

### AI Project Coordinators

- Added `packages/coordinators` with ProjectState rebuilding, Progress, Follow-up, Inspection, and Report coordinators.
- Added `ProjectState`, `Recommendation`, `CoordinatorRun`, and `WhatsAppDraft` models.
- Added `PROJECT_COORDINATOR` jobs and worker-owned hourly active-project scans.
- Added recommendation approval, dismissal, completion, detail, and WhatsApp draft API endpoints.
- Added AI Recommendations to the Operations Command Center.
- Added Project Coordinator state, run-now action, pending recommendations, and run history to project pages.
- Added recommendation detail pages with evidence/source references, proposed action payload, approval controls, and draft editing.
- Added coordinator metrics to Operations Health.
- Added ADR 0014 and `COORDINATOR_DEMO_SCRIPT.md`.

### Pilot Readiness

- Added resettable aviation Demo Workspace with synthetic airport projects, WhatsApp-style conversations, messages, evidence metadata, reports, milestones, and Action Items.
- Added first-run onboarding progress, demo reset, lightweight product tour, notifications, and feedback capture.
- Added internal product analytics events for key pilot actions.
- Added user-facing loading and error states on the Operations Command Center.
- Added mobile dashboard navigation.
- Added production readiness, quick start, demo script, pilot readiness report, and known limitations docs.

### Changed

- Project detail pages now link to a dedicated Project Intelligence workspace.
- Search source support now includes generated project reports.
- Media previews now use signed API media URLs instead of exposing storage keys to the dashboard.
- Photo attachments are now asynchronously enriched with advisory vision summaries when image media is available.
- AI Search now includes photo analysis summaries, detected objects, possible issues, and tags.
- AI classification now receives a `UnifiedEvidenceContext` containing message text, project/conversation/sender metadata, attachment metadata, and available voice transcripts.
- Inbox and command-center evidence displays now group media by operational update instead of individual files.
- Message search indexing now includes available voice transcripts and attachment filenames.
- Moved search indexing from API search requests to worker-owned background jobs.
- Added lightweight `ProcessingJob` observability for search indexing, AI classification, future voice transcription, and future media download work.
- Added worker heartbeat persistence through `WorkerHeartbeat`.
- Added `Message.processingStatus` for support/debug visibility.

### Added

- Added `packages/intelligence` for grounded morning briefs, daily summaries, weekly reports, risk summaries, and pending decisions.
- Added `ProjectReport` persistence and worker-owned `REPORT_GENERATION` jobs for cached weekly progress reports.
- Added project intelligence API endpoints, Markdown export, PDF export, and asynchronous report generation.
- Added reusable Evidence Viewer UI for media preview, transcripts, vision analysis, source WhatsApp message context, timeline references, and linked Action Items.
- Added `StorageProvider` and `LocalStorageProvider` with expiring signed media URLs.
- Added ADR 0013 for Project Intelligence and Automated Reporting.
- Added `PhotoAnalysis` persistence, `PHOTO_ANALYSIS` jobs, and worker-owned vision processing.
- Added photo analysis API endpoints for project, analysis, and evidence lookups.
- Added photo intelligence UI in the inbox, project detail pages, command-center recent evidence, and admin operations health.
- Added ADR 0012 for Photo Intelligence.
- Added runtime unified evidence context builder and evidence summary API endpoints for messages.
- Added attachment-level voice transcription status, transcript, and error fields.
- Added worker-owned voice transcription processing with non-blocking failure handling.
- Added ADR 0011 for unified evidence processing.
- Added `/admin/operations` dashboard page for owners and admins.
- Added admin API endpoints for operations health, job listing, worker listing, individual job retry, and bulk failed-job retry.
- Added ADR 0010B for background processing observability.
