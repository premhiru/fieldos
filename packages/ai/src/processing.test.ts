import type { PrismaClient } from "@fieldos/db";
import { beforeEach, describe, expect, it } from "vitest";

import { AIOutputValidationError, type MessageClassifier } from "./message-classifier.js";
import { AIProviderRateLimitError } from "./provider-errors.js";
import { AIClassificationProcessor } from "./processing.js";
import type { ClassifyMessageResult } from "./types.js";

describe("AIClassificationProcessor", () => {
  let prisma: FakePrisma;

  beforeEach(() => {
    prisma = new FakePrisma();
  });

  it("creates a pending classification job for a project message", async () => {
    const processor = new AIClassificationProcessor(prisma.client, {
      classifier: new FakeClassifier(validResult())
    });

    await processor.enqueueMessage("message_1");

    expect(prisma.classifications).toHaveLength(1);
    expect(prisma.classifications[0]?.status).toBe("PENDING");
    expect(prisma.messages[0]?.processingStatus).toBe("AI_PENDING");
    expect(prisma.processingJobs[0]?.type).toBe("AI_CLASSIFICATION");
  });

  it("classifies messages without a project so project suggestions can be created", async () => {
    prisma.messages[0]!.conversation.projectId = null;
    prisma.messages[0]!.conversation.project = null;
    const processor = new AIClassificationProcessor(prisma.client, {
      classifier: new FakeClassifier(validResult())
    });

    await processor.enqueueMessage("message_1");

    expect(prisma.classifications).toHaveLength(1);
  });

  it("saves a valid AI result and creates an action item", async () => {
    const processor = new AIClassificationProcessor(prisma.client, {
      classifier: new FakeClassifier(validResult({ actionRequired: true }))
    });
    await processor.enqueueMessage("message_1");

    await processor.processPending();

    expect(prisma.classifications[0]?.status).toBe("COMPLETED");
    expect(prisma.classifications[0]?.category).toBe("DEFECT");
    expect(prisma.messages[0]?.processingStatus).toBe("AI_COMPLETE");
    expect(prisma.actionItems).toHaveLength(1);
    expect(prisma.events.some((event) => event.eventType === "MESSAGE_EVIDENCE_RECEIVED")).toBe(
      true
    );
    expect(prisma.events.some((event) => event.title.includes("1 Voice Note"))).toBe(true);
    expect(prisma.processingJobs.some((job) => job.type === "SEARCH_INDEX")).toBe(true);
  });

  it("does not create an action item when the model says no follow-up is required", async () => {
    const processor = new AIClassificationProcessor(prisma.client, {
      classifier: new FakeClassifier(validResult({ actionRequired: false }))
    });
    await processor.enqueueMessage("message_1");

    await processor.processPending();

    expect(prisma.classifications[0]?.status).toBe("COMPLETED");
    expect(prisma.actionItems).toHaveLength(0);
  });

  it("marks invalid AI output as failed and does not create an action item", async () => {
    const processor = new AIClassificationProcessor(prisma.client, {
      classifier: new FailingClassifier()
    });
    await processor.enqueueMessage("message_1");

    await processor.processPending();

    expect(prisma.classifications[0]?.status).toBe("FAILED");
    expect(prisma.messages[0]?.processingStatus).toBe("FAILED");
    expect(prisma.actionItems).toHaveLength(0);
  });

  it("keeps classifications pending when the provider rate limits", async () => {
    const processor = new AIClassificationProcessor(prisma.client, {
      classifier: new RateLimitedClassifier()
    });
    await processor.enqueueMessage("message_1");

    await expect(processor.processPending()).rejects.toMatchObject({
      name: "AIProviderRateLimitError",
      retryAfterMs: 60_000,
      status: 429
    });

    expect(prisma.classifications[0]?.status).toBe("PENDING");
    expect(prisma.classifications[0]?.errorMessage).toBeNull();
    expect(prisma.messages[0]?.processingStatus).toBe("AI_PENDING");
  });

  it("keeps the completed legacy result when v2 shadow classification fails", async () => {
    prisma.messages[0]!.conversation.projectId = null;
    prisma.messages[0]!.conversation.project = null;
    const processor = new AIClassificationProcessor(prisma.client, {
      classifier: new FakeClassifier(validResult({ actionRequired: false })),
      classifierV2: new FailingClassifierV2(),
      decisionEngineMode: "shadow"
    });
    await processor.enqueueMessage("message_1");

    await processor.processPending();

    expect(prisma.classifications[0]?.status).toBe("COMPLETED");
    expect(prisma.messages[0]?.processingStatus).toBe("AI_COMPLETE");
    expect(prisma.classifications[0]?.errorMessage).toBeNull();
  });
});

