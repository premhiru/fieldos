import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { processSearchIndexJob } from "./background-processing.js";
import { buildEvidenceSummary, buildUnifiedEvidenceContext } from "./evidence-context.js";

const baseDate = new Date("2026-07-07T00:00:00.000Z");

describe("UnifiedEvidenceContext", () => {
  it("builds context for text-only messages", async () => {
    const context = await buildUnifiedEvidenceContext(fakePrismaWithMessage(), "msg_1");

    expect(context?.messageText).toBe("Terminal 2 runway lighting completed.");
    expect(context?.voiceTranscript).toBeNull();
    expect(context?.evidenceSummary.labels).toEqual([]);
  });

  it("builds context for text, photos, voice, and PDFs", async () => {
    const context = await buildUnifiedEvidenceContext(
      fakePrismaWithMessage(
        messageRecord({
          attachments: [
            attachment("photo_1", "site-1.jpg", "image/jpeg"),
            attachment("photo_2", "site-2.jpg", "image/jpeg"),
            attachment("voice_1", "voice.ogg", "audio/ogg", {
              transcript: "Lighting works are completed and inspected.",
              transcriptionStatus: "COMPLETED"
            }),
            attachment("pdf_1", "handover.pdf", "application/pdf")
          ],
          type: "VOICE"
        })
      ),
      "msg_1"
    );

    expect(context?.attachedPhotos).toHaveLength(2);
    expect(context?.attachedVoiceNotes).toHaveLength(1);
    expect(context?.attachedDocuments).toHaveLength(1);
    expect(context?.voiceTranscript).toBe("Lighting works are completed and inspected.");
    expect(context?.evidenceSummary.labels).toEqual(["2 Photos", "1 Voice Note", "1 PDF"]);
  });

  it("continues when voice transcription failed", async () => {
    const context = await buildUnifiedEvidenceContext(
      fakePrismaWithMessage(
        messageRecord({
          attachments: [
            attachment("voice_1", "voice.ogg", "audio/ogg", {
              transcriptionError: "Provider unavailable.",
              transcriptionStatus: "FAILED"
            })
          ],
          type: "VOICE"
        })
      ),
      "msg_1"
    );

    expect(context?.voiceTranscript).toBeNull();
    expect(context?.messageMetadata.transcriptionFailed).toBe(true);
    expect(context?.evidenceSummary.labels).toEqual(["1 Voice Note"]);
  });

  it("returns null for missing messages", async () => {
    const context = await buildUnifiedEvidenceContext(fakePrismaWithMessage(null), "missing");

    expect(context).toBeNull();
  });
});

describe("buildEvidenceSummary", () => {
  it("counts evidence by media type", () => {
    expect(
      buildEvidenceSummary({
        attachedDocuments: [
          {
            createdAt: baseDate,
            filename: "report.pdf",
            id: "doc_1",
            mimeType: "application/pdf",
            size: 100,
            storageKey: "report.pdf"
          }
        ],
        attachedPhotos: [
          {
            createdAt: baseDate,
            filename: "photo.jpg",
            id: "photo_1",
            mimeType: "image/jpeg",
            size: 100,
            storageKey: "photo.jpg"
          }
        ],
        attachedVideos: [],
        attachedVoiceNotes: [
          {
            createdAt: baseDate,
            filename: "voice.ogg",
            id: "voice_1",
            mimeType: "audio/ogg",
            size: 100,
            storageKey: "voice.ogg",
            transcript: null,
            transcriptionError: null,
            transcriptionStatus: "PENDING"
          }
        ]
      }).labels
    ).toEqual(["1 Photo", "1 Voice Note", "1 PDF"]);
  });
});

