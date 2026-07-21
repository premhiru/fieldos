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
  "DECISION",
  "COMMITMENT",
  "QUESTION",
  "ACKNOWLEDGEMENT",
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
  messageDirection: z.enum(["INBOUND", "OUTBOUND"]),
  messageType: classifiableMessageTypeSchema,
  organizationId: z.string().trim().min(1),
  processingStatus: z.string(),
  project: z
    .object({
      code: z.string(),
      id: z.string().trim().min(1),
      name: z.string().trim().min(1),
      status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]),
      timezone: z.string().trim().min(1)
    })
    .nullable(),
  sender: z.object({
    displayName: z.string().trim().min(1),
    externalIdentifier: z.string().trim(),
    id: z.string().trim().min(1),
    role: z.string().trim().min(1)
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

export const factualClaimSchema = z.object({
  confidence: numericConfidenceSchema,
  statement: z.string().trim().min(1).max(300),
  status: z.enum(["ASSERTED", "TENTATIVE", "NEGATED"]),
  subject: z.string().trim().min(1).max(160).nullable(),
  type: z.string().trim().min(1).max(80)
});

const isoDateOrDateTimeSchema = z.union([z.iso.date(), z.iso.datetime()]);

export const referencedDateSchema = z.object({
  confidence: numericConfidenceSchema,
  phrase: z.string().trim().min(1).max(120),
  resolvedDate: isoDateOrDateTimeSchema.nullable()
});

export const classificationAmbiguitySchema = z.object({
  isAmbiguous: z.boolean(),
  missingContext: z.array(z.string().trim().min(1).max(160)).max(8)
});

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
  operatingContext: z.object({
    isWeekend: z.boolean(),
    localDateTime: z.string().trim().min(1),
    timezone: z.string().trim().min(1),
    weekday: z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])
  }),
  photoAnalyses: z
    .array(
      z.object({
        analysisStatus: z.string().trim().min(1),
        claimSupport: z.string().trim().min(1),
        evidenceId: z.string().trim().min(1),
        limitations: z.array(z.string().trim().min(1).max(200)).max(10),
        operationalConclusion: z.string().trim().min(1),
        summary: z.string().trim().min(1).max(800)
      })
    )
    .max(4),
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
        relation: z.enum(["PRECEDING", "SUBSEQUENT"]),
        senderName: z.string().trim().min(1)
      })
    )
    .max(8),
  replyContext: z
    .object({
      body: z.string().nullable(),
      id: z.string().trim().min(1),
      occurredAt: z.coerce.date(),
      senderName: z.string().trim().min(1)
    })
    .nullable(),
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
    .max(10),
  unresolvedExpectations: z
    .array(
      z.object({
        dueAt: z.coerce.date().nullable(),
        expectedResponder: z.string().nullable(),
        id: z.string().trim().min(1),
        requestedItem: z.string().trim().min(1).max(200),
        sourceMessageId: z.string().trim().min(1),
        type: responseExpectationTypeSchema.exclude(["NONE"])
      })
    )
    .max(10)
});

export const classifyMessageV2ResultSchema = z
  .object({
    abstentionReason: z.string().trim().min(1).max(300).nullable(),
    ambiguity: classificationAmbiguitySchema,
    completionClaim: completionClaimSchema,
    confidence: numericConfidenceSchema,
    factualClaims: z.array(factualClaimSchema).max(8),
    inspectionReadiness: inspectionReadinessSchema,
    location: z.string().trim().min(1).max(160).nullable(),
    locations: z.array(z.string().trim().min(1).max(160)).max(5),
    operationalImpact: operationalImpactSchema,
    primaryCategory: aiMessageCategorySchema,
    recommendationEligible: z.boolean(),
    recommendationEligibilityReason: z.string().trim().min(1).max(300),
    referencedDates: z.array(referencedDateSchema).max(5),
    relevance: messageRelevanceSchema,
    responseExpectation: z.object({
      dueAt: isoDateOrDateTimeSchema.nullable(),
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
    if (value.ambiguity.isAmbiguous && value.relevance !== "AMBIGUOUS") {
      context.addIssue({
        code: "custom",
        message: "Ambiguous classifications must use AMBIGUOUS relevance.",
        path: ["relevance"]
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
    if (
      ["OPEN", "RESOLVED"].includes(value.responseExpectation.status) &&
      !value.responseExpectation.requestedItem
    ) {
      context.addIssue({
        code: "custom",
        message: "Open or resolved expectations must identify the requested item.",
        path: ["responseExpectation", "requestedItem"]
      });
    }
    if (value.responseExpectation.status === "OPEN" && value.responseExpectation.type === "NONE") {
      context.addIssue({
        code: "custom",
        message: "Open expectations must identify an expectation type.",
        path: ["responseExpectation", "type"]
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

export const visionResultSchema = z
  .object({
    analysisStatus: z.enum([
      "USEFUL",
      "INSUFFICIENT_CONTEXT",
      "POOR_IMAGE_QUALITY",
      "NO_OPERATIONAL_CONCLUSION"
    ]),
    claimedContext: z.string().trim().min(1).max(300).nullable(),
    claimSupport: z.enum([
      "SUPPORTED",
      "PARTIALLY_SUPPORTED",
      "NOT_SUPPORTED",
      "UNABLE_TO_DETERMINE"
    ]),
    detectedObjects: z.array(z.string().trim().min(1).max(80)).max(20),
    limitations: z.array(z.string().trim().min(1).max(240)).max(10),
    overallConfidence: numericConfidenceSchema,
    possibleIssues: z
      .array(
        z.object({
          basis: z.string().trim().min(1).max(240),
          confidence: numericConfidenceSchema,
          issue: z.string().trim().min(1).max(160),
          requiresHumanReview: z.literal(true)
        })
      )
      .max(10),
    progressEvidence: z.object({
      reason: z.string().trim().min(1).max(300),
      scope: z.string().trim().min(1).max(160).nullable(),
      usable: z.boolean()
    }),
    safetySignal: z.object({
      present: z.boolean(),
      reason: z.string().trim().min(1).max(300).nullable(),
      severity: z.enum(["LOW", "MEDIUM", "HIGH"]).nullable()
    }),
    summary: z.string().trim().min(1).max(800),
    tags: z.array(z.string().trim().min(1).max(80)).max(20),
    visibleObservations: z
      .array(
        z.object({
          confidence: numericConfidenceSchema,
          observation: z.string().trim().min(1).max(240)
        })
      )
      .max(20)
  })
  .superRefine((value, context) => {
    if (value.claimedContext === null && value.claimSupport !== "UNABLE_TO_DETERMINE") {
      context.addIssue({
        code: "custom",
        message: "Claim support must be UNABLE_TO_DETERMINE when no claim was supplied.",
        path: ["claimSupport"]
      });
    }
    if (value.progressEvidence.usable && !value.progressEvidence.scope) {
      context.addIssue({
        code: "custom",
        message: "Usable progress evidence requires a clearly identified scope.",
        path: ["progressEvidence", "scope"]
      });
    }
    if (
      value.safetySignal.present &&
      (!value.safetySignal.reason || !value.safetySignal.severity)
    ) {
      context.addIssue({
        code: "custom",
        message: "A visible safety signal requires a cautious reason and severity.",
        path: ["safetySignal"]
      });
    }
    if (!value.safetySignal.present && (value.safetySignal.reason || value.safetySignal.severity)) {
      context.addIssue({
        code: "custom",
        message: "Absent safety signals must use null reason and severity.",
        path: ["safetySignal"]
      });
    }
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
