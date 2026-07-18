import { randomUUID } from "node:crypto";

import type {
  Prisma,
  PrismaClient,
  ProcessingJob,
  ProcessingJobType,
  SearchDocumentSourceType,
  WorkerStatus
} from "@prisma/client";

import {
  buildUnifiedEvidenceContext,
  formatEvidenceSummary,
  type UnifiedEvidenceContext
} from "./evidence-context.js";

export interface QueueProcessingJobInput {
  correlationId?: string;
  maxAttempts?: number;
  nextRunAt?: Date | null;
  organizationId: string;
  projectId?: string | null;
  sourceId: string;
  sourceType: string;
  type: ProcessingJobType;
}

export interface JobMetricsRow {
  completedToday: number;
  failed: number;
  pending: number;
  running: number;
  type: ProcessingJobType;
}

const coordinatorJobDebounceMs = 15 * 60 * 1000;

export async function queueProcessingJob(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: QueueProcessingJobInput
): Promise<ProcessingJob> {
  const correlationId = input.correlationId ?? randomUUID();

  return prisma.processingJob.upsert({
    create: {
      correlationId,
      maxAttempts: input.maxAttempts ?? 3,
      nextRunAt: input.nextRunAt ?? null,
      organizationId: input.organizationId,
      projectId: input.projectId ?? null,
      sourceId: input.sourceId,
      sourceType: input.sourceType,
      status: "PENDING",
      type: input.type
    },
    update: {
      attempts: 0,
      completedAt: null,
      errorMessage: null,
      failedAt: null,
      maxAttempts: input.maxAttempts ?? 3,
      nextRunAt: input.nextRunAt ?? null,
      organizationId: input.organizationId,
      projectId: input.projectId ?? null,
      sourceId: input.sourceId,
      sourceType: input.sourceType,
      startedAt: null,
      status: "PENDING"
    },
    where: {
      type_sourceType_sourceId: {
        sourceId: input.sourceId,
        sourceType: input.sourceType,
        type: input.type
      }
    }
  });
}

export async function queueSearchIndexJob(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: Omit<QueueProcessingJobInput, "sourceType" | "type"> & {
    sourceType: SearchDocumentSourceType;
  }
): Promise<ProcessingJob> {
  return queueProcessingJob(prisma, {
    ...input,
    sourceType: input.sourceType,
    type: "SEARCH_INDEX"
  });
}

export async function queueAIClassificationJob(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: Omit<QueueProcessingJobInput, "sourceType" | "type">
): Promise<ProcessingJob> {
  return queueProcessingJob(prisma, {
    ...input,
    maxAttempts: input.maxAttempts ?? 10,
    sourceType: "AI_MESSAGE_CLASSIFICATION",
    type: "AI_CLASSIFICATION"
  });
}

export async function queueVoiceTranscriptionJob(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: Omit<QueueProcessingJobInput, "sourceType" | "type">
): Promise<ProcessingJob> {
  return queueProcessingJob(prisma, {
    ...input,
    maxAttempts: input.maxAttempts ?? 5,
    sourceType: "ATTACHMENT",
    type: "VOICE_TRANSCRIPTION"
  });
}

export async function queuePhotoAnalysisJob(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: Omit<QueueProcessingJobInput, "sourceType" | "type">
): Promise<ProcessingJob> {
  return queueProcessingJob(prisma, {
    ...input,
    maxAttempts: input.maxAttempts ?? 10,
    sourceType: "ATTACHMENT",
    type: "PHOTO_ANALYSIS"
  });
}

export async function queueReportGenerationJob(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: Omit<QueueProcessingJobInput, "sourceType" | "type">
): Promise<ProcessingJob> {
  return queueProcessingJob(prisma, {
    ...input,
    sourceType: "PROJECT_REPORT",
    type: "REPORT_GENERATION"
  });
}

export async function queueProjectCoordinatorJob(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: Omit<QueueProcessingJobInput, "sourceType" | "type">
): Promise<ProcessingJob> {
  return (await queueDebouncedProjectCoordinatorJob(prisma, input, "PROJECT_COORDINATOR")).job;
}

