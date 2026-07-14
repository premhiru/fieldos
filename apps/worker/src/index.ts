import { Redis } from "ioredis";
import { createHash } from "node:crypto";
import {
  AIClassificationProcessor,
  MilestoneDetector,
  MessageClassifier,
  OpenAICompatibleVisionProvider,
  isAIProviderRateLimitError,
  type VisionResult
} from "@fieldos/ai";
import { BaileysWhatsAppSessionManager, RedisWhatsAppQrStore } from "@fieldos/baileys-whatsapp";
import { ProjectCoordinatorRuntime } from "@fieldos/coordinators";
import {
  claimNextProcessingJob,
  buildProjectIntelligenceContext,
  deferProcessingJob,
  heartbeatWorker,
  markProcessingJobComplete,
  markProcessingJobFailed,
  prisma,
  processSearchIndexJob,
  queueProjectCoordinatorJob,
  queueSearchIndexJob,
  type ProcessingJob
} from "@fieldos/db";
import {
  ProjectIntelligenceService,
  weeklyReportToMarkdown,
  weeklyReportToPdfBuffer
} from "@fieldos/intelligence";

import { buildProjectReportObjectKey, createLogger, createStorageProvider } from "@fieldos/shared";

import { workerEnv } from "./env.js";
import { PhotoAnalysisService } from "./photo-analysis.js";
import { VoiceTranscriptionService } from "./voice-transcription.js";

class ProviderRequestThrottle {
  private nextAvailableAt = 0;

  constructor(private readonly minIntervalMs: number) {}

  defer(delayMs: number): void {
    this.nextAvailableAt = Math.max(this.nextAvailableAt, Date.now() + delayMs);
  }

  async wait(): Promise<void> {
    const waitMs = Math.max(this.nextAvailableAt - Date.now(), 0);

    if (waitMs > 0) {
      logger.info({ waitMs }, "waiting before AI provider request");
      await sleep(waitMs);
    }

    this.nextAvailableAt = Date.now() + this.minIntervalMs;
  }
}

const logger = createLogger("fieldos-worker");
const redis = new Redis(workerEnv.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3
});
const storageProvider = createStorageProvider({
  local: {
    rootPath: workerEnv.WHATSAPP_STORAGE_PATH,
    signingSecret: workerEnv.MEDIA_SIGNING_SECRET
  },
  storage: workerEnv
});
const whatsappSessionManager = new BaileysWhatsAppSessionManager(
  prisma,
  new RedisWhatsAppQrStore(redis),
  {
    mediaStorageProvider: storageProvider,
    pollIntervalMs: workerEnv.WHATSAPP_SESSION_POLL_INTERVAL_MS,
    rootStoragePath: workerEnv.WHATSAPP_STORAGE_PATH
  }
);
const aiClassificationProcessor = new AIClassificationProcessor(prisma, {
  classifier: new MessageClassifier({
    apiKey: workerEnv.OPENROUTER_API_KEY ?? workerEnv.OPENAI_API_KEY,
    baseUrl: workerEnv.AI_BASE_URL,
    model: workerEnv.AI_MODEL
  })
});
const voiceTranscriptionService = new VoiceTranscriptionService({
  apiKey: workerEnv.OPENAI_API_KEY,
  model: workerEnv.VOICE_TRANSCRIPTION_MODEL,
  storageProvider
});
const photoAnalysisService = new PhotoAnalysisService({
  provider: new OpenAICompatibleVisionProvider({
    apiKey: workerEnv.OPENROUTER_API_KEY ?? workerEnv.OPENAI_API_KEY,
    baseUrl: workerEnv.AI_BASE_URL,
    model: workerEnv.VISION_MODEL
  }),
  storageProvider
});
const projectIntelligenceService = new ProjectIntelligenceService();
const coordinatorRuntime = new ProjectCoordinatorRuntime(prisma, {
  draftSender: {
    send: (input) => whatsappSessionManager.sendDraft(input)
  },
  milestoneDetector: new MilestoneDetector({
    apiKey: workerEnv.OPENROUTER_API_KEY ?? workerEnv.OPENAI_API_KEY,
    baseUrl: workerEnv.AI_BASE_URL,
    model: workerEnv.AI_MODEL
  })
});
const aiProviderThrottle = new ProviderRequestThrottle(workerEnv.AI_PROVIDER_MIN_INTERVAL_MS);
const workerName = process.env.WORKER_NAME ?? "fieldos-worker";
const workerVersion =
  process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.npm_package_version ?? "0.0.0";

