import { Redis } from "ioredis";
import { AIClassificationProcessor, MessageClassifier } from "@fieldos/ai";
import { BaileysWhatsAppSessionManager, RedisWhatsAppQrStore } from "@fieldos/baileys-whatsapp";
import { prisma } from "@fieldos/db";

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

redis.on("error", (error: Error) => {
  logger.warn({ error }, "redis connection error");
});

let heartbeat: NodeJS.Timeout | undefined;
let aiClassificationTimer: NodeJS.Timeout | undefined;
let aiClassificationFailureCount = 0;
let shuttingDown = false;

async function start() {
  await redis.connect();
  await redis.ping();
  await whatsappSessionManager.start();
  await processAIClassifications();

  logger.info("worker started and waiting for jobs");

  heartbeat = setInterval(() => {
    logger.debug("worker heartbeat");
  }, 30_000);

  scheduleAIClassificationProcessing();
}

async function processAIClassifications(): Promise<void> {
  const processed = await aiClassificationProcessor.processPending();

  if (processed > 0) {
    logger.info({ processed }, "AI classifications processed");
  }
}

function scheduleAIClassificationProcessing(
  delayMs = workerEnv.AI_CLASSIFICATION_POLL_INTERVAL_MS
) {
  if (shuttingDown) {
    return;
  }

  aiClassificationTimer = setTimeout(async () => {
    try {
      await processAIClassifications();
      aiClassificationFailureCount = 0;
      scheduleAIClassificationProcessing();
    } catch (error: unknown) {
      aiClassificationFailureCount += 1;
      const retryDelayMs = Math.min(
        workerEnv.AI_CLASSIFICATION_POLL_INTERVAL_MS * 2 ** aiClassificationFailureCount,
        60_000
      );
      logger.error(
        { error, job: "ai-classification", retryDelayMs },
        "AI classification processing failed"
      );
      scheduleAIClassificationProcessing(retryDelayMs);
    }
  }, delayMs);
}

async function shutdown(signal: NodeJS.Signals) {
  shuttingDown = true;
  logger.info({ signal }, "shutting down worker");

  if (heartbeat) {
    clearInterval(heartbeat);
  }

  if (aiClassificationTimer) {
    clearTimeout(aiClassificationTimer);
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
