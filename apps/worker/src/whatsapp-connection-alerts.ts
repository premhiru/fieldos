import type { PrismaClient, WhatsAppAccountStatus } from "@fieldos/db";
import type { Logger, TransactionalEmailSender } from "@fieldos/shared";

export type WhatsAppConnectionAlertType = "DISCONNECT" | "RECOVERY";

export interface WhatsAppConnectionAlertContext {
  accountId: string;
  accountName: string;
  adminEmails: string[];
  disconnectAlertSentAt: Date | null;
  disconnectedAt: Date | null;
  lastDisconnectReason: string | null;
  organizationId: string;
  organizationName: string;
  phoneNumber: string | null;
  recoveryAlertSentAt: Date | null;
  status: WhatsAppAccountStatus;
}

export interface WhatsAppConnectionAlertStore {
  findContext(accountId: string): Promise<WhatsAppConnectionAlertContext | null>;
  markDisconnectAlertSent(accountId: string, disconnectedAt: Date, sentAt: Date): Promise<void>;
  markRecoveryAlertSent(accountId: string, disconnectedAt: Date, sentAt: Date): Promise<void>;
}

export function createPrismaWhatsAppConnectionAlertStore(
  prisma: PrismaClient
): WhatsAppConnectionAlertStore {
  return {
    async findContext(accountId) {
      const account = await prisma.whatsAppAccount.findUnique({
        select: {
          disconnectAlertSentAt: true,
          disconnectedAt: true,
          displayName: true,
          id: true,
          lastDisconnectReason: true,
          organization: {
            select: {
              id: true,
              memberships: {
                select: {
                  user: { select: { email: true } }
                },
                where: { role: { in: ["OWNER", "ADMIN"] } }
              },
              name: true
            }
          },
          phoneNumber: true,
          recoveryAlertSentAt: true,
          status: true
        },
        where: { id: accountId }
      });

      if (!account) {
        return null;
      }

      return {
        accountId: account.id,
        accountName: account.displayName,
        adminEmails: [...new Set(account.organization.memberships.map(({ user }) => user.email))],
        disconnectAlertSentAt: account.disconnectAlertSentAt,
        disconnectedAt: account.disconnectedAt,
        lastDisconnectReason: account.lastDisconnectReason,
        organizationId: account.organization.id,
        organizationName: account.organization.name,
        phoneNumber: account.phoneNumber,
        recoveryAlertSentAt: account.recoveryAlertSentAt,
        status: account.status
      };
    },

    async markDisconnectAlertSent(accountId, disconnectedAt, sentAt) {
      await prisma.whatsAppAccount.updateMany({
        data: { disconnectAlertSentAt: sentAt },
        where: {
          disconnectAlertSentAt: null,
          disconnectedAt,
          id: accountId,
          status: { not: "CONNECTED" }
        }
      });
    },

    async markRecoveryAlertSent(accountId, disconnectedAt, sentAt) {
      await prisma.whatsAppAccount.updateMany({
        data: { recoveryAlertSentAt: sentAt },
        where: {
          disconnectedAt,
          id: accountId,
          recoveryAlertSentAt: null,
          status: "CONNECTED"
        }
      });
    }
  };
}

export class WhatsAppConnectionAlertProcessor {
  constructor(
    private readonly store: WhatsAppConnectionAlertStore,
    private readonly emailSender: TransactionalEmailSender,
    private readonly config: {
      appUrl: string;
      fromEmail?: string;
      logger: Pick<Logger, "info" | "warn">;
      now?: () => Date;
    }
  ) {}

  async process(input: {
    accountId: string;
    alertType: WhatsAppConnectionAlertType;
  }): Promise<void> {
    const context = await this.store.findContext(input.accountId);

    if (!context) {
      return;
    }

    if (input.alertType === "DISCONNECT") {
      await this.sendDisconnectAlert(context);
      return;
    }

    await this.sendRecoveryAlert(context);
  }

  private async sendDisconnectAlert(context: WhatsAppConnectionAlertContext): Promise<void> {
    if (
      context.status === "CONNECTED" ||
      !context.disconnectedAt ||
      context.disconnectAlertSentAt
    ) {
      return;
    }

    const recipients = uniqueEmails(context.adminEmails);
    if (recipients.length === 0) {
      this.config.logger.warn(
        { accountId: context.accountId, organizationId: context.organizationId },
        "WhatsApp disconnect alert skipped because no owner or admin email is available"
      );
      return;
    }

    const sentAt = this.now();
    const delivery = await this.emailSender.send({
      from: this.requireFromEmail(),
      html: buildDisconnectHtml(context, this.settingsUrl()),
      idempotencyKey: `whatsapp-disconnect/${context.accountId}/${context.disconnectedAt.toISOString()}`,
      subject: "FieldOS alert: WhatsApp connection lost",
      text: buildDisconnectText(context, this.settingsUrl()),
      to: recipients
    });

    if (delivery === "NOT_CONFIGURED") {
      throw new Error("WhatsApp connection email delivery is not configured.");
    }

    await this.store.markDisconnectAlertSent(context.accountId, context.disconnectedAt, sentAt);
    this.config.logger.info(
      { accountId: context.accountId, organizationId: context.organizationId },
      "WhatsApp disconnect alert sent"
    );
  }

