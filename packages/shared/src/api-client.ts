export interface ApiClientOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
}

export interface ApiRequestOptions<TBody = unknown> {
  body?: TBody;
  headers?: HeadersInit;
  method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createApiClient({ baseUrl = "", fetcher = fetch }: ApiClientOptions = {}) {
  async function request<TResponse, TBody = unknown>(
    path: string,
    options: ApiRequestOptions<TBody> = {}
  ): Promise<TResponse> {
    const response = await fetcher(`${baseUrl}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      },
      method: options.method ?? "GET",
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    const text = await response.text();
    const data = text ? parseJson(text) : null;

    if (!response.ok) {
      const message =
        isApiErrorResponse(data) && data.error ? data.error : `Request failed: ${response.status}`;
      throw new ApiError(message, response.status, data);
    }

    return data as TResponse;
  }

  return {
    get: <TResponse>(path: string) => request<TResponse>(path),
    post: <TResponse, TBody = unknown>(path: string, body?: TBody) =>
      request<TResponse, TBody>(path, { method: "POST", body })
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isApiErrorResponse(value: unknown): value is { error?: string } {
  return typeof value === "object" && value !== null && "error" in value;
}
