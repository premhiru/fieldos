# FieldOS UX Review

| Field        | Value                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Purpose      | Evaluate whether FieldOS feels trustworthy, clear, and valuable to a first-time enterprise field-operations customer. |
| Owner        | Product Design                                                                                                        |
| Status       | Complete - Critical findings resolved                                                                                 |
| Last Updated | 2026-07-16                                                                                                            |

## Table of Contents

- [Executive Summary](#executive-summary)
- [Resolution Update](#resolution-update)
- [Overall Impression](#overall-impression)
- [Strengths](#strengths)
- [Weaknesses](#weaknesses)
- [Screen Scorecard](#screen-scorecard)
- [Screen-by-Screen Review](#screen-by-screen-review)
- [Cognitive Load Review](#cognitive-load-review)
- [Enterprise Readiness](#enterprise-readiness)
- [Visual Readiness](#visual-readiness)
- [Top 10 Improvements](#top-10-improvements)
- [Delight Opportunities](#delight-opportunities)
- [Screenshots](#screenshots)
- [Final Score](#final-score)
- [Recommendation](#recommendation)
- [YC Demo Day Test](#yc-demo-day-test)

## Executive Summary

FieldOS has the bones of a credible operations product: restrained branding, a consistent shell, a useful unified inbox, real evidence, reports, assignment controls, and an understandable operational vocabulary. It does not yet feel like premium enterprise software.

The central problem is not styling. It is product hierarchy. FieldOS repeatedly exposes everything it knows instead of helping the project manager decide what matters now. The Project Command Center is an inventory of modules, Settings becomes an enormous administration stream, and the conversation detail exposes repeated AI processing controls that feel like internal tooling. The product often makes the user interpret the system rather than letting the system interpret operations for the user.

The strongest pages are Reports and Action Items because each has one clear job. The weakest page is Settings, followed by the Project Command Center. Status disagreement is a serious trust issue: the project list labels the live project `Critical`, while its Project Brief labels it `Needs Attention`. An enterprise customer will question every subsequent signal after seeing that contradiction.

**Overall score: 5.8/10.** Suitable for a closely supported design-partner pilot. Not ready to be sold as a dependable daily operating system to a major enterprise.

## Resolution Update

The critique above is retained as the baseline captured before the Final Pilot Product Editing sprint. The following critical findings were resolved on 2026-07-16:

| Finding                                        | Resolution                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Project health disagrees across views          | One deterministic health service now supplies both status and reason to list and detail contracts.                       |
| Project Command Center lacks a dominant task   | The page now contains Project Brief, Recommended Actions, What's Changed, and Quick Links only.                          |
| Settings is an unbounded administration stream | Settings now renders one of six task-oriented views; chat management is closed, active-first, searchable, and paginated. |
| AI machinery is exposed in daily work          | Customer flows use FieldOS summaries and natural confidence labels; retries are progressively disclosed.                 |
| Dashboard duplicates counts and activity       | Recommendations lead the page, summary counts are compact, and the duplicate activity feed was removed.                  |
| Timeline contains routine noise                | Significant events are the default and Show all activity is explicit.                                                    |
| Project creation occupies permanent space      | The create form is hidden until requested.                                                                               |

Partially resolved findings:

- Inbox now foregrounds unread state, project assignment, urgency language, and recency. First-class conversation ownership remains deferred.
- Evidence photos auto-load in the focused project Evidence view and source message evidence. Rich cross-record evidence playback remains future work.
- Mobile hierarchy follows the same recommendation-first order; pilot visual QA is required after every material content change.

See [`../PRODUCT_EDITING_REPORT.md`](../PRODUCT_EDITING_REPORT.md) for measurements, design decisions, and deferred work.

## Overall Impression

The first impression is calm, serious, and more credible than a typical prototype. The login screen has a clear point of view and the shell is consistent. Once inside, that confidence erodes because the product lacks a strong editorial layer. Important decisions, raw messages, AI summaries, system states, and administrative controls compete for attention.

FieldOS currently feels like a technically capable platform presented through a product-shaped interface. It does not yet feel like a product that has made hard choices on behalf of an operations manager.

## Strengths

- The brand is restrained and appropriate for enterprise operations.
- Navigation labels are plain, stable, and easy to scan.
- Action Items makes ownership and assignment visible without opening a separate editor.
- Reports has a clear information hierarchy and communicates recency well.
- The unified inbox concept is immediately understandable.
- Evidence is linked back to source messages and timeline references.
- Empty states use calm language and do not blame the user.
- Dark mode is coherent and readable, with status accents preserved.
- The application avoids decorative excess and generally uses consistent spacing and typography.

## Weaknesses

- The Project Command Center has no dominant task and requires excessive scrolling.
- Settings mixes security, people, invitations, integrations, connection setup, and a very long chat discovery list in one document.
- AI controls and labels are exposed too frequently, making the product feel operationally unsafe and unfinished.
- Project health is inconsistent across screens.
- Recommendations have no discoverable review hub or history; when there are zero pending items, the workflow disappears.
- The inbox can show `No conversations found` while retaining an open conversation in the detail pane.
- Mobile first load is dominated by skeleton blocks before useful information appears.
- Project creation permanently occupies prime space even when the user mainly needs to monitor existing work.
- Evidence Viewer uses technical filenames and an extra `Open Evidence` action instead of showing the asset directly.
- Search feedback is weak: the answer area can remain visually ambiguous while a related raw report excerpt appears below.

## Screen Scorecard

Scores are 0-10. `Density` measures whether the amount of information is useful rather than overwhelming.

| Screen                 | Nav | Visual | Readability | Decision Speed | Density | Professionalism | Mobile | Trust | Overall |
| ---------------------- | --: | -----: | ----------: | -------------: | ------: | --------------: | -----: | ----: | ------: |
| Login                  |   6 |      8 |           8 |              8 |       8 |               8 |      6 |     7 |     7.4 |
| Dashboard              |   8 |      7 |           7 |              6 |       6 |               7 |      4 |     6 |     6.4 |
| Projects               |   7 |      6 |           7 |              5 |       5 |               6 |      5 |     5 |     5.8 |
| Project Command Center |   7 |      6 |           5 |              3 |       3 |               5 |      3 |     4 |     4.5 |
| Inbox                  |   8 |      6 |           7 |              6 |       6 |               6 |      5 |     5 |     6.1 |
| Recommendation Review  |   4 |      6 |           7 |              3 |       7 |               5 |      5 |     4 |     5.1 |
| Action Items           |   7 |      7 |           8 |              7 |       7 |               7 |      6 |     7 |     7.0 |
| Timeline               |   6 |      6 |           6 |              5 |       4 |               6 |      4 |     6 |     5.4 |
| Evidence Viewer        |   6 |      6 |           6 |              5 |       6 |               6 |      4 |     5 |     5.5 |
| Search                 |   7 |      6 |           6 |              4 |       6 |               5 |      5 |     5 |     5.5 |
| Reports                |   7 |      7 |           8 |              8 |       8 |               7 |      6 |     7 |     7.3 |
| Settings               |   5 |      5 |           4 |              2 |       1 |               4 |      1 |     4 |     3.3 |
| Mobile Dashboard       |   8 |      5 |           5 |              4 |       3 |               5 |      4 |     5 |     4.9 |

## Screen-by-Screen Review

### Login

**Current problems:** Strong visual split, but the value proposition is generic and does not demonstrate the operational proof behind the product. The wide composition leaves the login form feeling secondary and slightly detached.

**Recommended changes:** Keep the restraint. Replace generic supporting copy with one concrete trust promise about evidence, decisions, and accountability. Add a small security or data-residency trust line appropriate for enterprise buyers.

**Priority:** Medium. **Effort:** Small. **Expected impact:** Better trust and clearer category positioning before authentication.

### Dashboard

**Current problems:** The four headline counts are useful, but the large empty recommendation area consumes disproportionate space. `Recent Activity` is long and undifferentiated. The page answers what exists, not what the manager should do first.

**Recommended changes:** Lead with a three-item morning priority list that combines risk, owner, deadline, and evidence freshness. Compress the empty recommendation state. Group recent activity by project and significance, not raw chronology.

**Priority:** High. **Effort:** Medium. **Expected impact:** Faster daily orientation and stronger perceived intelligence.

### Projects

**Current problems:** The create form dominates the page even though project creation is infrequent. One row carries little operational context. `Critical` conflicts with `Needs Attention` on the project page.

**Recommended changes:** Move creation behind a primary `New project` action. Make the default view a compact portfolio table showing health reason, owner, last update, unread evidence, open decisions, and next milestone. Establish one health model and explain the reason for every status.

**Priority:** Critical. **Effort:** Medium. **Expected impact:** Higher trust and much faster portfolio scanning.

### Project Command Center

**Current problems:** The page is a 3,000+ pixel sequence of Project Brief, Recommendations, Timeline, Evidence, Milestones, Reports, and Action Items. No section owns the page. Repeated AI-derived cards create fatigue, and key actions are buried below long evidence blocks.

**Recommended changes:** Turn the page into a concise project overview with four permanent zones: current health, next decisions, milestone progress, and latest evidence. Move Timeline, Evidence, Reports, and full Action Items into dedicated subviews. Default to change-since-last-visit, not the full project history.

**Priority:** Critical. **Effort:** Large. **Expected impact:** This is the single biggest improvement to daily usability and enterprise credibility.

### Inbox

**Current problems:** The master-detail model is familiar, but filtering can leave an existing detail pane visible beside `No conversations found`. Channel labels are technical and message previews lack urgency, ownership, or project consequence.

**Recommended changes:** Clear or explicitly pin the detail pane when filters remove its conversation. Show project, unread count, last sender, and action signal consistently. Keep channel as secondary metadata.

**Priority:** High. **Effort:** Medium. **Expected impact:** Less confusion and faster triage.

### Recommendation Review

**Current problems:** With zero pending recommendations, there is no route to a review history or example. The workflow effectively disappears. A first customer cannot learn what FieldOS recommendations look like or verify prior decisions.

**Recommended changes:** Provide a persistent Recommendations destination with Pending, Approved, Dismissed, and Snoozed views. Explain why there are no recommendations and show when the system last evaluated the project.

**Priority:** High. **Effort:** Medium. **Expected impact:** Better transparency, auditability, and confidence in AI behavior.

### Action Items

**Current problems:** This is one of the clearest screens, but every item receives similar emphasis. `Accept`, completion, assignment, and dismissal are presented together without a clear lifecycle. Six unassigned AI suggestions can become repetitive.

**Recommended changes:** Separate review state from execution state. Rank items by urgency and operational consequence. Batch low-confidence suggestions and make ownership, due date, and evidence the dominant fields.

**Priority:** Medium. **Effort:** Medium. **Expected impact:** Faster assignment and less AI-review fatigue.

### Timeline

**Current problems:** Timeline entries read like a log, not an operational story. Reports, messages, and Action Items receive similar weight. The timeline is embedded inside an already overloaded page.

**Recommended changes:** Make Timeline a dedicated view with filters for milestones, decisions, evidence, people, and system events. Visually elevate state changes and decisions; collapse routine message noise by day or conversation.

**Priority:** High. **Effort:** Medium. **Expected impact:** Better forensic review and management reporting.

### Evidence Viewer

**Current problems:** The drawer is calm, but a technical filename is the title and media requires another `Open Evidence` action. Source Message, Timeline References, and Linked Action Items are useful yet visually equal, so provenance does not read as a narrative.

**Recommended changes:** Render supported media inline. Lead with human context: sender, project, date, and AI summary. Present provenance as a compact chain from source to interpretation to action. Keep the storage filename in details.

**Priority:** High. **Effort:** Medium. **Expected impact:** Stronger trust and substantially faster evidence review.

### Search

**Current problems:** The query model is understandable, but loading feedback is visually vague and the returned related record exposes a raw report excerpt. It is unclear whether FieldOS has answered the question or merely found a document.

**Recommended changes:** Separate `Answer` from `Sources`. State coverage and confidence plainly. Highlight the exact passages used, include dates, and explain when evidence is insufficient.

**Priority:** High. **Effort:** Medium. **Expected impact:** Search becomes a trustworthy decision aid instead of a retrieval surface.

### Reports

**Current problems:** The page is clear and well structured, but report type and generation controls are basic. Multiple Morning Briefs are hard to distinguish beyond time.

**Recommended changes:** Keep this architecture. Add reporting period, author/system source, status, and a concise preview. Make the default generation action explicit about its scope and date range.

**Priority:** Medium. **Effort:** Small. **Expected impact:** Better auditability without adding clutter.

### Settings

**Current problems:** This is not a usable settings experience. Security, invitations, members, WhatsApp setup, and every discovered chat/group render in one enormous page. The captured document height exceeded 200,000 pixels. Repeated Activate/Ignore/Archive controls turn the screen into a database browser.

**Recommended changes:** Make User Settings, Team & Access, Integrations, and Operations Health separate routed pages. Give WhatsApp its own workspace with summary counts, search, pagination or virtualization, saved filters, and bulk operations. Hide archived/ignored chats by default. Separate connection health from chat mapping.

**Priority:** Critical. **Effort:** Large. **Expected impact:** Dramatically lower cognitive load and make administration credible at enterprise scale.

### Mobile and Tablet

**Current problems:** Tablet is usable but dense. Mobile first load is mostly large skeleton blocks, pushing useful information far below the fold. The bottom navigation is appropriate, but the dashboard content still follows desktop sequencing rather than mobile urgency.

**Recommended changes:** On mobile, show the top three priority actions immediately, followed by compact health counts. Reduce skeleton height and progressively load secondary activity. Treat Recent Activity as a separate destination.

**Priority:** High. **Effort:** Medium. **Expected impact:** A field manager can make a decision in seconds rather than waiting and scrolling.

## Cognitive Load Review

FieldOS has consistent components but weak information editing. Repetition is the main source of load: repeated Action Item cards, repeated AI classification controls, repeated WhatsApp chat actions, and repeated timeline events. The visual system cannot create hierarchy when every record is placed in a similar bordered container.

Whitespace is generally generous, but it is sometimes used to accommodate empty or low-value states rather than to separate meaningful decisions. Typography is legible, yet too many headings share similar scale and weight. The user repeatedly has to answer, “Which of these sections is the real work?”

The product should adopt a stricter rule: every page gets one dominant user objective, one primary action, and no more than three initially visible information groups.

## Enterprise Readiness

For Changi Airport, DSTA, ST Engineering, SATS, or a major contractor, the current experience would raise four immediate concerns:

1. **Signal reliability:** Project health disagrees across views.
2. **Operational scale:** Settings and chat mapping do not scale beyond a small pilot.
3. **Auditability:** AI recommendations and search results need clearer evaluation time, evidence coverage, decision history, and responsible owner.
4. **Control:** Raw AI rerun actions and repeated processing states feel like internal operations tooling exposed to end users.

The interface is suitable for a guided pilot with a small team and one active project. It is not ready to support a procurement claim that it can run enterprise operations without close vendor support.

## Visual Readiness

The light theme is restrained and professional. The dark theme is coherent, readable, and preserves semantic colors, but it becomes visually flat because most surfaces converge on near-black. Both modes rely heavily on thin borders and white/dark cards; this produces consistency but not enough hierarchy.

Spacing and alignment are mostly strong. Icons are consistent. Empty states are pleasant. Loading states need tighter dimensions and faster transition to useful content, especially on mobile. The product would benefit more from stronger information hierarchy than from additional decoration.

## Top 10 Improvements

1. **Decompose Settings and virtualize chat discovery.** Critical, large effort, transformational impact.
2. **Redesign the Project Command Center around health, decisions, milestones, and latest evidence.** Critical, large effort, transformational impact.
3. **Create one authoritative project-health model and show the reason for each state.** Critical, medium effort, very high trust impact.
4. **Create a persistent Recommendations hub with history and audit context.** High, medium effort, high trust impact.
5. **Remove or progressively disclose AI processing controls from customer workflows.** High, medium effort, high professionalism impact.
6. **Turn the dashboard into a prioritized daily brief rather than a collection of counts and feeds.** High, medium effort, high decision-speed impact.
7. **Make Evidence Viewer render media inline and foreground provenance.** High, medium effort, high trust impact.
8. **Fix inbox filter/detail contradictions and make triage signals explicit.** High, medium effort, high usability impact.
9. **Design a mobile-first priority view with compact loading states.** High, medium effort, high field-use impact.
10. **Separate Search answers from sources and communicate evidence coverage.** High, medium effort, high AI-confidence impact.

## Delight Opportunities

1. **Morning Command Brief:** Three prioritized decisions with owner, deadline, evidence, and one-click handoff.
2. **What Changed Since Yesterday:** A project-level narrative that suppresses routine noise and highlights only meaningful changes.
3. **Evidence-to-Action Chain:** A single visual trail from WhatsApp message to AI interpretation, approval, assignee, and outcome.
4. **Project Health Explanation:** Clicking a health state reveals exactly which signals changed it and what would restore green status.
5. **Field Playback:** A chronological, media-rich daily recap that lets managers understand a site in under two minutes.

## Screenshots

- [Login](./01-login-desktop.png)
- [Dashboard](./02-dashboard-desktop.png)
- [Projects](./03-projects-desktop.png)
- [Project Command Center](./04-project-command-center-desktop.png)
- [Inbox](./05-inbox-desktop.png)
- [Inbox conversation](./06-inbox-conversation-desktop.png)
- [Recommendations empty state](./07-recommendations-empty-desktop.png)
- [Action Items](./08-action-items-desktop.png)
- [Timeline and Project Command Center](./09-timeline-desktop.png)
- [Evidence Viewer](./10-evidence-viewer-desktop.png)
- [Search](./11-search-desktop.png)
- [Reports](./12-reports-desktop.png)
- [Settings](./13-settings-desktop.png)
- [Mobile dashboard, 375px](./14-dashboard-mobile-375.png)
- [Tablet dashboard, 768px](./15-dashboard-tablet-768.png)
- [Desktop dashboard, 1440px](./16-dashboard-desktop-1440.png)
- [Dark-mode dashboard](./17-dashboard-dark-desktop.png)

## Final Score

**5.8/10**

FieldOS looks credible at first glance and contains several genuinely useful workflows. It loses trust under sustained use because it exposes too much system output, does not prioritize decisions strongly enough, and does not yet scale administratively.

## Recommendation

**No.** I would not recommend FieldOS to a paying enterprise customer today.

I would recommend it to a carefully selected design partner under a high-touch pilot agreement. The core concept is valuable, Reports and Action Items demonstrate product potential, and the visual foundation is sound. Before charging an enterprise to depend on it, FieldOS must resolve health-state consistency, simplify the Project Command Center, rebuild Settings for scale, and make AI provenance and review history unmistakable.

## YC Demo Day Test

Investors would believe the team has built substantial technology and understands the field-operations problem. They would not yet believe the current product can be sold broadly to enterprise customers without heavy onboarding and support.

What is missing is a sharp product thesis visible in every screen: FieldOS should tell a manager what changed, what matters, who owns it, and what decision is needed. Today it too often shows messages, analyses, records, and controls and asks the manager to assemble that answer. The path to enterprise credibility is not more features. It is stronger prioritization, fewer exposed mechanics, consistent operational truth, and proof that the interface remains calm at 100 projects and thousands of conversations.

## Review Notes

- Reviewed the production deployment on 2026-07-16 using desktop, tablet, mobile, light, and dark modes.
- Followed the requested journey from login through logout and exercised navigation, filters, search, Action Item tabs, project rows, conversation selection, and Evidence Viewer.
- No destructive mutations, invitations, assignments, approvals, report generation, connection changes, or application-code changes were made.
- Production had zero pending recommendations, so a recommendation detail could not be entered naturally. The empty state and workflow discoverability were reviewed instead.
