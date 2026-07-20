import type {
  CoordinatorType,
  Prisma,
  PrismaClient,
  Milestone,
  MilestonePriority,
  MilestoneStatus,
  ProjectState,
  Recommendation,
  RecommendationActionType,
  RecommendationConfidence,
  RecommendationPriority,
  RecommendationType,
  WhatsAppDraft
} from "@fieldos/db";

export type CoordinatorPrisma = PrismaClient | Prisma.TransactionClient;

export interface CoordinatorRunResult {
  coordinatorType: CoordinatorType;
  recommendationsCreated: number;
}

export interface ProjectCoordinatorRunResult {
  projectState: ProjectState;
  results: CoordinatorRunResult[];
}

export interface RecommendationInput {
  confidence: RecommendationConfidence;
  description: string;
  priority: RecommendationPriority;
  projectId: string;
  proposedActionPayload?: Prisma.InputJsonValue;
  proposedActionType: RecommendationActionType;
  reason: string;
  sourceCoordinator: CoordinatorType;
  sourceEntityId?: string | null;
  sourceEntityType?: string | null;
  title: string;
  type: RecommendationType;
}

export interface WhatsAppDraftSender {
  send(input: {
    conversationId: string;
    draftId: string;
    messageBody: string;
    organizationId: string;
    projectId: string;
    whatsappAccountId: string | null;
  }): Promise<{ externalMessageId?: string | null; queued?: boolean }>;
}

export interface ProjectCoordinatorRuntimeOptions {
  decisionEngineMode?: "legacy" | "shadow" | "v2";
  draftSender?: WhatsAppDraftSender;
  milestoneDetector?: MilestoneDetectorPort;
  now?: () => Date;
}

export interface MilestoneDetectionCandidate {
  action: "CREATE" | "UPDATE" | "COMPLETE" | "START" | "DELAY" | "NONE";
  actualEndDate: string | null;
  actualStartDate: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  description: string | null;
  hasMilestoneChange: boolean;
  milestoneTitle: string | null;
  originalDatePhrase: string | null;
  plannedEndDate: string | null;
  plannedStartDate: string | null;
  reason: string;
  status: MilestoneStatus | null;
}

export interface MilestoneDetectorPort {
  detectMilestones(input: {
    existingMilestones: Array<{
      id: string;
      plannedEndDate: string | null;
      plannedStartDate: string | null;
      status: MilestoneStatus;
      title: string;
    }>;
    messageText: string | null;
    occurredAt: Date;
    project: { id: string; name: string; timezone: string };
    projectState: {
      nextMilestone: string | null;
      pendingDecisionSummary: string | null;
      recentProgressSummary: string | null;
    } | null;
    recentTimelineEvents: Array<{
      description: string | null;
      occurredAt: Date;
      title: string;
    }>;
    relativeDateHints: Record<string, string | null>;
    sender: string;
    voiceTranscript: string | null;
  }): Promise<MilestoneDetectionCandidate[]>;
}

export interface MilestoneWriteInput {
  actualEndDate?: Date | null;
  actualStartDate?: Date | null;
  description?: string | null;
  plannedEndDate?: Date | null;
  plannedStartDate?: Date | null;
  priority?: MilestonePriority;
  status?: MilestoneStatus;
  title: string;
}

export interface MilestoneRecommendationEdit {
  actualEndDate?: Date | null;
  actualStartDate?: Date | null;
  description?: string | null;
  plannedEndDate?: Date | null;
  plannedStartDate?: Date | null;
  priority?: MilestonePriority;
  status?: MilestoneStatus;
  title?: string;
}

export interface MilestoneRecommendationView extends RecommendationWithProject {
  evidence: {
    attachments: Array<{ filename: string; id: string; mimeType: string }>;
    conversationId: string;
    messageBody: string | null;
    messageId: string;
    occurredAt: Date;
    sender: string;
    timelineEvent: {
      description: string | null;
      id: string;
      occurredAt: Date;
      title: string;
    } | null;
    voiceTranscript: string | null;
  } | null;
}

export interface MilestoneApprovalResult {
  milestone: Milestone;
  recommendation: Recommendation;
}

export interface RecommendationWithProject extends Recommendation {
  project: {
    code: string;
    id: string;
    name: string;
  };
  whatsAppDrafts: WhatsAppDraft[];
}

export interface CoordinatorOperationsMetrics {
  approvalRate: number;
  candidatesGeneratedToday: number;
  candidatesShadowedToday: number;
  candidatesSuppressedToday: number;
  failedRunsToday: number;
  lastRunPerProject: Array<{
    projectId: string;
    projectName: string;
    coordinatorType: CoordinatorType;
    status: string;
    startedAt: Date;
  }>;
  pendingRecommendations: number;
  recommendationsCreatedToday: number;
  runsToday: number;
  suppressionsByReason: Array<{ count: number; reason: string }>;
}

export type DraftSendResult =
  | { draft: WhatsAppDraft; sent: true }
  | { draft: WhatsAppDraft; queued: true; sent: false }
  | { draft: WhatsAppDraft; sent: false; error: string };

export interface RecommendationApprovalResult {
  actionItemId?: string;
  draft?: WhatsAppDraft;
  milestone?: Milestone;
  recommendation: Recommendation;
  reportId?: string;
}
