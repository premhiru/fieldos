import type { ClassifyMessageV2Input } from "../types.js";

export const messageClassificationPromptVersionV2 = "message-classification.v2.4";

export const messageClassificationOutputContractV2 = `
Use these exact JSON types and enum values:
- relevance: "OPERATIONAL" | "NON_OPERATIONAL" | "AMBIGUOUS"
- primaryCategory and each secondarySignals item: "PROGRESS_UPDATE" | "DEFECT" | "DELAY" | "SAFETY_ISSUE" | "DELIVERY" | "INSPECTION_REQUEST" | "CLIENT_APPROVAL" | "VARIATION_ORDER" | "RFI" | "MATERIAL_ISSUE" | "MANPOWER_ISSUE" | "DECISION" | "COMMITMENT" | "QUESTION" | "ACKNOWLEDGEMENT" | "GENERAL_NOTE" | "UNKNOWN"
- Approval requests are QUESTION or DECISION. CLIENT_APPROVAL means approval was actually given. Never emit APPROVAL_REQUEST or another unlisted category.
- operationalImpact: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
- responseExpectation: an object with type, status, dueAt, evidence, expectedResponder, requestedItem
- responseExpectation.type: "NONE" | "QUESTION" | "COMMITMENT" | "DOCUMENT" | "PHOTO" | "APPROVAL" | "DECISION" | "DELIVERY_UPDATE" | "INSPECTION_RESULT"
- responseExpectation.status: "NONE" | "OPEN" | "RESOLVED" | "UNCLEAR"
- responseExpectation.dueAt: ISO 8601 date (YYYY-MM-DD), ISO 8601 timestamp, or null; never return an unresolved phrase such as "today" or "Friday"
- responseExpectation.evidence, expectedResponder, requestedItem: concise string or null
- completionClaim: "NONE" | "PARTIAL" | "CLAIMED" | "AMBIGUOUS"
- inspectionReadiness: "NONE" | "NOT_READY" | "READY_CLAIMED" | "REQUESTED" | "AMBIGUOUS"
- recommendationEligible: boolean
- recommendationEligibilityReason: concise string explaining why a recommendation is or is not eligible
- abstentionReason: REQUIRED non-empty concise string when recommendationEligible=false; null only when recommendationEligible=true
- factualClaims: array of {type, subject, statement, status, confidence}; status is "ASSERTED" | "TENTATIVE" | "NEGATED"
- locations: array of concise location strings
- referencedDates: array of {phrase, resolvedDate, confidence}; resolvedDate is an ISO 8601 date (YYYY-MM-DD), ISO 8601 timestamp, or null; use null when the supplied context cannot resolve the phrase
- ambiguity: {isAmbiguous, missingContext}; missingContext is an array of concise strings
- If ambiguity.isAmbiguous is true, relevance must be AMBIGUOUS. If relevance is OPERATIONAL or NON_OPERATIONAL, ambiguity.isAmbiguous must be false. Put non-blocking limitations in uncertainty instead.
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
Represent all material signals: choose one primary category and up to five secondary signals. A defect may coexist with a delay.
Acknowledgements are not progress. Questions are QUESTION unless they genuinely request technical or project information, in which case RFI may apply.
An approval request is QUESTION or DECISION, not CLIENT_APPROVAL. A message confirming approval was given may be CLIENT_APPROVAL.
"Done", "Complete", "Completed", or "Finished" as a context-free short reply is AMBIGUOUS with primaryCategory UNKNOWN. A bare "Okay" without reply context is AMBIGUOUS; "Okay noted" is an acknowledgement. "Okay" may otherwise be acknowledgement, approval, or permission; use context and abstain when unclear.
A delivery is not automatically progress. "Completed" and "installed" are claims, not proof of completion or inspection readiness.
A photo is not proof of the sender's claim. Use the supplied photo summary and limitations cautiously.
Routine chatter is NON_OPERATIONAL. A clear project progress update remains OPERATIONAL even when it is routine and recommendationEligible=false. Unclear messages are AMBIGUOUS. Prefer abstention over guessing.
Use AMBIGUOUS only when missing context prevents a reliable classification. Missing quantities, proof, or completion detail do not make an otherwise clear routine progress update ambiguous.
Routine informational progress normally has recommendationEligible=false. Evidence is not automatically work.
recommendationEligible means the evidence is strong enough to create a candidate for the central recommendation gate. It does not approve an action and does not certify the sender's claim.
Set recommendationEligible=true with confidence >= 0.75 when the message clearly supports a material candidate: a defect or safety issue requiring verification or rectification; a delay, material issue, or manpower issue affecting work; a technical RFI requiring resolution; a client approval with an explicit downstream action; a variation requiring confirmation; an explicit scoped inspection request with prerequisites claimed complete; or an overdue unresolved expectation requiring a specific follow-up.
Treat a named technical RFI with a specific requested clarification as material even when the sender does not state the downstream delay. Treat a variation that adds a concrete work scope as material because it requires scope coordination or confirmation.
An explicit inspection request may be candidate-eligible without certifying completion. Record READY_CLAIMED or REQUESTED, preserve uncertainty, and let the central gate check evidence and prerequisites.
An overdue expectation may be candidate-eligible even when follow-up is a standard workflow, provided requestedItem, evidence, and dueAt identify the actual unresolved request.
When an explicitly overdue commitment names a weekday without a date, resolve dueAt to the most recent occurrence of that weekday before the message timestamp in the project timezone. Otherwise leave unresolved relative dates null. If an overdue expectation has no confidently resolved dueAt, set recommendationEligible=false rather than routing it to a different action.
Do not require the sender to prescribe the remediation, assignee, or escalation before a clear material defect, delay, or safety signal can become candidate-eligible.
Keep recommendationEligible=false for routine progress, ordinary delivery, acknowledgement, social chatter, vague or partial completion, future commitments not yet due, resolved requests, unsupported photo-only claims, and generic questions with no material project consequence.
Do not certify completion, inspection readiness, compliance, safety, workmanship, quantities, or hidden conditions.
An unanswered request or commitment must identify the requested item and supporting evidence.
When the current message resolves a supplied unresolved expectation, use status RESOLVED and copy that expectation's requestedItem exactly so deterministic persistence can close the correct record.
An explicit project request or RFI closure is operational evidence with responseExpectation.status RESOLVED, but it is not recommendation-eligible unless it creates a separate material downstream action. When the message explicitly says an RFI response was received or an RFI clarification was resolved, use primaryCategory RFI rather than GENERAL_NOTE.
If evidence is insufficient, ambiguous, non-operational, or already resolved, abstain and explain briefly.
Keep summary, uncertainty, abstentionReason, and userFacingReason concise and user-facing. Never output chain-of-thought.

Required keys:
relevance, primaryCategory, secondarySignals, operationalImpact, responseExpectation,
completionClaim, inspectionReadiness, recommendationEligible, recommendationEligibilityReason,
abstentionReason, summary, factualClaims, location, locations, referencedDates, ambiguity,
confidence, uncertainty, userFacingReason

${messageClassificationOutputContractV2}
`.trim();

