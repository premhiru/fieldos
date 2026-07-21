import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  MessageClassifierV2,
  aiEvaluationCases,
  createConfiguredAIProvider,
  evaluateDecisionLayer,
  isAIProviderRateLimitError,
  type AIEvaluationCase,
  type AIEvaluationPrediction,
  type AIEvaluationRun,
  type ClassifyMessageV2Input,
  type ClassifyMessageV2Result
} from "../packages/ai/src/index.js";
import { messageClassificationPromptVersionV2 } from "../packages/ai/src/prompts/message-classification.v2.js";
import {
  isFollowUpEligible,
  isInspectionEligible,
  isRoutineProgress,
  recommendationFingerprint,
  semanticScopeForDecision
} from "../packages/coordinators/src/decision-policy.js";

const policyVersion = "recommendation-policy.v2.1";
const schemaVersion = "2.2";
const defaultOutput = resolve(
  dirname(process.argv[1] ?? "scripts/run-ai-evaluation.ts"),
  "../packages/ai/src/evaluation-results.v2.json"
);

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  let fallbackCount = 0;
  const configured = createConfiguredAIProvider({
    onFallback: () => {
      fallbackCount += 1;
    }
  });
  const classifier = new MessageClassifierV2({
    model: configured.model,
    provider: configured.provider
  });
  const selectedCases = aiEvaluationCases
    .filter((testCase) => !options.caseId || testCase.id === options.caseId)
    .slice(0, options.limit ?? aiEvaluationCases.length);

  if (selectedCases.length === 0) {
    throw new Error("No evaluation cases matched the supplied options.");
  }

  const predictions: AIEvaluationPrediction[] = [];
  const createdFingerprints = new Set<string>();

  for (const [index, testCase] of selectedCases.entries()) {
    let prediction: AIEvaluationPrediction;
    try {
      const classification = await classifyWithRetry(testCase, classifier);
      prediction = projectDecision(testCase, classification, createdFingerprints);
      process.stdout.write(
        `[${index + 1}/${selectedCases.length}] ${testCase.id}: ${classification.relevance}/${classification.primaryCategory} eligible=${classification.recommendationEligible} -> ${prediction.decision} ${prediction.recommendationType ?? "NONE"}\n`
      );
      if (options.caseId) {
        process.stdout.write(
          `${JSON.stringify({
            completionClaim: classification.completionClaim,
            confidence: classification.confidence,
            inspectionReadiness: classification.inspectionReadiness,
            reasonCode: prediction.reasonCode,
            responseExpectation: classification.responseExpectation
          })}\n`
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      prediction = {
        caseId: testCase.id,
        classification: null,
        decision: "SUPPRESS",
        error: errorMessage,
        fingerprint: null,
        reasonCode: "EVALUATION_ERROR",
        recommendationType: null
      };
      process.stdout.write(
        `[${index + 1}/${selectedCases.length}] ${testCase.id}: ERROR ${errorMessage.split("\n")[0]}\n`
      );
    }
    predictions.push(prediction);
    if (index < selectedCases.length - 1) await sleep(options.delayMs);
  }

  const run: AIEvaluationRun = {
    metadata: {
      completedAt: new Date().toISOString(),
      fallbackCount,
      model: classifier.model,
      policyVersion,
      promptVersion: messageClassificationPromptVersionV2,
      schemaVersion
    },
    predictions
  };

  if (!options.caseId && !options.limit) {
    await writeFile(options.output, `${JSON.stringify(run, null, 2)}\n`, "utf8");
  }

  process.stdout.write(
    `${JSON.stringify(evaluateDecisionLayer(selectedCases, predictions), null, 2)}\n`
  );
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});

async function classifyWithRetry(
  testCase: AIEvaluationCase,
  classifier: MessageClassifierV2
): Promise<ClassifyMessageV2Result> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await classifier.classifyMessage(buildInput(testCase));
    } catch (error) {
      if (!isAIProviderRateLimitError(error) || attempt === 3) throw error;
      const retryAfterMs = Math.min(error.retryAfterMs ?? 15_000 * 2 ** attempt, 120_000);
      process.stdout.write(
        `${testCase.id}: provider rate limited; retrying in ${retryAfterMs} ms\n`
      );
      await sleep(retryAfterMs);
    }
  }
  throw new Error(`Evaluation exhausted retries for ${testCase.id}.`);
}