export async function queueProjectCoordinatorMilestoneJob(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: Omit<QueueProcessingJobInput, "sourceType" | "type">
): Promise<ProcessingJob> {
  return (await queueDebouncedProjectCoordinatorJob(prisma, input, "PROJECT_COORDINATOR_MILESTONE"))
    .job;
}

export async function queueProjectCoordinatorJobs(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: Omit<QueueProcessingJobInput, "sourceType" | "type">
): Promise<number> {
  const [lightweight, milestone] = await Promise.all([
    queueDebouncedProjectCoordinatorJob(prisma, input, "PROJECT_COORDINATOR"),
    queueDebouncedProjectCoordinatorJob(prisma, input, "PROJECT_COORDINATOR_MILESTONE")
  ]);

  return Number(lightweight.queued) + Number(milestone.queued);
}

async function queueDebouncedProjectCoordinatorJob(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: Omit<QueueProcessingJobInput, "sourceType" | "type">,
  type: "PROJECT_COORDINATOR" | "PROJECT_COORDINATOR_MILESTONE"
): Promise<{ job: ProcessingJob; queued: boolean }> {
  const debounceCutoff = new Date(Date.now() - coordinatorJobDebounceMs);
  const recentJob = await prisma.processingJob.findFirst({
    orderBy: {
      updatedAt: "desc"
    },
    where: {
      OR: [
        {
          createdAt: { gte: debounceCutoff }
        },
        {
          updatedAt: { gte: debounceCutoff }
        }
      ],
      projectId: input.projectId ?? input.sourceId,
      status: { in: ["PENDING", "RUNNING"] },
      type
    }
  });

  if (recentJob) {
    return { job: recentJob, queued: false };
  }

  return {
    job: await queueProcessingJob(prisma, {
      ...input,
      sourceType: "PROJECT",
      type
    }),
    queued: true
  };
}

export async function queueWhatsAppDraftSendJob(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: Omit<QueueProcessingJobInput, "sourceType" | "type">
): Promise<ProcessingJob> {
  return queueProcessingJob(prisma, {
    ...input,
    maxAttempts: input.maxAttempts ?? 5,
    sourceType: "WHATSAPP_DRAFT",
    type: "WHATSAPP_DRAFT_SEND"
  });
}

export async function queueWhatsAppConnectionAlertJob(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: Omit<QueueProcessingJobInput, "sourceType" | "type"> & {
    alertType: "DISCONNECT" | "RECOVERY";
  }
): Promise<ProcessingJob> {
  const { alertType, ...job } = input;
  return queueProcessingJob(prisma, {
    ...job,
    maxAttempts: input.maxAttempts ?? 5,
    sourceType:
      alertType === "DISCONNECT" ? "WHATSAPP_DISCONNECT_ALERT" : "WHATSAPP_RECOVERY_ALERT",
    type: "WHATSAPP_CONNECTION_ALERT"
  });
}

export async function claimNextProcessingJob(
  prisma: PrismaClient,
  type: ProcessingJobType
): Promise<ProcessingJob | null> {
  const now = new Date();
  const jobs = await prisma.processingJob.findMany({
    orderBy: {
      createdAt: "asc"
    },
    take: 10,
    where: {
      OR: [
        {
          nextRunAt: null
        },
        {
          nextRunAt: {
            lte: now
          }
        }
      ],
      status: "PENDING",
      type
    }
  });
  const exhaustedJobIds = jobs
    .filter((candidate) => candidate.attempts >= candidate.maxAttempts)
    .map((candidate) => candidate.id);

  if (exhaustedJobIds.length > 0) {
    await prisma.processingJob.updateMany({
      data: {
        errorMessage: "Processing job exhausted its attempts before reaching a terminal state.",
        failedAt: now,
        nextRunAt: null,
        startedAt: null,
        status: "FAILED"
      },
      where: {
        id: { in: exhaustedJobIds },
        status: "PENDING"
      }
    });
  }

  const job = jobs.find((candidate) => candidate.attempts < candidate.maxAttempts);

  if (!job) {
    return null;
  }

  try {
    const result = await prisma.processingJob.updateMany({
      data: {
        attempts: {
          increment: 1
        },
        errorMessage: null,
        nextRunAt: null,
        startedAt: new Date(),
        status: "RUNNING"
      },
      where: {
        id: job.id,
        status: "PENDING"
      }
    });

    if (result.count === 0) {
      return null;
    }

    return prisma.processingJob.findUnique({
      where: {
        id: job.id
      }
    });
  } catch {
    return null;
  }
}

