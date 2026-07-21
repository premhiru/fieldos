import type { AIMessageCategory, ClassifyMessageV2Result } from "./types.js";

export interface AIEvaluationContextMessage {
  body: string;
  direction: "INBOUND" | "OUTBOUND";
  occurredAt: string;
  relation: "PRECEDING" | "SUBSEQUENT";
  senderName: string;
}

export interface AIEvaluationExpectation {
  dueAt: string | null;
  expectedResponder: string | null;
  requestedItem: string;
  sourceMessageId: string;
  type:
    | "QUESTION"
    | "COMMITMENT"
    | "DOCUMENT"
    | "PHOTO"
    | "APPROVAL"
    | "DECISION"
    | "DELIVERY_UPDATE"
    | "INSPECTION_RESULT";
}

export interface AIEvaluationCase {
  duplicateOf?: string;
  expectedAbstention: boolean;
  expectedOperationalImpact: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  expectedPrimaryCategory: AIMessageCategory;
  expectedRecommendationEligible: boolean;
  expectedRecommendationType: string | null;
  expectedRelevance: "OPERATIONAL" | "NON_OPERATIONAL" | "AMBIGUOUS";
  expectedResponseExpectation: "NONE" | "OPEN" | "RESOLVED" | "UNCLEAR";
  expectedSecondarySignals: AIMessageCategory[];
  id: string;
  occurredAt?: string;
  prohibitedRecommendationOutcomes: string[];
  recentMessages?: AIEvaluationContextMessage[];
  scenarioKey?: string;
  text: string;
  unresolvedExpectations?: AIEvaluationExpectation[];
}

export interface AIEvaluationPrediction {
  caseId: string;
  classification: ClassifyMessageV2Result | null;
  decision: "CREATE" | "SUPPRESS" | "REQUEST_CLARIFICATION";
  error: string | null;
  fingerprint: string | null;
  reasonCode: string;
  recommendationType: string | null;
}

export interface AIEvaluationRun {
  metadata: {
    completedAt: string;
    fallbackCount: number;
    model: string;
    policyVersion: string;
    promptVersion: string;
    schemaVersion: string;
  };
  predictions: AIEvaluationPrediction[];
}

export interface AIEvaluationMetrics {
  abstentionAccuracy: number;
  duplicateRecommendationRate: number;
  evaluationFailureRate: number;
  falsePositiveRecommendationRate: number;
  followUpFalsePositiveRate: number;
  inspectionFalsePositiveRate: number;
  multiSignalPrecision: number;
  multiSignalRecall: number;
  primaryCategoryAccuracy: number;
  recommendationPrecision: number;
  recommendationRecall: number;
}

