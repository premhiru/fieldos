import { describe, expect, it } from "vitest";

import {
  getRecoveryAlertAction,
  shouldRecordUnexpectedDisconnect
} from "./connection-alert-state.js";

describe("WhatsApp connection alert state", () => {
  it("records an unexpected loss only after a connected session opened", () => {
    expect(
      shouldRecordUnexpectedDisconnect({
        hasOpened: true,
        persistedStatus: "CONNECTED",
        stalePrePairingSession: false
      })
    ).toBe(true);
  });

  it.each([
    { hasOpened: false, persistedStatus: "CONNECTED", stalePrePairingSession: false },
    { hasOpened: true, persistedStatus: "DISCONNECTED", stalePrePairingSession: false },
    { hasOpened: true, persistedStatus: "CONNECTED", stalePrePairingSession: true }
  ])("does not alert for initial pairing, intentional disconnects, or stale sessions", (input) => {
    expect(shouldRecordUnexpectedDisconnect(input)).toBe(false);
  });

  it("queues one recovery after a disconnect alert was sent", () => {
    expect(
      getRecoveryAlertAction({
        disconnectAlertSentAt: new Date("2026-07-14T02:01:00.000Z"),
        disconnectedAt: new Date("2026-07-14T02:00:00.000Z"),
        recoveryAlertSentAt: null
      })
    ).toBe("QUEUE");
  });

  it("clears a brief outage that recovered before the grace-period alert", () => {
    expect(
      getRecoveryAlertAction({
        disconnectAlertSentAt: null,
        disconnectedAt: new Date("2026-07-14T02:00:00.000Z"),
        recoveryAlertSentAt: null
      })
    ).toBe("CLEAR");
  });

  it("does nothing when recovery was already recorded", () => {
    expect(
      getRecoveryAlertAction({
        disconnectAlertSentAt: new Date("2026-07-14T02:01:00.000Z"),
        disconnectedAt: new Date("2026-07-14T02:00:00.000Z"),
        recoveryAlertSentAt: new Date("2026-07-14T02:05:00.000Z")
      })
    ).toBe("NONE");
  });
});
