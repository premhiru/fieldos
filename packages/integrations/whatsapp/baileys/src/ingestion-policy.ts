import type { WhatsAppAccountRecord, WhatsAppChatMappingRecord } from "./types.js";

export type WhatsAppIngestionSkipReason =
  "ACCOUNT_NOT_CONNECTED" | "MAPPING_MISSING" | "MAPPING_NOT_ACTIVE" | "PROJECT_MISSING";

export interface WhatsAppIngestionDecision {
  allowed: boolean;
  reasonSkipped: WhatsAppIngestionSkipReason | null;
}

export function decideWhatsAppIngestion(input: {
  account: Pick<WhatsAppAccountRecord, "status">;
  mapping: Pick<WhatsAppChatMappingRecord, "projectId" | "status"> | null;
}): WhatsAppIngestionDecision {
  if (input.account.status !== "CONNECTED") {
    return {
      allowed: false,
      reasonSkipped: "ACCOUNT_NOT_CONNECTED"
    };
  }

  if (!input.mapping) {
    return {
      allowed: false,
      reasonSkipped: "MAPPING_MISSING"
    };
  }

  if (input.mapping.status !== "ACTIVE") {
    return {
      allowed: false,
      reasonSkipped: "MAPPING_NOT_ACTIVE"
    };
  }

  if (!input.mapping.projectId) {
    return {
      allowed: false,
      reasonSkipped: "PROJECT_MISSING"
    };
  }

  return {
    allowed: true,
    reasonSkipped: null
  };
}
