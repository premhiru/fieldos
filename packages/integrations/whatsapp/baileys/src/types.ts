import type { MessageDirection, MessageType } from "@fieldos/messaging";

export interface WhatsAppAccountRecord {
  id: string;
  organizationId: string;
  displayName: string;
  phoneNumber: string | null;
  connectorType: "BAILEYS" | "META_CLOUD";
  status: "PENDING_QR" | "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR";
  sessionKey: string;
  lastConnectedAt: Date | null;
  lastDisconnectedAt: Date | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsAppChatMappingRecord {
  id: string;
  organizationId: string;
  whatsappAccountId: string;
  conversationId: string | null;
  projectId: string | null;
  jid: string;
  chatName: string | null;
  isGroup: boolean;
  status: "DISCOVERED" | "ACTIVE" | "IGNORED" | "ARCHIVED";
  activatedAt: Date | null;
  activatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  project: {
    id: string;
    code: string;
    name: string;
  } | null;
  conversation: {
    id: string;
    title: string;
    projectId: string | null;
  } | null;
}

export interface NormalizedWhatsAppMessage {
  chatJid: string;
  senderJid: string;
  pushName: string | null;
  isGroup: boolean;
  messageId: string;
  direction: MessageDirection;
  type: MessageType;
  body: string | null;
  occurredAt: Date;
  media: {
    kind: "IMAGE" | "DOCUMENT" | "VOICE" | "VIDEO";
    filename: string;
    mimeType: string;
    size: number | null;
  } | null;
}

export interface BaileysSessionManagerOptions {
  pollIntervalMs?: number;
  rootStoragePath?: string;
}
