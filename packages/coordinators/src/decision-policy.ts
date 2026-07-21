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

export interface ReportReadinessInput {
  actionItems: Array<{ id: string; priority: string; updatedAt?: Date }>;
  classifications: Array<{
    category: string;
    evidenceId: string;
    impact: string;
    processedAt: Date;
  }>;
  events: Array<{ eventType: string; id: string; occurredAt: Date }>;
  milestones: Array<{ id: string; status: string; updatedAt: Date }>;
  periodStart: Date;
}

export interface ReportReadinessResult {
  categories: string[];
  evidenceIds: string[];
  ready: boolean;
}

export function isInspectionEligible(input: InspectionDecisionInput): boolean {
  return Boolean(
    input.scope?.trim() &&
    input.sourceMessageId &&
    input.confidence >= 0.75 &&
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

export function assessReportReadiness(input: ReportReadinessInput): ReportReadinessResult {
  const evidenceByCategory = new Map<string, Set<string>>();
  let hasCriticalSignal = false;
  const add = (category: string, evidenceId: string) => {
    const ids = evidenceByCategory.get(category) ?? new Set<string>();
    ids.add(evidenceId);
    evidenceByCategory.set(category, ids);
  };

  for (const classification of input.classifications) {
    if (classification.processedAt < input.periodStart) continue;
    if (classification.impact === "CRITICAL") hasCriticalSignal = true;
    if (!["MEDIUM", "HIGH", "CRITICAL"].includes(classification.impact)) continue;

    if (
      ["DEFECT", "DELAY", "SAFETY_ISSUE", "MATERIAL_ISSUE", "MANPOWER_ISSUE"].includes(
        classification.category
      )
    ) {
      add("RISK_OR_DELAY", classification.evidenceId);
    } else if (
      ["DECISION", "CLIENT_APPROVAL", "VARIATION_ORDER", "RFI"].includes(classification.category)
    ) {
      add("DECISION_OR_SCOPE", classification.evidenceId);
    } else if (classification.category === "PROGRESS_UPDATE") {
      add("MEANINGFUL_PROGRESS", classification.evidenceId);
    }
  }

  for (const item of input.actionItems) {
    if (item.updatedAt && item.updatedAt < input.periodStart) continue;
    if (["HIGH", "URGENT"].includes(item.priority)) add("HIGH_PRIORITY_WORK", item.id);
  }

  for (const milestone of input.milestones) {
    if (milestone.updatedAt < input.periodStart) continue;
    if (["COMPLETED", "DELAYED", "IN_PROGRESS"].includes(milestone.status)) {
      add("MILESTONE_CHANGE", milestone.id);
    }
  }

  for (const event of input.events) {
    if (event.occurredAt < input.periodStart) continue;
    if (/DECISION|APPROVAL/i.test(event.eventType)) add("DECISION_OR_SCOPE", event.id);
    if (/EVIDENCE|PHOTO|DOCUMENT/i.test(event.eventType)) add("NEW_EVIDENCE", event.id);
  }

  const categories = [...evidenceByCategory.keys()].sort();
  return {
    categories,
    evidenceIds: [...new Set([...evidenceByCategory.values()].flatMap((ids) => [...ids]))].slice(
      0,
      10
    ),
    ready: hasCriticalSignal || categories.length >= 2
  };
}

export function recommendationFingerprint(input: {
  actionType: string;
  businessKey?: string | null;
  projectId: string;
  scope: string;
  type: string;
}): string {
  const normalized = [
    input.projectId,
    input.type,
    input.actionType,
    normalizeFingerprintText(input.scope),
    normalizeFingerprintText(input.businessKey ?? "")
  ].join("|");

  return createHash("sha256").update(normalized).digest("hex");
}

export function semanticScopeForDecision(input: {
  factualClaims: unknown;
  locations: unknown;
  primaryCategory: string;
  summary: string;
}): string {
  const subject = Array.isArray(input.factualClaims)
    ? input.factualClaims
        .map((claim) =>
          typeof claim === "object" && claim !== null && "subject" in claim
            ? stringValue(claim.subject)
            : null
        )
        .find(Boolean)
    : null;
  const location = Array.isArray(input.locations)
    ? input.locations.map(stringValue).find(Boolean)
    : null;
  const stableParts = [input.primaryCategory, subject, location].filter((value): value is string =>
    Boolean(value)
  );

  return stableParts.length > 1 ? stableParts.join(": ") : input.summary;
}

export function isProhibitedGenericRecommendation(title: string): boolean {
  return /^(review( (the|recent))? (progress|update)|mark progress reviewed|check( (the|recent))? progress|request( a)? progress update|monitor( the)? project|follow up( generally)?|inspect recent activity|consider next steps)$/i.test(
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

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
