import { z } from "zod";

import {
  buildMilestoneDetectionUserPrompt,
  milestoneDetectionSystemPrompt
} from "./prompts/milestone-detection.v1.js";
import {
  AIOutputValidationError,
  createConfiguredAIProvider,
  OpenAICompatibleProvider
} from "./message-classifier.js";
import {
  milestoneDetectionInputSchema,
  milestoneDetectionResultSchema,
  type AIProvider,
  type MilestoneDetectionChange,
  type MilestoneDetectionInput
} from "./types.js";

export interface MilestoneDetectorOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  provider?: AIProvider;
}

export class MilestoneDetector {
  private readonly model: string;
  private readonly provider: AIProvider;

  constructor(options: MilestoneDetectorOptions = {}) {
    if (options.provider) {
      this.model = options.model ?? process.env.AI_MODEL ?? "openrouter/free";
      this.provider = options.provider;
      return;
    }

    if (options.apiKey || options.baseUrl) {
      this.model = options.model ?? process.env.AI_MODEL ?? "openrouter/free";
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

  async detectMilestones(input: MilestoneDetectionInput): Promise<MilestoneDetectionChange[]> {
    const parsed = milestoneDetectionInputSchema.parse(input);
    const raw = await this.provider.completeJson({
      messages: [
        { content: milestoneDetectionSystemPrompt, role: "system" },
        { content: buildMilestoneDetectionUserPrompt(parsed), role: "user" }
      ],
      model: this.model
    });
    const result = milestoneDetectionResultSchema.safeParse(raw);

    if (!result.success) {
      throw new AIOutputValidationError(z.prettifyError(result.error));
    }

    return result.data.changes.filter(
      (change) => change.hasMilestoneChange && change.action !== "NONE"
    );
  }
}
