import { describe, expect, it } from "vitest";

import {
  isGroupSafeRecommendation,
  isSensitiveRecommendation,
  isWithinQuietHours,
  recommendationImpact,
  settingAllowsRecommendation
} from "./recommendation-policy.js";

describe("WhatsApp recommendation policy", () => {
  it("classifies material state changes as high impact", () => {
    expect(recommendationImpact("COMPLETE_MILESTONE")).toBe("HIGH_IMPACT");
    expect(recommendationImpact("REVIEW_EVIDENCE")).toBe("LOW_IMPACT");
    expect(recommendationImpact("CREATE_ACTION_ITEM")).toBe("STANDARD");
  });

  it("prevents sensitive recommendations from group routing", () => {
    expect(
      isSensitiveRecommendation({
        description: "Review confidential variation pricing.",
        reason: "Commercial approval is required.",
        title: "Variation review",
        type: "APPROVAL_REQUIRED"
      })
    ).toBe(true);
  });

  it("allows only explicitly safe, non-sensitive actions in groups", () => {
    const base = {
      description: "Review the latest site photo.",
      reason: "New evidence is available.",
      title: "Review site evidence",
      type: "GENERAL" as const
    };
    expect(isGroupSafeRecommendation({ ...base, proposedActionType: "REVIEW_EVIDENCE" })).toBe(
      true
    );
    expect(isGroupSafeRecommendation({ ...base, proposedActionType: "CREATE_ACTION_ITEM" })).toBe(
      false
    );
    expect(
      isGroupSafeRecommendation({
        ...base,
        description: "Review confidential contract evidence.",
        proposedActionType: "REVIEW_EVIDENCE"
      })
    ).toBe(false);
  });

  it("requires explicit allowed types and respects urgent-only settings", () => {
    const setting = {
      allowedRecommendationTypes: ["INSPECTION"],
      enabled: true,
      sendUrgentOnly: true
    };
    expect(settingAllowsRecommendation(setting, { priority: "URGENT", type: "INSPECTION" })).toBe(
      true
    );
    expect(settingAllowsRecommendation(setting, { priority: "HIGH", type: "INSPECTION" })).toBe(
      false
    );
  });

  it("handles quiet hours that cross midnight in project time", () => {
    const setting = {
      quietHoursEnd: "07:00",
      quietHoursStart: "22:00",
      timezone: "Asia/Singapore"
    };
    expect(isWithinQuietHours(setting, new Date("2026-07-24T15:00:00.000Z"))).toBe(true);
    expect(isWithinQuietHours(setting, new Date("2026-07-24T04:00:00.000Z"))).toBe(false);
  });

  it("holds low-priority recommendations instead of sending them individually", () => {
    expect(
      settingAllowsRecommendation(
        {
          allowedRecommendationTypes: ["INSPECTION"],
          enabled: true,
          sendUrgentOnly: false
        },
        { priority: "LOW", type: "INSPECTION" }
      )
    ).toBe(false);
  });
});
