import { z } from "zod";

import {
  buildMessageClassificationUserPrompt,
  messageClassificationSystemPrompt
} from "./prompts/message-classification.v1.js";
import {
  classifyMessageInputSchema,
  classifyMessageResultSchema,
  type AIProvider,
  type ClassifyMessageInput,
  type ClassifyMessageResult
} from "./types.js";
import { FallbackAIProvider } from "./fallback-provider.js";
import { createAIProviderRequestError } from "./provider-errors.js";

const openAiChatResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string()
        })
      })
    )
    .min(1)
});

export class AIConfigurationError extends Error {
  constructor(message = "AI not configured.") {
    super(message);
    this.name = "AIConfigurationError";
  }
}

export class AIOutputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIOutputValidationError";
  }
}

export interface MessageClassifierOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  provider?: AIProvider;
}

const defaultAIBaseUrl = "https://openrouter.ai/api/v1";
const defaultAIModel = "openrouter/free";
const defaultKimiBaseUrl = "https://api.moonshot.ai/v1";
const defaultKimiModel = "kimi-k2.6";

export interface ConfiguredAIProviderOptions {
  fallbackApiKey?: string;
  fallbackBaseUrl?: string;
  fallbackModel?: string;
  kimiApiKey?: string;
  kimiBaseUrl?: string;
  kimiModel?: string;
  onFallback?: (error: unknown) => void;
}

export function createConfiguredAIProvider(options: ConfiguredAIProviderOptions = {}): {
  model: string;
  provider: AIProvider;
} {
  const fallbackApiKey =
    options.fallbackApiKey ?? process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;
  const fallbackBaseUrl = options.fallbackBaseUrl ?? process.env.AI_BASE_URL ?? defaultAIBaseUrl;
  const fallbackModel = options.fallbackModel ?? process.env.AI_MODEL ?? defaultAIModel;
  const fallback = {
    model: fallbackModel,
    provider: new OpenAICompatibleProvider({
      apiKey: fallbackApiKey,
      baseUrl: fallbackBaseUrl,
      providerLabel: "OpenRouter"
    })
  };
  const kimiApiKey = options.kimiApiKey ?? process.env.KIMI_API_KEY ?? process.env.MOONSHOT_API_KEY;

  if (!kimiApiKey) {
    return fallback;
  }

  const kimiModel = options.kimiModel ?? process.env.KIMI_MODEL ?? defaultKimiModel;
  const primary = {
    model: kimiModel,
    provider: new OpenAICompatibleProvider({
      apiKey: kimiApiKey,
      baseUrl: options.kimiBaseUrl ?? process.env.KIMI_BASE_URL ?? defaultKimiBaseUrl,
      providerLabel: "Kimi",
      temperature: null,
      thinking: { type: "disabled" }
    })
  };

  return fallbackApiKey
    ? {
        model: kimiModel,
        provider: new FallbackAIProvider(primary, fallback, options.onFallback)
      }
    : primary;
}

export class MessageClassifier {
  private readonly model: string;
  private readonly provider: AIProvider;

  constructor(options: MessageClassifierOptions = {}) {
    if (options.provider) {
      this.model = options.model ?? process.env.AI_MODEL ?? defaultAIModel;
      this.provider = options.provider;
      return;
    }

    if (options.apiKey || options.baseUrl) {
      this.model = options.model ?? process.env.AI_MODEL ?? defaultAIModel;
      this.provider = new OpenAICompatibleProvider({
        apiKey: options.apiKey ?? process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY,
        baseUrl: options.baseUrl ?? process.env.AI_BASE_URL
      });
      return;
    }

    const configured = createConfiguredAIProvider();
    this.model = options.model ?? configured.model;
    this.provider = configured.provider;
  }

  async classifyMessage(input: ClassifyMessageInput): Promise<ClassifyMessageResult> {
    const parsed = classifyMessageInputSchema.parse(input);
    const raw = await this.provider.completeJson({
      messages: [
        {
          content: messageClassificationSystemPrompt,
          role: "system"
        },
        {
          content: buildMessageClassificationUserPrompt(parsed),
          role: "user"
        }
      ],
      model: this.model
    });

    const result = classifyMessageResultSchema.safeParse(raw);

    if (!result.success) {
      throw new AIOutputValidationError(z.prettifyError(result.error));
    }

    return result.data;
  }
}

export class OpenAICompatibleProvider implements AIProvider {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly providerLabel: string;
  private readonly temperature: number | null;
  private readonly thinking?: { type: "disabled" | "enabled" };

  constructor(options: {
    apiKey?: string;
    baseUrl?: string;
    providerLabel?: string;
    temperature?: number | null;
    thinking?: { type: "disabled" | "enabled" };
  }) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? defaultAIBaseUrl;
    this.providerLabel = options.providerLabel ?? "AI provider";
    this.temperature = options.temperature === undefined ? 0.1 : options.temperature;
    this.thinking = options.thinking;
  }

  async completeJson(input: {
    model: string;
    messages: Array<{ role: "system" | "user"; content: string }>;
  }): Promise<unknown> {
    if (!this.apiKey) {
      throw new AIConfigurationError();
    }

    const requestBody: Record<string, unknown> = {
      messages: input.messages,
      model: input.model,
      response_format: {
        type: "json_object"
      }
    };

    if (this.temperature !== null) {
      requestBody.temperature = this.temperature;
    }

    if (this.thinking) {
      requestBody.thinking = this.thinking;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      body: JSON.stringify(requestBody),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      throw createAIProviderRequestError({
        label: this.providerLabel,
        retryAfterHeader: response.headers.get("retry-after"),
        status: response.status
      });
    }

    const payload = openAiChatResponseSchema.parse(await response.json());
    const content = payload.choices[0]?.message.content;

    if (!content) {
      throw new AIOutputValidationError("AI provider returned an empty response.");
    }

    try {
      return JSON.parse(content) as unknown;
    } catch {
      throw new AIOutputValidationError("AI provider returned invalid JSON.");
    }
  }
}
