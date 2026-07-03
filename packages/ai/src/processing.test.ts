import type { PrismaClient } from "@fieldos/db";
import { beforeEach, describe, expect, it } from "vitest";

import { AIOutputValidationError, type MessageClassifier } from "./message-classifier.js";
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
  });

  it("does not classify messages without a project", async () => {
    prisma.messages[0]!.conversation.projectId = null;
    const processor = new AIClassificationProcessor(prisma.client, {
      classifier: new FakeClassifier(validResult())
    });

    await processor.enqueueMessage("message_1");

    expect(prisma.classifications).toHaveLength(0);
  });

  it("saves a valid AI result and creates a suggested task", async () => {
    const processor = new AIClassificationProcessor(prisma.client, {
      classifier: new FakeClassifier(validResult({ shouldCreateTask: true }))
    });
    await processor.enqueueMessage("message_1");

    await processor.processPending();

    expect(prisma.classifications[0]?.status).toBe("COMPLETED");
    expect(prisma.classifications[0]?.category).toBe("DEFECT");
    expect(prisma.suggestedTasks).toHaveLength(1);
  });

  it("does not create a suggested task when the model says no follow-up is required", async () => {
    const processor = new AIClassificationProcessor(prisma.client, {
      classifier: new FakeClassifier(validResult({ shouldCreateTask: false }))
    });
    await processor.enqueueMessage("message_1");

    await processor.processPending();

    expect(prisma.classifications[0]?.status).toBe("COMPLETED");
    expect(prisma.suggestedTasks).toHaveLength(0);
  });

  it("marks invalid AI output as failed and does not create a suggested task", async () => {
    const processor = new AIClassificationProcessor(prisma.client, {
      classifier: new FailingClassifier()
    });
    await processor.enqueueMessage("message_1");

    await processor.processPending();

    expect(prisma.classifications[0]?.status).toBe("FAILED");
    expect(prisma.suggestedTasks).toHaveLength(0);
  });
});

function validResult(overrides: Partial<ClassifyMessageResult> = {}): ClassifyMessageResult {
  return {
    category: "DEFECT",
    confidence: 0.92,
    location: "Lobby",
    priority: "HIGH",
    reasoningSummary: "The message reports a failed light and asks for rectification.",
    shouldCreateTask: true,
    suggestedTaskDescription: "Rectify the failed lobby light.",
    suggestedTaskTitle: "Fix lobby light",
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

interface FakeMessage {
  body: string;
  conversation: {
    id: string;
    organizationId: string;
    projectId: string | null;
    title: string;
  };
  conversationId: string;
  id: string;
  occurredAt: Date;
  senderParticipant: {
    displayName: string;
  };
  type: "TEXT";
}

class FakePrisma {
  messages: FakeMessage[] = [
    {
      body: "Lobby light failed, please rectify.",
      conversation: {
        id: "conversation_1",
        organizationId: "organization_1",
        projectId: "project_1",
        title: "Site team"
      },
      conversationId: "conversation_1",
      id: "message_1",
      occurredAt: new Date("2026-07-03T00:00:00.000Z"),
      senderParticipant: {
        displayName: "Supervisor"
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
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    projectId: string | null;
    status: "PENDING" | "COMPLETED" | "FAILED" | "NEEDS_REVIEW";
  }> = [];
  suggestedTasks: Array<{
    classificationId: string;
    id: string;
    messageId: string;
    organizationId: string;
    projectId: string;
    title: string;
  }> = [];

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
          projectId: string;
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
          priority: "MEDIUM" as const,
          projectId: create.projectId,
          status: create.status
        };
        this.classifications.push(classification);
        return classification;
      }
    },
    message: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        this.messages.find((item) => item.id === where.id) ?? null
    },
    suggestedTask: {
      create: async ({
        data
      }: {
        data: {
          classificationId: string;
          messageId: string;
          organizationId: string;
          projectId: string;
          title: string;
        };
      }) => {
        const task = {
          ...data,
          id: `suggested_task_${this.suggestedTasks.length + 1}`
        };
        this.suggestedTasks.push(task);
        return task;
      },
      deleteMany: async () => ({ count: 0 })
    }
  } as unknown as PrismaClient;
}