function validResult(overrides: Partial<ClassifyMessageResult> = {}): ClassifyMessageResult {
  return {
    actionRequired: true,
    category: "DEFECT",
    confidence: 0.92,
    location: "Lobby",
    reasoningSummary: "The message reports a failed light and asks for rectification.",
    summary: "A lobby light has failed and needs follow-up.",
    ...overrides
  };
}

class FakeClassifier implements Pick<MessageClassifier, "classifyMessage"> {
  constructor(private readonly result: ClassifyMessageResult) {}

  async classifyMessage(): Promise<ClassifyMessageResult> {
    return this.result;
  }
}

class FailingClassifier implements Pick<MessageClassifier, "classifyMessage"> {
  async classifyMessage(): Promise<ClassifyMessageResult> {
    throw new AIOutputValidationError("Invalid AI JSON.");
  }
}

class RateLimitedClassifier implements Pick<MessageClassifier, "classifyMessage"> {
  async classifyMessage(): Promise<ClassifyMessageResult> {
    throw new AIProviderRateLimitError({
      message: "AI provider rate limited the request with status 429.",
      retryAfterMs: 60_000,
      status: 429
    });
  }
}

class FailingClassifierV2 {
  readonly model = "test-v2";

  async classifyMessage(): Promise<never> {
    throw new AIOutputValidationError("Invalid v2 AI JSON.");
  }
}

interface FakeMessage {
  attachments: Array<{
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
  }>;
  body: string;
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
    } | null;
    projectId: string | null;
    title: string;
  };
  conversationId: string;
  id: string;
  occurredAt: Date;
  processingStatus?: string;
  senderParticipant: {
    displayName: string;
    externalIdentifier: string;
    id: string;
  };
  type: "TEXT";
}

class FakePrisma {
  messages: FakeMessage[] = [
    {
      attachments: [
        {
          conversationId: "conversation_1",
          createdAt: new Date("2026-07-03T00:00:00.000Z"),
          filename: "voice.ogg",
          id: "attachment_1",
          messageId: "message_1",
          mimeType: "audio/ogg",
          size: 100,
          storageKey: "voice.ogg",
          transcript: "Please rectify the lobby light.",
          transcriptionError: null,
          transcriptionStatus: "COMPLETED"
        }
      ],
      body: "Lobby light failed, please rectify.",
      conversation: {
        channel: "WHATSAPP",
        id: "conversation_1",
        isGroup: true,
        organizationId: "organization_1",
        project: {
          code: "P1",
          id: "project_1",
          name: "Project 1",
          status: "ACTIVE"
        },
        projectId: "project_1",
        title: "Site team"
      },
      conversationId: "conversation_1",
      id: "message_1",
      occurredAt: new Date("2026-07-03T00:00:00.000Z"),
      senderParticipant: {
        displayName: "Supervisor",
        externalIdentifier: "supervisor@example.com",
        id: "participant_1"
      },
      type: "TEXT" as const
    }
  ];
  classifications: Array<{
    category: string | null;
    confidence: number | null;
    errorMessage: string | null;
    id: string;
    message: FakeMessage;
    messageId: string;
    organizationId: string;
    actionRequired: boolean;
    projectId: string | null;
    status: "PENDING" | "COMPLETED" | "FAILED" | "NEEDS_REVIEW";
  }> = [];
  actionItems: Array<{
    classificationId: string;
    id: string;
    messageId: string;
    organizationId: string;
    projectId: string | null;
    suggestedProjectId?: string | null;
    title: string;
    type?: "FOLLOW_UP" | "PROJECT_SUGGESTION";
  }> = [];
  events: Array<{
    eventType?: string;
    id: string;
    organizationId?: string;
    projectId?: string | null;
    sourceId: string;
    sourceType?: string;
    title: string;
  }> = [];
  processingJobs: Array<{
    id: string;
    sourceId: string;
    sourceType: string;
    status: string;
    type: string;
  }> = [];
  projects = [
    {
      code: "T2",
      id: "project_2",
      name: "Terminal 2"
    }
  ];

