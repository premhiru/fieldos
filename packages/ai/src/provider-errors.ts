export class AIProviderRequestError extends Error {
  readonly retryAfterMs: number | null;
  readonly status: number;

  constructor(input: { message: string; retryAfterMs?: number | null; status: number }) {
    super(input.message);
    this.name = "AIProviderRequestError";
    this.retryAfterMs = input.retryAfterMs ?? null;
    this.status = input.status;
  }
}

export class AIProviderRateLimitError extends AIProviderRequestError {
  constructor(input: { message: string; retryAfterMs?: number | null; status: number }) {
    super(input);
    this.name = "AIProviderRateLimitError";
  }
}

export function createAIProviderRequestError(input: {
  label: string;
  retryAfterHeader: string | null;
  status: number;
}) {
  const retryAfterMs = parseRetryAfterMs(input.retryAfterHeader);

  if (input.status === 429) {
    return new AIProviderRateLimitError({
      message: `${input.label} rate limited the request with status 429.`,
      retryAfterMs,
      status: input.status
    });
  }

  return new AIProviderRequestError({
    message: `${input.label} request failed with status ${input.status}.`,
    retryAfterMs,
    status: input.status
  });
}

export function isAIProviderRateLimitError(error: unknown): error is AIProviderRateLimitError {
  return error instanceof AIProviderRateLimitError;
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.ceil(seconds * 1000);
  }

  const retryAt = Date.parse(value);

  if (!Number.isNaN(retryAt)) {
    return Math.max(retryAt - Date.now(), 0);
  }

  return null;
}
