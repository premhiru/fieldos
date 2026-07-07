# Demo Notes

| Field        | Value                                                          |
| ------------ | -------------------------------------------------------------- |
| Purpose      | Capture demo steps and verification notes for FieldOS changes. |
| Owner        | Product Engineering                                            |
| Status       | Active                                                         |
| Last Updated | 2026-07-06                                                     |

## Table of Contents

- [Task 010B: Operations Health](#task-010b-operations-health)

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
