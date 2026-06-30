import { createEnv, DEFAULT_API_PORT, nodeEnvSchema } from "@fieldos/shared";
import { z } from "zod";

export const apiEnv = createEnv(
  z.object({
    DATABASE_URL: z.string().min(1),
    NODE_ENV: nodeEnvSchema,
    PORT: z.coerce.number().int().positive().default(DEFAULT_API_PORT)
  })
);
