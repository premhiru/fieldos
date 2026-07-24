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
    const transaction = vi.fn();
    const client = {
      $transaction: transaction,
      whatsAppInvitation: {
        findUnique: vi.fn().mockResolvedValue({
          expiresAt: new Date("2026-07-20T00:00:00.000Z"),
          status: "JOINED"
        })
      }
    };
    const service = createPrismaWhatsAppNativeService(client as never);

    await expect(
      service.acceptInvitation({ token: "a".repeat(32), userId: "user-1" })
    ).rejects.toThrow("Invitation is invalid or expired.");
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe("WhatsApp invitation roles", () => {
  it("never permits an invitation to create another organization owner", () => {
    expect(() =>
      createWhatsAppInvitationSchema.parse({ personId: "person-1", role: "OWNER" })
    ).toThrow();
  });
});
