# Demo Notes

| Field        | Value                                                          |
| ------------ | -------------------------------------------------------------- |
| Purpose      | Capture demo steps and verification notes for FieldOS changes. |
| Owner        | Product Engineering                                            |
| Status       | Active                                                         |
| Last Updated | 2026-07-24                                                     |

## Table of Contents

- [Final Pilot Product Editing](#final-pilot-product-editing)
- [WhatsApp-Native Operations](#whatsapp-native-operations)
- [AI Decision Layer v2](#ai-decision-layer-v2)
- [UX Refactoring Sprint](#ux-refactoring-sprint)
- [Milestone Intelligence](#milestone-intelligence)
- [Task 013B: Cloudflare R2 Durable Storage](#task-013b-cloudflare-r2-durable-storage)
- [Milestone 2: AI Project Coordinators](#milestone-2-ai-project-coordinators)
- [Sprint 14: Pilot Readiness](#sprint-14-pilot-readiness)
- [Task 013: Project Intelligence and Automated Reporting](#task-013-project-intelligence-and-automated-reporting)
- [Task 012: Photo Intelligence](#task-012-photo-intelligence)
- [Task 011: Unified Evidence Processing](#task-011-unified-evidence-processing)
- [Task 010B: Operations Health](#task-010b-operations-health)

## WhatsApp-Native Operations

The code and migration are prepared, but all rollout flags remain disabled. Use only a dedicated test number and demo project. Validate participant sync before private delivery, then quoted `DETAILS`, quoted `APPROVE`, replay protection, an unauthorized sender, high-impact confirmation, and invitation activation. Do not demonstrate project-group delivery with external participants or customer data.

## Final Pilot Product Editing

What changed:

- Project health now uses one status and one reason everywhere.
- The Project Command Center contains only Project Brief, Recommended Actions, What's Changed, and Quick Links.
- Timeline, Evidence, and Milestones open in focused project views.
- Recommendations lead the dashboard and routine activity no longer competes with decisions.
- Settings opens one administrative section at a time; WhatsApp chats stay hidden until Manage chats is selected.
- FieldOS summaries replace raw classification status, provider errors, and prominent rerun controls.

How to test:

1. Open Projects and compare a project's health label and reason with its Project Brief.
2. Open the project and confirm Recommended Actions is the dominant section.
3. Confirm What's Changed omits routine message and system events, then open Full timeline and choose Show all activity.
4. Use each Quick Link and confirm Timeline, Evidence, Milestones, Reports, and Action Items remain reachable.
5. Open Settings and move between Workspace, Team, WhatsApp, Integrations, Security, and Operations without a long combined page.
6. In WhatsApp Settings, select Manage chats, search, change status filters, and move between pages.
7. Open an Inbox message and confirm the interpretation uses plain-language FieldOS summary states.

Current limitations:

- Inbox read state remains browser-local and conversation ownership is represented by project assignment.
- WhatsApp discovery pagination is client-side for the pilot.

## UX Refactoring Sprint

What changed:

- Primary navigation is now Dashboard, Projects, Inbox, Search, and Reports.
- Dashboard opens with the work that needs attention, not setup and system panels.
- Project pages follow Brief, Recommendations, Timeline, Evidence, Milestones, and Reports.
- Inbox supports All, Unread, Groups, Direct, and Unassigned filters with an in-page conversation preview.
- Search presents the answer first, followed by evidence and source records.
- Mobile uses a fixed five-item bottom navigation.

How to test:

1. Sign in and confirm the selected workspace remains active after a hard page navigation.
2. Review the dashboard summary, approve or dismiss a recommendation, and complete an assigned Action Item inline.
3. Open a project and confirm the six primary sections appear in the documented order.
4. Open Inbox, apply each filter, and select a conversation without leaving the page.
5. Press `Ctrl+K` or `Cmd+K`, ask a question, and confirm the answer is followed by evidence and source groups.
6. Open Reports and navigate to a project's intelligence workspace.
7. At a mobile viewport, confirm the bottom navigation remains usable and content is not obscured.

Current limitations:

- Inbox read state and recommendation snoozes are stored locally in the browser.
- Action Item due dates are not yet part of the domain model.

## Milestone Intelligence

What changed:

- WhatsApp messages and voice transcripts can produce milestone recommendations without changing project state automatically.
- Project pages show milestone summaries, chronological milestones, original evidence, resolved dates, confidence, and edit-before-approval controls.
- The Operations Command Center shows milestone recommendations, upcoming work, and delays.
- Approval creates or updates the milestone, records a business timeline event, and refreshes Project State.

How to test:

1. Map an active WhatsApp chat to a project and create an existing `Foundation Pour` milestone.
2. Send `We finished the foundation pour today, starting walls Monday.`
3. Wait for classification and the Project Coordinator job to complete.
4. Open the project Milestones section and confirm two recommendations appear with original and resolved dates.
5. Review the completion evidence, edit the milestone if needed, and approve it.
6. Confirm `Foundation Pour` is completed, the business timeline includes the completion, and Project State counts refresh.
7. Approve the wall recommendation and confirm the planned start is explicit.
8. Send `Work is moving along.` and confirm no milestone recommendation is created.

Current limitation:

- Milestone Intelligence does not implement scheduling dependencies, recurrence, resource planning, or automatic milestone mutation.

## Task 013B: Cloudflare R2 Durable Storage

What changed:

- Production storage can now use Cloudflare R2 through `R2StorageProvider`.
- WhatsApp evidence files, voice notes, photo evidence, PDFs, and generated report PDFs use the configured `StorageProvider`.
- API evidence and report routes authorize the user before returning expiring signed URLs.
- Local development still uses `STORAGE_PROVIDER=local` and `WHATSAPP_STORAGE_PATH`.
- Production startup fails fast when `STORAGE_PROVIDER=r2` is selected without complete R2 environment variables.

How to test:

1. Configure Railway API and worker with the R2 environment variables from `.env.example`.
2. Deploy API and worker.
3. Pair a WhatsApp test line.
4. Activate a chat/group and map it to a project.
5. Send a photo, voice note, and PDF into the active chat.
6. Open the inbox evidence viewer and confirm image preview, audio playback, and PDF preview use signed URLs.
7. Open Project Intelligence and generate a report.
8. Confirm the report PDF link opens a signed R2 URL.
9. Confirm API responses do not include `storageKey`, `.storage`, or local filesystem paths.

Current limitation:

- Existing evidence that was stored only on local Railway files before this change is not automatically migrated to R2.

## Milestone 2: AI Project Coordinators

What changed:

- Operations Command Center now starts with AI Recommendations.
- Project pages now show Project Coordinator state, recent summaries, pending recommendations, run-now control, and coordinator history.
- FieldOS can approve recommendations into Action Items, report-generation jobs, or WhatsApp drafts.
- WhatsApp drafts are editable and require a final explicit send action.
- WhatsApp draft sends are queued by the API and delivered by the worker through the active Baileys session.
- Operations Health includes coordinator run and recommendation metrics.

How to test:

1. Open the Operations Command Center and confirm AI Recommendations loads.
2. Open a project and click `Run Coordinators Now`.
3. Confirm ProjectState updates and coordinator run history records the run.
4. Open a recommendation detail page and review evidence/source references.
5. Approve a follow-up recommendation and confirm a WhatsApp draft appears.
6. Edit the draft and save it.
7. Confirm sending the draft asks for final confirmation and queues a `WHATSAPP_DRAFT_SEND` job.
8. Confirm the worker marks the draft `SENT` when the connected WhatsApp session accepts the message.
9. Approve a report recommendation and confirm a `REPORT_GENERATION` job is queued.
10. Open `/admin/operations` and confirm coordinator and draft-send metrics update.

Current limitation:

- Draft sending requires the dedicated WhatsApp account to be actively connected in the worker. If the line is disconnected, the job fails visibly and can be retried after pairing.

## Sprint 14: Pilot Readiness

What changed:

- First-run onboarding now supports either real organization creation or Demo Workspace launch.
- Demo Workspace creates resettable aviation pilot data.
- Dashboard shows pilot setup progress and a lightweight page tour.
- Notifications and feedback are available from the app shell.
- Product analytics events are recorded for key pilot actions.

How to test:

1. Sign in.
2. Click `Launch demo workspace` or `Reset demo workspace`.
3. Confirm the Operations Command Center loads with active projects and action items.
4. Open Inbox, Search, and Project Intelligence.
5. Submit feedback and confirm a notification appears.

Current limitation:

- Demo screenshots in `QUICK_START.md` are static in-repo references and should be replaced with production captures after deployment.

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

- Existing locally stored evidence still requires migration or re-ingestion before it can be served from R2.

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

## AI Decision Layer v2

Run the worker in `shadow`, send routine progress, partial completion, explicit inspection-ready, ambiguous, and overdue-commitment examples, then verify that v2 decisions appear only in operations telemetry. Customer-visible recommendations remain on the legacy path until the mode is deliberately changed to `v2`.

The key demo is quiet behavior: ordinary progress and single-photo evidence should not create v2 recommendations.

Before a release review, run `pnpm ai:evaluate` through the Kimi-primary provider chain and compare the result with `packages/ai/src/evaluation-results.v2.json`. The accepted fixture contains 86 labelled synthetic cases and no customer messages.
