import { Resend } from "resend";

export interface PasswordResetEmailInput {
  idempotencyKey: string;
  recipient: string;
  resetUrl: string;
}

export interface PasswordResetEmailSender {
  send(input: PasswordResetEmailInput): Promise<"NOT_CONFIGURED" | "SENT">;
}

interface ResendError {
  message: string;
  name: string;
  statusCode: number | null;
}

interface ResendEmailClient {
  emails: {
    send(
      payload: {
        from: string;
        html: string;
        subject: string;
        text: string;
        to: string;
      },
      options: { idempotencyKey: string }
    ): Promise<{ error: ResendError | null }>;
  };
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

  const resend = config.client ?? new Resend(apiKey);
  const sleep = config.sleep ?? delay;

  return {
    async send(input) {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const { error } = await resend.emails.send(
          {
            from,
            html: passwordResetEmailHtml(input.resetUrl),
            subject: "Reset your FieldOS password",
            text: `Reset your FieldOS password using this link: ${input.resetUrl}\n\nThis link expires in one hour. If you did not request it, you can ignore this email.`,
            to: input.recipient
          },
          { idempotencyKey: input.idempotencyKey }
        );

        if (!error) {
          return "SENT";
        }

        if (!isRetryable(error) || attempt === 3) {
          throw new PasswordResetEmailDeliveryError(error.name, error.statusCode);
        }

        await sleep(250 * 2 ** (attempt - 1));
      }

      throw new PasswordResetEmailDeliveryError("unknown", null);
    }
  };
}

function isRetryable(error: ResendError): boolean {
  return (
    error.statusCode === null ||
    error.statusCode === 429 ||
    error.statusCode >= 500 ||
    error.name === "concurrent_idempotent_requests"
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
