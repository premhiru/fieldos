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