redis.on("error", (error: Error) => {
  logger.warn({ error }, "redis connection error");
});

let heartbeat: NodeJS.Timeout | undefined;
let processingTimer: NodeJS.Timeout | undefined;
let processingFailureCount = 0;
let lastCoordinatorScanAt = 0;
let shuttingDown = false;

async function start() {
  await heartbeatWorker(prisma, {
    status: "STARTING",
    version: workerVersion,
    workerName
  });
  await redis.connect();
  await redis.ping();
  await whatsappSessionManager.start();
  await processBackgroundJobs();

  logger.info("worker started and waiting for jobs");

  await heartbeatWorker(prisma, {
    status: "ONLINE",
    version: workerVersion,
    workerName
  });

  heartbeat = setInterval(() => {
    heartbeatWorker(prisma, {
      status: "ONLINE",
      version: workerVersion,
      workerName
    })
      .then(() => logger.debug({ workerName, workerVersion }, "worker heartbeat"))
      .catch((error: unknown) => logger.warn({ error }, "worker heartbeat failed"));
  }, 30_000);

  scheduleBackgroundProcessing();
}

async function processBackgroundJobs(): Promise<void> {
  await queueCoordinatorScanIfDue();
  const voiceProcessed = await processJobsOfType("VOICE_TRANSCRIPTION", processVoiceJob);
  const photoProcessed = await processJobsOfType("PHOTO_ANALYSIS", processPhotoJob, {
    limit: workerEnv.AI_PROVIDER_JOBS_PER_POLL
  });
  const reportProcessed = await processJobsOfType("REPORT_GENERATION", processReportJob);
  const coordinatorProcessed = await processJobsOfType(
    "PROJECT_COORDINATOR",
    processCoordinatorJob
  );
  const draftSendProcessed = await processJobsOfType(
    "WHATSAPP_DRAFT_SEND",
    processWhatsAppDraftSendJob
  );
  const searchProcessed = await processJobsOfType("SEARCH_INDEX", processSearchJob);
  const aiProcessed = await processJobsOfType("AI_CLASSIFICATION", processAIJob, {
    limit: workerEnv.AI_PROVIDER_JOBS_PER_POLL
  });
  const processed =
    searchProcessed +
    aiProcessed +
    voiceProcessed +
    photoProcessed +
    reportProcessed +
    coordinatorProcessed +
    draftSendProcessed;

  if (processed > 0) {
    logger.info(
      {
        aiProcessed,
        coordinatorProcessed,
        draftSendProcessed,
        photoProcessed,
        processed,
        reportProcessed,
        searchProcessed,
        voiceProcessed
      },
      "background jobs processed"
    );
  }
}

function scheduleBackgroundProcessing(delayMs = workerEnv.AI_CLASSIFICATION_POLL_INTERVAL_MS) {
  if (shuttingDown) {
    return;
  }

  processingTimer = setTimeout(async () => {
    try {
      await processBackgroundJobs();
      processingFailureCount = 0;
      scheduleBackgroundProcessing();
    } catch (error: unknown) {
      processingFailureCount += 1;
      const retryDelayMs = Math.min(
        workerEnv.AI_CLASSIFICATION_POLL_INTERVAL_MS * 2 ** processingFailureCount,
        60_000
      );
      logger.error(
        { error, job: "background-processing", retryDelayMs },
        "background processing failed"
      );
      scheduleBackgroundProcessing(retryDelayMs);
    }
  }, delayMs);
}

async function processJobsOfType(
  type:
    | "AI_CLASSIFICATION"
    | "PHOTO_ANALYSIS"
    | "PROJECT_COORDINATOR"
    | "REPORT_GENERATION"
    | "SEARCH_INDEX"
    | "WHATSAPP_DRAFT_SEND"
    | "VOICE_TRANSCRIPTION",
  processor: (job: ProcessingJob) => Promise<void>,
  options: { limit?: number } = {}
): Promise<number> {
  let processed = 0;
  const limit = options.limit ?? 10;

  for (let index = 0; index < limit; index += 1) {
    const job = await claimNextProcessingJob(prisma, type);

    if (!job) {
      break;
    }

    await processClaimedJob(job, processor);
    processed += 1;
  }

  return processed;
}

