import { describe, expect, it, vi } from "vitest";

import { createWhatsAppInvitationSchema } from "./schemas.js";
import { createPrismaWhatsAppNativeService } from "./whatsapp-native-service.js";

describe("WhatsApp native operations tenancy", () => {
  it("does not list people when the project does not belong to the organization", async () => {
    const client = {
      project: { findFirst: vi.fn().mockResolvedValue(null) },
      projectParticipant: { findMany: vi.fn() }
    };
    const service = createPrismaWhatsAppNativeService(client as never);

    await expect(
      service.listPeople({ organizationId: "org-a", projectId: "project-b" })
    ).rejects.toThrow("Project not found.");
    expect(client.projectParticipant.findMany).not.toHaveBeenCalled();
  });

  it("returns recognizable WhatsApp identity details without raw provider identifiers", async () => {
    const client = {
      project: { findFirst: vi.fn().mockResolvedValue({ id: "project-1" }) },
      projectParticipant: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "participant-1",
            lastSeenAt: new Date("2026-08-07T00:00:00.000Z"),
            participantStatus: "ACTIVE",
            person: {
              company: null,
              displayName: "Site Supervisor",
              id: "person-1",
              identities: [
                {
                  displayName: "Supervisor",
                  groupParticipants: [],
                  id: "identity-1",
                  identityReviews: [
                    {
                      id: "review-1",
                      personIdentityId: "identity-1",
                      reason: "MANUAL_REVIEW",
                      status: "PENDING"
                    }
                  ],
                  jid: "6590000000@s.whatsapp.net",
                  lastSeenAt: new Date("2026-08-07T00:00:00.000Z"),
                  lid: "123@lid",
                  phoneNumber: "6590000000",
                  pushName: "Site Supervisor",
                  verificationStatus: "OBSERVED"
                }
              ],
              phoneNumber: "6590000000",
              roleTitle: null,
              status: "ACTIVE",
              type: "UNKNOWN",
              userId: null,
              whatsAppInvitations: []
            },
            role: null
          }
        ])
      }
    };
    const service = createPrismaWhatsAppNativeService(client as never);

    const people = (await service.listPeople({
      organizationId: "org-1",
      projectId: "project-1"
    })) as Array<Record<string, unknown>>;

    expect(people[0]).toMatchObject({
      person: {
        identities: [
          {
            displayName: "Supervisor",
            phoneNumber: "6590000000",
            pushName: "Site Supervisor"
          }
        ],
        identityReviews: [
          {
            id: "review-1",
            personIdentityId: "identity-1",
            status: "PENDING"
          }
        ],
        phoneNumber: "6590000000"
      }
    });
    expect(JSON.stringify(people[0])).not.toContain("@s.whatsapp.net");
    expect(JSON.stringify(people[0])).not.toContain("@lid");
  });

  it("finds reviewable people through pending WhatsApp identity reviews", async () => {
    const client = {
      project: { findFirst: vi.fn().mockResolvedValue({ id: "project-1" }) },
      projectParticipant: { findMany: vi.fn().mockResolvedValue([]) }
    };
    const service = createPrismaWhatsAppNativeService(client as never);

    await service.listPeople({
      filter: "review",
      organizationId: "org-1",
      projectId: "project-1"
    });

    expect(client.projectParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          person: {
            identities: {
              some: { identityReviews: { some: { status: "PENDING" } } }
            }
          }
        })
      })
    );
  });

  it("confirms a reviewed identity as a distinct person", async () => {
    const transactionClient = {
      identityReview: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      personIdentity: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      whatsAppOperationAudit: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) }
    };
    const client = {
      ...transactionClient,
      $transaction: vi.fn(async (callback) => callback(transactionClient)),
      identityReview: {
        ...transactionClient.identityReview,
        findFirst: vi.fn().mockResolvedValue({
          id: "review-1",
          personIdentity: { id: "identity-1" },
          personIdentityId: "identity-1"
        })
      }
    };
    const service = createPrismaWhatsAppNativeService(client as never);

    await service.confirmIdentity("review-1", "org-1", "admin-1");

    expect(client.personIdentity.updateMany).toHaveBeenCalledWith({
      data: { verificationStatus: "CONFIRMED" },
      where: { id: "identity-1", organizationId: "org-1" }
    });
    expect(client.whatsAppOperationAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "admin-1",
        eventType: "IDENTITY_CONFIRMED",
        personIdentityId: "identity-1"
      })
    });
  });

  it("does not activate an expired WhatsApp invitation", async () => {
    const transactionClient = {
      whatsAppInvitation: {
        findUnique: vi.fn().mockResolvedValue({
          expiresAt: new Date("2026-07-20T00:00:00.000Z"),
          status: "JOINED"
        })
      }
    };
    const transaction = vi.fn((callback) => callback(transactionClient));
    const client = {
      $transaction: transaction
    };
    const service = createPrismaWhatsAppNativeService(client as never);

    await expect(
      service.acceptInvitation({ token: "a".repeat(32), userId: "user-1" })
    ).rejects.toThrow("Invitation is invalid or expired.");
    expect(transaction).toHaveBeenCalledOnce();
  });

  it("requires the signed-in account to match an invitation's known email", async () => {
    const transactionClient = {
      user: { findUnique: vi.fn().mockResolvedValue({ email: "other@example.com" }) },
      whatsAppInvitation: {
        findUnique: vi.fn().mockResolvedValue({
          expiresAt: new Date("2099-07-20T00:00:00.000Z"),
          person: { email: "invitee@example.com" },
          status: "JOINED"
        }),
        updateMany: vi.fn()
      }
    };
    const service = createPrismaWhatsAppNativeService({
      $transaction: vi.fn((callback) => callback(transactionClient))
    } as never);

    await expect(
      service.acceptInvitation({ token: "b".repeat(32), userId: "user-1" })
    ).rejects.toThrow("Sign in with the email address associated with this invitation.");
    expect(transactionClient.whatsAppInvitation.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an invitation already claimed by a concurrent request", async () => {
    const transactionClient = {
      person: { findFirst: vi.fn().mockResolvedValue(null) },
      user: { findUnique: vi.fn().mockResolvedValue({ email: "invitee@example.com" }) },
      whatsAppInvitation: {
        findUnique: vi.fn().mockResolvedValue({
          expiresAt: new Date("2099-07-20T00:00:00.000Z"),
          id: "invitation-1",
          organizationId: "org-1",
          person: { email: "invitee@example.com" },
          personId: "person-1",
          status: "JOINED"
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 })
      }
    };
    const service = createPrismaWhatsAppNativeService({
      $transaction: vi.fn((callback) => callback(transactionClient))
    } as never);

    await expect(
      service.acceptInvitation({ token: "c".repeat(32), userId: "user-1" })
    ).rejects.toThrow("Invitation is invalid or expired.");
  });
});

describe("WhatsApp invitation roles", () => {
  it("never permits an invitation to create another organization owner", () => {
    expect(() =>
      createWhatsAppInvitationSchema.parse({ personId: "person-1", role: "OWNER" })
    ).toThrow();
  });
});
