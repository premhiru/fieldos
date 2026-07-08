# ADR 0013: Project Intelligence and Automated Reporting

| Field        | Value                                                                      |
| ------------ | -------------------------------------------------------------------------- |
| Purpose      | Document the decision for grounded project intelligence and report export. |
| Owner        | Engineering                                                                |
| Status       | Accepted                                                                   |
| Last Updated | 2026-07-08                                                                 |

## Table of Contents

- [Context](#context)
- [Decision](#decision)
- [Consequences](#consequences)
- [Alternatives Considered](#alternatives-considered)

## Context

FieldOS already stores the source material that field teams need for project status: messages, evidence, transcripts, photo analysis, Action Items, classifications, milestones, and events. Task 013 needs briefs and reports, but it should not create a separate reporting silo or rely on free-form model memory.

The product also needs evidence previews without leaking raw storage paths to the browser.

## Decision

FieldOS will build Project Intelligence as a grounded, deterministic package in `packages/intelligence`.

The API builds a `ProjectIntelligenceContext` from authorized project records. The intelligence package generates morning briefs, daily summaries, weekly progress reports, risk summaries, and pending decisions from that context. Report sections include source references so the dashboard can link back to the underlying evidence.

Weekly report generation can run synchronously for exports or asynchronously through `REPORT_GENERATION` jobs. Completed background reports are cached in `ProjectReport`, exported as Markdown and PDF, indexed for AI Search, and recorded as timeline events.

Evidence previews use a storage abstraction. `StorageProvider` defines `upload()`, `download()`, `getSignedUrl()`, and `delete()`. `LocalStorageProvider` signs short-lived API media URLs for local development. The dashboard requests evidence through the API and never receives raw storage keys.

## Consequences

- Reports stay explainable because they are grounded in stored FieldOS records.
- The MVP avoids introducing a second AI prompt surface for reporting before source quality and operator needs are clear.
- Background report generation uses the existing worker queue and operations health patterns.
- Evidence serving can move to S3, R2, or MinIO without changing dashboard components.
- Separate production API and worker services need shared object storage before local media previews and worker-generated PDF URLs can be fully reliable.

## Alternatives Considered

Generating full reports directly with an LLM was rejected for the MVP because it would make source attribution, deterministic tests, and operator trust harder.

Rendering PDFs only in the browser was rejected because reports should be available from API and worker paths for scheduled generation.

Passing raw storage paths to the dashboard was rejected because storage locations are server-side implementation details and may expose sensitive filesystem or bucket structure.
