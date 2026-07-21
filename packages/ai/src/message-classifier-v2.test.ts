import { describe, expect, it } from "vitest";

import { MessageClassifierV2 } from "./message-classifier-v2.js";
import type { AIProvider, ClassifyMessageV2Input } from "./types.js";

describe("MessageClassifierV2", () => {
  it("accepts a multi-signal operational result", async () => {
    const classifier = new MessageClassifierV2({
      provider: providerReturning({
        abstentionReason: null,
        ambiguity: { isAmbiguous: false, missingContext: [] },
        completionClaim: "PARTIAL",
        confidence: 0.88,
        factualClaims: [
          {
            confidence: 0.95,
            statement: "Cable tray installation is complete.",
            status: "ASSERTED",
            subject: "cable tray",
            type: "PROGRESS"
          }
        ],
        inspectionReadiness: "NOT_READY",
        location: null,
        locations: [],
        operationalImpact: "HIGH",
        primaryCategory: "PROGRESS_UPDATE",
        recommendationEligible: true,
        recommendationEligibilityReason: "Testing remains an unresolved prerequisite.",
        referencedDates: [
          {
            confidence: 0.9,
            phrase: "tomorrow",
            resolvedDate: "2026-07-19"
          }
        ],
        relevance: "OPERATIONAL",
        responseExpectation: {
          dueAt: "2026-07-19",
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
      referencedDates: [expect.objectContaining({ resolvedDate: "2026-07-19" })],
      secondarySignals: ["DELAY", "INSPECTION_REQUEST"]
    });
  });

  it("repairs one malformed result and requires an abstention reason", async () => {
    let calls = 0;
    let repairPrompt = "";
    const provider: AIProvider = {
      completeJson: async ({ messages }) => {
        calls += 1;
        if (calls === 2) {
          repairPrompt = messages.at(-1)?.content ?? "";
        }
        return calls === 1
          ? { relevance: "AMBIGUOUS" }
          : {
              abstentionReason: "The reply has no referenced scope.",
              ambiguity: { isAmbiguous: true, missingContext: ["reply context", "work scope"] },
              completionClaim: "AMBIGUOUS",
              confidence: 0.35,
              factualClaims: [],
              inspectionReadiness: "AMBIGUOUS",
              location: null,
              locations: [],
              operationalImpact: "NONE",
              primaryCategory: "UNKNOWN",
              recommendationEligible: false,
              recommendationEligibilityReason: "No specific operational action is supported.",
              referencedDates: [],
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
    expect(repairPrompt).toContain('relevance: "OPERATIONAL" | "NON_OPERATIONAL" | "AMBIGUOUS"');
    expect(repairPrompt).toContain("responseExpectation: an object");
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
    messageDirection: "INBOUND",
    messageType: "TEXT",
    openActionItems: [],
    operatingContext: {
      isWeekend: false,
      localDateTime: "2026-07-18, 08:00:00",
      timezone: "Asia/Singapore",
      weekday: "Saturday"
    },
    organizationId: "organization_1",
    processingStatus: "AI_PENDING",
    photoAnalyses: [],
    project: {
      code: "P1",
      id: "project_1",
      name: "Terminal",
      status: "ACTIVE",
      timezone: "Asia/Singapore"
    },
    projectState: null,
    recentMessages: [],
    recentTimelineEvents: [],
    replyContext: null,
    sender: {
      displayName: "Alex",
      externalIdentifier: "alex",
      id: "participant_1",
      role: "FIELD_SUPERVISOR"
    },
    timestamp: new Date("2026-07-18T00:00:00.000Z"),
    unresolvedExpectations: [],
    voiceTranscript: null
  };
}
