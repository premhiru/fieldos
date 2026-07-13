import { Resend } from "resend";

export interface TeamInvitationEmailSender {
  send(input: {
    deliveryKey: string;
    invitationId: string;
    invitationUrl: string;
    organizationName: string;
    recipient: string;
    role: string;
  }): Promise<"NOT_CONFIGURED" | "SENT">;
}

export function createTeamInvitationEmailSender(config: {
  apiKey?: string;
  from?: string;
}): TeamInvitationEmailSender {
  const { apiKey, from } = config;
  if (!apiKey || !from) {
    return { send: async () => "NOT_CONFIGURED" };
  }
  const resend = new Resend(apiKey);

  return {
    async send(input) {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const { error } = await resend.emails.send(
          {
            from,
            html: invitationEmailHtml(input),
            subject: `Join ${input.organizationName} on FieldOS`,
            text: `You have been invited to join ${input.organizationName} as ${input.role}. Accept the invitation: ${input.invitationUrl}\n\nThis invitation expires in seven days.`,
            to: input.recipient
          },
          { idempotencyKey: `team-invitation/${input.invitationId}/${input.deliveryKey}` }
        );
        if (!error) return "SENT";
        const retryable =
          error.statusCode === null || error.statusCode === 429 || error.statusCode >= 500;
        if (!retryable || attempt === 3) {
          throw new TeamInvitationEmailError(error.name, error.statusCode);
        }
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
      }
      throw new TeamInvitationEmailError("unknown", null);
    }
  };
}

export class TeamInvitationEmailError extends Error {
  constructor(
    readonly providerCode: string,
    readonly statusCode: number | null
  ) {
    super("Team invitation email delivery failed.");
    this.name = "TeamInvitationEmailError";
  }
}

function invitationEmailHtml(input: {
  invitationUrl: string;
  organizationName: string;
  role: string;
}): string {
  const url = escapeHtml(input.invitationUrl);
  return `<p>You have been invited to join <strong>${escapeHtml(input.organizationName)}</strong> on FieldOS as ${escapeHtml(input.role)}.</p><p><a href="${url}">Accept invitation</a></p><p>This invitation expires in seven days.</p>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
