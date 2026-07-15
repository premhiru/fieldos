import { describe, expect, it, vi } from "vitest";

import type { TransactionalEmailSender } from "@fieldos/shared";

import {
  WhatsAppConnectionAlertProcessor,
  type WhatsAppConnectionAlertContext,
  type WhatsAppConnectionAlertStore
} from "./whatsapp-connection-alerts.js";

const disconnectedAt = new Date("2026-07-14T02:00:00.000Z");
const now = new Date("2026-07-14T02:07:00.000Z");

function createHarness(overrides: Partial<WhatsAppConnectionAlertContext> = {}) {
  const context: WhatsAppConnectionAlertContext = {
    accountId: "account-1",
    accountName: "Pilot line",
    adminEmails: ["owner@example.com", "ADMIN@example.com", "owner@example.com"],
    disconnectAlertSentAt: null,
    disconnectedAt,
    lastDisconnectReason: "Network connection was lost",
    organizationId: "org-1",
    organizationName: "FieldOS Pilot",
    phoneNumber: "+6512345678",
    recoveryAlertSentAt: null,
    status: "DISCONNECTED",
    ...overrides
  };
  const send = vi.fn<TransactionalEmailSender["send"]>().mockResolvedValue("SENT");
  const store: WhatsAppConnectionAlertStore = {
    findContext: vi.fn().mockImplementation(async () => context),
    markDisconnectAlertSent: vi.fn().mockImplementation(async (_accountId, _outage, sentAt) => {
      context.disconnectAlertSentAt = sentAt;
    }),
    markRecoveryAlertSent: vi.fn().mockImplementation(async (_accountId, _outage, sentAt) => {
      context.recoveryAlertSentAt = sentAt;
    })
  };
  const logger = { info: vi.fn(), warn: vi.fn() };
  const processor = new WhatsAppConnectionAlertProcessor(
    store,
    { send },
    {
      appUrl: "https://fieldos.example.com/",
      fromEmail: "FieldOS <alerts@example.com>",
      logger,
      now: () => now
    }
  );

  return { context, logger, processor, send, store };
}

describe("WhatsAppConnectionAlertProcessor", () => {
  it("sends one disconnect alert to unique owners and admins", async () => {
    const { processor, send, store } = createHarness();

    await processor.process({ accountId: "account-1", alertType: "DISCONNECT" });
    await processor.process({ accountId: "account-1", alertType: "DISCONNECT" });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: `whatsapp-disconnect/account-1/${disconnectedAt.toISOString()}`,
        subject: "FieldOS alert: WhatsApp connection lost",
        to: ["owner@example.com", "admin@example.com"]
      })
    );
    expect(store.markDisconnectAlertSent).toHaveBeenCalledTimes(1);
  });

  it("does not alert for an account that reconnected during the grace period", async () => {
    const { processor, send } = createHarness({ status: "CONNECTED" });

    await processor.process({ accountId: "account-1", alertType: "DISCONNECT" });

    expect(send).not.toHaveBeenCalled();
  });

  it("alerts while the connector is still attempting to reconnect", async () => {
    const { processor, send } = createHarness({ status: "CONNECTING" });

    await processor.process({ accountId: "account-1", alertType: "DISCONNECT" });

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("alerts when a previously connected account requires pairing after a restart", async () => {
    const { processor, send } = createHarness({ status: "PENDING_QR" });

    await processor.process({ accountId: "account-1", alertType: "DISCONNECT" });

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends one recovery alert with the interruption duration", async () => {
    const { processor, send, store } = createHarness({
      disconnectAlertSentAt: new Date("2026-07-14T02:01:00.000Z"),
      status: "CONNECTED"
    });

    await processor.process({ accountId: "account-1", alertType: "RECOVERY" });
    await processor.process({ accountId: "account-1", alertType: "RECOVERY" });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: `whatsapp-recovery/account-1/${disconnectedAt.toISOString()}`,
        subject: "FieldOS update: WhatsApp connection restored",
        text: expect.stringContaining("7 minutes")
      })
    );
    expect(store.markRecoveryAlertSent).toHaveBeenCalledTimes(1);
  });

  it("logs and exits when the organization has no owner or admin email", async () => {
    const { logger, processor, send } = createHarness({ adminEmails: [] });

    await expect(
      processor.process({ accountId: "account-1", alertType: "DISCONNECT" })
    ).resolves.toBeUndefined();

    expect(send).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("surfaces provider failures so the durable job can retry", async () => {
    const { processor, send, store } = createHarness();
    send.mockRejectedValueOnce(new Error("provider unavailable"));

    await expect(
      processor.process({ accountId: "account-1", alertType: "DISCONNECT" })
    ).rejects.toThrow("provider unavailable");

    expect(store.markDisconnectAlertSent).not.toHaveBeenCalled();
  });

  it("does not duplicate a recovery already sent before a worker restart", async () => {
    const { processor, send } = createHarness({
      disconnectAlertSentAt: new Date("2026-07-14T02:01:00.000Z"),
      recoveryAlertSentAt: new Date("2026-07-14T02:07:00.000Z"),
      status: "CONNECTED"
    });

    await processor.process({ accountId: "account-1", alertType: "RECOVERY" });

    expect(send).not.toHaveBeenCalled();
  });
});
