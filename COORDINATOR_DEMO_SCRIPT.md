# Coordinator Demo Script

| Field        | Value                                                       |
| ------------ | ----------------------------------------------------------- |
| Purpose      | Provide a repeatable demo flow for AI Project Coordinators. |
| Owner        | Product Engineering                                         |
| Status       | Draft                                                       |
| Last Updated | 2026-07-08                                                  |

## Table of Contents

- [Demo Flow](#demo-flow)
- [Expected Notes](#expected-notes)

## Demo Flow

1. Open the Operations Command Center.
2. Show AI Recommendations at the top of the page.
3. Open a project from Projects Requiring Attention.
4. Show the Project Coordinator panel and current ProjectState.
5. Click Run Coordinators Now.
6. Open a progress recommendation.
7. Approve an inspection recommendation and confirm an Action Item is created.
8. Approve a follow-up recommendation and confirm a WhatsApp draft is created.
9. Edit the WhatsApp draft.
10. Click Send only after explaining that final send requires a configured outbound WhatsApp sender.
11. Approve a report recommendation and confirm report generation is queued.
12. Return to the project and show updated ProjectState and coordinator run history.

## Expected Notes

- FieldOS recommends; humans approve.
- WhatsApp drafts are not sent automatically.
- Coordinator recommendations are grounded in stored project records.
- Operations Health shows coordinator runs, failures, pending recommendations, and approval rate.
