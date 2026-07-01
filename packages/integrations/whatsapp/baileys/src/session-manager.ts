import {
  makeWASocket,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type BaileysEventMap,
  type WAMessage,
  type WASocket
} from "@whiskeysockets/baileys";
import type { PrismaClient } from "@fieldos/db";
import { createLogger } from "@fieldos/shared";
import pino from "pino";

import { normalizeWhatsAppMessage } from "./normalizer.js";
import type { WhatsAppQrStore } from "./qr-store.js";
import { BaileysFilesystemStorage } from "./storage.js";
import type { BaileysSessionManagerOptions, NormalizedWhatsAppMessage } from "./types.js";

const activeStatuses = ["PENDING_QR", "CONNECTING", "CONNECTED"] as const;
const baileysLogger = pino({ level: "silent" });

interface ManagedSession {
  accountId: string;
  socket: WASocket;
}

export class BaileysWhatsAppSessionManager {
  private readonly logger = createLogger("baileys-whatsapp");
  private readonly sessions = new Map<string, ManagedSession>();
  private readonly storage: BaileysFilesystemStorage;
  private pollTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly qrStore: WhatsAppQrStore,
    options: BaileysSessionManagerOptions = {}
  ) {
    this.storage = new BaileysFilesystemStorage(options.rootStoragePath);
    this.pollIntervalMs = options.pollIntervalMs ?? 10_000;
  }

  private readonly pollIntervalMs: number;

  async start(): Promise<void> {
    await this.reconcileSessions();
    this.pollTimer = setInterval(() => {
      this.reconcileSessions().catch((error: unknown) => {
        this.logger.error({ error }, "WhatsApp session reconciliation failed");
      });
    }, this.pollIntervalMs);
  }

  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    for (const session of this.sessions.values()) {
      session.socket.end(new Error("FieldOS worker shutdown"));
    }

    this.sessions.clear();
  }

  private async reconcileSessions(): Promise<void> {
    const accounts = await this.prisma.whatsAppAccount.findMany({
      where: {
        connectorType: "BAILEYS",
        status: {
          in: [...activeStatuses]
        }
      }
    });
    const activeAccountIds = new Set(accounts.map((account) => account.id));

    for (const session of this.sessions.values()) {
      if (!activeAccountIds.has(session.accountId)) {
        session.socket.end(new Error("WhatsApp account no longer active"));
        this.sessions.delete(session.accountId);
      }
    }

    for (const account of accounts) {
      if (!this.sessions.has(account.id)) {
        await this.startSession(account);
      }
    }
  }

  private async startSession(account: {
    id: string;
    organizationId: string;
    displayName: string;
  }): Promise<void> {
    await this.prisma.whatsAppAccount.update({
      data: {
        status: "CONNECTING"
      },
      where: {
        id: account.id
      }
    });

    const sessionPath = this.storage.getSessionPath(account.organizationId, account.id);
    const { saveCreds, state } = await useMultiFileAuthState(sessionPath);
    const versionResult = await fetchLatestBaileysVersion();
    const socket = makeWASocket({
      auth: state,
      logger: baileysLogger,
      printQRInTerminal: false,
      version: versionResult.version
    });

    this.sessions.set(account.id, {
      accountId: account.id,
      socket
    });

    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", async (update: BaileysEventMap["connection.update"]) => {
      try {
        if (update.qr) {
          await this.qrStore.set(account.id, update.qr);
          await this.prisma.whatsAppAccount.update({
            data: {
              status: "PENDING_QR"
            },
            where: {
              id: account.id
            }
          });
        }

        if (update.connection === "open") {
          await this.qrStore.remove(account.id);
          await this.prisma.whatsAppAccount.update({
            data: {
              displayName: socket.user?.name ?? account.displayName,
              lastConnectedAt: new Date(),
              phoneNumber: socket.user?.id ? normalizePhoneNumber(socket.user.id) : undefined,
              status: "CONNECTED"
            },
            where: {
              id: account.id
            }
          });
        }

        if (update.connection === "close") {
          const statusCode = getDisconnectStatusCode(update.lastDisconnect?.error);
          const loggedOut = statusCode === DisconnectReason.loggedOut;

          await this.qrStore.remove(account.id);
          await this.prisma.whatsAppAccount.update({
            data: {
              lastDisconnectedAt: new Date(),
              status: loggedOut ? "DISCONNECTED" : "ERROR"
            },
            where: {
              id: account.id
            }
          });
          this.sessions.delete(account.id);
        }
      } catch (error: unknown) {
        this.logger.error({ accountId: account.id, error }, "WhatsApp connection update failed");
      }
    });

    socket.ev.on("messages.upsert", async (event: BaileysEventMap["messages.upsert"]) => {
      if (event.type !== "notify") {
        return;
      }

      for (const message of event.messages) {
        try {
          await this.ingestMessage(account, socket, message);
        } catch (error: unknown) {
          this.logger.error({ accountId: account.id, error }, "WhatsApp message intake failed");
        }
      }
    });
  }

  private async ingestMessage(
    account: {
      id: string;
      organizationId: string;
    },
    socket: WASocket,
    rawMessage: WAMessage
  ): Promise<void> {
    const normalized = normalizeWhatsAppMessage(rawMessage);

    if (!normalized) {
      return;
    }

    const title = await this.getConversationTitle(socket, normalized);
    const existingMapping = await this.prisma.whatsAppChatMapping.findUnique({
      include: {
        conversation: true
      },
      where: {
        whatsappAccountId_jid: {
          jid: normalized.chatJid,
          whatsappAccountId: account.id
        }
      }
    });
    const conversation =
      existingMapping?.conversation ??
      (await this.prisma.conversation.upsert({
        create: {
          channel: "WHATSAPP",
          externalId: normalized.chatJid,
          isGroup: normalized.isGroup,
          lastMessageAt: normalized.occurredAt,
          organizationId: account.organizationId,
          projectId: existingMapping?.projectId ?? null,
          title
        },
        update: {
          isGroup: normalized.isGroup,
          lastMessageAt: normalized.occurredAt,
          projectId: existingMapping?.projectId ?? undefined,
          title
        },
        where: {
          organizationId_channel_externalId: {
            channel: "WHATSAPP",
            externalId: normalized.chatJid,
            organizationId: account.organizationId
          }
        }
      }));

    if (!existingMapping) {
      await this.prisma.whatsAppChatMapping.create({
        data: {
          chatName: title,
          conversationId: conversation.id,
          isGroup: normalized.isGroup,
          jid: normalized.chatJid,
          organizationId: account.organizationId,
          whatsappAccountId: account.id
        }
      });
    }

    const participant = await this.prisma.participant.upsert({
      create: {
        conversationId: conversation.id,
        displayName: normalized.pushName ?? normalized.senderJid,
        externalIdentifier: normalized.senderJid,
        role: normalized.direction === "OUTBOUND" ? "fieldos" : "contact"
      },
      update: {
        displayName: normalized.pushName ?? normalized.senderJid
      },
      where: {
        conversationId_externalIdentifier: {
          conversationId: conversation.id,
          externalIdentifier: normalized.senderJid
        }
      }
    });

    const existingMessage = await this.prisma.message.findUnique({
      where: {
        conversationId_externalMessageId: {
          conversationId: conversation.id,
          externalMessageId: normalized.messageId
        }
      }
    });

    if (existingMessage) {
      return;
    }

    const message = await this.prisma.message.create({
      data: {
        body: normalized.body,
        conversationId: conversation.id,
        direction: normalized.direction,
        externalMessageId: normalized.messageId,
        occurredAt: normalized.occurredAt,
        senderParticipantId: participant.id,
        type: normalized.type
      }
    });

    if (normalized.media) {
      await this.createAttachment(
        account,
        socket,
        rawMessage,
        normalized,
        message.id,
        conversation.id
      );
    }

    await this.prisma.$transaction([
      this.prisma.conversation.update({
        data: {
          lastMessageAt: normalized.occurredAt
        },
        where: {
          id: conversation.id
        }
      }),
      this.prisma.whatsAppAccount.update({
        data: {
          lastMessageAt: normalized.occurredAt
        },
        where: {
          id: account.id
        }
      })
    ]);
  }

  private async createAttachment(
    account: {
      id: string;
      organizationId: string;
    },
    socket: WASocket,
    rawMessage: WAMessage,
    normalized: NormalizedWhatsAppMessage,
    messageId: string,
    conversationId: string
  ): Promise<void> {
    if (!normalized.media) {
      return;
    }

    let storageKey = `whatsapp-media/${account.organizationId}/${account.id}/${messageId}-${normalized.media.filename}`;
    let size = normalized.media.size ?? 0;

    try {
      const buffer = (await downloadMediaMessage(
        rawMessage,
        "buffer",
        {},
        {
          logger: baileysLogger,
          reuploadRequest: socket.updateMediaMessage
        }
      )) as Buffer;
      const stored = await this.storage.writeMedia({
        accountId: account.id,
        buffer,
        filename: normalized.media.filename,
        messageId,
        organizationId: account.organizationId
      });
      storageKey = stored.storageKey;
      size = stored.size;
    } catch (error: unknown) {
      this.logger.warn(
        { accountId: account.id, error, messageId },
        "WhatsApp media download failed; storing attachment placeholder"
      );
    }

    await this.prisma.attachment.create({
      data: {
        conversationId,
        filename: normalized.media.filename,
        messageId,
        mimeType: normalized.media.mimeType,
        size,
        storageKey
      }
    });
  }

  private async getConversationTitle(
    socket: WASocket,
    message: NormalizedWhatsAppMessage
  ): Promise<string> {
    if (message.isGroup) {
      try {
        const metadata = await socket.groupMetadata(message.chatJid);
        return metadata.subject || message.chatJid;
      } catch {
        return message.chatJid;
      }
    }

    return message.pushName ?? normalizePhoneNumber(message.chatJid) ?? message.chatJid;
  }
}

function normalizePhoneNumber(jid: string): string | null {
  const value = jid.split("@")[0]?.split(":")[0];
  return value || null;
}

function getDisconnectStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const output = "output" in error ? error.output : undefined;

  if (!output || typeof output !== "object") {
    return undefined;
  }

  const statusCode = "statusCode" in output ? output.statusCode : undefined;
  return typeof statusCode === "number" ? statusCode : undefined;
}
