import { Redis } from "ioredis";
import { AIClassificationProcessor } from "@fieldos/ai";
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
const aiClassificationProcessor = new AIClassificationProcessor(prisma);

redis.on("error", (error: Error) => {
  logger.warn({ error }, "redis connection error");
});

let heartbeat: NodeJS.Timeout | undefined;
let aiClassificationTimer: NodeJS.Timeout | undefined;

async function start() {
  await redis.connect();
  await redis.ping();
  await whatsappSessionManager.start();
  await processAIClassifications();

  logger.info("worker started and waiting for jobs");

  heartbeat = setInterval(() => {
    logger.debug("worker heartbeat");
  }, 30_000);

  aiClassificationTimer = setInterval(() => {
    processAIClassifications().catch((error: unknown) => {
      logger.error({ error }, "AI classification processing failed");
    });
  }, workerEnv.AI_CLASSIFICATION_POLL_INTERVAL_MS);
}

async function processAIClassifications(): Promise<void> {
  const processed = await aiClassificationProcessor.processPending();

  if (processed > 0) {
    logger.info({ processed }, "AI classifications processed");
  }
}

async function shutdown(signal: NodeJS.Signals) {
  logger.info({ signal }, "shutting down worker");

  if (heartbeat) {
    clearInterval(heartbeat);
  }

  if (aiClassificationTimer) {
    clearInterval(aiClassificationTimer);
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
