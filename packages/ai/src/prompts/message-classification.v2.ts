import type { ClassifyMessageV2Input } from "../types.js";

export const messageClassificationPromptVersionV2 = "message-classification.v2";

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