async function processClaimedJob(
  job: ProcessingJob,
  processor: (job: ProcessingJob) => Promise<void>
): Promise<void> {
  const startedAt = Date.now();

  try {
    await processor(job);
    await markProcessingJobComplete(prisma, job.id);
    logger.info(
      {
        correlationId: job.correlationId,
        durationMs: Date.now() - startedAt,
        jobId: job.id,
        jobType: job.type,
        organizationId: job.organizationId,
        projectId: job.projectId,
        result: "completed"
      },
      "background job completed"
    );
  } catch (error: unknown) {
    if (isAIProviderRateLimitError(error)) {
      const retryAfterMs =
        error.retryAfterMs && error.retryAfterMs > 0
          ? error.retryAfterMs
          : workerEnv.AI_PROVIDER_RATE_LIMIT_RETRY_MS;
      aiProviderThrottle.defer(retryAfterMs);
      await deferProcessingJob(prisma, {
        errorMessage: error.message,
        job,
        minimumMaxAttempts: workerEnv.AI_PROVIDER_MAX_ATTEMPTS,
        retryAfterMs
      });
      logger.warn(
        {
          correlationId: job.correlationId,
          durationMs: Date.now() - startedAt,
          jobId: job.id,
          jobType: job.type,
          organizationId: job.organizationId,
          projectId: job.projectId,
          retryAfterMs,
          result: "deferred",
          status: error.status
        },
        "background job deferred after AI provider rate limit"
      );
      return;
    }

    const errorMessage = error instanceof Error ? error.message : "Background job failed.";
    await markProcessingJobFailed(prisma, {
      errorMessage,
      job
    });
    logger.warn(
      {
        correlationId: job.correlationId,
        durationMs: Date.now() - startedAt,
        error,
        jobId: job.id,
        jobType: job.type,
        organizationId: job.organizationId,
        projectId: job.projectId,
        result: "failed"
      },
      "background job failed"
    );
  }
}

async function processSearchJob(job: ProcessingJob): Promise<void> {
  await processSearchIndexJob(prisma, job);

  if (job.sourceType === "MESSAGE") {
    await prisma.message.updateMany({
      data: {
        processingStatus: "SEARCH_COMPLETE"
      },
      where: {
        id: job.sourceId,
        processingStatus: "SEARCH_PENDING"
      }
    });
  }
}

