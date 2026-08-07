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
      whatsAppGroupParticipant: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null)
      }
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

  it("does not remove anyone when an authoritative provider snapshot is empty", async () => {
    const findMany = vi.fn();
    const service = new WhatsAppParticipantSyncService({
      whatsAppChatMapping: {
        findUnique: vi.fn().mockResolvedValue(buildMapping())
      },
      whatsAppGroupParticipant: { findMany }
    } as never);

    await expect(
      service.syncGroup("mapping-1", [], { authoritative: true })
    ).resolves.toMatchObject({
      found: 0,
      removed: 0
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("does not remove anyone when a provider snapshot contains ignored identifiers", async () => {
    const findMany = vi.fn();
    const service = new WhatsAppParticipantSyncService({
      whatsAppChatMapping: {
        findUnique: vi.fn().mockResolvedValue(buildMapping())
      },
      whatsAppGroupParticipant: { findMany }
    } as never);

    await expect(
      service.syncGroup("mapping-1", [{ isAdmin: false, jid: "status@broadcast" }], {
        authoritative: true
      })
    ).resolves.toMatchObject({ ignored: 1, removed: 0 });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("removes missing participants only from a complete authoritative snapshot", async () => {
    const removedUpdate = vi.fn().mockResolvedValue({});
    const transactionClient = {
      projectParticipant: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        upsert: vi.fn().mockResolvedValue({})
      },
      whatsAppGroupParticipant: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: removedUpdate,
        upsert: vi.fn().mockResolvedValue({})
      },
      whatsAppOperationAudit: { create: vi.fn().mockResolvedValue({}) }
    };
    const service = new WhatsAppParticipantSyncService({
      $transaction: vi.fn((callback) => callback(transactionClient)),
      personIdentity: {
        findMany: vi.fn().mockResolvedValue([
          {
            createdAt: new Date("2026-07-01T00:00:00Z"),
            id: "identity-seen",
            jid: "6590000001@s.whatsapp.net",
            lid: null,
            personId: "person-seen",
            verificationStatus: "CONFIRMED"
          }
        ]),
        update: vi.fn().mockResolvedValue({
          id: "identity-seen",
          personId: "person-seen",
          verificationStatus: "CONFIRMED"
        })
      },
      whatsAppChatMapping: {
        findUnique: vi.fn().mockResolvedValue(buildMapping())
      },
      whatsAppGroupParticipant: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "group-participant-removed",
            personIdentity: { personId: "person-removed" },
            personIdentityId: "identity-removed"
          }
        ]),
        findUnique: vi.fn().mockResolvedValue({ participantStatus: "ACTIVE" })
      }
    } as never);

    await expect(
      service.syncGroup("mapping-1", [{ isAdmin: false, jid: "6590000001@s.whatsapp.net" }], {
        authoritative: true
      })
    ).resolves.toMatchObject({ removed: 1 });
    expect(removedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ participantStatus: "INACTIVE" }),
        where: { id: "group-participant-removed" }
      })
    );
  });
});

function buildMapping() {
  return {
    id: "mapping-1",
    isGroup: true,
    organizationId: "org-1",
    projectId: "project-1",
    status: "ACTIVE",
    whatsappAccountId: "account-1"
  };
}
