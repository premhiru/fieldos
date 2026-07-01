import { createEnv, DEFAULT_API_PORT, nodeEnvSchema } from "@fieldos/shared";
import { z } from "zod";

export const apiEnv = createEnv(
  z.object({
    CORS_ORIGIN: z.string().url().default("http://localhost:3000"),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(16),
    NODE_ENV: nodeEnvSchema,
    PORT: z.coerce.number().int().positive().default(DEFAULT_API_PORT),
    REDIS_URL: z.string().url().default("redis://localhost:6379")
  })
);
