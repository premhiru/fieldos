import { Resend } from "resend";

export interface TransactionalEmail {
  from: string;
  html: string;
  idempotencyKey: string;
  subject: string;
  text: string;
  to: string | string[];
}

export interface ResendError {
  message: string;
  name: string;
  statusCode: number | null;
}

export interface ResendEmailClient {
  emails: {
    send(
      payload: Omit<TransactionalEmail, "idempotencyKey">,
      options: { idempotencyKey: string }
    ): Promise<{ error: ResendError | null }>;
  };
}

export interface TransactionalEmailSender {
  send(email: TransactionalEmail): Promise<"NOT_CONFIGURED" | "SENT">;
}

export class TransactionalEmailDeliveryError extends Error {
  constructor(
    readonly providerCode: string,
    readonly statusCode: number | null
  ) {
    super("Transactional email delivery failed.");
    this.name = "TransactionalEmailDeliveryError";
  }
}

export function createResendEmailSender(config: {
  apiKey?: string;
  client?: ResendEmailClient;
}): TransactionalEmailSender {
  if (!config.apiKey && !config.client) {
    return { send: async () => "NOT_CONFIGURED" };
  }

  const client = config.client ?? new Resend(config.apiKey ?? "");

  return {
    async send({ idempotencyKey, ...payload }) {
      const { error } = await client.emails.send(payload, { idempotencyKey });

      if (error) {
        throw new TransactionalEmailDeliveryError(error.name, error.statusCode);
      }

      return "SENT";
    }
  };
}
