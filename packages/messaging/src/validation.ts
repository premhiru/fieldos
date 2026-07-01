import { z } from "zod";

export const channelSchema = z.enum(["WHATSAPP", "EMAIL", "SLACK", "TEAMS", "SMS"]);
export const messageDirectionSchema = z.enum(["INBOUND", "OUTBOUND"]);
export const messageTypeSchema = z.enum(["TEXT", "IMAGE", "DOCUMENT", "VOICE", "VIDEO", "SYSTEM"]);

const nullableStringSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .optional()
  .nullable()
  .transform((value) => value ?? null);

export const createConversationSchema = z.object({
  channel: channelSchema,
  externalId: z.string().trim().min(1).max(240),
  isGroup: z.boolean().default(false),
  lastMessageAt: z.coerce.date().optional().nullable().default(null),
  organizationId: z.string().trim().min(1),
  projectId: z.string().trim().min(1).optional().nullable().default(null),
  title: z.string().trim().min(1).max(240)
});

export const createParticipantSchema = z.object({
  conversationId: z.string().trim().min(1),
  displayName: z.string().trim().min(1).max(160),
  externalIdentifier: z.string().trim().min(1).max(240),
  role: z.string().trim().min(1).max(80)
});

export const createMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .max(10_000)
    .optional()
    .nullable()
    .transform((value) => value ?? null),
  conversationId: z.string().trim().min(1),
  direction: messageDirectionSchema,
  externalMessageId: nullableStringSchema,
  occurredAt: z.coerce.date(),
  senderParticipantId: z.string().trim().min(1),
  type: messageTypeSchema
});

export const createAttachmentSchema = z.object({
  filename: z.string().trim().min(1).max(240),
  messageId: z.string().trim().min(1),
  mimeType: z.string().trim().min(1).max(160),
  size: z.number().int().nonnegative(),
  storageKey: z.string().trim().min(1).max(500)
});

export const listConversationsSchema = z.object({
  organizationId: z.string().trim().min(1),
  search: z.string().trim().max(200).optional().default("")
});
