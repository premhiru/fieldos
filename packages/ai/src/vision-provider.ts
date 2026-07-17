import { z } from "zod";

import {
  visionRequestSchema,
  visionResultSchema,
  type VisionProvider,
  type VisionRequest,
  type VisionResult
} from "./types.js";
import { FallbackVisionProvider } from "./fallback-provider.js";
import { createAIProviderRequestError } from "./provider-errors.js";

const defaultVisionBaseUrl = "https://openrouter.ai/api/v1";
const defaultVisionModel = "openrouter/free";
const defaultKimiBaseUrl = "https://api.moonshot.ai/v1";
const defaultKimiModel = "kimi-k2.6";

const openAiVisionResponseSchema = z.object({
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

const visionSystemPrompt = [
  "You analyze field-operation photos for project managers.",
  "You assist but do not certify work, completion, safety, or engineering compliance.",
  "Never invent details. If a detail is unclear, say Unable to determine.",
  "Return only compact JSON with keys: summary, detectedObjects, possibleIssues, confidence, tags.",
  "detectedObjects and tags must be short generic terms that can support keyword search.",
  "possibleIssues must be cautious and use words like possible, may, appears, or Needs Review."
].join(" ");

export interface OpenAICompatibleVisionProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  providerLabel?: string;
  temperature?: number | null;
  thinking?: { type: "disabled" | "enabled" };
}

export interface ConfiguredVisionProviderOptions {
  fallbackApiKey?: string;
  fallbackBaseUrl?: string;
  fallbackModel?: string;
  kimiApiKey?: string;
  kimiBaseUrl?: string;
  kimiModel?: string;
  onFallback?: (error: unknown) => void;
}

export function createConfiguredVisionProvider(
  options: ConfiguredVisionProviderOptions = {}
): VisionProvider {
  const fallbackApiKey =
    options.fallbackApiKey ?? process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;
  const fallback = new OpenAICompatibleVisionProvider({
    apiKey: fallbackApiKey,
    baseUrl: options.fallbackBaseUrl ?? process.env.AI_BASE_URL ?? defaultVisionBaseUrl,
    model:
      options.fallbackModel ??
      process.env.VISION_MODEL ??
      process.env.AI_MODEL ??
      defaultVisionModel,
    providerLabel: "OpenRouter vision"
  });
  const kimiApiKey = options.kimiApiKey ?? process.env.KIMI_API_KEY ?? process.env.MOONSHOT_API_KEY;

  if (!kimiApiKey) {
    return fallback;
  }

  const primary = new OpenAICompatibleVisionProvider({
    apiKey: kimiApiKey,
    baseUrl: options.kimiBaseUrl ?? process.env.KIMI_BASE_URL ?? defaultKimiBaseUrl,
    model:
      options.kimiModel ??
      process.env.KIMI_VISION_MODEL ??
      process.env.KIMI_MODEL ??
      defaultKimiModel,
    providerLabel: "Kimi vision",
    temperature: null,
    thinking: { type: "disabled" }
  });

  return fallbackApiKey
    ? new FallbackVisionProvider(primary, fallback, options.onFallback)
    : primary;
}

export class VisionConfigurationError extends Error {
  constructor(message = "Vision AI not configured.") {
    super(message);
    this.name = "VisionConfigurationError";
  }
}

export class VisionOutputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VisionOutputValidationError";
  }
}

export class OpenAICompatibleVisionProvider implements VisionProvider {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly providerLabel: string;
  private readonly temperature: number | null;
  private readonly thinking?: { type: "disabled" | "enabled" };

  constructor(options: OpenAICompatibleVisionProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;
    this.baseUrl = options.baseUrl ?? process.env.AI_BASE_URL ?? defaultVisionBaseUrl;
    this.model =
      options.model ?? process.env.VISION_MODEL ?? process.env.AI_MODEL ?? defaultVisionModel;
    this.providerLabel = options.providerLabel ?? "Vision provider";
    this.temperature = options.temperature === undefined ? 0.1 : options.temperature;
    this.thinking = options.thinking;
  }

  async analyze(input: VisionRequest): Promise<VisionResult> {
    if (!this.apiKey) {
      throw new VisionConfigurationError();
    }

    const parsed = visionRequestSchema.parse(input);
    const requestBody: Record<string, unknown> = {
      messages: [
        {
          content: visionSystemPrompt,
          role: "system"
        },
        {
          content: [
            {
              text: buildVisionUserPrompt(parsed),
              type: "text"
            },
            {
              image_url: {
                url: `data:${parsed.image.mimeType};base64,${parsed.image.base64}`
              },
              type: "image_url"
            }
          ],
          role: "user"
        }
      ],
      model: this.model,
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

    const payload = openAiVisionResponseSchema.parse(await response.json());
    const content = payload.choices[0]?.message.content;

    if (!content) {
      throw new VisionOutputValidationError("Vision provider returned an empty response.");
    }

    let raw: unknown;

    try {
      raw = JSON.parse(content) as unknown;
    } catch {
      throw new VisionOutputValidationError("Vision provider returned invalid JSON.");
    }

    const result = visionResultSchema.safeParse(raw);

    if (!result.success) {
      throw new VisionOutputValidationError(z.prettifyError(result.error));
    }

    return result.data;
  }
}

function buildVisionUserPrompt(input: VisionRequest): string {
  return [
    `Filename: ${input.image.filename}`,
    input.context.projectName ? `Project: ${input.context.projectName}` : "Project: Unknown",
    input.context.conversationTitle
      ? `Conversation: ${input.context.conversationTitle}`
      : "Conversation: Unknown",
    input.context.messageText ? `Message text: ${input.context.messageText}` : "Message text: None",
    "Analyze only visible content in the image.",
    "Use generic detected object labels such as Runway Light, Electrical Cabinet, Cable, Concrete, Vehicle, Worker, Pallet, Equipment, or Unknown when appropriate.",
    "If confidence is low, include Needs Review in possibleIssues or tags."
  ].join("\n");
}
