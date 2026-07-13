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
  if (!config.apiKey || !config.from) {
    return {
      send: async () => "NOT_CONFIGURED"
    };
  }

  return {
    async send(input) {
      const response = await fetch("https://api.resend.com/emails", {
        body: JSON.stringify({
          from: config.from,
          html: passwordResetEmailHtml(input.resetUrl),
          subject: "Reset your FieldOS password",
          text: `Reset your FieldOS password using this link: ${input.resetUrl}\n\nThis link expires in one hour. If you did not request it, you can ignore this email.`,
          to: [input.recipient]
        }),
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(`Password reset email provider failed with status ${response.status}.`);
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
