import { createEnv, nodeEnvSchema } from "@fieldos/shared";
import { z } from "zod";

export const workerEnv = createEnv(
  z.object({
    NODE_ENV: nodeEnvSchema,
    REDIS_URL: z.string().url().default("redis://localhost:6379")
  })
);
