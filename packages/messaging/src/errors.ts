export type MessagingErrorCode = "FORBIDDEN" | "NOT_FOUND";

export class MessagingServiceError extends Error {
  constructor(
    public readonly code: MessagingErrorCode,
    message: string
  ) {
    super(message);
    this.name = "MessagingServiceError";
  }
}

export function forbidden(message = "You do not have access to this messaging resource.") {
  return new MessagingServiceError("FORBIDDEN", message);
}

export function notFound(message = "Messaging resource not found.") {
  return new MessagingServiceError("NOT_FOUND", message);
}
