import { describe, expect, it } from "vitest";

import { MessageClassifierV2 } from "./message-classifier-v2.js";
import type { AIProvider, ClassifyMessageV2Input } from "./types.js";

describe("MessageClassifierV2", () => {
  it("accepts a multi-signal operational result", async () => {
    const classifier = new MessageClassifierV2({
      provider: providerReturning({
        abstentionReason: null,
        completionClaim: "PARTIAL",
        confidence: 0.88,
        inspectionReadiness: "NOT_READY",
        location: null,
        operationalImpact: "HIGH",
        primaryCategory: "PROGRESS_UPDATE",
        recommendationEligible: true,
        relevance: "OPERATIONAL",
        responseExpectation: {
          dueAt: null,
          evidence: "Testing remains pending.",
          expectedResponder: null,
          requestedItem: "testing completion",
          status: "OPEN",
          type: "COMMITMENT"
        },
        secondarySignals: ["DELAY", "INSPECTION_REQUEST"],
        summary: "Installation is partial and testing remains outstanding.",
        uncertainty: "No test result was supplied.",
        userFacingReason: "Testing must finish before inspection."
      })
    });

    await expect(classifier.classifyMessage(input())).resolves.toMatchObject({
      completionClaim: "PARTIAL",
      secondarySignals: ["DELAY", "INSPECTION_REQUEST"]
    });
  });

  it("repairs one malformed result and requires an abstention reason", async () => {
    let calls = 0;
    const provider: AIProvider = {
      completeJson: async () => {
        calls += 1;
        return calls === 1
          ? { relevance: "AMBIGUOUS" }
          : {
              abstentionReason: "The reply has no referenced scope.",
              completionClaim: "AMBIGUOUS",
              confidence: 0.35,
              inspectionReadiness: "AMBIGUOUS",
              location: null,
              operationalImpact: "NONE",
              primaryCategory: "UNKNOWN",
              recommendationEligible: false,
              relevance: "AMBIGUOUS",
              responseExpectation: {
                dueAt: null,
                evidence: null,
                expectedResponder: null,
                requestedItem: null,
                status: "UNCLEAR",
                type: "NONE"
              },
              secondarySignals: [],
              summary: "Ambiguous completion reply.",
              uncertainty: "No reply context is available.",
              userFacingReason: "There is not enough context to act."
            };
      }
    };

    await expect(
      new MessageClassifierV2({ provider }).classifyMessage(input())
    ).resolves.toMatchObject({
      recommendationEligible: false,
      relevance: "AMBIGUOUS"
    });
    expect(calls).toBe(2);
  });
});

function providerReturning(value: unknown): AIProvider {
  return { completeJson: async () => value };
}

function input(): ClassifyMessageV2Input {
  return {
    activeMilestones: [],
    attachedDocuments: [],
    attachedPhotos: [],
    attachedVideos: [],
    attachedVoiceNotes: [],
    conversation: { channel: "WHATSAPP", id: "conversation_1", isGroup: true, title: "Site" },
    evidenceSummary: {
      attachmentCount: 0,
      documentCount: 0,
      labels: [],
      pdfCount: 0,
      photoCount: 0,
      videoCount: 0,
      voiceNoteCount: 0
    },
    externalMessageId: "external_1",
    messageId: "message_1",
    messageMetadata: {
      attachmentCount: 0,
      hasTranscript: false,
      transcriptionFailed: false,
      transcriptionPending: false
    },
    messageText: "Cable tray installed; cabling and testing are pending.",
    messageType: "TEXT",
    openActionItems: [],
    organizationId: "organization_1",
    processingStatus: "AI_PENDING",
    project: { code: "P1", id: "project_1", name: "Terminal", status: "ACTIVE" },
    projectState: null,
    recentMessages: [],
    recentTimelineEvents: [],
    sender: { displayName: "Alex", externalIdentifier: "alex", id: "participant_1" },
    timestamp: new Date("2026-07-18T00:00:00.000Z"),
    voiceTranscript: null
  };
}
