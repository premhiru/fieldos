import type { AIMessageCategory } from "./types.js";

export interface AIEvaluationCase {
  expectedAbstention: boolean;
  expectedOperationalImpact: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  expectedPrimaryCategory: AIMessageCategory;
  expectedRecommendationEligible: boolean;
  expectedRecommendationType: string | null;
  expectedRelevance: "OPERATIONAL" | "NON_OPERATIONAL" | "AMBIGUOUS";
  expectedResponseExpectation: "NONE" | "OPEN" | "RESOLVED" | "UNCLEAR";
  expectedSecondarySignals: AIMessageCategory[];
  id: string;
  prohibitedRecommendationOutcomes: string[];
  text: string;
}

export interface AIEvaluationMetrics {
  abstentionAccuracy: number;
  duplicateRecommendationRate: number;
  followUpFalsePositiveRate: number;
  inspectionFalsePositiveRate: number;
  multiSignalPrecision: number;
  multiSignalRecall: number;
  primaryCategoryAccuracy: number;
  recommendationPrecision: number;
}

interface Prediction {
  abstention: boolean;
  operationalImpact: AIEvaluationCase["expectedOperationalImpact"];
  primaryCategory: AIMessageCategory;
  recommendationEligible: boolean;
  recommendationType: string | null;
  relevance: AIEvaluationCase["expectedRelevance"];
  responseExpectation: AIEvaluationCase["expectedResponseExpectation"];
  secondarySignals: AIMessageCategory[];
}

export function evaluateDecisionLayer(cases: AIEvaluationCase[]): AIEvaluationMetrics {
  const predictions = cases.map((testCase) => ({
    prediction: cautiousBaseline(testCase.text),
    testCase
  }));
  const total = Math.max(cases.length, 1);
  const recommended = predictions.filter(({ prediction }) => prediction.recommendationEligible);
  const trueRecommendations = recommended.filter(
    ({ testCase }) => testCase.expectedRecommendationEligible
  ).length;
  const inspectionFalsePositives = recommended.filter(
    ({ prediction, testCase }) =>
      prediction.recommendationType === "INSPECTION" && !testCase.expectedRecommendationEligible
  ).length;
  const inspectionNegatives = predictions.filter(
    ({ testCase }) => testCase.expectedRecommendationType !== "INSPECTION"
  ).length;
  const followUpFalsePositives = recommended.filter(
    ({ prediction, testCase }) =>
      prediction.recommendationType === "FOLLOW_UP" && !testCase.expectedRecommendationEligible
  ).length;
  const followUpNegatives = predictions.filter(
    ({ testCase }) => testCase.expectedRecommendationType !== "FOLLOW_UP"
  ).length;
  let signalTruePositive = 0;
  let signalFalsePositive = 0;
  let signalFalseNegative = 0;

  for (const { prediction, testCase } of predictions) {
    const expected = new Set(testCase.expectedSecondarySignals);
    const actual = new Set(prediction.secondarySignals);
    signalTruePositive += [...actual].filter((signal) => expected.has(signal)).length;
    signalFalsePositive += [...actual].filter((signal) => !expected.has(signal)).length;
    signalFalseNegative += [...expected].filter((signal) => !actual.has(signal)).length;
  }

  return {
    abstentionAccuracy: ratio(
      predictions.filter(
        ({ prediction, testCase }) => prediction.abstention === testCase.expectedAbstention
      ).length,
      total
    ),
    duplicateRecommendationRate: 0,
    followUpFalsePositiveRate: ratio(followUpFalsePositives, followUpNegatives),
    inspectionFalsePositiveRate: ratio(inspectionFalsePositives, inspectionNegatives),
    multiSignalPrecision: ratio(signalTruePositive, signalTruePositive + signalFalsePositive),
    multiSignalRecall: ratio(signalTruePositive, signalTruePositive + signalFalseNegative),
    primaryCategoryAccuracy: ratio(
      predictions.filter(
        ({ prediction, testCase }) =>
          prediction.primaryCategory === testCase.expectedPrimaryCategory
      ).length,
      total
    ),
    recommendationPrecision: ratio(trueRecommendations, recommended.length)
  };
}

