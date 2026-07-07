# ADR 0012: Photo Intelligence

| Field        | Value                                                            |
| ------------ | ---------------------------------------------------------------- |
| Purpose      | Document the architecture decision for advisory vision analysis. |
| Owner        | Engineering                                                      |
| Status       | Accepted                                                         |
| Last Updated | 2026-07-07                                                       |

## Table of Contents

- [Context](#context)
- [Decision](#decision)
- [Consequences](#consequences)
- [Alternatives Considered](#alternatives-considered)

## Context

FieldOS receives photos as operational evidence through active WhatsApp conversations. Before this decision, photos were represented only as attachment metadata. That was enough for grouping evidence, but it did not help field teams understand visible site context, possible defects, missing work, or inspection-relevant details.

The system also needs to keep WhatsApp ingestion fast and reliable. Vision provider failures must not block message persistence, classification, search, or the inbox.

## Decision

FieldOS will analyze image attachments asynchronously through worker-owned `PHOTO_ANALYSIS` jobs.

The WhatsApp adapter stores the attachment and queues a photo analysis job after image media is available. The worker reads the local image, sends it to the configured OpenAI-compatible vision provider, validates compact JSON output, and upserts a `PhotoAnalysis` record linked to the attachment, message, conversation, organization, and optional project.

Persisted output is intentionally small:

- `summary`
- `detectedObjects`
- `possibleIssues`
- `confidence`
- `tags`

Photo intelligence is advisory only. It must not automatically certify completion, safety, compliance, or defect presence. Human review remains required for operational decisions.

`PhotoAnalysis` results are indexed through the existing `SearchDocument` pipeline so AI Search can retrieve visual evidence without sending binary files during search requests.

## Consequences

- WhatsApp ingestion remains decoupled from provider latency and failures.
- Vision analysis can be retried through the existing background job mechanism.
- Inbox, project detail, command center, and search surfaces can show concise visual context.
- The MVP avoids OCR, PDF extraction, video analysis, and object-storage serving until those are separately justified.
- Production deployments must configure a multimodal `VISION_MODEL` compatible with the selected OpenAI-compatible provider.

## Alternatives Considered

Running vision analysis synchronously during WhatsApp ingestion was rejected because provider latency and failures would make message ingestion brittle.

Storing long free-form vision output was rejected because the product needs compact operator-facing summaries, not verbose model text or hidden reasoning.

Using vision results to automatically create defects or reassign projects was rejected because visual AI output is probabilistic and must remain human-reviewed.
