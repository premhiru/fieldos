import { describe, expect, it } from "vitest";

import { aiEvaluationCases } from "./evaluation-cases.js";
import { cautiousBaseline, evaluateDecisionLayer } from "./evaluation.js";

describe("AI decision layer labelled evaluation", () => {
  it("contains at least 80 labelled field-operations cases", () => {
    expect(aiEvaluationCases.length).toBeGreaterThanOrEqual(80);
    expect(aiEvaluationCases.some((item) => item.expectedRecommendationEligible)).toBe(true);
    expect(aiEvaluationCases.some((item) => item.expectedAbstention)).toBe(true);
  });

  it("meets the precision-first pilot thresholds", () => {
    const metrics = evaluateDecisionLayer(aiEvaluationCases);

    expect(metrics.recommendationPrecision).toBeGreaterThanOrEqual(0.9);
    expect(metrics.inspectionFalsePositiveRate).toBeLessThanOrEqual(0.05);
    expect(metrics.followUpFalsePositiveRate).toBeLessThanOrEqual(0.1);
    expect(metrics.duplicateRecommendationRate).toBeLessThanOrEqual(0.02);
  });

  it("abstains from acknowledgement and context-free completion replies", () => {
    expect(cautiousBaseline("Okay noted.")).toMatchObject({
      abstention: true,
      recommendationEligible: false,
      relevance: "NON_OPERATIONAL"
    });
    expect(cautiousBaseline("Done")).toMatchObject({
      abstention: true,
      recommendationEligible: false,
      relevance: "AMBIGUOUS"
    });
  });
});
