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
      createdAt: new Date(),
      recommendation: { status: "DISMISSED" }
    });
    const result = await new RecommendationGate(prisma.client as never).evaluate(
      "organization_1",
      "ACTIVE",
      "V2",
      candidate()
    );

    expect(result.suppressionReason).toBe("RECENTLY_DISMISSED");
  });
});

function candidate(): RecommendationCandidateInput {
  return {
    confidence: "HIGH",
    description: "The signed test sheet remains overdue.",
    evidenceIds: ["message_1"],
    priority: "HIGH",
    projectId: "project_1",
    proposedActionType: "SEND_WHATSAPP_MESSAGE_DRAFT",
    reason: "A specific dated commitment remains unresolved.",
    scope: "signed test sheet",
    sourceCoordinator: "FOLLOW_UP",
    sourceEntityId: "expectation_1",
    sourceEntityType: "OUTSTANDING_EXPECTATION",
    title: "Follow up on signed test sheet",
    type: "FOLLOW_UP"
  };
}

function fakePrisma(history: unknown = null) {
  const candidateCreate = vi.fn().mockResolvedValue({ id: "candidate_1" });
  const recommendationCreate = vi.fn().mockResolvedValue({ id: "recommendation_1" });
  const client = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(client),
    recommendation: { create: recommendationCreate },
    recommendationCandidate: {
      create: candidateCreate,
      findFirst: vi.fn().mockResolvedValue(history)
    }
  };
  return { candidateCreate, client, recommendationCreate };
}
