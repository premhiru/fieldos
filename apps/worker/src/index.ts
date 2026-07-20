import { Redis } from "ioredis";
import { createHash } from "node:crypto";
import {
  AIClassificationProcessor,
  createConfiguredAIProvider,
  createConfiguredVisionProvider,
  isAIProviderRateLimitError,
  MilestoneDetector,
  MessageClassifier,
  MessageClassifierV2,
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
  queueProjectCoordinatorJobs,
  queueSearchIndexJob,
  recoverStaleProcessingJobs,
  type ProcessingJob,
  type ProjectReportType
} from "@fieldos/db";
import {
  dailySummaryToMarkdown,
  morningBriefToMarkdown,
  pendingDecisionsToMarkdown,
  ProjectIntelligenceService,
  reportMarkdownToPdfBuffer,
  riskSummaryToMarkdown,
  weeklyReportToMarkdown,
  type ProjectIntelligenceContext
} from "@fieldos/intelligence";

import {
  buildProjectReportObjectKey,
  createLogger,
  createResendEmailSender,
  createStorageProvider
} from "@fieldos/shared";

import { workerEnv } from "./env.js";
import { PhotoAnalysisService } from "./photo-analysis.js";
import { VoiceTranscriptionService } from "./voice-transcription.js";
import {
  createPrismaWhatsAppConnectionAlertStore,
  WhatsAppConnectionAlertProcessor
} from "./whatsapp-connection-alerts.js";

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
const maxAIProviderRetryMs = 6 * 60 * 60 * 1000;
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
const textAIProvider = createConfiguredAIProvider({
  fallbackApiKey: workerEnv.OPENROUTER_API_KEY ?? workerEnv.OPENAI_API_KEY,
  fallbackBaseUrl: workerEnv.AI_BASE_URL,
  fallbackModel: workerEnv.AI_MODEL,
  kimiApiKey: workerEnv.KIMI_API_KEY,
  kimiBaseUrl: workerEnv.KIMI_BASE_URL,
  kimiModel: workerEnv.KIMI_MODEL,
  onFallback: (error) => {
    logger.warn(
      { error, fallback: "openrouter", primary: "kimi" },
      "AI provider fallback activated"
    );
  }
});
const aiClassificationProcessor = new AIClassificationProcessor(prisma, {
  classifier: new MessageClassifier({
    model: textAIProvider.model,
    provider: textAIProvider.provider
  }),
  classifierV2: new MessageClassifierV2({
    model: textAIProvider.model,
    provider: textAIProvider.provider
  }),
  decisionEngineMode: workerEnv.AI_DECISION_ENGINE_MODE
});
const voiceTranscriptionService = new VoiceTranscriptionService({
  apiKey: workerEnv.OPENAI_API_KEY,
  model: workerEnv.VOICE_TRANSCRIPTION_MODEL,
  storageProvider
});
const photoAnalysisService = new PhotoAnalysisService({
  provider: createConfiguredVisionProvider({
    fallbackApiKey: workerEnv.OPENROUTER_API_KEY ?? workerEnv.OPENAI_API_KEY,
    fallbackBaseUrl: workerEnv.AI_BASE_URL,
    fallbackModel: workerEnv.VISION_MODEL,
    kimiApiKey: workerEnv.KIMI_API_KEY,
    kimiBaseUrl: workerEnv.KIMI_BASE_URL,
    kimiModel: workerEnv.KIMI_VISION_MODEL,
    onFallback: (error) => {
      logger.warn(
        { error, fallback: "openrouter", primary: "kimi" },
        "vision provider fallback activated"
      );
    }
  }),
  storageProvider
});
const projectIntelligenceService = new ProjectIntelligenceService();
const coordinatorRuntime = new ProjectCoordinatorRuntime(prisma, {
  decisionEngineMode: workerEnv.AI_DECISION_ENGINE_MODE,
  draftSender: {
    send: (input) => whatsappSessionManager.sendDraft(input)
  },
  milestoneDetector: new MilestoneDetector({
    model: textAIProvider.model,
    provider: textAIProvider.provider
  })
});
const aiProviderThrottle = new ProviderRequestThrottle(workerEnv.AI_PROVIDER_MIN_INTERVAL_MS);
const milestoneCoordinatorThrottle = new ProviderRequestThrottle(
  workerEnv.MILESTONE_COORDINATOR_MIN_INTERVAL_MS
);
const whatsAppConnectionAlertProcessor = new WhatsAppConnectionAlertProcessor(
  createPrismaWhatsAppConnectionAlertStore(prisma),
  createResendEmailSender({ apiKey: workerEnv.RESEND_API_KEY }),
  {
    appUrl: workerEnv.APP_URL,
    fromEmail: workerEnv.RESEND_FROM_EMAIL,
    logger
  }
);
const workerName = process.env.WORKER_NAME ?? "fieldos-worker";
const workerVersion =
  process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.npm_package_version ?? "0.0.0";

