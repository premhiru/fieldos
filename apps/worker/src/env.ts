import { createEnv, nodeEnvSchema } from "@fieldos/shared";
import { z } from "zod";

export const workerEnv = createEnv(
  z.object({
    AI_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
    AI_CLASSIFICATION_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(15_000),
    AI_MODEL: z.string().trim().min(1).default("openrouter/free"),
    NODE_ENV: nodeEnvSchema,
    OPENROUTER_API_KEY: z.string().trim().optional(),
    OPENAI_API_KEY: z.string().trim().optional(),
    VOICE_TRANSCRIPTION_MODEL: z.string().trim().min(1).default("whisper-1"),
    WHATSAPP_SESSION_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(10_000),
    WHATSAPP_STORAGE_PATH: z.string().default(".storage"),
    REDIS_URL: z.string().url().default("redis://localhost:6379")
  })
);
