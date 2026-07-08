import { z } from "zod";

import {
  visionRequestSchema,
  visionResultSchema,
  type VisionProvider,
  type VisionRequest,
  type VisionResult
} from "./types.js";
import { createAIProviderRequestError } from "./provider-errors.js";

const defaultVisionBaseUrl = "https://openrouter.ai/api/v1";
const defaultVisionModel = "openrouter/free";

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

  constructor(options: OpenAICompatibleVisionProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;
    this.baseUrl = options.baseUrl ?? process.env.AI_BASE_URL ?? defaultVisionBaseUrl;
    this.model =
      options.model ?? process.env.VISION_MODEL ?? process.env.AI_MODEL ?? defaultVisionModel;
  }

  async analyze(input: VisionRequest): Promise<VisionResult> {
    if (!this.apiKey) {
      throw new VisionConfigurationError();
    }

    const parsed = visionRequestSchema.parse(input);
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      body: JSON.stringify({
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
        },
        temperature: 0.1
      }),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      throw createAIProviderRequestError({
        label: "Vision provider",
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
