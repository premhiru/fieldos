import {
  Prisma,
  queueWhatsAppRecommendationDeliveryJob,
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
  businessKey?: string | null;
  clarificationQuestion?: string | null;
  evidenceLimitations: string;
  evidenceIds: string[];
  evidenceSummary: string;
  expectedValue: string;
  isSuperseded?: boolean;
  materiality: Array<
    | "SCHEDULE"
    | "COST"
    | "SAFETY"
    | "QUALITY"
    | "SCOPE"
    | "APPROVAL"
    | "INSPECTION"
    | "DELIVERY"
    | "OWNERSHIP"
    | "REPORTING"
    | "RISK"
    | "MILESTONE"
  >;
  scope: string;
}

export interface RecommendationGateResult {
  created: boolean;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  decision: "CREATE" | "SUPPRESS" | "REQUEST_CLARIFICATION";
  evidenceIds: string[];
  fingerprint: string;
  reason: string;
  reasonCode: string;
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
      businessKey: input.businessKey,
      projectId: input.projectId,
      scope: input.scope,
      type: input.type
    });
    const suppressionReason = await this.getSuppressionReason(projectStatus, fingerprint, input);

    if (suppressionReason) {
      await this.persistCandidate(organizationId, mode, input, fingerprint, {
        status: "SUPPRESSED",
        suppressionReason
      });
      this.logDecision(input, fingerprint, "SUPPRESS", suppressionReason);
      return gateResult(input, fingerprint, "SUPPRESS", suppressionReason);
    }

    if (input.clarificationQuestion?.trim()) {
      await this.persistCandidate(organizationId, mode, input, fingerprint, {
        status: "CLARIFICATION",
        suppressionReason: "AMBIGUOUS"
      });
      this.logDecision(input, fingerprint, "REQUEST_CLARIFICATION", "AMBIGUOUS");
      return gateResult(input, fingerprint, "REQUEST_CLARIFICATION", "AMBIGUOUS");
    }

    if (mode === "SHADOW") {
      const reason = "SHADOW_MODE";
      await this.persistCandidate(organizationId, mode, input, fingerprint, {
        status: "SHADOW",
        suppressionReason: reason
      });
      this.logDecision(input, fingerprint, "SUPPRESS", reason);
      return gateResult(input, fingerprint, "SUPPRESS", reason);
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
      await queueWhatsAppRecommendationDeliveryJob(tx, {
        nextRunAt: input.priority === "LOW" ? new Date(this.now().getTime() + 5 * 60 * 1000) : null,
        organizationId,
        projectId: input.projectId,
        sourceId: recommendation.id
      });
      await tx.whatsAppOperationAudit.create({
        data: {
          eventType: "RECOMMENDATION_DELIVERY_EVALUATION_QUEUED",
          organizationId,
          projectId: input.projectId,
          recommendationId: recommendation.id
        }
      });
      return recommendation;
    });

    this.logDecision(input, fingerprint, "CREATE", null);
    return {
      ...gateResult(input, fingerprint, "CREATE", null),
      created: true,
      recommendation: result
    };
  }

  private async getSuppressionReason(
    projectStatus: string,
    fingerprint: string,
    input: RecommendationCandidateInput
  ): Promise<RecommendationSuppressionReason | null> {
    if (projectStatus !== "ACTIVE") {
      return "PROJECT_INACTIVE";
    }
    if (input.materiality.length === 0) {
      return "NO_MATERIALITY";
    }
    if (!isActionable(input)) {
      return "NON_ACTIONABLE";
    }
    if (input.evidenceIds.length === 0 || !input.evidenceSummary.trim()) {
      return "INSUFFICIENT_EVIDENCE";
    }
    if (!input.expectedValue.trim()) {
      return "NO_EXPECTED_VALUE";
    }
    if (input.isSuperseded) {
      return "SUPERSEDED";
    }
    if (!meetsConfidencePolicy(input) && !input.clarificationQuestion?.trim()) {
      return "LOW_CONFIDENCE";
    }
    if (
      isProhibitedGenericRecommendation(input.title) ||
      isProhibitedGenericRecommendation(input.description)
    ) {
      return "ROUTINE_PROGRESS";
    }

    if (input.sourceEntityType === "OUTSTANDING_EXPECTATION" && input.sourceEntityId) {
      const expectation = await this.prisma.outstandingExpectation.findUnique({
        select: { status: true },
        where: { id: input.sourceEntityId }
      });
      if (!expectation || expectation.status !== "OPEN") {
        return "NO_UNRESOLVED_EXPECTATION";
      }
    }

    const history = await this.prisma.recommendationCandidate.findFirst({
      include: {
        recommendation: {
          select: {
            approvedAt: true,
            completedAt: true,
            dismissedAt: true,
            status: true,
            updatedAt: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      where: {
        fingerprint,
        projectId: input.projectId
      }
    });

    if (history?.recommendation) {
      const recommendation = history.recommendation;
      const materiallyNewEvidence = hasMateriallyNewEvidence(
        history.evidenceIds,
        input.evidenceIds
      );
      if (recommendation.status === "PENDING") {
        return "DUPLICATE_PENDING";
      }
      if (recommendation.status === "DISMISSED") {
        const decidedAt = recommendation.dismissedAt ?? recommendation.updatedAt;
        const ageMs = this.now().getTime() - decidedAt.getTime();
        if (!materiallyNewEvidence || ageMs < dismissedCooldownMs) {
          return "RECENTLY_DISMISSED";
        }
      }
      if (["APPROVED", "COMPLETED"].includes(recommendation.status)) {
        const decidedAt =
          recommendation.completedAt ?? recommendation.approvedAt ?? recommendation.updatedAt;
        const ageMs = this.now().getTime() - decidedAt.getTime();
        if (!materiallyNewEvidence || ageMs < actionedCooldownMs) {
          return "RECENTLY_ACTIONED";
        }
      }
    }

    const ownedWork = await this.prisma.actionItem.findFirst({
      select: { id: true },
      where: {
        OR: [
          { title: { contains: input.scope, mode: "insensitive" } },
          { description: { contains: input.scope, mode: "insensitive" } }
        ],
        projectId: input.projectId,
        status: { in: ["PENDING", "ACCEPTED"] }
      }
    });
    if (ownedWork) {
      return "OWNERSHIP_EXISTS";
    }

    return null;
  }

  private async persistCandidate(
    organizationId: string,
    mode: Exclude<AIDecisionEngineMode, "LEGACY">,
    input: RecommendationCandidateInput,
    fingerprint: string,
    decision: {
      status: "CLARIFICATION" | "SUPPRESSED" | "SHADOW";
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
    decision: "CREATE" | "SUPPRESS" | "REQUEST_CLARIFICATION",
    suppressionReason: string | null
  ): void {
    this.logger.info(
      {
        coordinatorType: input.sourceCoordinator,
        decision,
        fingerprint,
        projectId: input.projectId,
        sourceEntityId: input.sourceEntityId,
        suppressionReason
      },
      decision === "CREATE"
        ? "recommendation created"
        : decision === "REQUEST_CLARIFICATION"
          ? "recommendation clarification requested"
          : "recommendation candidate suppressed"
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
    status: "CLARIFICATION" | "CREATED" | "SUPPRESSED" | "SHADOW";
    suppressionReason: RecommendationSuppressionReason | "SHADOW_MODE" | null;
  }
) {
  return {
    confidence: input.confidence,
    coordinatorType: input.sourceCoordinator,
    description: input.description,
    engineVersion,
    evidenceIds: input.evidenceIds,
    evidenceLimitations: input.evidenceLimitations,
    evidenceSummary: input.evidenceSummary,
    expectedValue: input.expectedValue,
    fingerprint,
    mode,
    materiality: input.materiality,
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

function gateResult(
  input: RecommendationCandidateInput,
  fingerprint: string,
  decision: "CREATE" | "SUPPRESS" | "REQUEST_CLARIFICATION",
  reasonCode: RecommendationSuppressionReason | "SHADOW_MODE" | null
): RecommendationGateResult {
  return {
    confidence: input.confidence,
    created: false,
    decision,
    evidenceIds: [...input.evidenceIds],
    fingerprint,
    reason: decisionReason(reasonCode),
    reasonCode: reasonCode ?? "GATE_PASSED",
    recommendation: null,
    suppressionReason: reasonCode
  };
}

function decisionReason(reason: RecommendationSuppressionReason | "SHADOW_MODE" | null): string {
  const reasons: Record<string, string> = {
    AMBIGUOUS: "The evidence needs clarification before action is justified.",
    DUPLICATE_PENDING: "An equivalent recommendation is already pending.",
    INSUFFICIENT_EVIDENCE: "The candidate does not cite sufficient evidence.",
    LOW_CONFIDENCE: "The candidate does not meet the policy-specific confidence threshold.",
    NON_ACTIONABLE: "The proposed action is not specific enough to execute.",
    NO_EXPECTED_VALUE: "The candidate does not demonstrate meaningful operational value.",
    NO_MATERIALITY: "The candidate does not materially affect project operations.",
    OWNERSHIP_EXISTS: "Equivalent work is already assigned and open.",
    RECENTLY_ACTIONED: "Equivalent work was recently actioned without materially new evidence.",
    RECENTLY_DISMISSED: "Equivalent work was recently dismissed without materially new evidence.",
    SHADOW_MODE: "The candidate passed policy but shadow mode prevents customer-visible creation."
  };
  return reason ? (reasons[reason] ?? `Candidate suppressed by ${reason}.`) : "All gates passed.";
}

function hasMateriallyNewEvidence(previous: unknown, current: string[]): boolean {
  const previousIds = new Set(
    Array.isArray(previous)
      ? previous.filter((item): item is string => typeof item === "string")
      : []
  );
  return current.some((id) => !previousIds.has(id));
}

function isActionable(input: RecommendationCandidateInput): boolean {
  return Boolean(
    input.scope.trim().length >= 3 &&
    input.title.trim().length >= 8 &&
    input.description.trim().length >= 12 &&
    !isProhibitedGenericRecommendation(input.title)
  );
}

function meetsConfidencePolicy(input: RecommendationCandidateInput): boolean {
  if (input.confidence === "LOW") return false;
  if (input.type === "INSPECTION" || input.proposedActionType === "COMPLETE_MILESTONE") {
    return input.confidence === "HIGH";
  }
  if (input.type === "FOLLOW_UP") {
    return input.confidence === "HIGH";
  }
  if (input.materiality.includes("SAFETY") && input.priority === "URGENT") {
    return input.confidence === "HIGH" || input.confidence === "MEDIUM";
  }
  return true;
}
