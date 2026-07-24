export function getPreferredWhatsAppChatJid(input: {
  chatJid: string;
  phoneJid: string | null;
}): string {
  if (isGroupJid(input.chatJid)) {
    return input.chatJid;
  }

  if (isLidJid(input.chatJid) && input.phoneJid && isPhoneJid(input.phoneJid)) {
    return input.phoneJid;
  }

  return input.chatJid;
}

export function isDiscoverableChatJid(jid: string): boolean {
  if (jid === "status@broadcast") {
    return false;
  }

  if (jid.endsWith("@broadcast") || jid.includes("@newsletter")) {
    return false;
  }

  return Boolean(jid.trim());
}

export function isDirectContactJid(jid: string): boolean {
  return isPhoneJid(jid) || isLidJid(jid);
}

export function isGroupJid(jid: string): boolean {
  return jid.endsWith("@g.us");
}

export function isLidJid(jid: string): boolean {
  return jid.endsWith("@lid") || jid.endsWith("@hosted.lid");
}

export function isPhoneJid(jid: string): boolean {
  return jid.endsWith("@s.whatsapp.net");
}

export function getPhoneNumberFromWhatsAppJid(jid: string | null | undefined): string | null {
  if (!jid || !isPhoneJid(jid)) return null;
  const phoneNumber = jid.split("@")[0]?.split(":")[0]?.replace(/\D/g, "");
  return phoneNumber || null;
}
