import { describe, expect, it } from "vitest";

import { MessageClassifier } from "./message-classifier.js";
import type { AIProvider } from "./types.js";

describe("MessageClassifier", () => {
  it("uses the OpenRouter free router as the default model", async () => {
    const provider = new CapturingProvider();
    const classifier = new MessageClassifier({ provider });

    await classifier.classifyMessage(classificationContext());

    expect(provider.model).toBe("openrouter/free");
    expect(provider.userPrompt).toContain("Voice transcript");
    expect(provider.userPrompt).toContain("No image analysis performed.");
  });

  it("accepts context with a blank sender external identifier", async () => {
    const provider = new CapturingProvider();
    const classifier = new MessageClassifier({ provider });
    const context = classificationContext();

    context.sender.externalIdentifier = "";

    await expect(classifier.classifyMessage(context)).resolves.toMatchObject({
      category: "GENERAL_NOTE"
    });
  });
});

class CapturingProvider implements AIProvider {
  model: string | null = null;
  userPrompt = "";

  async completeJson(input: Parameters<AIProvider["completeJson"]>[0]): Promise<unknown> {
    this.model = input.model;
    this.userPrompt = input.messages.find((message) => message.role === "user")?.content ?? "";

    return {
      actionRequired: false,
      category: "GENERAL_NOTE",
      confidence: 0.9,
      location: null,
      reasoningSummary: "The message is a status update.",
      summary: "Terminal 2 runway lighting was completed."
    };
  }
}

function classificationContext() {
  const occurredAt = new Date("2026-07-03T00:00:00.000Z");

  return {
    attachedDocuments: [
      {
        createdAt: occurredAt,
        filename: "handover.pdf",
        id: "attachment_2",
        mimeType: "application/pdf",
        size: 1200,
        storageKey: "handover.pdf"
      }
    ],
    attachedPhotos: [
      {
        createdAt: occurredAt,
        filename: "site.jpg",
        id: "attachment_1",
        mimeType: "image/jpeg",
        size: 1000,
        storageKey: "site.jpg"
      }
    ],
    attachedVideos: [],
    attachedVoiceNotes: [
      {
        createdAt: occurredAt,
        filename: "voice.ogg",
        id: "attachment_3",
        mimeType: "audio/ogg",
        size: 800,
        storageKey: "voice.ogg",
        transcript: "Voice transcript",
        transcriptionError: null,
        transcriptionStatus: "COMPLETED" as const
      }
    ],
    conversation: {
      channel: "WHATSAPP" as const,
      id: "conversation_1",
      isGroup: true,
      title: "Site team"
    },
    evidenceSummary: {
      attachmentCount: 3,
      documentCount: 1,
      labels: ["1 Photo", "1 Voice Note", "1 PDF"],
      pdfCount: 1,
      photoCount: 1,
      videoCount: 0,
      voiceNoteCount: 1
    },
    externalMessageId: "external_1",
    messageId: "message_1",
    messageMetadata: {
      attachmentCount: 3,
      hasTranscript: true,
      transcriptionFailed: false,
      transcriptionPending: false
    },
    messageText: "Terminal 2 runway lighting completed.",
    messageType: "TEXT" as const,
    organizationId: "organization_1",
    processingStatus: "RECEIVED",
    project: null,
    sender: {
      displayName: "Supervisor",
      externalIdentifier: "supervisor@example.com",
      id: "participant_1"
    },
    timestamp: occurredAt,
    voiceTranscript: "Voice transcript"
  };
}
