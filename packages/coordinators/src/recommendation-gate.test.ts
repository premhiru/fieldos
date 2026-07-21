import { describe, expect, it, vi } from "vitest";

import { RecommendationGate, type RecommendationCandidateInput } from "./recommendation-gate.js";

describe("RecommendationGate", () => {
  it("persists an eligible shadow candidate without creating a recommendation", async () => {
    const prisma = fakePrisma();
    const result = await new RecommendationGate(prisma.client as never).evaluate(
      "organization_1",
      "ACTIVE",
      "SHADOW",
      candidate()
    );

    expect(result).toMatchObject({ created: false, suppressionReason: "SHADOW_MODE" });
    expect(prisma.recommendationCreate).not.toHaveBeenCalled();
    expect(prisma.candidateCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SHADOW", suppressionReason: "SHADOW_MODE" })
      })
    );
  });

  it("suppresses a duplicate pending recommendation", async () => {
    const prisma = fakePrisma({
      createdAt: new Date(),
      recommendation: { status: "PENDING" }
    });
    const result = await new RecommendationGate(prisma.client as never).evaluate(
      "organization_1",
      "ACTIVE",
      "V2",
      candidate()
    );

    expect(result.suppressionReason).toBe("DUPLICATE_PENDING");
    expect(prisma.recommendationCreate).not.toHaveBeenCalled();
  });

  it("protects a dismissed decision from immediate regeneration", async () => {
    const prisma = fakePrisma({
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      evidenceIds: ["message_1"],
      recommendation: {
        approvedAt: null,
        completedAt: null,
        dismissedAt: new Date("2026-07-18T00:00:00.000Z"),
        status: "DISMISSED",
        updatedAt: new Date("2026-07-18T00:00:00.000Z")
      }
    });
    const result = await new RecommendationGate(
      prisma.client as never,
      () => new Date("2026-07-19T00:00:00.000Z")
    ).evaluate("organization_1", "ACTIVE", "V2", candidate());

    expect(result.suppressionReason).toBe("RECENTLY_DISMISSED");
  });

  it("requires materially new evidence even after the dismissal cooldown", async () => {
    const prisma = fakePrisma({
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      evidenceIds: ["message_1"],
      recommendation: {
        approvedAt: null,
        completedAt: null,
        dismissedAt: new Date("2026-05-01T00:00:00.000Z"),
        status: "DISMISSED",
        updatedAt: new Date("2026-05-01T00:00:00.000Z")
      }
    });
    const result = await new RecommendationGate(
      prisma.client as never,
      () => new Date("2026-07-19T00:00:00.000Z")
    ).evaluate("organization_1", "ACTIVE", "V2", candidate());

    expect(result.suppressionReason).toBe("RECENTLY_DISMISSED");
  });

  it("persists a clarification candidate without creating customer-visible work", async () => {
    const prisma = fakePrisma();
    const result = await new RecommendationGate(prisma.client as never).evaluate(
      "organization_1",
      "ACTIVE",
      "V2",
      candidate({ clarificationQuestion: "Which test sheet is outstanding?", confidence: "LOW" })
    );

    expect(result).toMatchObject({
      created: false,
      decision: "REQUEST_CLARIFICATION",
      reasonCode: "AMBIGUOUS"
    });
    expect(prisma.candidateCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CLARIFICATION" }) })
    );
    expect(prisma.recommendationCreate).not.toHaveBeenCalled();
  });

  it("rejects candidates without material operational impact", async () => {
    const prisma = fakePrisma();
    const result = await new RecommendationGate(prisma.client as never).evaluate(
      "organization_1",
      "ACTIVE",
      "V2",
      candidate({ materiality: [] })
    );

    expect(result.reasonCode).toBe("NO_MATERIALITY");
  });

  it("rejects equivalent work that already has an owner", async () => {
    const prisma = fakePrisma(null, { id: "action_item_1" });
    const result = await new RecommendationGate(prisma.client as never).evaluate(
      "organization_1",
      "ACTIVE",
      "V2",
      candidate()
    );

    expect(result.reasonCode).toBe("OWNERSHIP_EXISTS");
  });
});

function candidate(
  overrides: Partial<RecommendationCandidateInput> = {}
): RecommendationCandidateInput {
  return {
    confidence: "HIGH",
    description: "The signed test sheet remains overdue.",
    evidenceLimitations: "No later document has been linked to this conversation.",
    evidenceIds: ["message_1"],
    evidenceSummary: "Message message_1 promised the signed test sheet by the due date.",
    expectedValue:
      "Obtaining the sheet unblocks test acceptance and closes the outstanding request.",
    materiality: ["APPROVAL", "OWNERSHIP"],
    priority: "HIGH",
    projectId: "project_1",
    proposedActionType: "SEND_WHATSAPP_MESSAGE_DRAFT",
    reason: "A specific dated commitment remains unresolved.",
    scope: "signed test sheet",
    sourceCoordinator: "FOLLOW_UP",
    sourceEntityId: "expectation_1",
    sourceEntityType: "OUTSTANDING_EXPECTATION",
    title: "Follow up on signed test sheet",
    type: "FOLLOW_UP",
    ...overrides
  };
}

function fakePrisma(history: unknown = null, ownedWork: unknown = null) {
  const candidateCreate = vi.fn().mockResolvedValue({ id: "candidate_1" });
  const recommendationCreate = vi.fn().mockResolvedValue({ id: "recommendation_1" });
  const client = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(client),
    actionItem: { findFirst: vi.fn().mockResolvedValue(ownedWork) },
    outstandingExpectation: { findUnique: vi.fn().mockResolvedValue({ status: "OPEN" }) },
    recommendation: { create: recommendationCreate },
    recommendationCandidate: {
      create: candidateCreate,
      findFirst: vi.fn().mockResolvedValue(history)
    }
  };
  return { candidateCreate, client, recommendationCreate };
}
