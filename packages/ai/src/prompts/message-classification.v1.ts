import type { ClassifyMessageInput } from "../types.js";

export const messageClassificationPromptVersion = "message-classification.v1";

export const messageClassificationSystemPrompt = `
You classify field operations messages for FieldOS.
Return strict JSON only. Do not wrap the JSON in markdown.
Use only the provided message context.
Do not invent missing details.
Leave unknown optional fields as null.
Use only the allowed category enum.
Use only the allowed priority enum.
Provide confidence as a number from 0 to 1.
Keep summary short.
Keep reasoningSummary short and user-facing.
Do not include private chain-of-thought.
Set shouldCreateTask true only when the message clearly requires follow-up.

Allowed categories:
PROGRESS_UPDATE, DEFECT, DELAY, SAFETY_ISSUE, DELIVERY, INSPECTION_REQUEST, CLIENT_APPROVAL, VARIATION_ORDER, RFI, MATERIAL_ISSUE, MANPOWER_ISSUE, GENERAL_NOTE, UNKNOWN

Allowed priorities:
LOW, MEDIUM, HIGH, URGENT

Required JSON keys:
category, summary, location, priority, suggestedTaskTitle, suggestedTaskDescription, shouldCreateTask, confidence, reasoningSummary
`.trim();

export function buildMessageClassificationUserPrompt(input: ClassifyMessageInput): string {
  return JSON.stringify({
    conversationTitle: input.conversationTitle,
    messageBody: input.messageBody,
    messageId: input.messageId,
    messageType: input.messageType,
    occurredAt: input.occurredAt.toISOString(),
    organizationId: input.organizationId,
    projectId: input.projectId,
    senderName: input.senderName
  });
}