function buildInput(testCase: AIEvaluationCase): ClassifyMessageV2Input {
  const timestamp = new Date(testCase.occurredAt ?? "2026-07-21T03:00:00.000Z");
  const voiceTranscript = testCase.text.startsWith("Voice transcript:")
    ? testCase.text.replace(/^Voice transcript:\s*/i, "")
    : null;
  const photoCaption = testCase.text.startsWith("Photo caption:")
    ? testCase.text.replace(/^Photo caption:\s*/i, "")
    : null;
  const isVoice = Boolean(voiceTranscript);
  const isPhoto = Boolean(photoCaption);
  const messageText = isVoice ? null : (photoCaption ?? testCase.text);

  return {
    activeMilestones: [],
    attachedDocuments: [],
    attachedPhotos: isPhoto ? [attachment("photo-1", "image/jpeg", timestamp)] : [],
    attachedVideos: [],
    attachedVoiceNotes: isVoice
      ? [
          {
            ...attachment("voice-1", "audio/ogg", timestamp),
            transcript: voiceTranscript,
            transcriptionError: null,
            transcriptionStatus: "COMPLETED"
          }
        ]
      : [],
    conversation: {
      channel: "WHATSAPP",
      id: "evaluation-conversation",
      isGroup: true,
      title: "Pilot field updates"
    },
    evidenceSummary: {
      attachmentCount: Number(isPhoto) + Number(isVoice),
      documentCount: 0,
      labels: isPhoto ? ["photo"] : isVoice ? ["voice-note"] : [],
      pdfCount: 0,
      photoCount: Number(isPhoto),
      videoCount: 0,
      voiceNoteCount: Number(isVoice)
    },
    externalMessageId: `evaluation:${testCase.id}`,
    messageId: testCase.id,
    messageMetadata: {
      attachmentCount: Number(isPhoto) + Number(isVoice),
      hasTranscript: isVoice,
      transcriptionFailed: false,
      transcriptionPending: false
    },
    messageText,
    messageDirection: "INBOUND",
    messageType: isPhoto ? "IMAGE" : isVoice ? "VOICE" : "TEXT",
    openActionItems: [],
    operatingContext: operatingContext(timestamp),
    organizationId: "evaluation-organization",
    photoAnalyses: isPhoto ? [photoContext(photoCaption ?? "")] : [],
    processingStatus: "AI_PENDING",
    project: {
      code: "EVAL",
      id: "evaluation-project",
      name: "Field Operations Pilot Project",
      status: "ACTIVE",
      timezone: "Asia/Singapore"
    },
    projectState: {
      health: "HEALTHY",
      nextMilestone: null,
      pendingDecisionSummary: null,
      recentBlockerSummary: null,
      recentProgressSummary: null
    },
    recentMessages: (testCase.recentMessages ?? []).map((message, index) => ({
      ...message,
      id: `${testCase.id}:context:${index + 1}`,
      occurredAt: new Date(message.occurredAt)
    })),
    recentTimelineEvents: [],
    replyContext: null,
    sender: {
      displayName: "Site Supervisor",
      externalIdentifier: "evaluation-supervisor",
      id: "evaluation-participant",
      role: "FIELD_SUPERVISOR"
    },
    timestamp,
    unresolvedExpectations: (testCase.unresolvedExpectations ?? []).map((expectation) => ({
      ...expectation,
      dueAt: expectation.dueAt ? new Date(expectation.dueAt) : null,
      id: `expectation:${expectation.sourceMessageId}`
    })),
    voiceTranscript
  };
}

function projectDecision(
  testCase: AIEvaluationCase,
  classification: ClassifyMessageV2Result,
  createdFingerprints: Set<string>
): AIEvaluationPrediction {
  const base = {
    caseId: testCase.id,
    classification,
    error: null,
    fingerprint: null,
    recommendationType: null
  };
  const evaluationProjectId = `evaluation-project:${testCase.scenarioKey ?? testCase.id}`;
  if (classification.relevance === "AMBIGUOUS" || classification.ambiguity.isAmbiguous) {
    return {
      ...base,
      decision: "REQUEST_CLARIFICATION",
      reasonCode: "AMBIGUOUS"
    };
  }
  if (!classification.recommendationEligible || classification.relevance !== "OPERATIONAL") {
    return {
      ...base,
      decision: "SUPPRESS",
      reasonCode:
        classification.relevance === "NON_OPERATIONAL" ? "NON_OPERATIONAL" : "NOT_ELIGIBLE"
    };
  }

  const scope = semanticScopeForDecision(classification);
  const secondarySignals = classification.secondarySignals;
  const explicitInspectionRequired =
    classification.primaryCategory === "INSPECTION_REQUEST" ||
    classification.inspectionReadiness === "REQUESTED" ||
    secondarySignals.includes("INSPECTION_REQUEST");
  let recommendationType: "ACTION_ITEM" | "FOLLOW_UP" | "INSPECTION" | null = null;
  let actionType = "CREATE_ACTION_ITEM";
  let businessScope = scope;

  if (
    isInspectionEligible({
      completionClaim: classification.completionClaim,
      confidence: classification.confidence,
      explicitInspectionRequired,
      hasOpenInspection: false,
      hasUnresolvedPrerequisite: classification.inspectionReadiness === "NOT_READY",
      inspectionReadiness: classification.inspectionReadiness,
      scope,
      sourceMessageId: testCase.id
    })
  ) {
    recommendationType = "INSPECTION";
    actionType = "SCHEDULE_INSPECTION_REMINDER";
  } else if (
    isFollowUpEligible({
      confidence: classification.confidence,
      conversationActive: true,
      dueAt: classification.responseExpectation.dueAt
        ? new Date(classification.responseExpectation.dueAt)
        : null,
      expectedResponder: classification.responseExpectation.expectedResponder,
      now: new Date(testCase.occurredAt ?? "2026-07-21T03:00:00.000Z"),
      projectStatus: "ACTIVE",
      requestedItem: classification.responseExpectation.requestedItem ?? "",
      status: classification.responseExpectation.status
    })
  ) {
    recommendationType = "FOLLOW_UP";
    actionType = "SEND_WHATSAPP_MESSAGE_DRAFT";
    businessScope = classification.responseExpectation.requestedItem ?? scope;
  } else if (hasMaterialActionSignal(classification) && !isRoutineClassification(classification)) {
    recommendationType = "ACTION_ITEM";
  }

  if (!recommendationType) {
    return { ...base, decision: "SUPPRESS", reasonCode: "NO_ACTIONABLE_CANDIDATE" };
  }

  const fingerprint = recommendationFingerprint({
    actionType,
    businessKey: testCase.scenarioKey ?? null,
    projectId: evaluationProjectId,
    scope: businessScope,
    type: recommendationType
  });
  if (createdFingerprints.has(fingerprint)) {
    return {
      ...base,
      decision: "SUPPRESS",
      fingerprint,
      reasonCode: "DUPLICATE_PENDING"
    };
  }
  createdFingerprints.add(fingerprint);

  return {
    ...base,
    decision: "CREATE",
    fingerprint,
    reasonCode: "ELIGIBLE",
    recommendationType
  };
}

