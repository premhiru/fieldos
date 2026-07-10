# Quick Start

| Field        | Value                                                 |
| ------------ | ----------------------------------------------------- |
| Purpose      | Help a pilot user start FieldOS in under ten minutes. |
| Owner        | Product Engineering                                   |
| Status       | Active                                                |
| Last Updated | 2026-07-10                                            |

## Table of Contents

- [Start](#start)
- [Demo Workspace](#demo-workspace)
- [Recommended Pilot Scope](#recommended-pilot-scope)
- [Final Smoke Test](#final-smoke-test)
- [Screenshots](#screenshots)
- [Production Checks](#production-checks)

## Start

1. Open the dashboard.
2. Sign up or log in.
3. Click `Launch demo workspace`.
4. Open the Dashboard, Inbox, Search, and Project Intelligence pages from the navigation.
5. Use `Reset demo workspace` before another walkthrough.

## Demo Workspace

The demo workspace creates aviation project data, WhatsApp-style conversations, messages, evidence records, voice transcripts, PDF metadata, timeline events, generated reports, and open Action Items. It is marked as demo data and can be reset without touching production organizations.

## Recommended Pilot Scope

- One company.
- One active project.
- One dedicated WhatsApp number.
- One active WhatsApp group mapped to the pilot project.
- Three to five users.
- One week.
- Daily check-in with the pilot lead.
- No contractual approvals, payment decisions, safety-critical sign-offs, or claims workflows.

## Final Smoke Test

1. Connect the dedicated WhatsApp line.
2. Activate one group and map it to the pilot project.
3. Send one text update, one photo, one voice note, and one PDF.
4. Confirm the inbox stores the message and evidence.
5. Confirm image preview, voice playback or transcript status, and PDF preview/download.
6. Confirm Project Intelligence, Search, and report generation reference the new evidence.
7. Run project coordinators and approve one recommendation.
8. Review the generated WhatsApp draft, confirm send, and verify the worker marks it sent or exposes a retryable failure.
9. Open Operations Health and confirm no critical worker, AI, media, or draft-send failures remain.

## Screenshots

![Dashboard quick start](./docs/assets/quick-start/dashboard.svg)

![Inbox quick start](./docs/assets/quick-start/inbox.svg)

## Production Checks

Confirm API health, worker heartbeat, R2 storage, Railway deployment status, dashboard login, WhatsApp pairing, active group mapping, OpenRouter configuration, and draft-send job health before each pilot session.
