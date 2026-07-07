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

const evidenceAttachmentMetadataSchema = z.object({
  createdAt: z.coerce.date(),
  filename: z.string().trim().min(1),
  id: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  size: z.number().int().min(0),
  storageKey: z.string().trim().min(1)
});

const evidenceVoiceNoteMetadataSchema = evidenceAttachmentMetadataSchema.extend({
  transcript: z.string().nullable(),
  transcriptionError: z.string().nullable(),
  transcriptionStatus: z.enum(["NOT_REQUIRED", "PENDING", "COMPLETED", "FAILED"])
});

export const classifyMessageInputSchema = z.object({
  attachedDocuments: z.array(evidenceAttachmentMetadataSchema),
  attachedPhotos: z.array(evidenceAttachmentMetadataSchema),
  attachedVideos: z.array(evidenceAttachmentMetadataSchema),
  attachedVoiceNotes: z.array(evidenceVoiceNoteMetadataSchema),
  conversation: z.object({
    channel: z.enum(["WHATSAPP", "EMAIL", "SLACK", "TEAMS", "SMS"]),
    id: z.string().trim().min(1),
    isGroup: z.boolean(),
    title: z.string().trim().min(1)
  }),
  evidenceSummary: z.object({
    attachmentCount: z.number().int().min(0),
    documentCount: z.number().int().min(0),
    labels: z.array(z.string()),
    pdfCount: z.number().int().min(0),
    photoCount: z.number().int().min(0),
    videoCount: z.number().int().min(0),
    voiceNoteCount: z.number().int().min(0)
  }),
  externalMessageId: z.string().nullable(),
  messageId: z.string().trim().min(1),
  messageMetadata: z.object({
    attachmentCount: z.number().int().min(0),
    hasTranscript: z.boolean(),
    transcriptionFailed: z.boolean(),
    transcriptionPending: z.boolean()
  }),
  messageText: z.string().nullable(),
  messageType: classifiableMessageTypeSchema,
  organizationId: z.string().trim().min(1),
  processingStatus: z.string(),
  project: z
    .object({
      code: z.string(),
      id: z.string().trim().min(1),
      name: z.string().trim().min(1),
      status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"])
    })
    .nullable(),
  sender: z.object({
    displayName: z.string().trim().min(1),
    externalIdentifier: z.string().trim().min(1),
    id: z.string().trim().min(1)
  }),
  timestamp: z.coerce.date(),
  voiceTranscript: z.string().nullable()
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
