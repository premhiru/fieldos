import { describe, expect, it } from "vitest";

import {
  getPreferredWhatsAppChatJid,
  isDirectContactJid,
  isDiscoverableChatJid,
  isGroupJid
} from "./jid.js";

describe("WhatsApp JID helpers", () => {
  it("keeps group JIDs stable", () => {
    expect(isGroupJid("120363025@g.us")).toBe(true);
    expect(
      getPreferredWhatsAppChatJid({
        chatJid: "120363025@g.us",
        phoneJid: "15551234567@s.whatsapp.net"
      })
    ).toBe("120363025@g.us");
  });

  it("prefers phone JIDs for direct LID chats when Baileys has the mapping", () => {
    expect(
      getPreferredWhatsAppChatJid({
        chatJid: "49233545699503@lid",
        phoneJid: "6590882954@s.whatsapp.net"
      })
    ).toBe("6590882954@s.whatsapp.net");
  });

  it("recognizes direct contact JIDs without treating broadcasts as discoverable", () => {
    expect(isDirectContactJid("6590882954@s.whatsapp.net")).toBe(true);
    expect(isDirectContactJid("49233545699503@lid")).toBe(true);
    expect(isDiscoverableChatJid("status@broadcast")).toBe(false);
    expect(isDiscoverableChatJid("newsletter@newsletter")).toBe(false);
  });
});
