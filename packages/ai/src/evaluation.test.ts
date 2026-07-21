import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { aiEvaluationCases } from "./evaluation-cases.js";
import {
  evaluateDecisionLayer,
  type AIEvaluationPrediction,
  type AIEvaluationRun
} from "./evaluation.js";
import type { ClassifyMessageV2Result } from "./types.js";

describe("AI decision layer labelled evaluation", () => {
  it("contains at least 80 labelled field-operations cases with genuine positives", () => {
    expect(aiEvaluationCases.length).toBeGreaterThanOrEqual(80);
    expect(aiEvaluationCases.some((item) => item.expectedRecommendationEligible)).toBe(true);
    expect(aiEvaluationCases.some((item) => item.expectedAbstention)).toBe(true);
    expect(aiEvaluationCases.some((item) => item.duplicateOf)).toBe(true);
    expect(aiEvaluationCases.some((item) => item.unresolvedExpectations?.length)).toBe(true);
    expect(aiEvaluationCases.some((item) => item.recentMessages?.length)).toBe(true);
  });

  it("calculates precision, recall, false positives, and duplicates from supplied predictions", () => {
    const cases = aiEvaluationCases.slice(0, 3).map((testCase, index) => ({
      ...testCase,
      duplicateOf: index === 2 ? aiEvaluationCases[0]?.id : undefined,
      expectedAbstention: index !== 0,
      expectedRecommendationEligible: index === 0,
      expectedRecommendationType: index === 0 ? "ACTION_ITEM" : null
    }));
    const predictions: AIEvaluationPrediction[] = cases.map((testCase, index) => ({
      caseId: testCase.id,
      classification: validV2Result({
        primaryCategory: testCase.expectedPrimaryCategory,
        secondarySignals: testCase.expectedSecondarySignals
      }),
      decision: index === 0 ? "CREATE" : "SUPPRESS",
      error: null,
      fingerprint: index === 0 ? "fingerprint-1" : null,
      reasonCode: index === 0 ? "ELIGIBLE" : "ROUTINE_PROGRESS",
      recommendationType: index === 0 ? "ACTION_ITEM" : null
    }));

    expect(evaluateDecisionLayer(cases, predictions)).toMatchObject({
      duplicateRecommendationRate: 0,
      falsePositiveRecommendationRate: 0,
      recommendationPrecision: 1,
      recommendationRecall: 1
    });
  });

  it("rejects incomplete evaluation runs instead of silently scoring a fallback", () => {
    expect(() => evaluateDecisionLayer(aiEvaluationCases, [])).toThrow(
      `Missing evaluation prediction for ${aiEvaluationCases[0]?.id}.`
    );
  });

  it("reports zero recommendation false positives when the engine creates nothing", () => {
    const testCase = {
      ...aiEvaluationCases[0]!,
      expectedAbstention: true,
      expectedRecommendationEligible: false,
      expectedRecommendationType: null
    };
    const prediction: AIEvaluationPrediction = {
      caseId: testCase.id,
      classification: validV2Result({ recommendationEligible: false }),
      decision: "SUPPRESS",
      error: null,
      fingerprint: null,
      reasonCode: "NOT_ELIGIBLE",
      recommendationType: null
    };

    expect(evaluateDecisionLayer([testCase], [prediction]).falsePositiveRecommendationRate).toBe(0);
  });

  it("keeps provider or schema failures in every applicable denominator", () => {
    const testCase = {
      ...aiEvaluationCases[0]!,
      expectedAbstention: true,
      expectedRecommendationEligible: false,
      expectedRecommendationType: null
    };
    const prediction: AIEvaluationPrediction = {
      caseId: testCase.id,
      classification: null,
      decision: "SUPPRESS",
      error: "AIOutputValidationError: invalid output",
      fingerprint: null,
      reasonCode: "EVALUATION_ERROR",
      recommendationType: null
    };

    expect(evaluateDecisionLayer([testCase], [prediction])).toMatchObject({
      abstentionAccuracy: 0,
      evaluationFailureRate: 1,
      primaryCategoryAccuracy: 0
    });
  });

  it("keeps the captured production-path baseline above pilot quality targets", () => {
    const run = JSON.parse(
      readFileSync(new URL("./evaluation-results.v2.json", import.meta.url), "utf8")
    ) as AIEvaluationRun;
    const expectedCaseIds = aiEvaluationCases.map((testCase) => testCase.id).sort();
    const predictionCaseIds = run.predictions.map((prediction) => prediction.caseId).sort();
    const metrics = evaluateDecisionLayer(aiEvaluationCases, run.predictions);

    expect(predictionCaseIds).toEqual(expectedCaseIds);
    expect(run.metadata).toMatchObject({
      fallbackCount: 0,
      model: "kimi-k2.6",
      policyVersion: "recommendation-policy.v2.1",
      promptVersion: "message-classification.v2.4",
      schemaVersion: "2.2"
    });
    expect(run.predictions.some((prediction) => prediction.decision === "CREATE")).toBe(true);
    expect(metrics).toMatchObject({
      evaluationFailureRate: 0
    });
    expect(metrics.recommendationPrecision).toBeGreaterThanOrEqual(0.9);
    expect(metrics.recommendationRecall).toBeGreaterThan(0.5);
    expect(metrics.inspectionFalsePositiveRate).toBeLessThanOrEqual(0.05);
    expect(metrics.followUpFalsePositiveRate).toBeLessThanOrEqual(0.1);
    expect(metrics.duplicateRecommendationRate).toBeLessThanOrEqual(0.02);
  });
});

function validV2Result(overrides: Partial<ClassifyMessageV2Result> = {}): ClassifyMessageV2Result {
  return {
    abstentionReason: null,
    ambiguity: { isAmbiguous: false, missingContext: [] },
    completionClaim: "NONE",
    confidence: 0.9,
    factualClaims: [],
    inspectionReadiness: "NONE",
    location: null,
    locations: [],
    operationalImpact: "HIGH",
    primaryCategory: "DEFECT",
    recommendationEligible: true,
    recommendationEligibilityReason: "A material issue requires a specific response.",
    referencedDates: [],
    relevance: "OPERATIONAL",
    responseExpectation: {
      dueAt: null,
      evidence: null,
      expectedResponder: null,
      requestedItem: null,
      status: "NONE",
      type: "NONE"
    },
    secondarySignals: [],
    summary: "A material issue requires action.",
    uncertainty: null,
    userFacingReason: "The issue may affect project delivery.",
    ...overrides
  };
}