export function buildMessageClassificationUserPromptV2(input: ClassifyMessageV2Input): string {
  return JSON.stringify({
    currentEvidence: {
      attachmentSummary: input.evidenceSummary,
      messageId: input.messageId,
      messageText: input.messageText,
      direction: input.messageDirection,
      messageType: input.messageType,
      occurredAt: input.timestamp.toISOString(),
      senderName: input.sender.displayName,
      senderRole: input.sender.role,
      voiceTranscript: input.voiceTranscript
    },
    boundedContext: {
      activeMilestones: input.activeMilestones,
      conversation: input.conversation,
      openActionItems: input.openActionItems,
      operatingContext: input.operatingContext,
      photoAnalyses: input.photoAnalyses,
      project: input.project,
      projectState: input.projectState,
      recentMessages: input.recentMessages.map((message) => ({
        ...message,
        occurredAt: message.occurredAt.toISOString()
      })),
      recentTimelineEvents: input.recentTimelineEvents.map((event) => ({
        ...event,
        occurredAt: event.occurredAt.toISOString()
      })),
      replyContext: input.replyContext
        ? { ...input.replyContext, occurredAt: input.replyContext.occurredAt.toISOString() }
        : null,
      unresolvedExpectations: input.unresolvedExpectations.map((expectation) => ({
        ...expectation,
        dueAt: expectation.dueAt?.toISOString() ?? null
      }))
    }
  });
}
