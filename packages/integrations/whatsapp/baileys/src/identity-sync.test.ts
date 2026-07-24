import { describe, expect, it, vi } from "vitest";

import {
  normalizeParticipantIdentifiers,
  WhatsAppParticipantSyncService
} from "./identity-sync.js";

describe("WhatsApp participant identity normalization", () => {
  it("keeps phone JIDs and LIDs as separate provider identifiers", () => {
    expect(
      normalizeParticipantIdentifiers({
        isAdmin: false,
        jid: "6590882954@s.whatsapp.net",
        lid: "49233545699503@lid"
      })
    ).toEqual({
      jid: "6590882954@s.whatsapp.net",
      lid: "49233545699503@lid",
      phoneNumber: "6590882954"
    });
  });

  it("does not manufacture a phone number from a LID", () => {
    expect(normalizeParticipantIdentifiers({ isAdmin: true, jid: "49233545699503@lid" })).toEqual({
      jid: null,
      lid: "49233545699503@lid",
      phoneNumber: null
    });
  });

  it("ignores unsupported provider identifiers", () => {
    expect(normalizeParticipantIdentifiers({ isAdmin: false, jid: "status@broadcast" })).toEqual({
      jid: null,
      lid: null,
      phoneNumber: null
    });
  });

  it("keeps existing same-person JID and LID records separate during sync", async () => {
    const personIdentityUpdate = vi.fn().mockResolvedValue({
      id: "identity-jid",
      personId: "person-1",
      verificationStatus: "CONFIRMED"
    });
    const transaction = vi.fn(async (callback: (tx: object) => Promise<void>) =>
      callback({
        projectParticipant: { upsert: vi.fn() },
        whatsAppGroupParticipant: { upsert: vi.fn() },
        whatsAppOperationAudit: { create: vi.fn() }
      })
    );
    const service = new WhatsAppParticipantSyncService({
      $transaction: transaction,
      personIdentity: {
        findMany: vi.fn().mockResolvedValue([
          {
            createdAt: new Date("2026-07-01T00:00:00Z"),
            id: "identity-jid",
            jid: "6590882954@s.whatsapp.net",
            lid: null,
            personId: "person-1",
            verificationStatus: "CONFIRMED"
          },
          {
            createdAt: new Date("2026-07-02T00:00:00Z"),
            id: "identity-lid",
            jid: null,
            lid: "49233545699503@lid",
            personId: "person-1",
            verificationStatus: "CONFIRMED"
          }
        ]),
        update: personIdentityUpdate
      },
      whatsAppChatMapping: {
        findUnique: vi.fn().mockResolvedValue({
          id: "mapping-1",
          isGroup: true,
          organizationId: "org-1",
          projectId: "project-1",
          status: "ACTIVE",
          whatsappAccountId: "account-1"
        })
      },
      whatsAppGroupParticipant: { findMany: vi.fn().mockResolvedValue([]) }
    } as never);

    await service.syncGroup("mapping-1", [
      {
        isAdmin: false,
        jid: "6590882954@s.whatsapp.net",
        lid: "49233545699503@lid"
      }
    ]);

    expect(personIdentityUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ lid: expect.anything() }),
        where: { id: "identity-jid" }
      })
    );
  });
});