export async function recoverStaleProcessingJobs(
  prisma: PrismaClient,
  staleAfterMs = 5 * 60 * 1000
): Promise<number> {
  const result = await prisma.processingJob.updateMany({
    data: {
      errorMessage: "Recovered after the previous worker stopped during processing.",
      nextRunAt: null,
      startedAt: null,
      status: "PENDING"
    },
    where: {
      startedAt: {
        lte: new Date(Date.now() - staleAfterMs)
      },
      status: "RUNNING"
    }
  });

  return result.count;
}

export async function markProcessingJobComplete(
  prisma: PrismaClient | Prisma.TransactionClient,
  jobId: string
): Promise<void> {
  await prisma.processingJob.update({
    data: {
      completedAt: new Date(),
      errorMessage: null,
      failedAt: null,
      status: "COMPLETED"
    },
    where: {
      id: jobId
    }
  });
}

export async function markProcessingJobFailed(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: {
    errorMessage: string;
    job: Pick<ProcessingJob, "attempts" | "id" | "maxAttempts">;
  }
): Promise<void> {
  const exhausted = input.job.attempts >= input.job.maxAttempts;

  await prisma.processingJob.update({
    data: {
      errorMessage: input.errorMessage,
      failedAt: new Date(),
      nextRunAt: null,
      status: exhausted ? "FAILED" : "PENDING"
    },
    where: {
      id: input.job.id
    }
  });
}

export async function deferProcessingJob(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: {
    errorMessage: string;
    job: Pick<ProcessingJob, "attempts" | "id" | "maxAttempts">;
    minimumMaxAttempts?: number;
    retryAfterMs: number;
  }
): Promise<void> {
  const maxAttempts = Math.max(input.job.maxAttempts, input.minimumMaxAttempts ?? 0);
  const exhausted = input.job.attempts >= maxAttempts;

  await prisma.processingJob.update({
    data: {
      errorMessage: input.errorMessage,
      failedAt: exhausted ? new Date() : null,
      maxAttempts,
      nextRunAt: exhausted ? null : new Date(Date.now() + input.retryAfterMs),
      startedAt: null,
      status: exhausted ? "FAILED" : "PENDING"
    },
    where: {
      id: input.job.id
    }
  });
}

export async function retryProcessingJob(
  prisma: PrismaClient,
  jobId: string
): Promise<ProcessingJob> {
  await prisma.processingJob.updateMany({
    data: {
      attempts: 0,
      completedAt: null,
      errorMessage: null,
      failedAt: null,
      nextRunAt: null,
      startedAt: null,
      status: "PENDING"
    },
    where: {
      id: jobId,
      status: "FAILED"
    }
  });

  return prisma.processingJob.findUniqueOrThrow({
    where: {
      id: jobId
    }
  });
}

export async function retryFailedProcessingJobs(
  prisma: PrismaClient,
  organizationId: string
): Promise<number> {
  const result = await prisma.processingJob.updateMany({
    data: {
      attempts: 0,
      completedAt: null,
      errorMessage: null,
      failedAt: null,
      nextRunAt: null,
      startedAt: null,
      status: "PENDING"
    },
    where: {
      organizationId,
      status: "FAILED"
    }
  });

  return result.count;
}

export async function heartbeatWorker(
  prisma: PrismaClient,
  input: {
    status: WorkerStatus;
    version: string;
    workerName: string;
  }
) {
  return prisma.workerHeartbeat.upsert({
    create: {
      lastHeartbeatAt: new Date(),
      status: input.status,
      version: input.version,
      workerName: input.workerName
    },
    update: {
      lastHeartbeatAt: new Date(),
      status: input.status,
      version: input.version
    },
    where: {
      workerName: input.workerName
    }
  });
}

