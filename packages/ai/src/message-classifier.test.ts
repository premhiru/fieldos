import { describe, expect, it } from "vitest";

import { MessageClassifier } from "./message-classifier.js";
import type { AIProvider } from "./types.js";

describe("MessageClassifier", () => {
  it("uses the OpenRouter free router as the default model", async () => {
    const provider = new CapturingProvider();
    const classifier = new MessageClassifier({ provider });

    await classifier.classifyMessage({
      conversationTitle: "Site team",
      messageBody: "Terminal 2 runway lighting completed.",
      messageId: "message_1",
      messageType: "TEXT",
      occurredAt: new Date("2026-07-03T00:00:00.000Z"),
      organizationId: "organization_1",
      projectId: null,
      senderName: "Supervisor"
    });

    expect(provider.model).toBe("openrouter/free");
  });
});

class CapturingProvider implements AIProvider {
  model: string | null = null;

  async completeJson(input: Parameters<AIProvider["completeJson"]>[0]): Promise<unknown> {
    this.model = input.model;

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
