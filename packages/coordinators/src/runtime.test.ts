import { describe, expect, it, vi } from "vitest";

import { ProjectCoordinatorRuntime } from "./runtime.js";

const now = new Date("2026-07-08T08:00:00.000Z");

describe("ProjectCoordinatorRuntime", () => {
  it("creates deterministic ProjectState snapshots", async () => {
    const prisma = createPrismaStub();
    const runtime = new ProjectCoordinatorRuntime(prisma as never, { now: () => now });

    prisma.event.findMany.mockResolvedValue([
      {
        description: "Taxiway Alpha lighting installed.",
        occurredAt: new Date("2026-07-08T07:00:00.000Z"),
        title: "Lighting installed"
      }
    ]);
    prisma.message.findMany.mockResolvedValue([]);
    prisma.actionItem.findMany.mockResolvedValue([
      {
        description: "Review inspection photos.",
        priority: "HIGH",
        status: "PENDING",
        title: "Review evidence"
      }
    ]);
    prisma.photoAnalysis.findMany.mockResolvedValue([
      {
        createdAt: new Date("2026-07-08T07:15:00.000Z"),
        summary: "Photos show installed runway edge lighting."
      }
    ]);
    prisma.projectReport.findMany.mockResolvedValue([]);
    prisma.recommendation.findMany.mockResolvedValue([]);

    await runtime.rebuildProjectState("project_1");

    expect(prisma.projectState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          health: "NEEDS_ATTENTION",
          highPriorityActionItemCount: 1,
          openActionItemCount: 1,
          recentEvidenceSummary: "Photos show installed runway edge lighting.",
          recentProgressSummary: "Taxiway Alpha lighting installed."
        })
      })
    );
  });

  it("creates follow-up recommendations for stale active WhatsApp conversations", async () => {
    const prisma = createPrismaStub();
    const runtime = new ProjectCoordinatorRuntime(prisma as never, { now: () => now });

    prisma.conversation.findMany.mockResolvedValue([
      {
        id: "conversation_1",
        lastMessageAt: new Date("2026-07-04T08:00:00.000Z"),
        title: "Team Bravo",
        updatedAt: new Date("2026-07-04T08:00:00.000Z"),
        whatsAppMapping: {
          whatsappAccountId: "whatsapp_1"
        }
      }
    ]);
    prisma.recommendation.findFirst.mockResolvedValue(null);

    await runtime.runProjectCoordinators("project_1");

    expect(prisma.recommendation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          priority: "HIGH",
          proposedActionType: "SEND_WHATSAPP_MESSAGE_DRAFT",
          sourceCoordinator: "FOLLOW_UP",
          title: "Request progress update from Team Bravo"
        })
      })
    );
  });

  it("updates similar pending recommendations instead of duplicating them", async () => {
    const prisma = createPrismaStub();
    const runtime = new ProjectCoordinatorRuntime(prisma as never, { now: () => now });

    prisma.conversation.findMany.mockResolvedValue([
      {
        id: "conversation_1",
        lastMessageAt: new Date("2026-07-04T08:00:00.000Z"),
        title: "Team Bravo",
        updatedAt: new Date("2026-07-04T08:00:00.000Z"),
        whatsAppMapping: {
          whatsappAccountId: "whatsapp_1"
        }
      }
    ]);
    prisma.recommendation.findFirst.mockResolvedValue({ id: "recommendation_1" });

    await runtime.runProjectCoordinators("project_1");

    expect(prisma.recommendation.create).not.toHaveBeenCalled();
    expect(prisma.recommendation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "recommendation_1"
        }
      })
    );
  });

  it("approves follow-up recommendations by creating WhatsApp drafts", async () => {
    const prisma = createPrismaStub();
    const runtime = new ProjectCoordinatorRuntime(prisma as never, { now: () => now });

    prisma.recommendation.findUnique.mockResolvedValue({
      id: "recommendation_1",
      organizationId: "org_1",
      projectId: "project_1",
      proposedActionPayload: {
        conversationId: "conversation_1",
        draftMessage: "Please share a progress update.",
        whatsappAccountId: "whatsapp_1"
      },
      proposedActionType: "SEND_WHATSAPP_MESSAGE_DRAFT",
      status: "PENDING"
    });
    prisma.conversation.findUnique.mockResolvedValue({ id: "conversation_1" });
    prisma.whatsAppDraft.create.mockResolvedValue({
      id: "draft_1",
      messageBody: "Please share a progress update.",
      status: "DRAFT"
    });
    prisma.recommendation.update.mockResolvedValue({
      id: "recommendation_1",
      status: "APPROVED"
    });

    const result = await runtime.approveRecommendation({
      recommendationId: "recommendation_1",
      userId: "user_1"
    });

    expect(result.draft?.id).toBe("draft_1");
    expect(prisma.whatsAppDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          messageBody: "Please share a progress update.",
          status: "DRAFT"
        })
      })
    );
  });

  it("marks draft sends failed when no WhatsApp sender is configured", async () => {
    const prisma = createPrismaStub();
    const runtime = new ProjectCoordinatorRuntime(prisma as never, { now: () => now });

    prisma.whatsAppDraft.findUnique.mockResolvedValue({
      conversationId: "conversation_1",
      id: "draft_1",
      messageBody: "Can we get an update?",
      organizationId: "org_1",
      projectId: "project_1",
      recommendationId: "recommendation_1",
      whatsappAccountId: "whatsapp_1"
    });
    prisma.whatsAppDraft.update.mockResolvedValue({
      id: "draft_1",
      status: "FAILED"
    });

    const result = await runtime.sendWhatsAppDraft({
      draftId: "draft_1",
      userId: "user_1"
    });

    expect(result.sent).toBe(false);
    expect(prisma.whatsAppDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED"
        })
      })
    );
  });

  it("marks draft sends approved when the API queues worker delivery", async () => {
    const prisma = createPrismaStub();
    const runtime = new ProjectCoordinatorRuntime(prisma as never, {
      draftSender: {
        send: vi.fn().mockResolvedValue({ queued: true })
      },
      now: () => now
    });

    prisma.whatsAppDraft.findUnique.mockResolvedValue({
      conversationId: "conversation_1",
      id: "draft_1",
      messageBody: "Can we get an update?",
      organizationId: "org_1",
      projectId: "project_1",
      recommendationId: "recommendation_1",
      whatsappAccountId: "whatsapp_1"
    });
    prisma.whatsAppDraft.update.mockResolvedValue({
      id: "draft_1",
      status: "APPROVED"
    });

    const result = await runtime.sendWhatsAppDraft({
      draftId: "draft_1",
      userId: "user_1"
    });

    expect(result.sent).toBe(false);
    expect("queued" in result && result.queued).toBe(true);
    expect(prisma.whatsAppDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          approvedByUserId: "user_1",
          status: "APPROVED"
        })
      })
    );
    expect(prisma.recommendation.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED"
        })
      })
    );
  });
});

function createPrismaStub() {
  const project = {
    id: "project_1",
    name: "Terminal 2",
    organizationId: "org_1"
  };

  return {
    $transaction: vi.fn((callback) => callback(createPrismaStub())),
    aIMessageClassification: {
      findMany: vi.fn().mockResolvedValue([])
    },
    actionItem: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([])
    },
    conversation: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null)
    },
    coordinatorRun: {
      create: vi.fn().mockResolvedValue({
        id: "run_1"
      }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({})
    },
    event: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([])
    },
    message: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([])
    },
    photoAnalysis: {
      findMany: vi.fn().mockResolvedValue([])
    },
    processingJob: {
      upsert: vi.fn()
    },
    project: {
      findMany: vi.fn().mockResolvedValue([project]),
      findUnique: vi.fn().mockResolvedValue(project)
    },
    projectReport: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([])
    },
    projectState: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockImplementation((input) =>
        Promise.resolve({
          id: "state_1",
          ...input.create
        })
      )
    },
    recommendation: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "recommendation_created" }),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({})
    },
    whatsAppChatMapping: {
      findUnique: vi.fn().mockResolvedValue(null)
    },
    whatsAppDraft: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn()
    }
  };
}
