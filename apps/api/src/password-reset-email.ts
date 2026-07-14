import {
  createResendEmailSender,
  TransactionalEmailDeliveryError,
  type ResendEmailClient
} from "@fieldos/shared";

export interface PasswordResetEmailInput {
  idempotencyKey: string;
  recipient: string;
  resetUrl: string;
}

export interface PasswordResetEmailSender {
  send(input: PasswordResetEmailInput): Promise<"NOT_CONFIGURED" | "SENT">;
}

export class PasswordResetEmailDeliveryError extends Error {
  constructor(
    readonly providerCode: string,
    readonly statusCode: number | null
  ) {
    super("Password reset email delivery failed.");
    this.name = "PasswordResetEmailDeliveryError";
  }
}

export function createPasswordResetEmailSender(config: {
  apiKey?: string;
  client?: ResendEmailClient;
  from?: string;
  sleep?: (durationMs: number) => Promise<void>;
}): PasswordResetEmailSender {
  const { apiKey, from } = config;

  if (!apiKey || !from) {
    return {
      send: async () => "NOT_CONFIGURED"
    };
  }

  const resend = createResendEmailSender({ apiKey, client: config.client });
  const sleep = config.sleep ?? delay;

  return {
    async send(input) {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const result = await resend.send({
            from,
            html: passwordResetEmailHtml(input.resetUrl),
            idempotencyKey: input.idempotencyKey,
            subject: "Reset your FieldOS password",
            text: `Reset your FieldOS password using this link: ${input.resetUrl}\n\nThis link expires in one hour. If you did not request it, you can ignore this email.`,
            to: input.recipient
          });

          if (result === "SENT") {
            return "SENT";
          }
        } catch (error) {
          if (!(error instanceof TransactionalEmailDeliveryError)) {
            throw error;
          }

          if (!isRetryable(error) || attempt === 3) {
            throw new PasswordResetEmailDeliveryError(error.providerCode, error.statusCode);
          }

          await sleep(250 * 2 ** (attempt - 1));
          continue;
        }
      }

      throw new PasswordResetEmailDeliveryError("unknown", null);
    }
  };
}

function isRetryable(error: TransactionalEmailDeliveryError): boolean {
  return (
    error.statusCode === null ||
    error.statusCode === 429 ||
    error.statusCode >= 500 ||
    error.providerCode === "concurrent_idempotent_requests"
  );
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function passwordResetEmailHtml(resetUrl: string): string {
  const safeUrl = escapeHtml(resetUrl);
  return `<p>A password reset was requested for your FieldOS account.</p><p><a href="${safeUrl}">Reset your password</a></p><p>This link expires in one hour. If you did not request it, you can ignore this email.</p>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
