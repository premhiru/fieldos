import { z } from "zod";

import {
  buildMessageClassificationUserPromptV2,
  messageClassificationSystemPromptV2
} from "./prompts/message-classification.v2.js";
import { AIOutputValidationError, createConfiguredAIProvider } from "./message-classifier.js";
import {
  classifyMessageV2InputSchema,
  classifyMessageV2ResultSchema,
  type AIProvider,
  type ClassifyMessageV2Input,
  type ClassifyMessageV2Result
} from "./types.js";

export interface MessageClassifierV2Options {
  model?: string;
  provider?: AIProvider;
}

export class MessageClassifierV2 {
  readonly model: string;
  private readonly provider: AIProvider;

  constructor(options: MessageClassifierV2Options = {}) {
    const configured = options.provider ? null : createConfiguredAIProvider();
    this.model = options.model ?? configured?.model ?? process.env.AI_MODEL ?? "openrouter/free";
    this.provider = options.provider ?? configured?.provider ?? failMissingProvider();
  }

  async classifyMessage(input: ClassifyMessageV2Input): Promise<ClassifyMessageV2Result> {
    const parsed = classifyMessageV2InputSchema.parse(input);
    const messages = [
      { content: messageClassificationSystemPromptV2, role: "system" as const },
      { content: buildMessageClassificationUserPromptV2(parsed), role: "user" as const }
    ];
    const raw = await this.provider.completeJson({ messages, model: this.model });
    const result = classifyMessageV2ResultSchema.safeParse(raw);

    if (result.success) {
      return result.data;
    }

    const repaired = await this.provider.completeJson({
      messages: [
        ...messages,
        {
          content: `Your previous JSON failed validation. Return a corrected complete object only. Validation errors: ${z.prettifyError(result.error)}`,
          role: "user"
        }
      ],
      model: this.model
    });
    const repairedResult = classifyMessageV2ResultSchema.safeParse(repaired);

    if (!repairedResult.success) {
      throw new AIOutputValidationError(z.prettifyError(repairedResult.error));
    }

    return repairedResult.data;
  }
}

function failMissingProvider(): never {
  throw new Error("AI provider is not configured.");
}
