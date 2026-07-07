import { Redis } from "ioredis";
import { AIClassificationProcessor, MessageClassifier } from "@fieldos/ai";
import { BaileysWhatsAppSessionManager, RedisWhatsAppQrStore } from "@fieldos/baileys-whatsapp";
import {
  claimNextProcessingJob,
  heartbeatWorker,
  markProcessingJobComplete,
  markProcessingJobFailed,
  prisma,
  processSearchIndexJob,
  type ProcessingJob
} from "@fieldos/db";

import { createLogger } from "@fieldos/shared";

import { workerEnv } from "./env.js";

const logger = createLogger("fieldos-worker");
const redis = new Redis(workerEnv.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3
});
const whatsappSessionManager = new BaileysWhatsAppSessionManager(
  prisma,
  new RedisWhatsAppQrStore(redis),
  {
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
  const searchProcessed = await processJobsOfType("SEARCH_INDEX", processSearchJob);
  const aiProcessed = await processJobsOfType("AI_CLASSIFICATION", processAIJob);
  const processed = searchProcessed + aiProcessed;

  if (processed > 0) {
    logger.info({ aiProcessed, processed, searchProcessed }, "background jobs processed");
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
  type: "AI_CLASSIFICATION" | "SEARCH_INDEX",
  processor: (job: ProcessingJob) => Promise<void>
): Promise<number> {
  let processed = 0;

  for (let index = 0; index < 10; index += 1) {
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

async function processAIJob(job: ProcessingJob): Promise<void> {
  await aiClassificationProcessor.processClassification(job.sourceId);
  const classification = await prisma.aIMessageClassification.findUnique({
    select: {
      errorMessage: true,
      status: true
    },
    where: {
      id: job.sourceId
    }
  });

  if (classification?.status === "FAILED") {
    throw new Error(classification.errorMessage ?? "AI classification failed.");
  }
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