export async function processSearchIndexJob(
  prisma: PrismaClient,
  job: Pick<ProcessingJob, "sourceId" | "sourceType">
): Promise<void> {
  const document = await buildSearchDocument(prisma, job);

  if (!document) {
    return;
  }

  await prisma.searchDocument.upsert({
    create: {
      content: document.content || document.title,
      metadata: document.metadata,
      occurredAt: document.occurredAt,
      organizationId: document.organizationId,
      projectId: document.projectId,
      sourceId: document.sourceId,
      sourceType: document.sourceType,
      title: document.title
    },
    update: {
      content: document.content || document.title,
      metadata: document.metadata,
      occurredAt: document.occurredAt,
      organizationId: document.organizationId,
      projectId: document.projectId,
      title: document.title
    },
    where: {
      sourceType_sourceId: {
        sourceId: document.sourceId,
        sourceType: document.sourceType
      }
    }
  });
}

export async function getJobMetrics(
  prisma: PrismaClient,
  organizationId: string
): Promise<JobMetricsRow[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [pending, running, failed, completedToday] = await Promise.all([
    prisma.processingJob.groupBy({
      by: ["type"],
      _count: true,
      where: {
        organizationId,
        status: "PENDING"
      }
    }),
    prisma.processingJob.groupBy({
      by: ["type"],
      _count: true,
      where: {
        organizationId,
        status: "RUNNING"
      }
    }),
    prisma.processingJob.groupBy({
      by: ["type"],
      _count: true,
      where: {
        organizationId,
        status: "FAILED"
      }
    }),
    prisma.processingJob.groupBy({
      by: ["type"],
      _count: true,
      where: {
        completedAt: {
          gte: today
        },
        organizationId,
        status: "COMPLETED"
      }
    })
  ]);

  const rows = new Map<ProcessingJobType, JobMetricsRow>();
  const ensure = (type: ProcessingJobType) => {
    const existing = rows.get(type);

    if (existing) {
      return existing;
    }

    const row = {
      completedToday: 0,
      failed: 0,
      pending: 0,
      running: 0,
      type
    };
    rows.set(type, row);
    return row;
  };

  for (const type of [
    "SEARCH_INDEX",
    "AI_CLASSIFICATION",
    "VOICE_TRANSCRIPTION",
    "PHOTO_ANALYSIS",
    "REPORT_GENERATION",
    "MEDIA_DOWNLOAD",
    "PROJECT_COORDINATOR",
    "PROJECT_COORDINATOR_MILESTONE",
    "WHATSAPP_DRAFT_SEND"
  ] as const) {
    ensure(type);
  }

  for (const row of pending) {
    ensure(row.type).pending = row._count;
  }

  for (const row of running) {
    ensure(row.type).running = row._count;
  }

  for (const row of failed) {
    ensure(row.type).failed = row._count;
  }

  for (const row of completedToday) {
    ensure(row.type).completedToday = row._count;
  }

  return [...rows.values()];
}

type SearchDocumentInput = {
  content: string;
  metadata: Prisma.InputJsonValue;
  occurredAt: Date | null;
  organizationId: string;
  projectId: string | null;
  sourceId: string;
  sourceType: SearchDocumentSourceType;
  title: string;
};

async function buildSearchDocument(
  prisma: PrismaClient,
  job: Pick<ProcessingJob, "sourceId" | "sourceType">
): Promise<SearchDocumentInput | null> {
  switch (job.sourceType) {
    case "PROJECT":
      return buildProjectDocument(prisma, job.sourceId);
    case "MESSAGE":
      return buildMessageDocument(prisma, job.sourceId);
    case "TIMELINE_EVENT":
      return buildEventDocument(prisma, job.sourceId);
    case "ACTION_ITEM":
      return buildActionItemDocument(prisma, job.sourceId);
    case "AI_CLASSIFICATION":
      return buildAIClassificationDocument(prisma, job.sourceId);
    case "PHOTO_ANALYSIS":
      return buildPhotoAnalysisDocument(prisma, job.sourceId);
    case "PROJECT_REPORT":
      return buildProjectReportDocument(prisma, job.sourceId);
    default:
      return null;
  }
}

