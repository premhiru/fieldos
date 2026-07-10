# Pilot QA Report

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Purpose      | Record go-live QA findings and readiness for the first FieldOS pilot. |
| Owner        | Principal QA Engineering                                              |
| Status       | Active                                                                |
| Last Updated | 2026-07-10                                                            |

## Table of Contents

- [Readiness Score](#readiness-score)
- [Critical Issues](#critical-issues)
- [High Issues](#high-issues)
- [Medium Issues](#medium-issues)
- [Low Issues](#low-issues)
- [Known Limitations](#known-limitations)
- [QA Coverage](#qa-coverage)
- [Recommended Pilot Scope](#recommended-pilot-scope)
- [Final Smoke Test](#final-smoke-test)
- [Rollback Plan](#rollback-plan)

## Readiness Score

Overall pilot readiness: 88%.

FieldOS is ready for a constrained one-project, one-week pilot after the latest Railway and dashboard deployments are verified from this commit. The product is credible for evidence intake, command-center review, AI Search, reports, and human-approved recommendations. It is not ready for contractual, safety-critical, or production billing workflows.

## Critical Issues

- None open after this sprint.

## High Issues

- Fixed: WhatsApp drafts could be approved but could not be sent in production because Baileys sockets live in the worker, not the API. The API now queues `WHATSAPP_DRAFT_SEND` jobs, and the worker sends through the active Baileys session.
- Fixed: Recommendation detail did not clearly distinguish failed send from queued send. The UI now asks for confirmation and shows queued/sent/error states.

## Medium Issues

- Live WhatsApp media, voice, PDF, and outbound draft-send verification require the dedicated pilot phone line to be paired after deployment.
- Production voice transcription still requires `OPENAI_API_KEY`; OpenRouter chat configuration does not provide audio transcription.
- Existing pre-R2 media objects can still fail preview if they were stored only on the old local filesystem.
- Vercel deployment must be confirmed from the connected dashboard project after GitHub push.

## Low Issues

- Quick-start screenshots are static references and should be replaced with production screenshots after the go-live deployment.
- Branch protection and real GitHub CODEOWNERS team setup remain administrative follow-ups.

## Known Limitations

- The first pilot should use Baileys only with a dedicated business test number.
- No official Meta WhatsApp Cloud API connector exists yet.
- No real-time inbox streaming; users refresh or rely on polling page loads.
- AI outputs are advisory and require human review.
- Search is grounded keyword retrieval, not semantic/vector search.
- Demo media placeholders are useful for walkthroughs but do not replace a live R2 smoke test.

## QA Coverage

- Authentication and organization isolation are covered by API tests.
- Project, messaging, WhatsApp activation, evidence, AI classification, Action Items, Operations Health, Search, reporting, and recommendations have local test coverage.
- Local migration path is verified before deployment.
- Security review found no raw R2 credentials or storage keys exposed through evidence/report preview APIs.
- Error handling uses structured API envelopes and visible dashboard error states on core pages.
- Mobile navigation exists for pilot screens; the first pilot should still be run primarily on desktop/tablet for admin workflows.

## Recommended Pilot Scope

- One company.
- One active project.
- One dedicated WhatsApp number.
- One active WhatsApp group.
- Three to five users.
- One week.
- Daily check-in with the pilot lead.
- Do not use FieldOS for contractual approvals, claims, payments, legal notices, or safety-critical sign-offs during the first pilot.

## Final Smoke Test

Run after deployment with the dedicated WhatsApp line:

1. Connect WhatsApp.
2. Activate one group.
3. Send text, photo, voice note, and PDF.
4. Confirm message, evidence, signed media preview, transcript status, timeline event, project brief update, and search indexing.
5. Generate a report and confirm the report references evidence.
6. Run coordinators and confirm a recommendation appears.
7. Approve a recommendation and review the WhatsApp draft.
8. Confirm send, then verify the worker completes `WHATSAPP_DRAFT_SEND` and the draft becomes `SENT`.
9. Confirm Operations Health shows no critical failures.

## Rollback Plan

1. Redeploy the previous successful Railway API deployment.
2. Redeploy the previous successful Railway worker deployment.
3. Repoint or redeploy the previous Vercel dashboard build.
4. If the new migration has already been applied, leave additive enum/table changes in place unless a blocking issue requires database restore.
5. Pause the pilot and keep WhatsApp ingestion disabled until API health, worker heartbeat, R2 access, and job queues are clean.