  client = {
    $transaction: async <T>(callback: (tx: FakePrisma["client"]) => Promise<T>) =>
      callback(this.client),
    aIMessageClassification: {
      findMany: async () => this.classifications.filter((item) => item.status === "PENDING"),
      findUnique: async ({ where }: { where: { id: string } }) =>
        this.classifications.find((item) => item.id === where.id) ?? null,
      update: async ({ data, where }: { data: Record<string, unknown>; where: { id: string } }) => {
        const classification = this.classifications.find((item) => item.id === where.id);

        if (!classification) {
          throw new Error("classification missing");
        }

        Object.assign(classification, data);
        return classification;
      },
      upsert: async ({
        create,
        update,
        where
      }: {
        create: {
          messageId: string;
          organizationId: string;
          projectId: string | null;
          status: "PENDING";
        };
        update: Record<string, unknown>;
        where: { messageId: string };
      }) => {
        const existing = this.classifications.find((item) => item.messageId === where.messageId);

        if (existing) {
          Object.assign(existing, update);
          return existing;
        }

        const message = this.messages.find((item) => item.id === create.messageId);

        if (!message) {
          throw new Error("message missing");
        }

        const classification = {
          category: null,
          confidence: null,
          errorMessage: null,
          id: `classification_${this.classifications.length + 1}`,
          message,
          messageId: create.messageId,
          organizationId: create.organizationId,
          actionRequired: false,
          projectId: create.projectId,
          status: create.status
        };
        this.classifications.push(classification);
        return classification;
      }
    },
    message: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        this.messages.find((item) => item.id === where.id) ?? null,
      update: async ({ data, where }: { data: Record<string, unknown>; where: { id: string } }) => {
        const message = this.messages.find((item) => item.id === where.id);

        if (!message) {
          throw new Error("message missing");
        }

        Object.assign(message, data);
        return message;
      }
    },
    actionItem: {
      create: async ({
        data
      }: {
        data: {
          classificationId: string;
          confidence: number;
          description: string | null;
          messageId: string;
          organizationId: string;
          projectId: string | null;
          status: "PENDING";
          suggestedProjectId?: string | null;
          title: string;
          type: "FOLLOW_UP" | "PROJECT_SUGGESTION";
        };
      }) => {
        const task = {
          ...data,
          id: `action_item_${this.actionItems.length + 1}`
        };
        this.actionItems.push(task);
        return task;
      },
      deleteMany: async () => ({ count: 0 })
    },
    event: {
      findFirst: async ({
        where
      }: {
        where: {
          sourceId: string;
          sourceType: string;
        };
      }) =>
        this.events.find(
          (event) => event.sourceId === where.sourceId && event.sourceType === where.sourceType
        ) ?? null,
      create: async ({ data }: { data: { sourceId: string; title: string } }) => {
        const event = {
          ...data,
          id: `event_${this.events.length + 1}`
        };
        this.events.push(event);
        return event;
      },
      update: async ({ data, where }: { data: Record<string, unknown>; where: { id: string } }) => {
        const event = this.events.find((item) => item.id === where.id);

        if (!event) {
          throw new Error("event missing");
        }

        Object.assign(event, data);
        return event;
      }
    },
    processingJob: {
      upsert: async ({
        create,
        update,
        where
      }: {
        create: { sourceId: string; sourceType: string; status: string; type: string };
        update: Record<string, unknown>;
        where: { type_sourceType_sourceId: { sourceId: string; sourceType: string; type: string } };
      }) => {
        const existing = this.processingJobs.find(
          (job) =>
            job.sourceId === where.type_sourceType_sourceId.sourceId &&
            job.sourceType === where.type_sourceType_sourceId.sourceType &&
            job.type === where.type_sourceType_sourceId.type
        );

        if (existing) {
          Object.assign(existing, update);
          return existing;
        }

        const job = {
          ...create,
          id: `job_${this.processingJobs.length + 1}`
        };
        this.processingJobs.push(job);
        return job;
      }
    },
    project: {
      findMany: async () => this.projects
    }
  } as unknown as PrismaClient;
}