async function buildProjectDocument(
  prisma: PrismaClient,
  projectId: string
): Promise<SearchDocumentInput | null> {
  const project = await prisma.project.findUnique({
    where: {
      id: projectId
    }
  });

  if (!project) {
    return null;
  }

  return {
    content: `Project ${project.name} ${project.code} status ${project.status}`,
    metadata: {
      code: project.code,
      status: project.status
    },
    occurredAt: project.updatedAt,
    organizationId: project.organizationId,
    projectId: project.id,
    sourceId: project.id,
    sourceType: "PROJECT",
    title: `${project.code} ${project.name}`
  };
}

async function buildMessageDocument(
  prisma: PrismaClient,
  messageId: string
): Promise<SearchDocumentInput | null> {
  const context = await buildUnifiedEvidenceContext(prisma, messageId);

  if (!context) {
    return null;
  }

  return {
    content: buildMessageSearchContent(context),
    metadata: {
      conversationId: context.conversation.id,
      conversationTitle: context.conversation.title,
      evidenceSummary: {
        attachmentCount: context.evidenceSummary.attachmentCount,
        documentCount: context.evidenceSummary.documentCount,
        labels: context.evidenceSummary.labels,
        pdfCount: context.evidenceSummary.pdfCount,
        photoCount: context.evidenceSummary.photoCount,
        videoCount: context.evidenceSummary.videoCount,
        voiceNoteCount: context.evidenceSummary.voiceNoteCount
      },
      messageType: context.messageType,
      sender: context.sender.displayName
    },
    occurredAt: context.timestamp,
    organizationId: context.organizationId,
    projectId: context.project?.id ?? null,
    sourceId: context.messageId,
    sourceType: "MESSAGE",
    title: context.conversation.title
  };
}

