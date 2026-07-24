import {
  createEnv,
  DEFAULT_API_PORT,
  nodeEnvSchema,
  storageEnvironmentSchema
} from "@fieldos/shared";
import { z } from "zod";

const disabledFeatureFlagSchema = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

export const apiEnv = createEnv(
  z
    .object({
      CORS_ORIGIN: z.string().url().default("http://localhost:3000"),
      CRON_SECRET: z.string().trim().min(16),
      DATABASE_URL: z.string().min(1),
      EMAIL_FROM: z.string().trim().min(3).optional(),
      JWT_SECRET: z.string().min(16),
      MEDIA_SIGNING_SECRET: z.string().trim().min(16).optional(),
      NODE_ENV: nodeEnvSchema,
      PORT: z.coerce.number().int().positive().default(DEFAULT_API_PORT),
      REDIS_URL: z.string().url().default("redis://localhost:6379"),
      RESEND_API_KEY: z.string().trim().min(1).optional(),
      WEB_APP_URL: z.string().url().default("http://localhost:3000"),
      WHATSAPP_STORAGE_PATH: z.string().default(".storage"),
      WHATSAPP_RECOMMENDATION_DELIVERY_ENABLED: disabledFeatureFlagSchema,
      WHATSAPP_RECOMMENDATION_REPLY_ENABLED: disabledFeatureFlagSchema,
      WHATSAPP_PARTICIPANT_SYNC_ENABLED: disabledFeatureFlagSchema,
      WHATSAPP_INVITATIONS_ENABLED: disabledFeatureFlagSchema
    })
    .and(storageEnvironmentSchema)
);