export function evaluateDecisionLayer(
  cases: AIEvaluationCase[],
  predictions: AIEvaluationPrediction[]
): AIEvaluationMetrics {
  const predictionByCase = new Map<string, AIEvaluationPrediction>();
  for (const prediction of predictions) {
    if (predictionByCase.has(prediction.caseId)) {
      throw new Error(`Duplicate evaluation prediction for ${prediction.caseId}.`);
    }
    predictionByCase.set(prediction.caseId, prediction);
  }

  const evaluated = cases.map((testCase) => {
    const prediction = predictionByCase.get(testCase.id);
    if (!prediction) throw new Error(`Missing evaluation prediction for ${testCase.id}.`);
    return { prediction, testCase };
  });
  const unexpectedPredictions = predictions.filter(
    (prediction) => !cases.some((testCase) => testCase.id === prediction.caseId)
  );
  if (unexpectedPredictions.length > 0) {
    throw new Error(
      `Unexpected evaluation predictions: ${unexpectedPredictions
        .map((prediction) => prediction.caseId)
        .join(", ")}.`
    );
  }

  const total = Math.max(cases.length, 1);
  const created = evaluated.filter(({ prediction }) => prediction.decision === "CREATE");
  const expectedRecommendations = evaluated.filter(
    ({ testCase }) => testCase.expectedRecommendationEligible
  );
  const trueRecommendations = created.filter(({ prediction, testCase }) =>
    recommendationMatches(prediction, testCase)
  ).length;
  const falsePositiveRecommendations = created.length - trueRecommendations;
  const inspectionFalsePositives = created.filter(
    ({ prediction, testCase }) =>
      prediction.recommendationType === "INSPECTION" &&
      testCase.expectedRecommendationType !== "INSPECTION"
  ).length;
  const inspectionNegatives = evaluated.filter(
    ({ testCase }) => testCase.expectedRecommendationType !== "INSPECTION"
  ).length;
  const followUpFalsePositives = created.filter(
    ({ prediction, testCase }) =>
      prediction.recommendationType === "FOLLOW_UP" &&
      testCase.expectedRecommendationType !== "FOLLOW_UP"
  ).length;
  const followUpNegatives = evaluated.filter(
    ({ testCase }) => testCase.expectedRecommendationType !== "FOLLOW_UP"
  ).length;
  const duplicateCases = evaluated.filter(({ testCase }) => Boolean(testCase.duplicateOf));
  const duplicateCreates = duplicateCases.filter(
    ({ prediction }) => prediction.decision === "CREATE"
  ).length;
  const failedPredictions = evaluated.filter(
    ({ prediction }) => Boolean(prediction.error) || !prediction.classification
  );
  let signalTruePositive = 0;
  let signalFalsePositive = 0;
  let signalFalseNegative = 0;

  for (const { prediction, testCase } of evaluated) {
    const expected = new Set(testCase.expectedSecondarySignals);
    if (!prediction.classification) {
      signalFalseNegative += expected.size;
      continue;
    }
    const actual = new Set(prediction.classification.secondarySignals);
    signalTruePositive += [...actual].filter((signal) => expected.has(signal)).length;
    signalFalsePositive += [...actual].filter((signal) => !expected.has(signal)).length;
    signalFalseNegative += [...expected].filter((signal) => !actual.has(signal)).length;
  }

  return {
    abstentionAccuracy: ratio(
      evaluated.filter(
        ({ prediction, testCase }) =>
          !prediction.error &&
          Boolean(prediction.classification) &&
          (prediction.decision !== "CREATE") === testCase.expectedAbstention
      ).length,
      total
    ),
    duplicateRecommendationRate: ratioOrZero(duplicateCreates, duplicateCases.length),
    evaluationFailureRate: ratio(failedPredictions.length, total),
    falsePositiveRecommendationRate: ratioOrZero(falsePositiveRecommendations, created.length),
    followUpFalsePositiveRate: ratioOrZero(followUpFalsePositives, followUpNegatives),
    inspectionFalsePositiveRate: ratioOrZero(inspectionFalsePositives, inspectionNegatives),
    multiSignalPrecision: ratio(signalTruePositive, signalTruePositive + signalFalsePositive),
    multiSignalRecall: ratio(signalTruePositive, signalTruePositive + signalFalseNegative),
    primaryCategoryAccuracy: ratio(
      evaluated.filter(
        ({ prediction, testCase }) =>
          prediction.classification?.primaryCategory === testCase.expectedPrimaryCategory
      ).length,
      total
    ),
    recommendationPrecision: ratio(trueRecommendations, created.length),
    recommendationRecall: ratio(trueRecommendations, expectedRecommendations.length)
  };
}

function recommendationMatches(
  prediction: AIEvaluationPrediction,
  testCase: AIEvaluationCase
): boolean {
  return (
    !prediction.error &&
    Boolean(prediction.classification) &&
    testCase.expectedRecommendationEligible &&
    prediction.recommendationType === testCase.expectedRecommendationType
  );
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : Math.round((numerator / denominator) * 10_000) / 10_000;
}

function ratioOrZero(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : ratio(numerator, denominator);
}