function buildMessageSearchContent(context: UnifiedEvidenceContext): string {
  return [
    context.messageText ?? "",
    context.voiceTranscript ? `Voice transcript: ${context.voiceTranscript}` : "",
    context.attachedDocuments.length > 0
      ? `Document filenames: ${context.attachedDocuments
          .map((attachment) => attachment.filename)
          .join(", ")}`
      : "",
    context.attachedPhotos.length > 0
      ? `Photo filenames: ${context.attachedPhotos
          .map((attachment) => attachment.filename)
          .join(", ")}`
      : "",
    context.evidenceSummary.attachmentCount > 0
      ? `Evidence summary: ${formatEvidenceSummary(context.evidenceSummary)}`
      : "",
    `Sender: ${context.sender.displayName}`,
    `Conversation: ${context.conversation.title}`,
    context.project ? `Project: ${context.project.name}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

async function buildEventDocument(
  prisma: PrismaClient,
  eventId: string
): Promise<SearchDocumentInput | null> {
  const event = await prisma.event.findUnique({
    where: {
      id: eventId
    }
  });

  if (!event) {
    return null;
  }

  return {
    content: [event.description ?? "", `Event type: ${event.eventType}`].filter(Boolean).join("\n"),
    metadata: {
      eventType: event.eventType
    },
    occurredAt: event.occurredAt,
    organizationId: event.organizationId,
    projectId: event.projectId,
    sourceId: event.id,
    sourceType: "TIMELINE_EVENT",
    title: event.title
  };
}

async function buildActionItemDocument(
  prisma: PrismaClient,
  actionItemId: string
): Promise<SearchDocumentInput | null> {
  const actionItem = await prisma.actionItem.findUnique({
    where: {
      id: actionItemId
    }
  });

  if (!actionItem) {
    return null;
  }

  return {
    content: [
      actionItem.description ?? "",
      `Status: ${actionItem.status}`,
      `Priority: ${actionItem.priority}`,
      `Type: ${actionItem.type}`
    ]
      .filter(Boolean)
      .join("\n"),
    metadata: {
      priority: actionItem.priority,
      status: actionItem.status,
      type: actionItem.type
    },
    occurredAt: actionItem.updatedAt,
    organizationId: actionItem.organizationId,
    projectId: actionItem.projectId ?? actionItem.suggestedProjectId,
    sourceId: actionItem.id,
    sourceType: "ACTION_ITEM",
    title: actionItem.title
  };
}

async function buildAIClassificationDocument(
  prisma: PrismaClient,
  classificationId: string
): Promise<SearchDocumentInput | null> {
  const classification = await prisma.aIMessageClassification.findUnique({
    where: {
      id: classificationId
    }
  });

  if (!classification) {
    return null;
  }

  return {
    content: [
      classification.summary ?? "",
      classification.location ? `Location: ${classification.location}` : "",
      classification.reasoningSummary ?? "",
      classification.category ? `Category: ${classification.category}` : ""
    ]
      .filter(Boolean)
      .join("\n"),
    metadata: {
      category: classification.category,
      confidence: classification.confidence,
      status: classification.status
    },
    occurredAt: classification.updatedAt,
    organizationId: classification.organizationId,
    projectId: classification.projectId,
    sourceId: classification.id,
    sourceType: "AI_CLASSIFICATION",
    title: classification.category
      ? `AI classification: ${classification.category}`
      : "AI classification"
  };
}

async function buildPhotoAnalysisDocument(
  prisma: PrismaClient,
  photoAnalysisId: string
): Promise<SearchDocumentInput | null> {
  const analysis = await prisma.photoAnalysis.findUnique({
    include: {
      evidence: {
        select: {
          filename: true,
          mimeType: true
        }
      },
      project: {
        select: {
          code: true,
          name: true
        }
      }
    },
    where: {
      id: photoAnalysisId
    }
  });

  if (!analysis) {
    return null;
  }

  const detectedObjects = jsonStringArray(analysis.detectedObjects);
  const possibleIssues = jsonStringArray(analysis.possibleIssues);
  const tags = jsonStringArray(analysis.tags);

  return {
    content: [
      analysis.summary,
      detectedObjects.length > 0 ? `Detected objects: ${detectedObjects.join(", ")}` : "",
      possibleIssues.length > 0 ? `Possible issues: ${possibleIssues.join(", ")}` : "",
      tags.length > 0 ? `Tags: ${tags.join(", ")}` : "",
      `Filename: ${analysis.evidence.filename}`,
      `MIME type: ${analysis.evidence.mimeType}`,
      analysis.project ? `Project: ${analysis.project.name} ${analysis.project.code}` : ""
    ]
      .filter(Boolean)
      .join("\n"),
    metadata: {
      confidence: analysis.confidence,
      detectedObjects,
      evidenceId: analysis.evidenceId,
      possibleIssues,
      provider: analysis.provider,
      tags
    },
    occurredAt: analysis.createdAt,
    organizationId: analysis.organizationId,
    projectId: analysis.projectId,
    sourceId: analysis.id,
    sourceType: "PHOTO_ANALYSIS",
    title: `Photo analysis: ${analysis.evidence.filename}`
  };
}

async function buildProjectReportDocument(
  prisma: PrismaClient,
  projectReportId: string
): Promise<SearchDocumentInput | null> {
  const report = await prisma.projectReport.findUnique({
    include: {
      project: {
        select: {
          code: true,
          name: true
        }
      }
    },
    where: {
      id: projectReportId
    }
  });

  if (!report || report.status !== "COMPLETED") {
    return null;
  }

  return {
    content: report.markdown ?? report.title,
    metadata: {
      generatedAt: report.generatedAt?.toISOString() ?? null,
      pdfStorageKey: report.pdfStorageKey,
      reportType: report.type,
      status: report.status
    },
    occurredAt: report.generatedAt ?? report.updatedAt,
    organizationId: report.organizationId,
    projectId: report.projectId,
    sourceId: report.id,
    sourceType: "PROJECT_REPORT",
    title: `${report.project.code} ${report.title}`
  };
}

function jsonStringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

export function getWorkerEffectiveStatus(input: {
  lastHeartbeatAt: Date;
  status: WorkerStatus;
}): WorkerStatus {
  if (input.status !== "ONLINE") {
    return input.status;
  }

  return Date.now() - input.lastHeartbeatAt.getTime() > 90_000 ? "OFFLINE" : input.status;
}