function isRoutineClassification(classification: ClassifyMessageV2Result): boolean {
  return isRoutineProgress({
    completionClaim: classification.completionClaim,
    operationalImpact: classification.operationalImpact,
    primaryCategory: classification.primaryCategory,
    recommendationEligible: classification.recommendationEligible,
    responseExpectationStatus: classification.responseExpectation.status,
    secondarySignals: classification.secondarySignals
  });
}

function hasMaterialActionSignal(classification: ClassifyMessageV2Result): boolean {
  const material = new Set([
    "CLIENT_APPROVAL",
    "DEFECT",
    "DELAY",
    "MANPOWER_ISSUE",
    "MATERIAL_ISSUE",
    "RFI",
    "SAFETY_ISSUE",
    "VARIATION_ORDER"
  ]);
  return [classification.primaryCategory, ...classification.secondarySignals].some((signal) =>
    material.has(signal)
  );
}

function attachment(id: string, mimeType: string, createdAt: Date) {
  return {
    createdAt,
    filename: `${id}.${mimeType === "image/jpeg" ? "jpg" : "ogg"}`,
    id,
    mimeType,
    size: 1024,
    storageKey: `evaluation/${id}`
  };
}

function photoContext(caption: string) {
  const damaged = /damaged|broken|crushed|torn/i.test(caption);
  return {
    analysisStatus: damaged ? "USEFUL" : "NO_OPERATIONAL_CONCLUSION",
    claimSupport: damaged ? "PARTIALLY_SUPPORTED" : "UNABLE_TO_DETERMINE",
    evidenceId: "photo-1",
    limitations: [
      "One image cannot establish hidden condition, function, quantity, or completion."
    ],
    operationalConclusion: damaged
      ? "Visible packaging damage warrants human verification of delivered contents."
      : "The image supports searchable observations only.",
    summary: damaged
      ? "Outer packaging appears visibly crushed or torn; the contents cannot be assessed."
      : "An equipment cabinet is visible; condition, function, and completion cannot be determined."
  };
}

function operatingContext(timestamp: Date): ClassifyMessageV2Input["operatingContext"] {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Singapore",
    weekday: "long"
  }).format(timestamp) as ClassifyMessageV2Input["operatingContext"]["weekday"];
  return {
    isWeekend: ["Saturday", "Sunday"].includes(weekday),
    localDateTime: new Intl.DateTimeFormat("en-CA", {
      dateStyle: "full",
      timeStyle: "long",
      timeZone: "Asia/Singapore"
    }).format(timestamp),
    timezone: "Asia/Singapore",
    weekday
  };
}

function parseOptions(args: string[]) {
  const valueAfter = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const limitValue = valueAfter("--limit");
  const delayValue = valueAfter("--delay-ms");
  return {
    caseId: valueAfter("--case"),
    delayMs: delayValue ? Math.max(Number(delayValue), 0) : 1_200,
    limit: limitValue ? Math.max(Number(limitValue), 1) : undefined,
    output: valueAfter("--output") ?? defaultOutput
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
