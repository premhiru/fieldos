import type { ClassifyMessageV2Input } from "../types.js";

export const messageClassificationPromptVersionV2 = "message-classification.v2";

export const messageClassificationOutputContractV2 = `
Use these exact JSON types and enum values:
- relevance: "OPERATIONAL" | "NON_OPERATIONAL" | "AMBIGUOUS"
- primaryCategory and each secondarySignals item: "PROGRESS_UPDATE" | "DEFECT" | "DELAY" | "SAFETY_ISSUE" | "DELIVERY" | "INSPECTION_REQUEST" | "CLIENT_APPROVAL" | "VARIATION_ORDER" | "RFI" | "MATERIAL_ISSUE" | "MANPOWER_ISSUE" | "GENERAL_NOTE" | "UNKNOWN"
- operationalImpact: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
- responseExpectation: an object with type, status, dueAt, evidence, expectedResponder, requestedItem
- responseExpectation.type: "NONE" | "QUESTION" | "COMMITMENT" | "DOCUMENT" | "PHOTO" | "APPROVAL" | "DECISION" | "DELIVERY_UPDATE" | "INSPECTION_RESULT"
- responseExpectation.status: "NONE" | "OPEN" | "RESOLVED" | "UNCLEAR"
- responseExpectation.dueAt: ISO 8601 timestamp or null
- responseExpectation.evidence, expectedResponder, requestedItem: concise string or null
- completionClaim: "NONE" | "PARTIAL" | "CLAIMED" | "AMBIGUOUS"
- inspectionReadiness: "NONE" | "NOT_READY" | "READY_CLAIMED" | "REQUESTED" | "AMBIGUOUS"
- recommendationEligible: boolean
- abstentionReason: REQUIRED non-empty concise string when recommendationEligible=false; null only when recommendationEligible=true
- summary: concise string
- location: concise string or null
- confidence: number from 0 to 1
- uncertainty: concise string or null
- userFacingReason: concise string
When there is no response expectation, return {"type":"NONE","status":"NONE","dueAt":null,"evidence":null,"expectedResponder":null,"requestedItem":null}.
Do not substitute booleans, title-case labels, or free-form labels for enum values.
`.trim();

export const messageClassificationSystemPromptV2 = `
You extract cautious operational facts from field-operation messages.
Return strict JSON only. Do not wrap JSON in markdown.
Use only the bounded context supplied. Never invent names, dates, scope, locations, commitments, or evidence.
Represent all material signals: choose one primary category and up to five secondary signals.
"Done", "completed", "installed", acknowledgements, and silence are ambiguous without clear scope or reply context.
Routine progress normally has recommendationEligible=false. Evidence is not automatically work.
recommendationEligible may be true only for a clear, useful operational decision with confidence >= 0.75.
Do not certify completion, inspection readiness, compliance, safety, workmanship, quantities, or hidden conditions.
An unanswered request or commitment must identify the requested item and supporting evidence.
If evidence is insufficient, ambiguous, non-operational, or already resolved, abstain and explain briefly.
Keep summary, uncertainty, abstentionReason, and userFacingReason concise and user-facing. Never output chain-of-thought.

Required keys:
relevance, primaryCategory, secondarySignals, operationalImpact, responseExpectation,
completionClaim, inspectionReadiness, recommendationEligible, abstentionReason,
summary, location, confidence, uncertainty, userFacingReason

${messageClassificationOutputContractV2}
`.trim();

export function buildMessageClassificationUserPromptV2(input: ClassifyMessageV2Input): string {
  return JSON.stringify({
    currentEvidence: {
      attachmentSummary: input.evidenceSummary,
      messageId: input.messageId,
      messageText: input.messageText,
      messageType: input.messageType,
      occurredAt: input.timestamp.toISOString(),
      senderName: input.sender.displayName,
      voiceTranscript: input.voiceTranscript
    },
    boundedContext: {
      activeMilestones: input.activeMilestones,
      conversation: input.conversation,
      openActionItems: input.openActionItems,
      project: input.project,
      projectState: input.projectState,
      recentMessages: input.recentMessages.map((message) => ({
        ...message,
        occurredAt: message.occurredAt.toISOString()
      })),
      recentTimelineEvents: input.recentTimelineEvents.map((event) => ({
        ...event,
        occurredAt: event.occurredAt.toISOString()
      }))
    }
  });
}