redis.on("error", (error: Error) => {
  logger.warn({ error }, "redis connection error");
});

let heartbeat: NodeJS.Timeout | undefined;
let processingTimer: NodeJS.Timeout | undefined;
let processingFailureCount = 0;
let shuttingDown = false;

async function start() {
  await heartbeatWorker(prisma, {
    status: "STARTING",
    version: workerVersion,
    workerName
  });
  const recoveredJobs = await recoverStaleProcessingJobs(prisma);

  if (recoveredJobs > 0) {
    logger.warn({ recoveredJobs }, "requeued jobs left running by a previous worker");
  }

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
  const voiceProcessed = await processJobsOfType("VOICE_TRANSCRIPTION", processVoiceJob);
  const photoProcessed = await processJobsOfType("PHOTO_ANALYSIS", processPhotoJob, {
    limit: workerEnv.AI_PROVIDER_JOBS_PER_POLL
  });
  const reportProcessed = await processJobsOfType("REPORT_GENERATION", processReportJob);
  const coordinatorProcessed = await processJobsOfType(
    "PROJECT_COORDINATOR",
    processCoordinatorJob
  );
  const milestoneCoordinatorProcessed = await processJobsOfType(
    "PROJECT_COORDINATOR_MILESTONE",
    processMilestoneCoordinatorJob
  );
  const draftSendProcessed = await processJobsOfType(
    "WHATSAPP_DRAFT_SEND",
    processWhatsAppDraftSendJob
  );
  const searchProcessed = await processJobsOfType("SEARCH_INDEX", processSearchJob);
  const connectionAlertProcessed = await processJobsOfType(
    "WHATSAPP_CONNECTION_ALERT",
    processWhatsAppConnectionAlertJob
  );
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
    milestoneCoordinatorProcessed +
    draftSendProcessed +
    connectionAlertProcessed;

  if (processed > 0) {
    logger.info(
      {
        aiProcessed,
        connectionAlertProcessed,
        coordinatorProcessed,
        draftSendProcessed,
        milestoneCoordinatorProcessed,
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
    | "PROJECT_COORDINATOR_MILESTONE"
    | "REPORT_GENERATION"
    | "SEARCH_INDEX"
    | "WHATSAPP_CONNECTION_ALERT"
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
      const providerRetryAfterMs =
        error.retryAfterMs && error.retryAfterMs > 0
          ? error.retryAfterMs
          : workerEnv.AI_PROVIDER_RATE_LIMIT_RETRY_MS;
      const retryAfterMs = Math.min(
        providerRetryAfterMs * 2 ** Math.max(job.attempts - 1, 0),
        maxAIProviderRetryMs
      );
      const throttle =
        job.type === "PROJECT_COORDINATOR_MILESTONE"
          ? milestoneCoordinatorThrottle
          : aiProviderThrottle;
      throttle.defer(retryAfterMs);
      await deferProcessingJob(prisma, {
        errorMessage: error.message,
        job,
        minimumMaxAttempts: Math.max(workerEnv.AI_PROVIDER_MAX_ATTEMPTS, job.attempts + 1),
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

    if (job.type === "WHATSAPP_CONNECTION_ALERT") {
      const errorMessage =
        error instanceof Error ? error.message : "WhatsApp connection alert failed.";
      const retryAfterMs = Math.min(60_000 * 2 ** Math.max(job.attempts - 1, 0), 15 * 60_000);
      await deferProcessingJob(prisma, {
        errorMessage,
        job,
        retryAfterMs
      });
      logger.warn(
        {
          accountId: job.sourceId,
          correlationId: job.correlationId,
          jobId: job.id,
          organizationId: job.organizationId,
          retryAfterMs
        },
        "WhatsApp connection alert deferred after delivery failure"
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

async function processWhatsAppConnectionAlertJob(job: ProcessingJob): Promise<void> {
  const alertType =
    job.sourceType === "WHATSAPP_DISCONNECT_ALERT"
      ? "DISCONNECT"
      : job.sourceType === "WHATSAPP_RECOVERY_ALERT"
        ? "RECOVERY"
        : null;

  if (!alertType) {
    throw new Error(`Unsupported WhatsApp connection alert source: ${job.sourceType}`);
  }

  await whatsAppConnectionAlertProcessor.process({
    accountId: job.sourceId,
    alertType
  });
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
        analysisVersion: "2.0",
        claimAssessment: result.claimAssessment,
        confidence: result.confidence,
        conversationId: attachment.conversationId,
        detectedObjects: result.detectedObjects,
        evidenceId: attachment.id,
        messageId: attachment.messageId,
        limitations: result.limitations,
        observations: result.observations,
        operationalConclusion: result.operationalConclusion,
        organizationId: attachment.message.conversation.organizationId,
        possibleIssues: result.possibleIssues,
        projectId: attachment.message.conversation.projectId,
        provider: workerEnv.VISION_MODEL,
        promptVersion: "photo-analysis.v2",
        senderClaim: result.senderClaim,
        summary: result.summary,
        tags: result.tags
      },
      update: {
        analysisVersion: "2.0",
        claimAssessment: result.claimAssessment,
        confidence: result.confidence,
        detectedObjects: result.detectedObjects,
        limitations: result.limitations,
        observations: result.observations,
        operationalConclusion: result.operationalConclusion,
        possibleIssues: result.possibleIssues,
        projectId: attachment.message.conversation.projectId,
        provider: workerEnv.VISION_MODEL,
        promptVersion: "photo-analysis.v2",
        senderClaim: result.senderClaim,
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
      await queueProjectCoordinatorJobs(tx, {
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
    await queueProjectCoordinatorJobs(prisma, {
      organizationId: classification.organizationId,
      projectId: classification.projectId,
      sourceId: classification.projectId
    });
  }
}

async function processCoordinatorJob(job: ProcessingJob): Promise<void> {
  await coordinatorRuntime.runLightweightCoordinators(job.sourceId);
}

async function processMilestoneCoordinatorJob(job: ProcessingJob): Promise<void> {
  await milestoneCoordinatorThrottle.wait();
  await coordinatorRuntime.runMilestoneCoordinator(job.sourceId);
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

    const artifact = buildReportArtifact(report.type, context);
    const markdown = artifact.markdown;
    const pdf = reportMarkdownToPdfBuffer(markdown);
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
          content: JSON.parse(JSON.stringify(artifact.content)),
          contentHash,
          errorMessage: null,
          generatedAt: new Date(),
          markdown,
          pdfStorageKey,
          status: "COMPLETED",
          title: artifact.title
        },
        where: {
          id: report.id
        }
      });

      const event = await tx.event.create({
        data: {
          description: `Generated ${artifact.title}.`,
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
      await queueProjectCoordinatorJobs(tx, {
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

function buildReportArtifact(
  type: ProjectReportType,
  context: ProjectIntelligenceContext
): { content: unknown; markdown: string; title: string } {
  if (type === "MORNING_BRIEF") {
    const content = projectIntelligenceService.generateMorningBrief(context);
    return {
      content,
      markdown: morningBriefToMarkdown(content),
      title: content.title
    };
  }

  if (type === "DAILY_SUMMARY") {
    const content = projectIntelligenceService.generateDailySummary(context);
    return {
      content,
      markdown: dailySummaryToMarkdown(content, context.generatedAt),
      title: content.title
    };
  }

  if (type === "RISK_SUMMARY") {
    const title = `${context.project.name} Risk Summary`;
    const risks = projectIntelligenceService.generateRiskSummary(context);
    const content = { generatedAt: context.generatedAt, project: context.project, risks, title };
    return {
      content,
      markdown: riskSummaryToMarkdown({ generatedAt: context.generatedAt, risks, title }),
      title
    };
  }

  if (type === "PENDING_DECISIONS") {
    const title = `${context.project.name} Pending Decisions`;
    const decisions = projectIntelligenceService.generatePendingDecisions(context);
    const content = {
      generatedAt: context.generatedAt,
      pendingDecisions: decisions,
      project: context.project,
      title
    };
    return {
      content,
      markdown: pendingDecisionsToMarkdown({
        decisions,
        generatedAt: context.generatedAt,
        title
      }),
      title
    };
  }

  const content = projectIntelligenceService.generateWeeklyReport(context);
  return {
    content,
    markdown: weeklyReportToMarkdown(content),
    title: content.title
  };
}

function buildPhotoAnalysisEventDescription(result: VisionResult): string {
  return [
    `Visual Summary: ${result.summary}`,
    result.observations.length > 0
      ? `Visible observations: ${result.observations.join(", ")}`
      : "Visible observations: Unable to determine.",
    result.detectedObjects.length > 0
      ? `Detected: ${result.detectedObjects.join(", ")}`
      : "Detected: Unable to determine.",
    result.possibleIssues.length > 0
      ? `Possible Issue: ${result.possibleIssues.join(", ")}`
      : "Possible Issue: None obvious. Needs Review.",
    `Operational conclusion: ${result.operationalConclusion === "NO_OPERATIONAL_CONCLUSION" ? "No operational conclusion" : "Human verification recommended"}`,
    result.limitations.length > 0 ? `Limitations: ${result.limitations.join(" ")}` : "",
    `Confidence: ${formatVisionConfidence(result.confidence)}`
  ]
    .filter(Boolean)
    .join("\n");
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
