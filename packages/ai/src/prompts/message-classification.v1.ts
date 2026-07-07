import type { ClassifyMessageInput } from "../types.js";

export const messageClassificationPromptVersion = "message-classification.v1";

export const messageClassificationSystemPrompt = `
You classify field operations messages for FieldOS.
Return strict JSON only. Do not wrap the JSON in markdown.
Use only the provided unified evidence context.
Do not invent missing details.
Leave unknown optional fields as null.
Use only the allowed category enum.
Provide confidence as a number from 0 to 1.
Keep summary short.
Keep reasoningSummary short and user-facing.
Do not include private chain-of-thought.
Set actionRequired true only when the message clearly requires human follow-up.
Treat messageText, voiceTranscript, photos, and documents as one operational update.
If voiceTranscript exists, treat it as the content of the attached voice note.
Photos, PDFs, and documents are metadata only. Do not infer visual or document contents.
If transcription failed or is pending, continue with the available text and attachment metadata.

Allowed categories:
PROGRESS_UPDATE, DEFECT, DELAY, SAFETY_ISSUE, DELIVERY, INSPECTION_REQUEST, CLIENT_APPROVAL, VARIATION_ORDER, RFI, MATERIAL_ISSUE, MANPOWER_ISSUE, GENERAL_NOTE, UNKNOWN

Required JSON keys:
category, summary, location, actionRequired, confidence, reasoningSummary
`.trim();

export function buildMessageClassificationUserPrompt(input: ClassifyMessageInput): string {
  return JSON.stringify({
    attachedDocuments: input.attachedDocuments.map((attachment) => ({
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size
    })),
    attachedPhotos: {
      count: input.attachedPhotos.length,
      files: input.attachedPhotos.map((attachment) => ({
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size: attachment.size
      })),
      note: input.attachedPhotos.length > 0 ? "No image analysis performed." : null
    },
    attachedVideos: {
      count: input.attachedVideos.length,
      note:
        input.attachedVideos.length > 0 ? "Video metadata only. No video analysis performed." : null
    },
    attachedVoiceNotes: input.attachedVoiceNotes.map((attachment) => ({
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
      transcriptionError: attachment.transcriptionError,
      transcriptionStatus: attachment.transcriptionStatus
    })),
    conversation: input.conversation,
    evidenceSummary: input.evidenceSummary,
    messageId: input.messageId,
    messageText: input.messageText,
    messageType: input.messageType,
    occurredAt: input.timestamp.toISOString(),
    organizationId: input.organizationId,
    project: input.project
      ? {
          code: input.project.code,
          id: input.project.id,
          name: input.project.name,
          status: input.project.status
        }
      : null,
    senderName: input.sender.displayName,
    voiceTranscript: input.voiceTranscript
  });
}