describe("message search indexing", () => {
  it("indexes message text, voice transcript, and document filenames", async () => {
    const searchDocuments: Array<{ content: string; metadata: unknown; title: string }> = [];
    const prisma = {
      ...fakePrismaWithMessage(
        messageRecord({
          attachments: [
            attachment("voice_1", "voice.ogg", "audio/ogg", {
              transcript: "Runway lighting is complete.",
              transcriptionStatus: "COMPLETED"
            }),
            attachment("pdf_1", "handover.pdf", "application/pdf")
          ],
          type: "VOICE"
        })
      ),
      searchDocument: {
        upsert: async ({
          create
        }: {
          create: { content: string; metadata: unknown; title: string };
        }) => {
          searchDocuments.push(create);
          return create;
        }
      }
    };

    await processSearchIndexJob(prisma as never, {
      sourceId: "msg_1",
      sourceType: "MESSAGE"
    });

    expect(searchDocuments[0]?.content).toContain("Runway lighting is complete.");
    expect(searchDocuments[0]?.content).toContain("handover.pdf");
    expect(searchDocuments[0]?.content).toContain("Evidence summary: 1 Voice Note · 1 PDF");
  });
});

interface FakeAttachment {
  conversationId: string;
  createdAt: Date;
  filename: string;
  id: string;
  messageId: string;
  mimeType: string;
  size: number;
  storageKey: string;
  transcript: string | null;
  transcriptionError: string | null;
  transcriptionStatus: "NOT_REQUIRED" | "PENDING" | "COMPLETED" | "FAILED";
}

interface FakeMessage {
  attachments: FakeAttachment[];
  body: string | null;
  conversation: {
    channel: "WHATSAPP";
    id: string;
    isGroup: boolean;
    organizationId: string;
    project: {
      code: string;
      id: string;
      name: string;
      status: "ACTIVE";
    };
    title: string;
  };
  externalMessageId: string;
  id: string;
  occurredAt: Date;
  processingStatus: "RECEIVED";
  senderParticipant: {
    displayName: string;
    externalIdentifier: string;
    id: string;
  };
  type: "TEXT" | "VOICE";
}

function fakePrismaWithMessage(message: FakeMessage | null = messageRecord()): PrismaClient & {
  message: {
    findUnique: () => Promise<FakeMessage | null>;
  };
} {
  return {
    message: {
      findUnique: async () => message
    }
  } as unknown as PrismaClient & {
    message: {
      findUnique: () => Promise<FakeMessage | null>;
    };
  };
}

function messageRecord(overrides: Partial<FakeMessage> = {}): FakeMessage {
  return {
    ...messageRecordBase(),
    ...overrides
  };
}

function messageRecordBase(): FakeMessage {
  return {
    attachments: [],
    body: "Terminal 2 runway lighting completed.",
    conversation: {
      channel: "WHATSAPP",
      id: "conv_1",
      isGroup: true,
      organizationId: "org_1",
      project: {
        code: "T2",
        id: "project_1",
        name: "Terminal 2",
        status: "ACTIVE"
      },
      title: "Terminal 2 Ops"
    },
    externalMessageId: "external_1",
    id: "msg_1",
    occurredAt: baseDate,
    processingStatus: "RECEIVED",
    senderParticipant: {
      displayName: "John Tan",
      externalIdentifier: "john@example.com",
      id: "participant_1"
    },
    type: "TEXT"
  };
}

function attachment(
  id: string,
  filename: string,
  mimeType: string,
  overrides: {
    transcript?: string | null;
    transcriptionError?: string | null;
    transcriptionStatus?: "NOT_REQUIRED" | "PENDING" | "COMPLETED" | "FAILED";
  } = {}
) {
  return {
    conversationId: "conv_1",
    createdAt: baseDate,
    filename,
    id,
    messageId: "msg_1",
    mimeType,
    size: 100,
    storageKey: filename,
    transcript: overrides.transcript ?? null,
    transcriptionError: overrides.transcriptionError ?? null,
    transcriptionStatus: overrides.transcriptionStatus ?? "NOT_REQUIRED"
  };
}
