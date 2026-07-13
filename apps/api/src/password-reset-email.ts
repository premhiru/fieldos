import { Resend } from "resend";

export interface PasswordResetEmailInput {
  recipient: string;
  resetUrl: string;
}

export interface PasswordResetEmailSender {
  send(input: PasswordResetEmailInput): Promise<"NOT_CONFIGURED" | "SENT">;
}

export function createPasswordResetEmailSender(config: {
  apiKey?: string;
  from?: string;
}): PasswordResetEmailSender {
  const { apiKey, from } = config;

  if (!apiKey || !from) {
    return {
      send: async () => "NOT_CONFIGURED"
    };
  }

  const resend = new Resend(apiKey);

  return {
    async send(input) {
      const { error } = await resend.emails.send({
        from,
        html: passwordResetEmailHtml(input.resetUrl),
        subject: "Reset your FieldOS password",
        text: `Reset your FieldOS password using this link: ${input.resetUrl}\n\nThis link expires in one hour. If you did not request it, you can ignore this email.`,
        to: input.recipient
      });

      if (error) {
        throw new Error(`Password reset email provider failed: ${error.message}`);
      }

      return "SENT";
    }
  };
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