async function processVoiceJob(job: ProcessingJob): Promise<void> {
  const attachment = await prisma.attachment.findUnique({
    include: {
      message: {
        select: {
          conversation: {
            select: {
              organizationId: true,
              projectId: true
            }
          },
          id: true
        }
      }
    },
    where: {
      id: job.sourceId
    }
  });

  if (!attachment) {
    return;
  }

  try {
    const transcript = await voiceTranscriptionService.transcribe({
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      storageKey: attachment.storageKey
    });

    await prisma.$transaction(async (tx) => {
      await tx.attachment.update({
        data: {
          transcript,
          transcriptionError: null,
          transcriptionStatus: "COMPLETED"
        },
        where: {
          id: attachment.id
        }
      });

      await tx.message.update({
        data: {
          processingStatus: "TRANSCRIPTION_COMPLETE"
        },
        where: {
          id: attachment.messageId
        }
      });

      await queueSearchIndexJob(tx, {
        organizationId: attachment.message.conversation.organizationId,
        projectId: attachment.message.conversation.projectId,
        sourceId: attachment.messageId,
        sourceType: "MESSAGE"
      });
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Voice transcription failed.";

    await prisma.attachment.update({
      data: {
        transcriptionError: errorMessage,
        transcriptionStatus: "FAILED"
      },
      where: {
        id: attachment.id
      }
    });

    await aiClassificationProcessor.enqueueMessage(attachment.messageId);
    throw error;
  }

  await aiClassificationProcessor.enqueueMessage(attachment.messageId);
}

async function processPhotoJob(job: ProcessingJob): Promise<void> {
  const attachment = await prisma.attachment.findUnique({
    include: {
      message: {
        select: {
          body: true,
          conversation: {
            select: {
              id: true,
              organizationId: true,
              project: {
                select: {
                  name: true
                }
              },
              projectId: true,
              title: true
            }
          },
          id: true,
          occurredAt: true
        }
      }
    },
    where: {
      id: job.sourceId
    }
  });

  if (!attachment || !attachment.mimeType.toLowerCase().startsWith("image/")) {
    return;
  }

  await aiProviderThrottle.wait();
  const result = await photoAnalysisService.analyze({
    conversationTitle: attachment.message.conversation.title,
    filename: attachment.filename,
    messageText: attachment.message.body,
    mimeType: attachment.mimeType,
    projectName: attachment.message.conversation.project?.name ?? null,
    storageKey: attachment.storageKey
  });

  await prisma.$transaction(async (tx) => {
    const analysis = await tx.photoAnalysis.upsert({
      create: {
        confidence: result.confidence,
        conversationId: attachment.conversationId,
        detectedObjects: result.detectedObjects,
        evidenceId: attachment.id,
        messageId: attachment.messageId,
        organizationId: attachment.message.conversation.organizationId,
        possibleIssues: result.possibleIssues,
        projectId: attachment.message.conversation.projectId,
        provider: workerEnv.VISION_MODEL,
        summary: result.summary,
        tags: result.tags
      },
      update: {
        confidence: result.confidence,
        detectedObjects: result.detectedObjects,
        possibleIssues: result.possibleIssues,
        projectId: attachment.message.conversation.projectId,
        provider: workerEnv.VISION_MODEL,
        summary: result.summary,
        tags: result.tags
      },
      where: {
        evidenceId: attachment.id
      }
    });
    const existingEvent = await tx.event.findFirst({
      where: {
        eventType: "PHOTO_ANALYSIS_COMPLETE",
        sourceId: attachment.messageId,
        sourceType: "MESSAGE"
      }
    });
    const eventPayload = {
      description: buildPhotoAnalysisEventDescription(result),
      eventType: "PHOTO_ANALYSIS_COMPLETE",
      organizationId: attachment.message.conversation.organizationId,
      projectId: attachment.message.conversation.projectId,
      sourceId: attachment.messageId,
      sourceType: "MESSAGE" as const,
      title: "Site Photos",
      occurredAt: attachment.message.occurredAt
    };
    const event = existingEvent
      ? await tx.event.update({
          data: eventPayload,
          where: {
            id: existingEvent.id
          }
        })
      : await tx.event.create({
          data: eventPayload
        });

    await queueSearchIndexJob(tx, {
      organizationId: analysis.organizationId,
      projectId: analysis.projectId,
      sourceId: analysis.id,
      sourceType: "PHOTO_ANALYSIS"
    });
    await queueSearchIndexJob(tx, {
      organizationId: event.organizationId,
      projectId: event.projectId,
      sourceId: event.id,
      sourceType: "TIMELINE_EVENT"
    });
    await queueSearchIndexJob(tx, {
      organizationId: attachment.message.conversation.organizationId,
      projectId: attachment.message.conversation.projectId,
      sourceId: attachment.messageId,
      sourceType: "MESSAGE"
    });
    if (attachment.message.conversation.projectId) {
      await queueProjectCoordinatorJob(tx, {
        organizationId: attachment.message.conversation.organizationId,
        projectId: attachment.message.conversation.projectId,
        sourceId: attachment.message.conversation.projectId
      });
    }
  });
}

async function processAIJob(job: ProcessingJob): Promise<void> {
  await aiProviderThrottle.wait();
  await aiClassificationProcessor.processClassification(job.sourceId);
  const classification = await prisma.aIMessageClassification.findUnique({
    select: {
      errorMessage: true,
      organizationId: true,
      projectId: true,
      status: true
    },
    where: {
      id: job.sourceId
    }
  });

  if (classification?.status === "FAILED") {
    throw new Error(classification.errorMessage ?? "AI classification failed.");
  }

  if (classification?.projectId) {
    await queueProjectCoordinatorJob(prisma, {
      organizationId: classification.organizationId,
      projectId: classification.projectId,
      sourceId: classification.projectId
    });
  }
}

async function processCoordinatorJob(job: ProcessingJob): Promise<void> {
  await aiProviderThrottle.wait();
  await coordinatorRuntime.runProjectCoordinators(job.sourceId);
}

async function processWhatsAppDraftSendJob(job: ProcessingJob): Promise<void> {
  const draft = await prisma.whatsAppDraft.findUnique({
    select: {
      approvedByUserId: true,
      status: true
    },
    where: {
      id: job.sourceId
    }
  });

  if (!draft || draft.status === "SENT" || draft.status === "CANCELLED") {
    return;
  }

  if (!draft.approvedByUserId) {
    throw new Error("WhatsApp draft has not been approved by a user.");
  }

  const result = await coordinatorRuntime.sendWhatsAppDraft({
    draftId: job.sourceId,
    userId: draft.approvedByUserId
  });

  if (!result.sent) {
    throw new Error("error" in result ? result.error : "WhatsApp draft send was not completed.");
  }
}

async function queueCoordinatorScanIfDue(): Promise<void> {
  const now = Date.now();

  if (now - lastCoordinatorScanAt < 60 * 60 * 1000) {
    return;
  }

  const queued = await coordinatorRuntime.queueScheduledScan();
  lastCoordinatorScanAt = now;

  if (queued > 0) {
    logger.info({ queued }, "queued scheduled coordinator scan");
  }
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function processReportJob(job: ProcessingJob): Promise<void> {
  const report = await prisma.projectReport.findUnique({
    include: {
      project: true
    },
    where: {
      id: job.sourceId
    }
  });

  if (!report) {
    return;
  }

  try {
    await prisma.projectReport.update({
      data: {
        errorMessage: null,
        status: "RUNNING"
      },
      where: {
        id: report.id
      }
    });

    const context = await buildProjectIntelligenceContext(prisma, report.projectId);

    if (!context) {
      throw new Error("Project intelligence context could not be built.");
    }

    const weeklyReport = projectIntelligenceService.generateWeeklyReport(context);
    const markdown = weeklyReportToMarkdown(weeklyReport);
    const pdf = weeklyReportToPdfBuffer(weeklyReport);
    const contentHash = createHash("sha256").update(markdown).digest("hex");
    const pdfStorageKey = buildProjectReportObjectKey({
      organizationId: report.organizationId,
      projectId: report.projectId,
      reportId: report.id
    });

    await storageProvider.upload({
      contentType: "application/pdf",
      data: pdf,
      key: pdfStorageKey
    });

    await prisma.$transaction(async (tx) => {
      const completedReport = await tx.projectReport.update({
        data: {
          content: JSON.parse(JSON.stringify(weeklyReport)),
          contentHash,
          errorMessage: null,
          generatedAt: new Date(),
          markdown,
          pdfStorageKey,
          status: "COMPLETED",
          title: weeklyReport.title
        },
        where: {
          id: report.id
        }
      });

      const event = await tx.event.create({
        data: {
          description: `Generated ${weeklyReport.title}.`,
          eventType: "PROJECT_REPORT_GENERATED",
          organizationId: report.organizationId,
          projectId: report.projectId,
          sourceId: completedReport.id,
          sourceType: "REPORT",
          title: "Project Report Generated",
          occurredAt: completedReport.generatedAt ?? new Date()
        }
      });

      await queueSearchIndexJob(tx, {
        organizationId: report.organizationId,
        projectId: report.projectId,
        sourceId: completedReport.id,
        sourceType: "PROJECT_REPORT"
      });
      await queueSearchIndexJob(tx, {
        organizationId: report.organizationId,
        projectId: report.projectId,
        sourceId: event.id,
        sourceType: "TIMELINE_EVENT"
      });
      await queueProjectCoordinatorJob(tx, {
        organizationId: report.organizationId,
        projectId: report.projectId,
        sourceId: report.projectId
      });
    });
  } catch (error: unknown) {
    await prisma.projectReport.update({
      data: {
        errorMessage: error instanceof Error ? error.message : "Report generation failed.",
        status: "FAILED"
      },
      where: {
        id: report.id
      }
    });
    throw error;
  }
}

function buildPhotoAnalysisEventDescription(result: VisionResult): string {
  return [
    `Visual Summary: ${result.summary}`,
    result.detectedObjects.length > 0
      ? `Detected: ${result.detectedObjects.join(", ")}`
      : "Detected: Unable to determine.",
    result.possibleIssues.length > 0
      ? `Possible Issue: ${result.possibleIssues.join(", ")}`
      : "Possible Issue: None obvious. Needs Review.",
    `Confidence: ${formatVisionConfidence(result.confidence)}`
  ].join("\n");
}

function formatVisionConfidence(confidence: number): string {
  if (confidence >= 0.75) {
    return "High";
  }

  if (confidence >= 0.45) {
    return "Needs Review";
  }

  return "Low";
}

async function shutdown(signal: NodeJS.Signals) {
  shuttingDown = true;
  logger.info({ signal }, "shutting down worker");
  await heartbeatWorker(prisma, {
    status: "STOPPING",
    version: workerVersion,
    workerName
  });

  if (heartbeat) {
    clearInterval(heartbeat);
  }

  if (processingTimer) {
    clearTimeout(processingTimer);
  }

  await whatsappSessionManager.stop();
  await redis.quit();
  await prisma.$disconnect();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    shutdown(signal)
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        logger.error({ error }, "worker shutdown failed");
        process.exit(1);
      });
  });
}

start().catch((error: unknown) => {
  logger.error({ error }, "worker startup failed");
  process.exit(1);
});
