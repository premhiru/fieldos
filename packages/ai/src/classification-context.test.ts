import type { PrismaClient, UnifiedEvidenceContext } from "@fieldos/db";
import { describe, expect, it } from "vitest";

import { buildClassificationDecisionContext } from "./classification-context.js";

describe("buildClassificationDecisionContext", () => {
  it("assembles bounded operational context around the current message", async () => {
    const takes: number[] = [];
    const prisma = fakePrisma(takes);

    const context = await buildClassificationDecisionContext(prisma, baseEvidenceContext());

    expect(takes).toEqual([10, 10, 4, 4, 10, 10, 4]);
    expect(context.operatingContext).toMatchObject({
      isWeekend: false,
      timezone: "Asia/Singapore",
      weekday: "Friday"
    });
    expect(context.recentMessages).toEqual([
      expect.objectContaining({ id: "message_before", relation: "PRECEDING" }),
      expect.objectContaining({ id: "message_after", relation: "SUBSEQUENT" })
    ]);
    expect(context.unresolvedExpectations).toEqual([
      expect.objectContaining({ id: "expectation_1", requestedItem: "signed test sheet" })
    ]);
    expect(context.photoAnalyses).toEqual([
      expect.objectContaining({
        analysisStatus: "NO_OPERATIONAL_CONCLUSION",
        evidenceId: "photo_1",
        limitations: ["Testing cannot be seen."]
      })
    ]);
    expect(context.replyContext).toBeNull();
    expect(context.sender.role).toBe("FIELD_SUPERVISOR");
    expect(context.messageDirection).toBe("INBOUND");
  });

  it("keeps project-scoped context empty when a conversation is not mapped", async () => {
    const context = await buildClassificationDecisionContext(fakePrisma([]), {
      ...baseEvidenceContext(),
      project: null
    });

    expect(context.activeMilestones).toEqual([]);
    expect(context.openActionItems).toEqual([]);
    expect(context.projectState).toBeNull();
    expect(context.recentTimelineEvents).toEqual([]);
    expect(context.unresolvedExpectations).toEqual([]);
    expect(context.recentMessages).toHaveLength(2);
  });
});

function fakePrisma(takes: number[]): PrismaClient {
  const recordTake =
    <T>(value: T) =>
    async ({ take }: { take: number }): Promise<T> => {
      takes.push(take);
      return value;
    };

  return {
    actionItem: {
      findMany: recordTake([{ id: "action_1", status: "PENDING", title: "Send test sheet" }])
    },
    event: {
      findMany: recordTake([
        {
          description: "Testing remains pending.",
          eventType: "MESSAGE_EVIDENCE_RECEIVED",
          id: "event_1",
          occurredAt: new Date("2026-07-16T04:00:00.000Z"),
          title: "Testing update"
        }
      ])
    },
    message: {
      findMany: async ({
        orderBy,
        take
      }: {
        orderBy: { occurredAt: "asc" | "desc" };
        take: number;
      }) => {
        takes.push(take);
        return orderBy.occurredAt === "desc"
          ? [
              {
                body: "Testing is still pending.",
                direction: "INBOUND",
                id: "message_before",
                occurredAt: new Date("2026-07-16T05:00:00.000Z"),
                senderParticipant: { displayName: "Alex" }
              }
            ]
          : [
              {
                body: "The signed test sheet has not been issued.",
                direction: "INBOUND",
                id: "message_after",
                occurredAt: new Date("2026-07-17T01:00:00.000Z"),
                senderParticipant: { displayName: "Alex" }
              }
            ];
      }
    },
    milestone: {
      findMany: recordTake([
        {
          id: "milestone_1",
          plannedEndDate: new Date("2026-07-20T00:00:00.000Z"),
          status: "IN_PROGRESS",
          title: "CCR testing"
        }
      ])
    },
    outstandingExpectation: {
      findMany: recordTake([
        {
          dueAt: new Date("2026-07-17T00:00:00.000Z"),
          expectedResponder: "Alex",
          id: "expectation_1",
          requestedItem: "signed test sheet",
          sourceMessageId: "message_request",
          type: "DOCUMENT"
        }
      ])
    },
    photoAnalysis: {
      findMany: recordTake([
        {
          analysisStatus: "NO_OPERATIONAL_CONCLUSION",
          claimSupport: "UNABLE_TO_DETERMINE",
          evidenceId: "photo_1",
          limitations: ["Testing cannot be seen."],
          operationalConclusion: "NO_OPERATIONAL_CONCLUSION",
          summary: "A cabinet and loose cables are visible."
        }
      ])
    },
    projectState: {
      findUnique: async () => ({
        health: "NEEDS_ATTENTION",
        nextMilestone: "CCR testing",
        pendingDecisionSummary: null,
        recentBlockerSummary: "Testing remains pending.",
        recentProgressSummary: "Cabinet installed."
      })
    }
  } as unknown as PrismaClient;
}

function baseEvidenceContext(): UnifiedEvidenceContext {
  return {
    attachedDocuments: [],
    attachedPhotos: [
      {
        createdAt: new Date("2026-07-17T00:00:00.000Z"),
        filename: "cabinet.jpg",
        id: "photo_1",
        mimeType: "image/jpeg",
        size: 512,
        storageKey: "evidence/cabinet.jpg"
      }
    ],
    attachedVideos: [],
    attachedVoiceNotes: [],
    conversation: {
      channel: "WHATSAPP",
      id: "conversation_1",
      isGroup: true,
      title: "Airfield lighting"
    },
    evidenceSummary: {
      attachmentCount: 1,
      documentCount: 0,
      labels: ["1 Photo"],
      pdfCount: 0,
      photoCount: 1,
      videoCount: 0,
      voiceNoteCount: 0
    },
    externalMessageId: "wa_1",
    messageDirection: "INBOUND",
    messageId: "message_current",
    messageMetadata: {
      attachmentCount: 1,
      hasTranscript: false,
      transcriptionFailed: false,
      transcriptionPending: false
    },
    messageText: "Cabinet installation done.",
    messageType: "IMAGE",
    organizationId: "organization_1",
    processingStatus: "AI_PENDING",
    project: {
      code: "AGL-01",
      id: "project_1",
      name: "Taxiway A lighting",
      status: "ACTIVE",
      timezone: "Asia/Singapore"
    },
    sender: {
      displayName: "Alex",
      externalIdentifier: "alex@example.com",
      id: "participant_1",
      role: "FIELD_SUPERVISOR"
    },
    timestamp: new Date("2026-07-17T00:30:00.000Z"),
    voiceTranscript: null
  };
}
