import { describe, expect, it } from "vitest";

import {
  assessReportReadiness,
  isFollowUpEligible,
  isInspectionEligible,
  isProhibitedGenericRecommendation,
  isRoutineProgress,
  recommendationFingerprint,
  semanticScopeForDecision
} from "./decision-policy.js";

describe("AI decision policy regressions", () => {
  it.each([
    ["Delivery completed", "NONE", "NONE"],
    ["Cable tray installed; cabling pending", "PARTIAL", "NOT_READY"]
  ])(
    "does not infer inspection from broad completion language: %s",
    (_text, completion, readiness) => {
      expect(
        isInspectionEligible({
          completionClaim: completion as "NONE" | "PARTIAL",
          confidence: 0.9,
          explicitInspectionRequired: false,
          hasOpenInspection: false,
          hasUnresolvedPrerequisite: completion === "PARTIAL",
          inspectionReadiness: readiness as "NONE" | "NOT_READY",
          scope: "Cable tray",
          sourceMessageId: "message_1"
        })
      ).toBe(false);
    }
  );

  it("allows explicit inspection readiness with clear scope and closed prerequisites", () => {
    expect(
      isInspectionEligible({
        completionClaim: "CLAIMED",
        confidence: 0.75,
        explicitInspectionRequired: true,
        hasOpenInspection: false,
        hasUnresolvedPrerequisite: false,
        inspectionReadiness: "REQUESTED",
        scope: "Taxiway A circuit installation and testing",
        sourceMessageId: "message_1"
      })
    ).toBe(true);
  });

  it("does not create a follow-up from silence alone", () => {
    expect(
      isFollowUpEligible({
        confidence: 1,
        conversationActive: true,
        dueAt: new Date("2026-07-17T00:00:00Z"),
        expectedResponder: null,
        now: new Date("2026-07-18T00:00:00Z"),
        projectStatus: "ACTIVE",
        requestedItem: "",
        status: "OPEN"
      })
    ).toBe(false);
  });

  it("allows a direct overdue request with a specific requested item", () => {
    expect(
      isFollowUpEligible({
        confidence: 0.9,
        conversationActive: true,
        dueAt: new Date("2026-07-17T00:00:00Z"),
        expectedResponder: "Alex",
        now: new Date("2026-07-18T00:00:00Z"),
        projectStatus: "ACTIVE",
        requestedItem: "signed test sheet",
        status: "OPEN"
      })
    ).toBe(true);
  });

  it("deduplicates the same business action across different source messages", () => {
    const first = recommendationFingerprint({
      actionType: "SCHEDULE_INSPECTION_REMINDER",
      projectId: "project_1",
      scope: "Taxiway A circuit",
      type: "INSPECTION"
    });
    const second = recommendationFingerprint({
      actionType: "SCHEDULE_INSPECTION_REMINDER",
      projectId: "project_1",
      scope: "taxiway a circuit",
      type: "INSPECTION"
    });

    expect(second).toBe(first);
  });

  it("keeps semantic scope stable when summaries paraphrase the same issue", () => {
    const first = semanticScopeForDecision({
      factualClaims: [{ subject: "fire door closer" }],
      locations: ["Level 2 corridor"],
      primaryCategory: "DEFECT",
      summary: "The Level 2 fire door closer is broken."
    });
    const second = semanticScopeForDecision({
      factualClaims: [{ subject: "fire door closer" }],
      locations: ["Level 2 corridor"],
      primaryCategory: "DEFECT",
      summary: "A defective closer was reported beside the second-floor corridor."
    });

    expect(first).toBe(second);
  });

  it("treats routine progress as evidence rather than a recommendation", () => {
    expect(
      isRoutineProgress({
        completionClaim: "NONE",
        operationalImpact: "LOW",
        primaryCategory: "PROGRESS_UPDATE",
        recommendationEligible: false,
        responseExpectationStatus: "NONE",
        secondarySignals: []
      })
    ).toBe(true);
  });

  it.each(["Review progress", "Mark progress reviewed", "Check recent progress"])(
    "blocks generic progress work: %s",
    (title) => expect(isProhibitedGenericRecommendation(title)).toBe(true)
  );

  it("generates stable semantic fingerprints", () => {
    const first = recommendationFingerprint({
      actionType: "CREATE_ACTION_ITEM",
      projectId: "project_1",
      scope: "Review the signed test sheet.",
      type: "FOLLOW_UP"
    });
    const repeated = recommendationFingerprint({
      actionType: "CREATE_ACTION_ITEM",
      projectId: "project_1",
      scope: "review  the signed test sheet",
      type: "FOLLOW_UP"
    });

    expect(repeated).toBe(first);
  });

  it("does not treat repeated low-value events as report substance", () => {
    const readiness = assessReportReadiness({
      actionItems: [],
      classifications: [],
      events: Array.from({ length: 10 }, (_, index) => ({
        eventType: "SYSTEM_REFRESH",
        id: `event_${index}`,
        occurredAt: new Date("2026-07-17T00:00:00.000Z")
      })),
      milestones: [],
      periodStart: new Date("2026-07-13T00:00:00.000Z")
    });

    expect(readiness).toEqual({ categories: [], evidenceIds: [], ready: false });
  });

  it("allows a report when distinct substantive changes exist", () => {
    const readiness = assessReportReadiness({
      actionItems: [
        {
          id: "action_1",
          priority: "HIGH",
          updatedAt: new Date("2026-07-17T00:00:00.000Z")
        }
      ],
      classifications: [
        {
          category: "DELAY",
          evidenceId: "message_1",
          impact: "HIGH",
          processedAt: new Date("2026-07-17T00:00:00.000Z")
        }
      ],
      events: [],
      milestones: [],
      periodStart: new Date("2026-07-13T00:00:00.000Z")
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.categories).toEqual(["HIGH_PRIORITY_WORK", "RISK_OR_DELAY"]);
  });
});
