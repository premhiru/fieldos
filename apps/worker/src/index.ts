import { Redis } from "ioredis";

import { createLogger } from "@fieldos/shared";

import { workerEnv } from "./env.js";

const logger = createLogger("fieldos-worker");
const redis = new Redis(workerEnv.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3
});

redis.on("error", (error: Error) => {
  logger.warn({ error }, "redis connection error");
});

let heartbeat: NodeJS.Timeout | undefined;

async function start() {
  await redis.connect();
  await redis.ping();

  logger.info("worker started and waiting for jobs");

  heartbeat = setInterval(() => {
    logger.debug("worker heartbeat");
  }, 30_000);
}

async function shutdown(signal: NodeJS.Signals) {
  logger.info({ signal }, "shutting down worker");

  if (heartbeat) {
    clearInterval(heartbeat);
  }

  await redis.quit();
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
