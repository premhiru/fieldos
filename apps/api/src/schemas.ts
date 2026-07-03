import { z } from "zod";

export const organizationParamsSchema = z.object({
  organizationId: z.string().min(1)
});

export const projectParamsSchema = z.object({
  projectId: z.string().min(1)
});

export const conversationParamsSchema = z.object({
  id: z.string().min(1)
});

export const messageParamsSchema = z.object({
  id: z.string().min(1)
});

export const suggestedTaskParamsSchema = z.object({
  id: z.string().min(1)
});

export const whatsappAccountParamsSchema = z.object({
  id: z.string().min(1)
});

export const whatsappChatMappingParamsSchema = z.object({
  id: z.string().min(1)
});

export const whatsappAccountsQuerySchema = z.object({
  organizationId: z.string().trim().min(1)
});

export const createWhatsAppAccountSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  organizationId: z.string().trim().min(1)
});

export const updateWhatsAppChatMappingSchema = z.object({
  projectId: z.string().trim().min(1).nullable()
});

export const activateWhatsAppChatMappingSchema = z.object({
  projectId: z.string().trim().min(1)
});

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens.")
});

export const createProjectSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9-]+$/, "Use uppercase letters, numbers, and hyphens."),
  name: z.string().trim().min(1).max(160),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).default("ACTIVE")
});
