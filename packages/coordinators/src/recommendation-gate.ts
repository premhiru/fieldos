import {
  Prisma,
  type AIDecisionEngineMode,
  type PrismaClient,
  type Recommendation,
  type RecommendationSuppressionReason
} from "@fieldos/db";
import { createLogger } from "@fieldos/shared";

import { isProhibitedGenericRecommendation, recommendationFingerprint } from "./decision-policy.js";
import type { RecommendationInput } from "./types.js";

const engineVersion = "ai-decision-layer.v2";
const dismissedCooldownMs = 30 * 24 * 60 * 60 * 1000;
const actionedCooldownMs = 7 * 24 * 60 * 60 * 1000;

export interface RecommendationCandidateInput extends RecommendationInput {
  evidenceIds: string[];
  scope: string;
}

export interface RecommendationGateResult {
  created: boolean;
  fingerprint: string;
  recommendation: Recommendation | null;
  suppressionReason: RecommendationSuppressionReason | "SHADOW_MODE" | null;
}

export class RecommendationGate {
  private readonly logger = createLogger("recommendation-gate");

  constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date()
  ) {}

  async evaluate(
    organizationId: string,
    projectStatus: string,
    mode: Exclude<AIDecisionEngineMode, "LEGACY">,
    input: RecommendationCandidateInput
  ): Promise<RecommendationGateResult> {
    const fingerprint = recommendationFingerprint({
      actionType: input.proposedActionType,
      projectId: input.projectId,
      scope: input.scope,
      sourceEntityId: input.sourceEntityId,
      type: input.type
    });
    const suppressionReason = await this.getSuppressionReason(projectStatus, fingerprint, input);

    if (suppressionReason || mode === "SHADOW") {
      const reason = suppressionReason ?? "SHADOW_MODE";
      await this.persistCandidate(organizationId, mode, input, fingerprint, {
        status: suppressionReason ? "SUPPRESSED" : "SHADOW",
        suppressionReason: reason
      });
      this.logDecision(input, fingerprint, false, reason);
      return {
        created: false,
        fingerprint,
        recommendation: null,
        suppressionReason: reason
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const recommendation = await tx.recommendation.create({
        data: {
          confidence: input.confidence,
          description: input.description,
          organizationId,
          priority: input.priority,
          projectId: input.projectId,
          proposedActionPayload: input.proposedActionPayload ?? Prisma.JsonNull,
          proposedActionType: input.proposedActionType,
          reason: input.reason,
          sourceCoordinator: input.sourceCoordinator,
          sourceEntityId: input.sourceEntityId ?? null,
          sourceEntityType: input.sourceEntityType ?? null,
          title: input.title,
          type: input.type
        }
      });
      await tx.recommendationCandidate.create({
        data: candidateData(organizationId, mode, input, fingerprint, {
          recommendationId: recommendation.id,
          status: "CREATED",
          suppressionReason: null
        })
      });
      return recommendation;
    });

    this.logDecision(input, fingerprint, true, null);
    return { created: true, fingerprint, recommendation: result, suppressionReason: null };
  }

  private async getSuppressionReason(
    projectStatus: string,
    fingerprint: string,
    input: RecommendationCandidateInput
  ): Promise<RecommendationSuppressionReason | null> {
    if (projectStatus !== "ACTIVE") {
      return "PROJECT_INACTIVE";
    }
    if (input.evidenceIds.length === 0) {
      return "INSUFFICIENT_EVIDENCE";
    }
    if (input.confidence === "LOW") {
      return "LOW_CONFIDENCE";
    }
    if (isProhibitedGenericRecommendation(input.title)) {
      return "ROUTINE_PROGRESS";
    }

    const history = await this.prisma.recommendationCandidate.findFirst({
      include: { recommendation: { select: { status: true } } },
      orderBy: { createdAt: "desc" },
      where: {
        fingerprint,
        projectId: input.projectId
      }
    });

    if (!history?.recommendation) {
      return null;
    }

    const ageMs = this.now().getTime() - history.createdAt.getTime();
    if (history.recommendation.status === "PENDING") {
      return "DUPLICATE_PENDING";
    }
    if (history.recommendation.status === "DISMISSED" && ageMs < dismissedCooldownMs) {
      return "RECENTLY_DISMISSED";
    }
    if (
      ["APPROVED", "COMPLETED"].includes(history.recommendation.status) &&
      ageMs < actionedCooldownMs
    ) {
      return "RECENTLY_ACTIONED";
    }

    return null;
  }

  private async persistCandidate(
    organizationId: string,
    mode: Exclude<AIDecisionEngineMode, "LEGACY">,
    input: RecommendationCandidateInput,
    fingerprint: string,
    decision: {
      status: "SUPPRESSED" | "SHADOW";
      suppressionReason: RecommendationSuppressionReason | "SHADOW_MODE";
    }
  ): Promise<void> {
    await this.prisma.recommendationCandidate.create({
      data: candidateData(organizationId, mode, input, fingerprint, {
        recommendationId: null,
        status: decision.status,
        suppressionReason: decision.suppressionReason
      })
    });
  }

  private logDecision(
    input: RecommendationCandidateInput,
    fingerprint: string,
    created: boolean,
    suppressionReason: string | null
  ): void {
    this.logger.info(
      {
        coordinatorType: input.sourceCoordinator,
        created,
        fingerprint,
        projectId: input.projectId,
        sourceEntityId: input.sourceEntityId,
        suppressionReason
      },
      created ? "recommendation created" : "recommendation candidate suppressed"
    );
  }
}

function candidateData(
  organizationId: string,
  mode: Exclude<AIDecisionEngineMode, "LEGACY">,
  input: RecommendationCandidateInput,
  fingerprint: string,
  decision: {
    recommendationId: string | null;
    status: "CREATED" | "SUPPRESSED" | "SHADOW";
    suppressionReason: RecommendationSuppressionReason | "SHADOW_MODE" | null;
  }
) {
  return {
    confidence: input.confidence,
    coordinatorType: input.sourceCoordinator,
    description: input.description,
    engineVersion,
    evidenceIds: input.evidenceIds,
    fingerprint,
    mode,
    organizationId,
    priority: input.priority,
    projectId: input.projectId,
    proposedActionPayload: input.proposedActionPayload ?? Prisma.JsonNull,
    proposedActionType: input.proposedActionType,
    reason: input.reason,
    recommendationId: decision.recommendationId,
    sourceEntityId: input.sourceEntityId ?? null,
    sourceEntityType: input.sourceEntityType ?? null,
    status: decision.status,
    suppressionReason: decision.suppressionReason,
    title: input.title,
    type: input.type
  };
}
