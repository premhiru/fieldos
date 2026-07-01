import type { WAMessage } from "@whiskeysockets/baileys";

import type { NormalizedWhatsAppMessage } from "./types.js";

export function normalizeWhatsAppMessage(message: WAMessage): NormalizedWhatsAppMessage | null {
  const chatJid = message.key.remoteJid;
  const messageId = message.key.id;

  if (!chatJid || !messageId) {
    return null;
  }

  const content = unwrapMessageContent(asRecord(message.message));
  const isGroup = chatJid.endsWith("@g.us");
  const senderJid = typeof message.key.participant === "string" ? message.key.participant : chatJid;
  const occurredAt = parseMessageTimestamp(message.messageTimestamp);
  const direction = message.key.fromMe ? "OUTBOUND" : "INBOUND";
  const pushName = typeof message.pushName === "string" ? message.pushName : null;

  if (typeof content.conversation === "string") {
    return {
      body: content.conversation,
      chatJid,
      direction,
      isGroup,
      media: null,
      messageId,
      occurredAt,
      pushName,
      senderJid,
      type: "TEXT"
    };
  }

  const extendedTextMessage = asRecord(content.extendedTextMessage);
  if (extendedTextMessage && typeof extendedTextMessage.text === "string") {
    return {
      body: extendedTextMessage.text,
      chatJid,
      direction,
      isGroup,
      media: null,
      messageId,
      occurredAt,
      pushName,
      senderJid,
      type: "TEXT"
    };
  }

  const imageMessage = asRecord(content.imageMessage);
  if (imageMessage) {
    return createMediaMessage({
      body: getString(imageMessage.caption),
      chatJid,
      direction,
      filename: `${messageId}.jpg`,
      isGroup,
      kind: "IMAGE",
      media: imageMessage,
      messageId,
      occurredAt,
      pushName,
      senderJid,
      type: "IMAGE"
    });
  }

  const documentMessage = asRecord(content.documentMessage);
  if (documentMessage) {
    return createMediaMessage({
      body: getString(documentMessage.caption),
      chatJid,
      direction,
      filename: getString(documentMessage.fileName) ?? `${messageId}.document`,
      isGroup,
      kind: "DOCUMENT",
      media: documentMessage,
      messageId,
      occurredAt,
      pushName,
      senderJid,
      type: "DOCUMENT"
    });
  }

  const audioMessage = asRecord(content.audioMessage);
  if (audioMessage) {
    return createMediaMessage({
      body: null,
      chatJid,
      direction,
      filename: `${messageId}.ogg`,
      isGroup,
      kind: "VOICE",
      media: audioMessage,
      messageId,
      occurredAt,
      pushName,
      senderJid,
      type: "VOICE"
    });
  }

  const videoMessage = asRecord(content.videoMessage);
  if (videoMessage) {
    return createMediaMessage({
      body: getString(videoMessage.caption),
      chatJid,
      direction,
      filename: `${messageId}.mp4`,
      isGroup,
      kind: "VIDEO",
      media: videoMessage,
      messageId,
      occurredAt,
      pushName,
      senderJid,
      type: "VIDEO"
    });
  }

  return {
    body: "[Unsupported WhatsApp message type]",
    chatJid,
    direction,
    isGroup,
    media: null,
    messageId,
    occurredAt,
    pushName,
    senderJid,
    type: "SYSTEM"
  };
}

function createMediaMessage(input: {
  body: string | null;
  chatJid: string;
  direction: "INBOUND" | "OUTBOUND";
  filename: string;
  isGroup: boolean;
  kind: "IMAGE" | "DOCUMENT" | "VOICE" | "VIDEO";
  media: Record<string, unknown>;
  messageId: string;
  occurredAt: Date;
  pushName: string | null;
  senderJid: string;
  type: "IMAGE" | "DOCUMENT" | "VOICE" | "VIDEO";
}): NormalizedWhatsAppMessage {
  return {
    body: input.body,
    chatJid: input.chatJid,
    direction: input.direction,
    isGroup: input.isGroup,
    media: {
      filename: input.filename,
      kind: input.kind,
      mimeType: getString(input.media.mimetype) ?? "application/octet-stream",
      size: getNumber(input.media.fileLength)
    },
    messageId: input.messageId,
    occurredAt: input.occurredAt,
    pushName: input.pushName,
    senderJid: input.senderJid,
    type: input.type
  };
}

function unwrapMessageContent(content: Record<string, unknown> | null): Record<string, unknown> {
  let current = content;

  for (let index = 0; index < 4; index += 1) {
    if (!current) {
      return {};
    }

    const ephemeral = asRecord(current.ephemeralMessage);
    if (ephemeral) {
      current = asRecord(ephemeral.message);
      continue;
    }

    const viewOnce = asRecord(current.viewOnceMessage);
    if (viewOnce) {
      current = asRecord(viewOnce.message);
      continue;
    }

    const viewOnceV2 = asRecord(current.viewOnceMessageV2);
    if (viewOnceV2) {
      current = asRecord(viewOnceV2.message);
      continue;
    }

    return current;
  }

  return current ?? {};
}

function parseMessageTimestamp(value: unknown): Date {
  if (typeof value === "number") {
    return new Date(value * 1000);
  }

  if (typeof value === "bigint") {
    return new Date(Number(value) * 1000);
  }

  if (value && typeof value === "object" && "toNumber" in value) {
    const toNumber = value.toNumber;

    if (typeof toNumber === "function") {
      return new Date(Number(toNumber.call(value)) * 1000);
    }
  }

  return new Date();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function getNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (value && typeof value === "object" && "toNumber" in value) {
    const toNumber = value.toNumber;

    if (typeof toNumber === "function") {
      return Number(toNumber.call(value));
    }
  }

  return null;
}
