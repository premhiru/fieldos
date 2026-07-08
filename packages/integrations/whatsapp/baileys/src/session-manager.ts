import {
  Browsers,
  makeWASocket,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type BaileysEventMap,
  type WAMessage,
  type WASocket
} from "@whiskeysockets/baileys";
import {
  queueAIClassificationJob,
  queuePhotoAnalysisJob,
  queueSearchIndexJob,
  queueVoiceTranscriptionJob,
  type Attachment,
  type PrismaClient
} from "@fieldos/db";
import { buildEvidenceObjectKey, createLogger } from "@fieldos/shared";
import { randomUUID } from "node:crypto";
import pino from "pino";

import { decideWhatsAppIngestion } from "./ingestion-policy.js";
import {
  getPreferredWhatsAppChatJid,
  isDirectContactJid,
  isDiscoverableChatJid,
  isGroupJid,
  isLidJid
} from "./jid.js";
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

function buildFallbackEvidenceKey(input: {
  evidenceId: string;
  filename: string;
  messageId: string;
  organizationId: string;
  projectId: string | null;
}): string {
  return buildEvidenceObjectKey({
    evidenceId: input.evidenceId,
    filename: `${input.messageId}-${input.filename}`,
    organizationId: input.organizationId,
    projectId: input.projectId
  });
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
    this.storage = new BaileysFilesystemStorage(
      options.rootStoragePath,
      options.mediaStorageProvider
    );
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
    sessionKey: string;
  }): Promise<void> {
    this.logger.info({ accountId: account.id }, "starting WhatsApp session");

    await this.prisma.whatsAppAccount.update({
      data: {
        status: "CONNECTING"
      },
      where: {
        id: account.id
      }
    });

    const sessionPath = this.storage.getSessionPath(account.sessionKey);
    const { saveCreds, state } = await useMultiFileAuthState(sessionPath);
    const versionResult = await fetchLatestBaileysVersion();
    const isPairingSession = !state.creds.registered;

    this.logger.info(
      {
        accountId: account.id,
        isPairingSession,
        waVersion: versionResult.version.join(".")
      },
      "creating WhatsApp socket"
    );

    const socket = makeWASocket({
      auth: state,
      browser: isPairingSession ? Browsers.ubuntu("Chrome") : Browsers.macOS("Desktop"),
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 30_000,
      logger: baileysLogger,
      markOnlineOnConnect: false,
      printQRInTerminal: false,
      syncFullHistory: !isPairingSession,
      version: versionResult.version
    });

    this.sessions.set(account.id, {
      accountId: account.id,
      socket
    });

    let hasOpened = false;
    let hasQr = false;

    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("chats.upsert", async (chats: BaileysEventMap["chats.upsert"]) => {
      for (const chat of chats) {
        try {
          await this.discoverChatMetadata(account, {
            chatJid: typeof chat.id === "string" ? chat.id : null,
            title: getChatMetadataTitle(chat)
          });
        } catch (error: unknown) {
          this.logger.error({ accountId: account.id, error }, "WhatsApp chat discovery failed");
        }
      }
    });
    socket.ev.on("chats.update", async (chats: BaileysEventMap["chats.update"]) => {
      for (const chat of chats) {
        try {
          await this.discoverChatMetadata(account, {
            chatJid: typeof chat.id === "string" ? chat.id : null,
            title: getChatMetadataTitle(chat)
          });
        } catch (error: unknown) {
          this.logger.error({ accountId: account.id, error }, "WhatsApp chat update failed");
        }
      }
    });
    socket.ev.on(
      "messaging-history.set",
      async (history: BaileysEventMap["messaging-history.set"]) => {
        const contactTitles = new Map(
          history.contacts.map((contact) => [
            contact.id,
            getFirstString(contact.name, contact.notify, contact.verifiedName)
          ])
        );

        this.logger.info(
          {
            accountId: account.id,
            chatCount: history.chats.length,
            contactCount: history.contacts.length,
            isLatest: history.isLatest,
            messageCount: history.messages.length,
            progress: history.progress,
            syncType: history.syncType
          },
          "WhatsApp history sync received"
        );

        for (const contact of history.contacts) {
          try {
            const chatJid = typeof contact.id === "string" ? contact.id : null;

            if (!chatJid || !isDirectContactJid(chatJid)) {
              continue;
            }

            await this.discoverChatMetadata(account, {
              chatJid,
              title: getFirstString(contact.name, contact.notify, contact.verifiedName)
            });
          } catch (error: unknown) {
            this.logger.error(
              { accountId: account.id, error },
              "WhatsApp history contact discovery failed"
            );
          }
        }

        for (const chat of history.chats) {
          try {
            const chatJid = typeof chat.id === "string" ? chat.id : null;
            await this.discoverChatMetadata(account, {
              chatJid,
              title:
                getChatMetadataTitle(chat) ?? (chatJid ? contactTitles.get(chatJid) : null) ?? null
            });
          } catch (error: unknown) {
            this.logger.error(
              { accountId: account.id, error },
              "WhatsApp history chat discovery failed"
            );
          }
        }

        for (const message of history.messages) {
          try {
            const chatJid = message.key.remoteJid;
            await this.discoverChatMetadata(account, {
              chatJid: typeof chatJid === "string" ? chatJid : null,
              title:
                typeof chatJid === "string"
                  ? (contactTitles.get(chatJid) ?? getString(message.pushName) ?? null)
                  : null
            });
          } catch (error: unknown) {
            this.logger.error(
              { accountId: account.id, error },
              "WhatsApp history message discovery failed"
            );
          }
        }
      }
    );
    socket.ev.on("connection.update", async (update: BaileysEventMap["connection.update"]) => {
      try {
        if (update.qr) {
          hasQr = true;
          this.logger.info({ accountId: account.id }, "WhatsApp QR generated");
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
          hasOpened = true;
          this.logger.info({ accountId: account.id }, "WhatsApp session connected");
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
          const recoverableDisconnect = isRecoverableDisconnect(statusCode);
          const stalePrePairingSession =
            recoverableDisconnect &&
            statusCode === DisconnectReason.connectionClosed &&
            !hasOpened &&
            !hasQr;
          const nextStatus = loggedOut
            ? "DISCONNECTED"
            : recoverableDisconnect
              ? "CONNECTING"
              : "ERROR";

          this.logger.warn(
            { accountId: account.id, loggedOut, recoverableDisconnect, statusCode },
            "WhatsApp session disconnected"
          );
          await this.qrStore.remove(account.id);
          const updatedAccount = await this.prisma.whatsAppAccount.update({
            data: {
              lastDisconnectedAt: new Date(),
              sessionKey: stalePrePairingSession
                ? `baileys/${account.organizationId}/${randomUUID()}`
                : undefined,
              status: stalePrePairingSession ? "PENDING_QR" : nextStatus
            },
            select: {
              displayName: true,
              id: true,
              organizationId: true,
              sessionKey: true
            },
            where: {
              id: account.id
            }
          });
          this.sessions.delete(account.id);

          if (stalePrePairingSession) {
            this.logger.info(
              { accountId: account.id, statusCode },
              "rotated stale WhatsApp pairing session"
            );
          }

          if (recoverableDisconnect) {
            setTimeout(() => {
              if (this.sessions.has(account.id)) {
                return;
              }

              this.startSession(stalePrePairingSession ? updatedAccount : account).catch(
                (error: unknown) => {
                  this.logger.error(
                    { accountId: account.id, error },
                    "WhatsApp session restart failed"
                  );
                }
              );
            }, 1_000);
          }
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
    const chatJid = rawMessage.key.remoteJid;

    if (!chatJid) {
      return;
    }

    if (!isDiscoverableChatJid(chatJid)) {
      return;
    }

    const accountState = await this.prisma.whatsAppAccount.findUnique({
      select: {
        status: true
      },
      where: {
        id: account.id
      }
    });

    if (!accountState) {
      return;
    }

    const isGroup = isGroupJid(chatJid);
    const pushName = typeof rawMessage.pushName === "string" ? rawMessage.pushName : null;
    const identity = await this.resolveChatIdentity(socket, {
      chatJid,
      isGroup
    });
    const title = await this.getChatTitle(socket, {
      chatJid,
      isGroup,
      pushName
    });
    const mapping = await this.discoverChatMapping(account, {
      chatJid: identity.chatJid,
      isGroup,
      title
    });
    const activeMapping = await this.promoteCanonicalMappingFromAlias(account, {
      aliasChatJid: identity.aliasChatJid,
      canonicalChatJid: identity.chatJid,
      mapping
    });
    const decision = decideWhatsAppIngestion({
      account: accountState,
      mapping: activeMapping
    });

    if (!decision.allowed) {
      this.logger.info(
        {
          accountId: account.id,
          canonicalChatJid: identity.chatJid,
          chatJid,
          reasonSkipped: decision.reasonSkipped,
          timestamp: new Date().toISOString()
        },
        "WhatsApp message skipped before content ingestion"
      );
      return;
    }

    const normalized = normalizeWhatsAppMessage(rawMessage);

    if (!normalized) {
      return;
    }

    const existingMapping = await this.prisma.whatsAppChatMapping.findUnique({
      include: {
        conversation: true
      },
      where: {
        whatsappAccountId_jid: {
          jid: identity.chatJid,
          whatsappAccountId: account.id
        }
      }
    });
    const conversation =
      existingMapping?.conversation ??
      (await this.prisma.conversation.upsert({
        create: {
          channel: "WHATSAPP",
          externalId: identity.chatJid,
          isGroup: normalized.isGroup,
          lastMessageAt: normalized.occurredAt,
          organizationId: account.organizationId,
          projectId: activeMapping.projectId,
          title
        },
        update: {
          isGroup: normalized.isGroup,
          lastMessageAt: normalized.occurredAt,
          projectId: activeMapping.projectId,
          title
        },
        where: {
          organizationId_channel_externalId: {
            channel: "WHATSAPP",
            externalId: identity.chatJid,
            organizationId: account.organizationId
          }
        }
      }));

    if (!existingMapping?.conversationId) {
      await this.prisma.whatsAppChatMapping.update({
        data: {
          chatName: title,
          conversationId: conversation.id,
          isGroup: normalized.isGroup,
          projectId: activeMapping.projectId
        },
        where: {
          whatsappAccountId_jid: {
            jid: identity.chatJid,
            whatsappAccountId: account.id
          }
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

    let message: { id: string };

    try {
      message = await this.prisma.message.create({
        data: {
          body: normalized.body,
          conversationId: conversation.id,
          direction: normalized.direction,
          externalMessageId: normalized.messageId,
          occurredAt: normalized.occurredAt,
          processingStatus: "SEARCH_PENDING",
          senderParticipantId: participant.id,
          type: normalized.type
        }
      });
    } catch (error: unknown) {
      if (isUniqueConstraintViolation(error)) {
        this.logger.info(
          {
            accountId: account.id,
            messageId: normalized.messageId,
            organizationId: account.organizationId
          },
          "duplicate WhatsApp message ignored"
        );
        return;
      }

      throw error;
    }

    const attachment = normalized.media
      ? await this.createAttachment(
          account,
          socket,
          rawMessage,
          normalized,
          message.id,
          conversation.id,
          activeMapping.projectId
        )
      : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.conversation.update({
        data: {
          lastMessageAt: normalized.occurredAt
        },
        where: {
          id: conversation.id
        }
      });
      await tx.whatsAppAccount.update({
        data: {
          lastMessageAt: normalized.occurredAt
        },
        where: {
          id: account.id
        }
      });
      await queueSearchIndexJob(tx, {
        organizationId: account.organizationId,
        projectId: activeMapping.projectId,
        sourceId: message.id,
        sourceType: "MESSAGE"
      });
    });

    if (attachment?.transcriptionStatus === "PENDING") {
      await this.enqueueVoiceTranscription({
        attachmentId: attachment.id,
        messageId: message.id,
        organizationId: account.organizationId,
        projectId: activeMapping.projectId
      });
    } else {
      if (attachment?.mimeType.toLowerCase().startsWith("image/")) {
        await this.enqueuePhotoAnalysis({
          attachmentId: attachment.id,
          messageId: message.id,
          organizationId: account.organizationId,
          projectId: activeMapping.projectId
        });
      }

      await this.enqueueClassification({
        messageId: message.id,
        organizationId: account.organizationId,
        projectId: activeMapping.projectId
      });
    }
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
    conversationId: string,
    projectId: string | null
  ): Promise<Attachment | null> {
    if (!normalized.media) {
      return null;
    }

    const evidenceId = randomUUID();
    let storageKey = buildFallbackEvidenceKey({
      evidenceId,
      filename: normalized.media.filename,
      messageId,
      organizationId: account.organizationId,
      projectId
    });
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
        evidenceId,
        filename: normalized.media.filename,
        messageId,
        mimeType: normalized.media.mimeType,
        organizationId: account.organizationId,
        projectId
      });
      storageKey = stored.storageKey;
      size = stored.size;
    } catch (error: unknown) {
      this.logger.warn(
        { accountId: account.id, error, messageId },
        "WhatsApp media download failed; storing attachment placeholder"
      );
    }

    return this.prisma.attachment.create({
      data: {
        id: evidenceId,
        conversationId,
        filename: normalized.media.filename,
        messageId,
        mimeType: normalized.media.mimeType,
        size,
        storageKey,
        transcriptionStatus: normalized.type === "VOICE" ? "PENDING" : "NOT_REQUIRED"
      }
    });
  }

  private async enqueueVoiceTranscription(input: {
    attachmentId: string;
    messageId: string;
    organizationId: string;
    projectId: string | null;
  }): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.message.update({
          data: {
            processingStatus: "TRANSCRIPTION_PENDING"
          },
          where: {
            id: input.messageId
          }
        });

        await queueVoiceTranscriptionJob(tx, {
          organizationId: input.organizationId,
          projectId: input.projectId,
          sourceId: input.attachmentId
        });
      });
    } catch (error: unknown) {
      this.logger.error(
        {
          attachmentId: input.attachmentId,
          error,
          messageId: input.messageId,
          organizationId: input.organizationId,
          projectId: input.projectId
        },
        "voice transcription enqueue failed"
      );

      await this.enqueueClassification({
        messageId: input.messageId,
        organizationId: input.organizationId,
        projectId: input.projectId
      });
    }
  }

  private async enqueuePhotoAnalysis(input: {
    attachmentId: string;
    messageId: string;
    organizationId: string;
    projectId: string | null;
  }): Promise<void> {
    try {
      await queuePhotoAnalysisJob(this.prisma, {
        organizationId: input.organizationId,
        projectId: input.projectId,
        sourceId: input.attachmentId
      });
    } catch (error: unknown) {
      this.logger.error(
        {
          attachmentId: input.attachmentId,
          error,
          messageId: input.messageId,
          organizationId: input.organizationId,
          projectId: input.projectId
        },
        "photo analysis enqueue failed"
      );
    }
  }

  private async discoverChatMapping(
    account: {
      id: string;
      organizationId: string;
    },
    input: {
      chatJid: string;
      isGroup: boolean;
      title: string;
    }
  ) {
    return this.prisma.whatsAppChatMapping.upsert({
      create: {
        chatName: input.title,
        isGroup: input.isGroup,
        jid: input.chatJid,
        organizationId: account.organizationId,
        status: "DISCOVERED",
        whatsappAccountId: account.id
      },
      update: {
        chatName: input.title,
        isGroup: input.isGroup
      },
      where: {
        whatsappAccountId_jid: {
          jid: input.chatJid,
          whatsappAccountId: account.id
        }
      }
    });
  }

  private async enqueueClassification(input: {
    messageId: string;
    organizationId: string;
    projectId: string | null;
  }): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const classification = await tx.aIMessageClassification.upsert({
          create: {
            messageId: input.messageId,
            organizationId: input.organizationId,
            projectId: input.projectId,
            status: "PENDING"
          },
          update: {
            errorMessage: null,
            projectId: input.projectId,
            status: "PENDING"
          },
          where: {
            messageId: input.messageId
          }
        });

        await tx.message.update({
          data: {
            processingStatus: "AI_PENDING"
          },
          where: {
            id: input.messageId
          }
        });

        await queueAIClassificationJob(tx, {
          organizationId: input.organizationId,
          projectId: input.projectId,
          sourceId: classification.id
        });
      });
    } catch (error: unknown) {
      this.logger.error(
        {
          error,
          messageId: input.messageId,
          organizationId: input.organizationId,
          projectId: input.projectId
        },
        "AI classification enqueue failed"
      );
    }
  }

  private async promoteCanonicalMappingFromAlias(
    account: {
      id: string;
      organizationId: string;
    },
    input: {
      aliasChatJid: string | null;
      canonicalChatJid: string;
      mapping: Awaited<ReturnType<BaileysWhatsAppSessionManager["discoverChatMapping"]>>;
    }
  ) {
    if (!input.aliasChatJid || input.aliasChatJid === input.canonicalChatJid) {
      return input.mapping;
    }

    if (input.mapping.status !== "DISCOVERED") {
      return input.mapping;
    }

    const aliasMapping = await this.prisma.whatsAppChatMapping.findUnique({
      where: {
        whatsappAccountId_jid: {
          jid: input.aliasChatJid,
          whatsappAccountId: account.id
        }
      }
    });

    if (aliasMapping?.status !== "ACTIVE") {
      return input.mapping;
    }

    const promotedMapping = await this.prisma.whatsAppChatMapping.update({
      data: {
        activatedAt: aliasMapping.activatedAt ?? new Date(),
        activatedByUserId: aliasMapping.activatedByUserId,
        projectId: aliasMapping.projectId,
        status: "ACTIVE"
      },
      where: {
        whatsappAccountId_jid: {
          jid: input.canonicalChatJid,
          whatsappAccountId: account.id
        }
      }
    });

    this.logger.info(
      {
        accountId: account.id,
        aliasChatJid: input.aliasChatJid,
        canonicalChatJid: input.canonicalChatJid,
        organizationId: account.organizationId
      },
      "promoted WhatsApp direct chat activation from alias"
    );

    return promotedMapping;
  }

  private async discoverChatMetadata(
    account: {
      id: string;
      organizationId: string;
    },
    input: {
      chatJid: string | null;
      title: string | null;
    }
  ): Promise<void> {
    if (!input.chatJid) {
      return;
    }

    if (!isDiscoverableChatJid(input.chatJid)) {
      return;
    }

    await this.discoverChatMapping(account, {
      chatJid: input.chatJid,
      isGroup: isGroupJid(input.chatJid),
      title: input.title ?? normalizePhoneNumber(input.chatJid) ?? input.chatJid
    });
  }

  private async resolveChatIdentity(
    socket: WASocket,
    input: {
      chatJid: string;
      isGroup: boolean;
    }
  ): Promise<{
    aliasChatJid: string | null;
    chatJid: string;
  }> {
    if (input.isGroup || !isLidJid(input.chatJid)) {
      return {
        aliasChatJid: null,
        chatJid: input.chatJid
      };
    }

    try {
      const phoneJid = await socket.signalRepository.lidMapping.getPNForLID(input.chatJid);
      const chatJid = getPreferredWhatsAppChatJid({
        chatJid: input.chatJid,
        phoneJid
      });

      return {
        aliasChatJid: chatJid === input.chatJid ? null : input.chatJid,
        chatJid
      };
    } catch (error: unknown) {
      this.logger.warn(
        {
          chatJid: input.chatJid,
          error
        },
        "WhatsApp LID mapping lookup failed"
      );

      return {
        aliasChatJid: null,
        chatJid: input.chatJid
      };
    }
  }

  private async getChatTitle(
    socket: WASocket,
    input: {
      chatJid: string;
      isGroup: boolean;
      pushName: string | null;
    }
  ): Promise<string> {
    if (input.isGroup) {
      try {
        const metadata = await socket.groupMetadata(input.chatJid);
        return metadata.subject || input.chatJid;
      } catch {
        return input.chatJid;
      }
    }

    return input.pushName ?? normalizePhoneNumber(input.chatJid) ?? input.chatJid;
  }
}

function normalizePhoneNumber(jid: string): string | null {
  const value = jid.split("@")[0]?.split(":")[0];
  return value || null;
}

function isRecoverableDisconnect(statusCode: number | undefined): boolean {
  return (
    statusCode === undefined ||
    statusCode === DisconnectReason.restartRequired ||
    statusCode === DisconnectReason.connectionClosed ||
    statusCode === DisconnectReason.connectionLost ||
    statusCode === DisconnectReason.timedOut ||
    statusCode === DisconnectReason.unavailableService ||
    statusCode === 515
  );
}

function getChatMetadataTitle(chat: unknown): string | null {
  if (!chat || typeof chat !== "object") {
    return null;
  }

  const record = chat as Record<string, unknown>;

  for (const field of ["name", "subject", "pushName"] as const) {
    const value = record[field];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function getFirstString(...values: unknown[]): string | null {
  for (const value of values) {
    const text = getString(value);

    if (text) {
      return text;
    }
  }

  return null;
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

function isUniqueConstraintViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  return "code" in error && error.code === "P2002";
}
