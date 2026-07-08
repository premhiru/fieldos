import type {
  CoordinatorType,
  Prisma,
  PrismaClient,
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
  }): Promise<{ externalMessageId?: string | null }>;
}

export interface ProjectCoordinatorRuntimeOptions {
  draftSender?: WhatsAppDraftSender;
  now?: () => Date;
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
}

export type DraftSendResult =
  { draft: WhatsAppDraft; sent: true } | { draft: WhatsAppDraft; sent: false; error: string };

export interface RecommendationApprovalResult {
  actionItemId?: string;
  draft?: WhatsAppDraft;
  recommendation: Recommendation;
  reportId?: string;
}
