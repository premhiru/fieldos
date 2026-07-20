import { createHash } from "node:crypto";

export interface InspectionDecisionInput {
  completionClaim: "NONE" | "PARTIAL" | "CLAIMED" | "AMBIGUOUS";
  confidence: number;
  explicitInspectionRequired: boolean;
  hasOpenInspection: boolean;
  hasUnresolvedPrerequisite: boolean;
  inspectionReadiness: "NONE" | "NOT_READY" | "READY_CLAIMED" | "REQUESTED" | "AMBIGUOUS";
  scope: string | null;
  sourceMessageId: string | null;
}

export interface FollowUpDecisionInput {
  confidence: number;
  conversationActive: boolean;
  dueAt: Date | null;
  expectedResponder: string | null;
  now: Date;
  projectStatus: string;
  requestedItem: string;
  status: string;
}

export function isInspectionEligible(input: InspectionDecisionInput): boolean {
  return Boolean(
    input.scope?.trim() &&
    input.sourceMessageId &&
    input.confidence >= 0.8 &&
    input.completionClaim === "CLAIMED" &&
    ["READY_CLAIMED", "REQUESTED"].includes(input.inspectionReadiness) &&
    input.explicitInspectionRequired &&
    !input.hasOpenInspection &&
    !input.hasUnresolvedPrerequisite
  );
}

export function isFollowUpEligible(input: FollowUpDecisionInput): boolean {
  return Boolean(
    input.projectStatus === "ACTIVE" &&
    input.conversationActive &&
    input.status === "OPEN" &&
    input.confidence >= 0.75 &&
    input.requestedItem.trim() &&
    input.dueAt &&
    input.dueAt.getTime() < input.now.getTime()
  );
}

export function isRoutineProgress(input: {
  completionClaim: string;
  operationalImpact: string;
  primaryCategory: string;
  recommendationEligible: boolean;
  responseExpectationStatus: string;
  secondarySignals: string[];
}): boolean {
  return (
    input.primaryCategory === "PROGRESS_UPDATE" &&
    input.completionClaim === "NONE" &&
    ["NONE", "LOW"].includes(input.operationalImpact) &&
    input.responseExpectationStatus !== "OPEN" &&
    input.secondarySignals.length === 0 &&
    !input.recommendationEligible
  );
}

export function recommendationFingerprint(input: {
  actionType: string;
  projectId: string;
  scope: string;
  sourceEntityId?: string | null;
  type: string;
}): string {
  const normalized = [
    input.projectId,
    input.type,
    input.actionType,
    normalizeFingerprintText(input.scope),
    input.sourceEntityId ?? ""
  ].join("|");

  return createHash("sha256").update(normalized).digest("hex");
}

export function isProhibitedGenericRecommendation(title: string): boolean {
  return /^(review progress|mark progress reviewed|check recent progress|request progress update)$/i.test(
    title.trim()
  );
}

function normalizeFingerprintText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}