  private async sendRecoveryAlert(context: WhatsAppConnectionAlertContext): Promise<void> {
    if (
      context.status !== "CONNECTED" ||
      !context.disconnectedAt ||
      !context.disconnectAlertSentAt ||
      context.recoveryAlertSentAt
    ) {
      return;
    }

    const recipients = uniqueEmails(context.adminEmails);
    if (recipients.length === 0) {
      this.config.logger.warn(
        { accountId: context.accountId, organizationId: context.organizationId },
        "WhatsApp recovery alert skipped because no owner or admin email is available"
      );
      return;
    }

    const sentAt = this.now();
    const duration = formatDuration(sentAt.getTime() - context.disconnectedAt.getTime());
    const delivery = await this.emailSender.send({
      from: this.requireFromEmail(),
      html: buildRecoveryHtml(context, duration, this.settingsUrl()),
      idempotencyKey: `whatsapp-recovery/${context.accountId}/${context.disconnectedAt.toISOString()}`,
      subject: "FieldOS update: WhatsApp connection restored",
      text: buildRecoveryText(context, duration, this.settingsUrl()),
      to: recipients
    });

    if (delivery === "NOT_CONFIGURED") {
      throw new Error("WhatsApp connection email delivery is not configured.");
    }

    await this.store.markRecoveryAlertSent(context.accountId, context.disconnectedAt, sentAt);
    this.config.logger.info(
      { accountId: context.accountId, organizationId: context.organizationId },
      "WhatsApp recovery alert sent"
    );
  }

  private now(): Date {
    return this.config.now?.() ?? new Date();
  }

  private requireFromEmail(): string {
    if (!this.config.fromEmail) {
      throw new Error("RESEND_FROM_EMAIL is required for WhatsApp connection alerts.");
    }

    return this.config.fromEmail;
  }

  private settingsUrl(): string {
    return `${this.config.appUrl.replace(/\/$/, "")}/settings`;
  }
}

function uniqueEmails(emails: string[]): string[] {
  return [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

function accountLabel(context: WhatsAppConnectionAlertContext): string {
  return context.phoneNumber
    ? `${context.accountName} (${context.phoneNumber})`
    : context.accountName;
}

function buildDisconnectText(context: WhatsAppConnectionAlertContext, settingsUrl: string): string {
  return [
    `FieldOS lost its WhatsApp connection for ${accountLabel(context)} in ${context.organizationName}.`,
    `Disconnected: ${context.disconnectedAt?.toISOString() ?? "Unknown"}`,
    `Reason: ${context.lastDisconnectReason ?? "Connection closed unexpectedly"}`,
    "FieldOS will continue reconnect attempts while the linked session remains valid.",
    `Review the connection: ${settingsUrl}`
  ].join("\n\n");
}

function buildDisconnectHtml(context: WhatsAppConnectionAlertContext, settingsUrl: string): string {
  return `<p>FieldOS lost its WhatsApp connection for <strong>${escapeHtml(accountLabel(context))}</strong> in ${escapeHtml(context.organizationName)}.</p><p><strong>Disconnected:</strong> ${escapeHtml(context.disconnectedAt?.toISOString() ?? "Unknown")}<br><strong>Reason:</strong> ${escapeHtml(context.lastDisconnectReason ?? "Connection closed unexpectedly")}</p><p>FieldOS will continue reconnect attempts while the linked session remains valid.</p><p><a href="${escapeHtml(settingsUrl)}">Review the WhatsApp connection</a></p>`;
}

function buildRecoveryText(
  context: WhatsAppConnectionAlertContext,
  duration: string,
  settingsUrl: string
): string {
  return [
    `FieldOS restored the WhatsApp connection for ${accountLabel(context)} in ${context.organizationName}.`,
    `Approximate interruption: ${duration}.`,
    "Message processing has resumed.",
    `Review the connection: ${settingsUrl}`
  ].join("\n\n");
}

function buildRecoveryHtml(
  context: WhatsAppConnectionAlertContext,
  duration: string,
  settingsUrl: string
): string {
  return `<p>FieldOS restored the WhatsApp connection for <strong>${escapeHtml(accountLabel(context))}</strong> in ${escapeHtml(context.organizationName)}.</p><p><strong>Approximate interruption:</strong> ${escapeHtml(duration)}.</p><p>Message processing has resumed.</p><p><a href="${escapeHtml(settingsUrl)}">Review the WhatsApp connection</a></p>`;
}

function formatDuration(durationMs: number): string {
  const totalMinutes = Math.max(1, Math.round(durationMs / 60_000));
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0
    ? `${hours} hour${hours === 1 ? "" : "s"}`
    : `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minutes`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
