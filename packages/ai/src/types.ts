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

  const normalized = value.trim();
  const confidenceLabels: Record<string, number> = {
    HIGH: 0.9,
    LOW: 0.3,
    MEDIUM: 0.6
  };
  const labelledConfidence = confidenceLabels[normalized.toUpperCase()];

  if (labelledConfidence !== undefined) {
    return labelledConfidence;
  }

  const percentageMatch = /^(\d+(?:\.\d+)?)%$/.exec(normalized);
  const parsed = percentageMatch ? Number(percentageMatch[1]) / 100 : Number(normalized);
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

export const messageRelevanceSchema = z.enum(["OPERATIONAL", "NON_OPERATIONAL", "AMBIGUOUS"]);
export const operationalImpactSchema = z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const responseExpectationTypeSchema = z.enum([
  "NONE",
  "QUESTION",
  "COMMITMENT",
  "DOCUMENT",
  "PHOTO",
  "APPROVAL",
  "DECISION",
  "DELIVERY_UPDATE",
  "INSPECTION_RESULT"
]);
export const responseExpectationStatusSchema = z.enum(["NONE", "OPEN", "RESOLVED", "UNCLEAR"]);
export const completionClaimSchema = z.enum(["NONE", "PARTIAL", "CLAIMED", "AMBIGUOUS"]);
export const inspectionReadinessSchema = z.enum([
  "NONE",
  "NOT_READY",
  "READY_CLAIMED",
  "REQUESTED",
  "AMBIGUOUS"
]);

export const classifyMessageV2InputSchema = classifyMessageInputSchema.extend({
  activeMilestones: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        plannedEndDate: z.string().nullable(),
        status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "DELAYED", "CANCELLED"]),
        title: z.string().trim().min(1)
      })
    )
    .max(10),
  openActionItems: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        status: z.string().trim().min(1),
        title: z.string().trim().min(1)
      })
    )
    .max(10),
  projectState: z
    .object({
      health: z.string(),
      nextMilestone: z.string().nullable(),
      pendingDecisionSummary: z.string().nullable(),
      recentBlockerSummary: z.string().nullable(),
      recentProgressSummary: z.string().nullable()
    })
    .nullable(),
  recentMessages: z
    .array(
      z.object({
        body: z.string().nullable(),
        direction: z.enum(["INBOUND", "OUTBOUND"]),
        id: z.string().trim().min(1),
        occurredAt: z.coerce.date(),
        senderName: z.string().trim().min(1)
      })
    )
    .max(8),
  recentTimelineEvents: z
    .array(
      z.object({
        description: z.string().nullable(),
        eventType: z.string().trim().min(1),
        id: z.string().trim().min(1),
        occurredAt: z.coerce.date(),
        title: z.string().trim().min(1)
      })
    )
    .max(10)
});

export const classifyMessageV2ResultSchema = z
  .object({
    abstentionReason: z.string().trim().min(1).max(300).nullable(),
    completionClaim: completionClaimSchema,
    confidence: numericConfidenceSchema,
    inspectionReadiness: inspectionReadinessSchema,
    location: z.string().trim().min(1).max(160).nullable(),
    operationalImpact: operationalImpactSchema,
    primaryCategory: aiMessageCategorySchema,
    recommendationEligible: z.boolean(),
    relevance: messageRelevanceSchema,
    responseExpectation: z.object({
      dueAt: z.string().datetime().nullable(),
      evidence: z.string().trim().min(1).max(300).nullable(),
      expectedResponder: z.string().trim().min(1).max(120).nullable(),
      requestedItem: z.string().trim().min(1).max(200).nullable(),
      status: responseExpectationStatusSchema,
      type: responseExpectationTypeSchema
    }),
    secondarySignals: z.array(aiMessageCategorySchema).max(5),
    summary: z.string().trim().min(1).max(500),
    uncertainty: z.string().trim().min(1).max(300).nullable(),
    userFacingReason: z.string().trim().min(1).max(300)
  })
  .superRefine((value, context) => {
    if (value.relevance !== "OPERATIONAL" && value.recommendationEligible) {
      context.addIssue({
        code: "custom",
        message: "Only operational evidence can be recommendation eligible.",
        path: ["recommendationEligible"]
      });
    }
    if (value.recommendationEligible && value.confidence < 0.75) {
      context.addIssue({
        code: "custom",
        message: "Recommendation eligibility requires confidence of at least 0.75.",
        path: ["confidence"]
      });
    }
    if (!value.recommendationEligible && !value.abstentionReason) {
      context.addIssue({
        code: "custom",
        message: "Abstaining classifications must explain why.",
        path: ["abstentionReason"]
      });
    }
  });

export type ClassifyMessageV2Input = z.infer<typeof classifyMessageV2InputSchema>;
export type ClassifyMessageV2Result = z.infer<typeof classifyMessageV2ResultSchema>;

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
  claimAssessment: z
    .enum(["NOT_ASSESSED", "SUPPORTED", "NOT_SUPPORTED", "INCONCLUSIVE"])
    .default("NOT_ASSESSED"),
  confidence: numericConfidenceSchema,
  detectedObjects: z.array(z.string().trim().min(1).max(80)).max(20),
  limitations: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  observations: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  operationalConclusion: z
    .enum(["NO_OPERATIONAL_CONCLUSION", "HUMAN_VERIFICATION_RECOMMENDED"])
    .default("NO_OPERATIONAL_CONCLUSION"),
  possibleIssues: z.array(z.string().trim().min(1).max(160)).max(10),
  senderClaim: z.string().trim().min(1).max(300).nullable().default(null),
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

export const milestoneDetectionChangeSchema = z
  .object({
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
    milestoneTitle: z.string().trim().min(1).max(160).nullable(),
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
  })
  .superRefine((value, context) => {
    if (value.action === "NONE" && value.hasMilestoneChange) {
      context.addIssue({
        code: "custom",
        message: "NONE cannot declare a milestone change.",
        path: ["hasMilestoneChange"]
      });
    }
    if (value.action !== "NONE" && !value.milestoneTitle) {
      context.addIssue({
        code: "custom",
        message: "Actionable milestone changes require a title.",
        path: ["milestoneTitle"]
      });
    }
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
