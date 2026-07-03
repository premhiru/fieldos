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

export const aiPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

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
  confidence: z.number().min(0).max(1),
  location: z.string().trim().min(1).max(160).nullable(),
  priority: aiPrioritySchema,
  reasoningSummary: z.string().trim().min(1).max(500).nullable(),
  shouldCreateTask: z.boolean(),
  suggestedTaskDescription: z.string().trim().min(1).max(1000).nullable(),
  suggestedTaskTitle: z.string().trim().min(1).max(160).nullable(),
  summary: z.string().trim().min(1).max(500)
});

export type AIMessageCategory = z.infer<typeof aiMessageCategorySchema>;
export type AIPriority = z.infer<typeof aiPrioritySchema>;
export type ClassificationStatus = z.infer<typeof classificationStatusSchema>;
export type ClassifyMessageInput = z.infer<typeof classifyMessageInputSchema>;
export type ClassifyMessageResult = z.infer<typeof classifyMessageResultSchema>;

export interface AIProvider {
  completeJson(input: {
    model: string;
    messages: Array<{ role: "system" | "user"; content: string }>;
  }): Promise<unknown>;
}
