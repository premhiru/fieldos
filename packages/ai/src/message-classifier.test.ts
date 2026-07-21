import { afterEach, describe, expect, it, vi } from "vitest";

import { createConfiguredAIProvider, MessageClassifier } from "./message-classifier.js";
import { AIProviderRateLimitError } from "./provider-errors.js";
import type { AIProvider } from "./types.js";

describe("MessageClassifier", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("normalizes a numeric confidence string from the provider", async () => {
    const classifier = new MessageClassifier({
      provider: {
        completeJson: async () => ({
          actionRequired: false,
          category: "GENERAL_NOTE",
          confidence: "0.9",
          location: null,
          reasoningSummary: "The message is a status update.",
          summary: "Terminal 2 runway lighting was completed."
        })
      }
    });

    await expect(classifier.classifyMessage(classificationContext())).resolves.toMatchObject({
      confidence: 0.9
    });
  });

  it("normalizes a percentage confidence string from the provider", async () => {
    const classifier = new MessageClassifier({
      provider: {
        completeJson: async () => ({
          actionRequired: false,
          category: "GENERAL_NOTE",
          confidence: "82%",
          location: null,
          reasoningSummary: "The message is a status update.",
          summary: "Terminal 2 runway lighting was completed."
        })
      }
    });

    await expect(classifier.classifyMessage(classificationContext())).resolves.toMatchObject({
      confidence: 0.82
    });
  });

  it("raises a retryable provider error when the provider returns 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        headers: {
          get: (name: string) => (name.toLowerCase() === "retry-after" ? "2" : null)
        },
        ok: false,
        status: 429
      }))
    );
    const classifier = new MessageClassifier({
      apiKey: "test-key",
      baseUrl: "https://ai.example.test",
      model: "test-model"
    });

    await expect(classifier.classifyMessage(classificationContext())).rejects.toMatchObject({
      name: "AIProviderRateLimitError",
      retryAfterMs: 2000,
      status: 429
    });
    await expect(classifier.classifyMessage(classificationContext())).rejects.toBeInstanceOf(
      AIProviderRateLimitError
    );
  });

  it("uses Kimi as the primary provider with compatible request parameters", async () => {
    const requests: Array<{ body: Record<string, unknown>; url: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({
          body: JSON.parse(String(init?.body)) as Record<string, unknown>,
          url: String(input)
        });
        return jsonResponse({ status: "ok" });
      })
    );
    const configured = createConfiguredAIProvider({
      fallbackApiKey: "openrouter-key",
      kimiApiKey: "kimi-key"
    });

    await configured.provider.completeJson({
      messages: [{ content: "Return JSON.", role: "user" }],
      model: configured.model
    });

    expect(requests[0]?.url).toBe("https://api.moonshot.ai/v1/chat/completions");
    expect(requests[0]?.body).toMatchObject({
      model: "kimi-k2.6",
      thinking: { type: "disabled" }
    });
    expect(requests[0]?.body).not.toHaveProperty("temperature");
  });

  it("falls back to OpenRouter when Kimi is unavailable", async () => {
    const urls: string[] = [];
    const onFallback = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);

        if (url.startsWith("https://api.moonshot.ai")) {
          return new Response(null, { status: 429 });
        }

        return jsonResponse({ status: "ok" });
      })
    );
    const configured = createConfiguredAIProvider({
      fallbackApiKey: "openrouter-key",
      kimiApiKey: "kimi-key",
      onFallback
    });

    await expect(
      configured.provider.completeJson({
        messages: [{ content: "Return JSON.", role: "user" }],
        model: configured.model
      })
    ).resolves.toEqual({ status: "ok" });
    expect(urls).toEqual([
      "https://api.moonshot.ai/v1/chat/completions",
      "https://openrouter.ai/api/v1/chat/completions"
    ]);
    expect(onFallback).toHaveBeenCalledOnce();
  });
});

function jsonResponse(content: unknown): Response {
  return {
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(content) } }]
    }),
    ok: true
  } as Response;
}

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
    messageDirection: "INBOUND" as const,
    messageType: "TEXT" as const,
    organizationId: "organization_1",
    processingStatus: "RECEIVED",
    project: null,
    sender: {
      displayName: "Supervisor",
      externalIdentifier: "supervisor@example.com",
      id: "participant_1",
      role: "FIELD_SUPERVISOR"
    },
    timestamp: occurredAt,
    voiceTranscript: "Voice transcript"
  };
}
