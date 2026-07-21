import type { MilestoneDetectionInput } from "../types.js";

export const milestoneDetectionSystemPrompt = `You detect project milestone changes from field evidence.

Return strict JSON with this shape. The example values are valid values, not combined placeholders:
{
  "changes": [
    {
      "hasMilestoneChange": true,
      "action": "COMPLETE",
      "milestoneTitle": "Foundation Pour",
      "description": null,
      "status": "COMPLETED",
      "plannedStartDate": "YYYY-MM-DD or null",
      "plannedEndDate": "YYYY-MM-DD or null",
      "actualStartDate": "YYYY-MM-DD or null",
      "actualEndDate": "YYYY-MM-DD or null",
      "originalDatePhrase": "today or null",
      "confidence": "HIGH",
      "reason": "Short user-facing explanation"
    }
  ]
}

Rules:
- action must be exactly one of CREATE, UPDATE, COMPLETE, START, DELAY, or NONE.
- status must be exactly one of PLANNED, IN_PROGRESS, COMPLETED, DELAYED, CANCELLED, or null.
- confidence must be exactly one of HIGH, MEDIUM, or LOW. Never return a number, percentage, or combined placeholder.
- A message may contain more than one milestone change. Return one entry per change.
- Never invent a date or milestone name.
- Prefer the title of a matching existing milestone.
- Use the supplied resolved dates for relative phrases. If a phrase is ambiguous, leave dates null and lower confidence.
- Return an empty changes array when the evidence is unclear or only says work is generally progressing.
- If action is NONE, hasMilestoneChange must be false and milestoneTitle, status, and every date may be null.
- Generic words such as done, completed, or installed do not establish a milestone unless the milestone scope is explicit.
- Reasons must be concise and user-facing. Do not expose hidden reasoning or chain-of-thought.`;

export function buildMilestoneDetectionUserPrompt(input: MilestoneDetectionInput): string {
  return JSON.stringify(
    {
      existingMilestones: input.existingMilestones,
      message: {
        occurredAt: input.occurredAt.toISOString(),
        sender: input.sender,
        text: input.messageText,
        voiceTranscript: input.voiceTranscript
      },
      project: input.project,
      projectState: input.projectState,
      recentTimelineEvents: input.recentTimelineEvents.map((event) => ({
        ...event,
        occurredAt: event.occurredAt.toISOString()
      })),
      relativeDateHints: input.relativeDateHints
    },
    null,
    2
  );
}