export function cautiousBaseline(text: string): Prediction {
  const normalized = text.toLowerCase().trim();
  const acknowledgement =
    /^(?:(?:ok(?:ay)?)(?:\s+noted)?|noted|thanks|thank you|received|acknowledged)[.!]*$/.test(
      normalized
    );
  const ambiguous = /^(done|complete|completed|finished)[.!]*$/.test(normalized);
  const signals = detectSignals(normalized);
  const primaryCategory = signals[0] ?? (acknowledgement ? "GENERAL_NOTE" : "UNKNOWN");
  const secondarySignals = signals.slice(1);
  const partial = /\b(but|however|pending|remaining|not yet|except)\b/.test(normalized);
  const explicitInspection =
    /\b(arrange|request|ready for|book|schedule)\b.{0,35}\binspection\b|\binspection\b.{0,35}\b(arrange|request|required)\b/.test(
      normalized
    );
  const openExpectation =
    /\b(please|could you|can you|will send|will provide|by (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|\d{1,2}))\b/.test(
      normalized
    );
  const resolvedExpectation = /\b(attached|provided|sent|uploaded|confirmed as requested)\b/.test(
    normalized
  );
  const materialAction = [
    "DEFECT",
    "DELAY",
    "SAFETY_ISSUE",
    "MATERIAL_ISSUE",
    "MANPOWER_ISSUE",
    "VARIATION_ORDER",
    "RFI"
  ].includes(primaryCategory);
  const explicitFollowUp =
    openExpectation && /\b(overdue|still waiting|not received|due|by )\b/.test(normalized);
  const recommendationEligible =
    !acknowledgement &&
    !ambiguous &&
    !partial &&
    (materialAction ||
      explicitInspection ||
      explicitFollowUp ||
      /approved.+(?:proceed|release|order)/.test(normalized));
  const recommendationType = explicitInspection
    ? "INSPECTION"
    : explicitFollowUp
      ? "FOLLOW_UP"
      : recommendationEligible
        ? "ACTION_ITEM"
        : null;
  const relevance = acknowledgement
    ? "NON_OPERATIONAL"
    : ambiguous
      ? "AMBIGUOUS"
      : signals.length > 0
        ? "OPERATIONAL"
        : "NON_OPERATIONAL";

  return {
    abstention: !recommendationEligible,
    operationalImpact:
      acknowledgement || ambiguous
        ? "NONE"
        : recommendationEligible
          ? primaryCategory === "SAFETY_ISSUE"
            ? "CRITICAL"
            : "HIGH"
          : "LOW",
    primaryCategory,
    recommendationEligible,
    recommendationType,
    relevance,
    responseExpectation: resolvedExpectation
      ? "RESOLVED"
      : openExpectation
        ? "OPEN"
        : ambiguous
          ? "UNCLEAR"
          : "NONE",
    secondarySignals
  };
}

function detectSignals(text: string): AIMessageCategory[] {
  const signals: AIMessageCategory[] = [];
  const add = (signal: AIMessageCategory, pattern: RegExp) => {
    if (pattern.test(text) && !signals.includes(signal)) signals.push(signal);
  };
  add("SAFETY_ISSUE", /\b(unsafe|injury|hazard|exposed live|no harness|smoke|fire)\b/);
  add("DEFECT", /\b(defect|failed|damaged|broken|leak|crack|faulty)\b/);
  add("DELAY", /\b(delay|delayed|late|behind|postponed|slipped|not arrive)\b/);
  add("DELIVERY", /\b(deliver|delivery|shipment|materials arrived|pallet)\b/);
  add("INSPECTION_REQUEST", /\binspect|inspection\b/);
  add("CLIENT_APPROVAL", /\b(client|consultant).{0,25}\b(approved|approval)\b|\bapproved by\b/);
  add("VARIATION_ORDER", /\b(variation|change order|additional scope)\b/);
  add("RFI", /\b(rfi|clarify|clarification|which drawing|confirm detail)\b/);
  add("MATERIAL_ISSUE", /\b(material shortage|out of stock|wrong material|missing material)\b/);
  add("MANPOWER_ISSUE", /\b(manpower|crew shortage|understaffed|no electrician)\b/);
  add("PROGRESS_UPDATE", /\b(installed|completed|progress|started|finished|commissioned|tested)\b/);
  return signals;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : Math.round((numerator / denominator) * 10_000) / 10_000;
}
