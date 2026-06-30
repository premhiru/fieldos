import { z } from "zod";

export const nodeEnvSchema = z.enum(["development", "test", "production"]).default("development");

export type NodeEnv = z.infer<typeof nodeEnvSchema>;

export function createEnv<TSchema extends z.ZodRawShape>(
  schema: z.ZodObject<TSchema>,
  source: NodeJS.ProcessEnv = process.env
): z.infer<z.ZodObject<TSchema>> {
  const parsed = schema.safeParse(source);

  if (!parsed.success) {
    const details = z.prettifyError(parsed.error);
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return parsed.data;
}
