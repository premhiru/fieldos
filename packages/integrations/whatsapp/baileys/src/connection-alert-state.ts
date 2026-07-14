export function shouldRecordUnexpectedDisconnect(input: {
  hasOpened: boolean;
  persistedStatus: string | null;
  stalePrePairingSession: boolean;
}): boolean {
  return input.hasOpened && input.persistedStatus === "CONNECTED" && !input.stalePrePairingSession;
}

export function getRecoveryAlertAction(input: {
  disconnectAlertSentAt: Date | null;
  disconnectedAt: Date | null;
  recoveryAlertSentAt: Date | null;
}): "CLEAR" | "NONE" | "QUEUE" {
  if (!input.disconnectedAt || input.recoveryAlertSentAt) {
    return "NONE";
  }

  return input.disconnectAlertSentAt ? "QUEUE" : "CLEAR";
}
