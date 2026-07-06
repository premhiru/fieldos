import { z } from "zod";

export const aiMessageCategorySchema = z.enum([
  "PROGRESS_UPDATE",
  "DEFECT",
  "DELAY",
  "SAFETY_ISSUE",
  "DELIVERY",
  "INSPECTION_REQUEST",
  "CLIENT_APPROVAL",
  "VARIATION_ORDER",
  "RFI",
  "MATERIAL_ISSUE",
  "MANPOWER_ISSUE",
  "GENERAL_NOTE",
  "UNKNOWN"
]);

export const classificationStatusSchema = z.enum([
  "PENDING",
  "COMPLETED",
  "FAILED",
  "NEEDS_REVIEW"
]);

export const classifiableMessageTypeSchema = z.enum([
  "TEXT",
  "IMAGE",
  "DOCUMENT",
  "VOICE",
  "VIDEO",
  "SYSTEM"
]);

export const classifyMessageInputSchema = z.object({
  conversationTitle: z.string().trim().min(1),
  messageBody: z.string().nullable(),
  messageId: z.string().trim().min(1),
  messageType: classifiableMessageTypeSchema,
  occurredAt: z.coerce.date(),
  organizationId: z.string().trim().min(1),
  projectId: z.string().trim().min(1).nullable(),
  senderName: z.string().trim().min(1)
});

export const classifyMessageResultSchema = z.object({
  category: aiMessageCategorySchema,
  actionRequired: z.boolean(),
  confidence: z.number().min(0).max(1),
  location: z.string().trim().min(1).max(160).nullable(),
  reasoningSummary: z.string().trim().min(1).max(500).nullable(),
  summary: z.string().trim().min(1).max(500)
});

export type AIMessageCategory = z.infer<typeof aiMessageCategorySchema>;
export type ClassificationStatus = z.infer<typeof classificationStatusSchema>;
export type ClassifyMessageInput = z.infer<typeof classifyMessageInputSchema>;
export type ClassifyMessageResult = z.infer<typeof classifyMessageResultSchema>;

export const searchAnswerSourceSchema = z.object({
  occurredAt: z.string().nullable(),
  projectName: z.string().nullable(),
  snippet: z.string().trim().min(1),
  sourceId: z.string().trim().min(1),
  sourceType: z.string().trim().min(1),
  title: z.string().trim().min(1)
});

export const searchAnswerInputSchema = z.object({
  question: z.string().trim().min(1).max(500),
  sources: z.array(searchAnswerSourceSchema).max(12)
});

export const searchAnswerResultSchema = z.object({
  answer: z.string().trim().min(1).max(1200),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  sourceIds: z.array(z.string().trim().min(1)).max(12)
});

export type SearchAnswerSource = z.infer<typeof searchAnswerSourceSchema>;
export type SearchAnswerInput = z.infer<typeof searchAnswerInputSchema>;
export type SearchAnswerResult = z.infer<typeof searchAnswerResultSchema>;

export interface AIProvider {
  completeJson(input: {
    model: string;
    messages: Array<{ role: "system" | "user"; content: string }>;
  }): Promise<unknown>;
}
