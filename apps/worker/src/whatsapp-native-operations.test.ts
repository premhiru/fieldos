import { describe, expect, it, vi } from "vitest";

import { WhatsAppNativeOperationsService } from "./whatsapp-native-operations.js";

const baseInput = {
  accountId: "account-1",
  body: "APPROVE",
  chatJid: "6590000000@s.whatsapp.net",
  inboundMessageId: "inbound-1",
  isGroup: false,
  organizationId: "org-1",
  pushName: "Reviewer",
  quotedMessageId: "outbound-1",
  senderJid: "6590000000@s.whatsapp.net"
};

describe("WhatsApp recommendation response security", () => {
  it("leaves natural language in the ordinary inbound pipeline", async () => {
    const service = createService({});
    await expect(service.handle({ ...baseInput, body: "okay" })).resolves.toEqual({
      handled: false
    });
  });

  it("intercepts deterministic controls but denies an unverified sender", async () => {
    const auditCreate = vi.fn().mockResolvedValue({});
    const service = createService({
      personIdentity: { findFirst: vi.fn().mockResolvedValue(null) },
      whatsAppOperationAudit: { create: auditCreate }
    });

    const result = await service.handle(baseInput);
    expect(result.handled).toBe(true);
    expect(result.replyText).toContain("not authorized");
    expect(auditCreate).toHaveBeenCalledOnce();
  });

  it("never applies an unquoted visible-reference approval", async () => {
    const coordinator = { approveRecommendation: vi.fn() };
    const service = createService(
      {
        personIdentity: {
          findFirst: vi.fn().mockResolvedValue({
            id: "identity-1",
            personId: "person-1",
            person: { userId: "user-1" }
          })
        },
        recommendationDelivery: { findFirst: vi.fn().mockResolvedValue(null) },
        whatsAppOperationAudit: { create: vi.fn().mockResolvedValue({}) }
      },
      coordinator
    );

    const result = await service.handle({
      ...baseInput,
      body: "APPROVE REC-1842",
      quotedMessageId: null
    });
    expect(result.replyText).toContain("reply directly");
    expect(coordinator.approveRecommendation).not.toHaveBeenCalled();
  });

  it("requires a second confirmation for a configured high-impact action", async () => {
    const coordinator = { approveRecommendation: vi.fn() };
    const delivery = buildDelivery({ impact: "HIGH_IMPACT" });
    const service = createService(
      {
        $transaction: vi.fn().mockResolvedValue([]),
        membership: {
          findUnique: vi.fn().mockResolvedValue({ allProjects: true, projectAccess: [] })
        },
        personIdentity: {
          findFirst: vi.fn().mockResolvedValue(buildIdentity()),
          findUnique: vi.fn().mockResolvedValue({ personId: "person-1" })
        },
        recommendationDelivery: {
          findFirst: vi.fn().mockResolvedValue(delivery),
          update: vi.fn().mockResolvedValue(delivery)
        },
        recommendationResponse: {
          create: vi.fn().mockResolvedValue({}),
          findUnique: vi.fn().mockResolvedValue(null)
        },
        whatsAppOperationAudit: { create: vi.fn().mockResolvedValue({}) },
        whatsAppRecommendationSetting: {
          findUnique: vi.fn().mockResolvedValue({ requireSecondConfirmationForHighImpact: true })
        }
      },
      coordinator
    );

    const result = await service.handle(baseInput);
    expect(result.replyText).toContain("CONFIRM REC-");
    expect(coordinator.approveRecommendation).not.toHaveBeenCalled();
  });

  it("does not repeat a response side effect when the inbound message is replayed", async () => {
    const coordinator = { approveRecommendation: vi.fn() };
    const service = createService(
      {
        personIdentity: { findFirst: vi.fn().mockResolvedValue(buildIdentity()) },
        recommendationDelivery: { findFirst: vi.fn().mockResolvedValue(buildDelivery()) },
        recommendationResponse: { findUnique: vi.fn().mockResolvedValue({ id: "response-1" }) },
        whatsAppOperationAudit: { create: vi.fn().mockResolvedValue({}) }
      },
      coordinator
    );

    const result = await service.handle(baseInput);
    expect(result.replyText).toContain("already processed");
    expect(coordinator.approveRecommendation).not.toHaveBeenCalled();
  });

  it("denies a project member who is not an explicitly selected group approver", async () => {
    const coordinator = { approveRecommendation: vi.fn() };
    const transaction = vi.fn().mockResolvedValue([]);
    const service = createService(
      {
        $transaction: transaction,
        membership: {
          findUnique: vi.fn().mockResolvedValue({ allProjects: true, projectAccess: [] })
        },
        personIdentity: {
          findFirst: vi.fn().mockResolvedValue(buildIdentity()),
          findUnique: vi.fn().mockResolvedValue({ personId: "person-1" })
        },
        recommendationDelivery: {
          findFirst: vi
            .fn()
            .mockResolvedValue(
              buildDelivery({ recipientIdentityId: null, whatsappChatMappingId: "mapping-1" })
            )
        },
        recommendationResponse: {
          create: vi.fn().mockResolvedValue({}),
          findUnique: vi.fn().mockResolvedValue(null)
        },
        whatsAppOperationAudit: { create: vi.fn().mockResolvedValue({}) },
        whatsAppRecommendationSetting: {
          findUnique: vi.fn().mockResolvedValue({
            groupApprovalsEnabled: true,
            namedApprovers: [{ personId: "person-2" }]
          })
        }
      },
      coordinator
    );

    const result = await service.handle({
      ...baseInput,
      chatJid: "group-1@g.us",
      isGroup: true
    });

    expect(result.replyText).toContain("not authorized");
    expect(coordinator.approveRecommendation).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledOnce();
  });
});

function createService(prisma: object, coordinator: object = {}) {
  return new WhatsAppNativeOperationsService(prisma as never, coordinator as never, {
    appUrl: "https://fieldos.example",
    deliveryEnabled: true,
    invitationsEnabled: true,
    replyEnabled: true,
    sendText: vi.fn()
  });
}

function buildIdentity() {
  return { id: "identity-1", personId: "person-1", person: { userId: "user-1" } };
}

function buildDelivery(overrides: Record<string, unknown> = {}) {
  return {
    confirmationExpiresAt: null,
    deliveryStatus: "SENT",
    expiresAt: new Date("2026-07-30T00:00:00.000Z"),
    id: "delivery-1",
    impact: "STANDARD",
    organizationId: "org-1",
    project: { name: "Project One", timezone: "UTC" },
    projectId: "project-1",
    recipientIdentity: { id: "identity-1", person: { userId: "user-1" } },
    recipientIdentityId: "identity-1",
    recipientPersonId: "person-1",
    recommendation: {
      decisionCandidate: { evidenceSummary: "Evidence", status: "CREATED" },
      description: "Description",
      id: "recommendation-1842",
      status: "PENDING",
      title: "Complete milestone"
    },
    recommendationId: "recommendation-1842",
    whatsappChatMappingId: null,
    ...overrides
  };
}
