import type { WAMessage } from "@whiskeysockets/baileys";

import type { NormalizedWhatsAppMessage } from "./types.js";

type NormalizedMessageBase = Pick<
  NormalizedWhatsAppMessage,
  | "chatJid"
  | "direction"
  | "isGroup"
  | "messageId"
  | "occurredAt"
  | "pushName"
  | "quotedMessageId"
  | "senderJid"
>;

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
  const direction: NormalizedWhatsAppMessage["direction"] = message.key.fromMe
    ? "OUTBOUND"
    : "INBOUND";
  const pushName = typeof message.pushName === "string" ? message.pushName : null;
  const baseMessage: NormalizedMessageBase = {
    chatJid,
    direction,
    isGroup,
    messageId,
    occurredAt,
    pushName,
    quotedMessageId: getQuotedMessageId(content),
    senderJid
  };

  if (typeof content.conversation === "string") {
    return {
      body: content.conversation,
      ...baseMessage,
      media: null,
      type: "TEXT"
    };
  }

  const extendedTextMessage = asRecord(content.extendedTextMessage);
  if (extendedTextMessage && typeof extendedTextMessage.text === "string") {
    return {
      body: extendedTextMessage.text,
      ...baseMessage,
      media: null,
      type: "TEXT"
    };
  }

  const imageMessage = asRecord(content.imageMessage);
  if (imageMessage) {
    return createMediaMessage({
      body: getString(imageMessage.caption),
      ...baseMessage,
      filename: `${messageId}.jpg`,
      kind: "IMAGE",
      media: imageMessage,
      type: "IMAGE"
    });
  }

  const documentMessage = asRecord(content.documentMessage);
  if (documentMessage) {
    return createMediaMessage({
      body: getString(documentMessage.caption),
      ...baseMessage,
      filename: getString(documentMessage.fileName) ?? `${messageId}.document`,
      kind: "DOCUMENT",
      media: documentMessage,
      type: "DOCUMENT"
    });
  }

  const audioMessage = asRecord(content.audioMessage);
  if (audioMessage) {
    return createMediaMessage({
      body: null,
      ...baseMessage,
      filename: `${messageId}.ogg`,
      kind: "VOICE",
      media: audioMessage,
      type: "VOICE"
    });
  }

  const videoMessage = asRecord(content.videoMessage) ?? asRecord(content.ptvMessage);
  if (videoMessage) {
    return createMediaMessage({
      body: getString(videoMessage.caption),
      ...baseMessage,
      filename: `${messageId}.mp4`,
      kind: "VIDEO",
      media: videoMessage,
      type: "VIDEO"
    });
  }

  const stickerMessage = asRecord(content.stickerMessage);
  if (stickerMessage) {
    return createMediaMessage({
      body: "Sticker",
      ...baseMessage,
      filename: `${messageId}.webp`,
      kind: "IMAGE",
      media: stickerMessage,
      type: "IMAGE"
    });
  }

  const buttonsResponseMessage = asRecord(content.buttonsResponseMessage);
  const listResponseMessage = asRecord(content.listResponseMessage);
  const singleSelectReply = asRecord(listResponseMessage?.singleSelectReply);
  const templateButtonReplyMessage = asRecord(content.templateButtonReplyMessage);
  const selectedResponse =
    getString(buttonsResponseMessage?.selectedDisplayText) ??
    getString(buttonsResponseMessage?.selectedButtonId) ??
    getString(listResponseMessage?.title) ??
    getString(singleSelectReply?.selectedRowId) ??
    getString(templateButtonReplyMessage?.selectedDisplayText) ??
    getString(templateButtonReplyMessage?.selectedId);

  if (selectedResponse) {
    return createSystemMessage({
      body: selectedResponse,
      ...baseMessage,
      type: "TEXT"
    });
  }

  const reactionMessage = asRecord(content.reactionMessage);
  if (reactionMessage) {
    const reactionText = getString(reactionMessage.text);

    return createSystemMessage({
      body: reactionText ? `Reaction: ${reactionText}` : "Reaction removed",
      ...baseMessage
    });
  }

  if (content.contactMessage || content.contactsArrayMessage) {
    return createSystemMessage({
      body: content.contactsArrayMessage ? "Contacts shared" : "Contact shared",
      ...baseMessage
    });
  }

  if (content.locationMessage || content.liveLocationMessage) {
    return createSystemMessage({
      body: "Location shared",
      ...baseMessage
    });
  }

  if (
    content.pollCreationMessage ||
    content.pollCreationMessageV2 ||
    content.pollCreationMessageV3
  ) {
    return createSystemMessage({
      body: "Poll shared",
      ...baseMessage
    });
  }

  if (content.pollUpdateMessage) {
    return createSystemMessage({
      body: "Poll response",
      ...baseMessage
    });
  }

  if (content.eventMessage) {
    return createSystemMessage({
      body: "Event shared",
      ...baseMessage
    });
  }

  if (
    content.protocolMessage ||
    content.senderKeyDistributionMessage ||
    content.messageHistoryBundle
  ) {
    return null;
  }

  return {
    body: "WhatsApp message",
    ...baseMessage,
    media: null,
    type: "SYSTEM"
  };
}

function createSystemMessage(input: {
  body: string;
  chatJid: string;
  direction: "INBOUND" | "OUTBOUND";
  isGroup: boolean;
  messageId: string;
  occurredAt: Date;
  pushName: string | null;
  quotedMessageId: string | null;
  senderJid: string;
  type?: "SYSTEM" | "TEXT";
}): NormalizedWhatsAppMessage {
  return {
    body: input.body,
    chatJid: input.chatJid,
    direction: input.direction,
    isGroup: input.isGroup,
    media: null,
    messageId: input.messageId,
    occurredAt: input.occurredAt,
    pushName: input.pushName,
    quotedMessageId: input.quotedMessageId,
    senderJid: input.senderJid,
    type: input.type ?? "SYSTEM"
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
  quotedMessageId: string | null;
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
    quotedMessageId: input.quotedMessageId,
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

    const viewOnceV2Extension = asRecord(current.viewOnceMessageV2Extension);
    if (viewOnceV2Extension) {
      current = asRecord(viewOnceV2Extension.message);
      continue;
    }

    const documentWithCaption = asRecord(current.documentWithCaptionMessage);
    if (documentWithCaption) {
      current = asRecord(documentWithCaption.message);
      continue;
    }

    const protocol = asRecord(current.protocolMessage);
    const edited = asRecord(protocol?.editedMessage);
    if (edited) {
      current = edited;
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

function getQuotedMessageId(content: Record<string, unknown>): string | null {
  for (const key of [
    "extendedTextMessage",
    "imageMessage",
    "documentMessage",
    "audioMessage",
    "videoMessage",
    "ptvMessage",
    "buttonsResponseMessage",
    "listResponseMessage",
    "templateButtonReplyMessage"
  ]) {
    const message = asRecord(content[key]);
    const contextInfo = asRecord(message?.contextInfo);
    const stanzaId = getString(contextInfo?.stanzaId);
    if (stanzaId) return stanzaId;
  }

  return getString(asRecord(content.contextInfo)?.stanzaId);
}
