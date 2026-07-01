import { createEnv, nodeEnvSchema } from "@fieldos/shared";
import { z } from "zod";

export const workerEnv = createEnv(
  z.object({
    NODE_ENV: nodeEnvSchema,
    WHATSAPP_SESSION_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(10_000),
    WHATSAPP_STORAGE_PATH: z.string().default(".storage"),
    REDIS_URL: z.string().url().default("redis://localhost:6379")
  })
);
