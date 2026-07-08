import { z } from "zod";

import {
  buildSearchAnswerUserPrompt,
  searchAnswerSystemPrompt
} from "./prompts/search-answer.v1.js";
import {
  searchAnswerInputSchema,
  searchAnswerResultSchema,
  type AIProvider,
  type SearchAnswerInput,
  type SearchAnswerResult
} from "./types.js";
import { AIConfigurationError, AIOutputValidationError } from "./message-classifier.js";
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

export interface SearchAnswerGeneratorOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  provider?: AIProvider;
}

const defaultAIBaseUrl = "https://openrouter.ai/api/v1";
const defaultAIModel = "openrouter/free";

export class SearchAnswerGenerator {
  private readonly model: string;
  private readonly provider: AIProvider;

  constructor(options: SearchAnswerGeneratorOptions = {}) {
    this.model = options.model ?? process.env.AI_MODEL ?? defaultAIModel;
    this.provider =
      options.provider ??
      new SearchOpenAICompatibleProvider({
        apiKey: options.apiKey ?? process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY,
        baseUrl: options.baseUrl ?? process.env.AI_BASE_URL
      });
  }

  async answer(input: SearchAnswerInput): Promise<SearchAnswerResult> {
    const parsed = searchAnswerInputSchema.parse(input);
    const raw = await this.provider.completeJson({
      messages: [
        {
          content: searchAnswerSystemPrompt,
          role: "system"
        },
        {
          content: buildSearchAnswerUserPrompt(parsed),
          role: "user"
        }
      ],
      model: this.model
    });
    const result = searchAnswerResultSchema.safeParse(raw);

    if (!result.success) {
      throw new AIOutputValidationError(z.prettifyError(result.error));
    }

    return result.data;
  }
}

class SearchOpenAICompatibleProvider implements AIProvider {
  private readonly apiKey?: string;
  private readonly baseUrl: string;

  constructor(options: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? defaultAIBaseUrl;
  }

  async completeJson(input: {
    model: string;
    messages: Array<{ role: "system" | "user"; content: string }>;
  }): Promise<unknown> {
    if (!this.apiKey) {
      throw new AIConfigurationError();
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      body: JSON.stringify({
        messages: input.messages,
        model: input.model,
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
        label: "AI provider",
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
