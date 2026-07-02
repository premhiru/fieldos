import type { WAMessage } from "@whiskeysockets/baileys";
import { describe, expect, it } from "vitest";

import { normalizeWhatsAppMessage } from "./normalizer.js";

describe("normalizeWhatsAppMessage", () => {
  it("normalizes text messages", () => {
    const normalized = normalizeWhatsAppMessage({
      key: {
        fromMe: false,
        id: "message_1",
        remoteJid: "15551234567@s.whatsapp.net"
      },
      message: {
        conversation: "Arrived at loading dock."
      },
      messageTimestamp: 1782864000,
      pushName: "Crew Lead"
    } as WAMessage);

    expect(normalized).toMatchObject({
      body: "Arrived at loading dock.",
      chatJid: "15551234567@s.whatsapp.net",
      direction: "INBOUND",
      senderJid: "15551234567@s.whatsapp.net",
      type: "TEXT"
    });
  });

  it("normalizes image messages with attachment metadata", () => {
    const normalized = normalizeWhatsAppMessage({
      key: {
        fromMe: false,
        id: "message_2",
        participant: "15550001111@s.whatsapp.net",
        remoteJid: "120363025@g.us"
      },
      message: {
        imageMessage: {
          caption: "Site photo",
          fileLength: 2048,
          mimetype: "image/jpeg"
        }
      },
      messageTimestamp: 1782864000,
      pushName: "Supervisor"
    } as WAMessage);

    expect(normalized).toMatchObject({
      body: "Site photo",
      isGroup: true,
      media: {
        filename: "message_2.jpg",
        mimeType: "image/jpeg",
        size: 2048
      },
      senderJid: "15550001111@s.whatsapp.net",
      type: "IMAGE"
    });
  });

  it("normalizes stickers as image attachments", () => {
    const normalized = normalizeWhatsAppMessage({
      key: {
        fromMe: false,
        id: "message_3",
        remoteJid: "15551234567@s.whatsapp.net"
      },
      message: {
        stickerMessage: {
          fileLength: 1024,
          mimetype: "image/webp"
        }
      },
      messageTimestamp: 1782864000
    } as WAMessage);

    expect(normalized).toMatchObject({
      body: "Sticker",
      media: {
        filename: "message_3.webp",
        mimeType: "image/webp",
        size: 1024
      },
      type: "IMAGE"
    });
  });

  it("normalizes common WhatsApp events without unsupported placeholders", () => {
    const normalized = normalizeWhatsAppMessage({
      key: {
        fromMe: false,
        id: "message_4",
        remoteJid: "15551234567@s.whatsapp.net"
      },
      message: {
        locationMessage: {
          degreesLatitude: 1.3521,
          degreesLongitude: 103.8198
        }
      },
      messageTimestamp: 1782864000
    } as WAMessage);

    expect(normalized).toMatchObject({
      body: "Location shared",
      type: "SYSTEM"
    });
  });

  it("skips WhatsApp protocol sync messages", () => {
    const normalized = normalizeWhatsAppMessage({
      key: {
        fromMe: false,
        id: "message_5",
        remoteJid: "15551234567@s.whatsapp.net"
      },
      message: {
        protocolMessage: {}
      },
      messageTimestamp: 1782864000
    } as WAMessage);

    expect(normalized).toBeNull();
  });
});
