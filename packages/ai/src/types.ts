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

const numericConfidenceSchema = z.preprocess((value) => {
  if (typeof value !== "string" || value.trim() === "") {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}, z.number().min(0).max(1));

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
    externalIdentifier: z.string().trim(),
    id: z.string().trim().min(1)
  }),
  timestamp: z.coerce.date(),
  voiceTranscript: z.string().nullable()
});

export const classifyMessageResultSchema = z.object({
  category: aiMessageCategorySchema,
  actionRequired: z.boolean(),
  confidence: numericConfidenceSchema,
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

export const visionRequestSchema = z.object({
  context: z.object({
    conversationTitle: z.string().trim().min(1).nullable(),
    messageText: z.string().trim().min(1).nullable(),
    projectName: z.string().trim().min(1).nullable()
  }),
  image: z.object({
    base64: z.string().trim().min(1),
    filename: z.string().trim().min(1),
    mimeType: z.string().trim().min(1)
  })
});

export const visionResultSchema = z.object({
  confidence: numericConfidenceSchema,
  detectedObjects: z.array(z.string().trim().min(1).max(80)).max(20),
  possibleIssues: z.array(z.string().trim().min(1).max(160)).max(10),
  summary: z.string().trim().min(1).max(800),
  tags: z.array(z.string().trim().min(1).max(80)).max(20)
});

export type VisionRequest = z.infer<typeof visionRequestSchema>;
export type VisionResult = z.infer<typeof visionResultSchema>;

export interface AIProvider {
  completeJson(input: {
    model: string;
    messages: Array<{ role: "system" | "user"; content: string }>;
  }): Promise<unknown>;
}

export const milestoneDetectionActionSchema = z.enum([
  "CREATE",
  "UPDATE",
  "COMPLETE",
  "START",
  "DELAY",
  "NONE"
]);

export const milestoneDetectionChangeSchema = z.object({
  action: milestoneDetectionActionSchema,
  actualEndDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  actualStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  description: z.string().trim().min(1).max(500).nullable(),
  hasMilestoneChange: z.boolean(),
  milestoneTitle: z.string().trim().min(1).max(160),
  originalDatePhrase: z.string().trim().min(1).max(80).nullable(),
  plannedEndDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  plannedStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  reason: z.string().trim().min(1).max(500),
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "DELAYED", "CANCELLED"]).nullable()
});

export const milestoneDetectionInputSchema = z.object({
  existingMilestones: z.array(
    z.object({
      id: z.string().trim().min(1),
      plannedEndDate: z.string().nullable(),
      plannedStartDate: z.string().nullable(),
      status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "DELAYED", "CANCELLED"]),
      title: z.string().trim().min(1)
    })
  ),
  messageText: z.string().nullable(),
  occurredAt: z.coerce.date(),
  project: z.object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    timezone: z.string().trim().min(1)
  }),
  projectState: z
    .object({
      nextMilestone: z.string().nullable(),
      pendingDecisionSummary: z.string().nullable(),
      recentProgressSummary: z.string().nullable()
    })
    .nullable(),
  recentTimelineEvents: z.array(
    z.object({
      description: z.string().nullable(),
      occurredAt: z.coerce.date(),
      title: z.string().trim().min(1)
    })
  ),
  relativeDateHints: z.record(z.string(), z.string().nullable()),
  sender: z.string().trim().min(1),
  voiceTranscript: z.string().nullable()
});

export const milestoneDetectionResultSchema = z.object({
  changes: z.array(milestoneDetectionChangeSchema).max(5)
});

export type MilestoneDetectionAction = z.infer<typeof milestoneDetectionActionSchema>;
export type MilestoneDetectionChange = z.infer<typeof milestoneDetectionChangeSchema>;
export type MilestoneDetectionInput = z.infer<typeof milestoneDetectionInputSchema>;
export type MilestoneDetectionResult = z.infer<typeof milestoneDetectionResultSchema>;

export interface VisionProvider {
  analyze(input: VisionRequest): Promise<VisionResult>;
}
