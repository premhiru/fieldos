import { z } from "zod";
import { createLogger } from "@fieldos/shared";

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
const logger = createLogger("vision-provider");

const visionOutputContract = `
Return one JSON object with every key below:
{
  "analysisStatus": "USEFUL" | "INSUFFICIENT_CONTEXT" | "POOR_IMAGE_QUALITY" | "NO_OPERATIONAL_CONCLUSION",
  "summary": string,
  "visibleObservations": [{"observation": string, "confidence": number}],
  "claimedContext": string | null,
  "claimSupport": "SUPPORTED" | "PARTIALLY_SUPPORTED" | "NOT_SUPPORTED" | "UNABLE_TO_DETERMINE",
  "possibleIssues": [{"issue": string, "confidence": number, "requiresHumanReview": true, "basis": string}],
  "progressEvidence": {"usable": boolean, "scope": string | null, "reason": string},
  "safetySignal": {"present": boolean, "severity": "LOW" | "MEDIUM" | "HIGH" | null, "reason": string | null},
  "detectedObjects": string[],
  "tags": string[],
  "limitations": string[],
  "overallConfidence": number
}
All confidence values are numbers from 0 to 1.
`.trim();

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
  "Return strict JSON only. Do not wrap JSON in markdown.",
  "Describe only visible observations. Separate the sender's claim from what the image visibly supports.",
  "Use NO_OPERATIONAL_CONCLUSION for ordinary photos and any image that cannot independently justify an operational conclusion.",
  "Use INSUFFICIENT_CONTEXT when the image is clear but lacks enough scope or context. Use POOR_IMAGE_QUALITY when the image itself is unusable.",
  "Never certify completion, compliance, workmanship, safety, quantities, test results, asset operation, or hidden conditions from one image.",
  "Never infer location solely from a project or conversation name.",
  "Do not treat absence from the frame as proof that something is missing.",
  "Photo analysis alone must not claim milestone completion, inspection readiness, defect remediation, or safety escalation.",
  "Only mark progressEvidence.usable when a clearly identified scope is visibly supported; otherwise use false and explain why.",
  "Only set safetySignal.present for a serious directly visible condition. Keep possible issues cautious and always require human review.",
  "detectedObjects and tags must be short generic terms that can support keyword search.",
  visionOutputContract
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
    const messages: Array<Record<string, unknown>> = [
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
    ];
    const requestBody: Record<string, unknown> = {
      messages,
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

    let raw: unknown;
    let validationMessage: string | null = null;

    try {
      raw = await this.completeJson(requestBody);
    } catch (error) {
      if (!(error instanceof VisionOutputValidationError)) throw error;
      raw = null;
      validationMessage = error.message;
    }

    const result = visionResultSchema.safeParse(raw);

    if (result.success) {
      return result.data;
    }

    validationMessage ??= z.prettifyError(result.error);
    logger.warn(
      { model: this.model, provider: this.providerLabel },
      "vision schema validation failed; requesting one bounded repair"
    );
    const repaired = await this.completeJson({
      ...requestBody,
      messages: [
        ...messages,
        {
          content: `Your previous JSON was structurally invalid. Return one corrected complete JSON object only. Preserve cautious meaning and follow this exact contract:\n${visionOutputContract}\nValidation errors:\n${validationMessage}`,
          role: "user"
        }
      ]
    });
    const repairedResult = visionResultSchema.safeParse(repaired);

    if (!repairedResult.success) {
      throw new VisionOutputValidationError(z.prettifyError(repairedResult.error));
    }

    return repairedResult.data;
  }

  private async completeJson(requestBody: Record<string, unknown>): Promise<unknown> {
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
    if (!content)
      throw new VisionOutputValidationError("Vision provider returned an empty response.");

    try {
      return JSON.parse(content) as unknown;
    } catch {
      throw new VisionOutputValidationError("Vision provider returned invalid JSON.");
    }
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
    "Treat the message as a sender claim, not as visible proof.",
    "State what cannot be determined from this single image in limitations.",
    visionOutputContract
  ].join("\n");
}
