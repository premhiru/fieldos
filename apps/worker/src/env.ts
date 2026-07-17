import { createEnv, nodeEnvSchema, storageEnvironmentSchema } from "@fieldos/shared";
import { z } from "zod";

export const workerEnv = createEnv(
  z
    .object({
      AI_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
      AI_CLASSIFICATION_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(15_000),
      AI_MODEL: z.string().trim().min(1).default("openrouter/free"),
      AI_PROVIDER_JOBS_PER_POLL: z.coerce.number().int().positive().default(1),
      AI_PROVIDER_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),
      AI_PROVIDER_MIN_INTERVAL_MS: z.coerce.number().int().positive().default(12_000),
      AI_PROVIDER_RATE_LIMIT_RETRY_MS: z.coerce.number().int().positive().default(60_000),
      KIMI_API_KEY: z.string().trim().optional(),
      KIMI_BASE_URL: z.string().url().default("https://api.moonshot.ai/v1"),
      KIMI_MODEL: z.string().trim().min(1).default("kimi-k2.6"),
      KIMI_VISION_MODEL: z.string().trim().min(1).default("kimi-k2.6"),
      MEDIA_SIGNING_SECRET: z.string().trim().min(16).default("local-media-signing-secret"),
      MILESTONE_COORDINATOR_MIN_INTERVAL_MS: z.coerce.number().int().positive().default(12_000),
      NODE_ENV: nodeEnvSchema,
      OPENROUTER_API_KEY: z.string().trim().optional(),
      OPENAI_API_KEY: z.string().trim().optional(),
      APP_URL: z.string().url().default("http://localhost:3000"),
      RESEND_API_KEY: z.string().trim().optional(),
      RESEND_FROM_EMAIL: z.string().trim().min(1).optional(),
      VISION_MODEL: z.string().trim().min(1).default("openrouter/free"),
      VOICE_TRANSCRIPTION_MODEL: z.string().trim().min(1).default("whisper-1"),
      WHATSAPP_SESSION_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(10_000),
      WHATSAPP_STORAGE_PATH: z.string().default(".storage"),
      REDIS_URL: z.string().url().default("redis://localhost:6379")
    })
    .and(storageEnvironmentSchema)
);
