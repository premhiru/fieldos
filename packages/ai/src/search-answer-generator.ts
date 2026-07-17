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
import {
  AIOutputValidationError,
  createConfiguredAIProvider,
  OpenAICompatibleProvider
} from "./message-classifier.js";

export interface SearchAnswerGeneratorOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  provider?: AIProvider;
}

const defaultAIModel = "openrouter/free";

export class SearchAnswerGenerator {
  private readonly model: string;
  private readonly provider: AIProvider;

  constructor(options: SearchAnswerGeneratorOptions = {}) {
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
