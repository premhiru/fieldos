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
    const messages = [
      { content: milestoneDetectionSystemPrompt, role: "system" as const },
      { content: buildMilestoneDetectionUserPrompt(parsed), role: "user" as const }
    ];
    const raw = await this.provider.completeJson({ messages, model: this.model });
    const result = milestoneDetectionResultSchema.safeParse(raw);

    if (result.success) {
      return actionableChanges(result.data.changes);
    }

    const repaired = await this.provider.completeJson({
      messages: [
        ...messages,
        {
          content: `Your previous JSON failed validation. Return one corrected complete JSON object only. Preserve the evidence and cautious meaning. action must be exactly CREATE, UPDATE, COMPLETE, START, DELAY, or NONE. status must be exactly PLANNED, IN_PROGRESS, COMPLETED, DELAYED, CANCELLED, or null. confidence must be exactly HIGH, MEDIUM, or LOW. Dates must be YYYY-MM-DD strings or null. Validation errors:\n${z.prettifyError(result.error)}`,
          role: "user"
        }
      ],
      model: this.model
    });
    const repairedResult = milestoneDetectionResultSchema.safeParse(repaired);

    if (!repairedResult.success) {
      throw new AIOutputValidationError(z.prettifyError(repairedResult.error));
    }

    return actionableChanges(repairedResult.data.changes);
  }
}

function actionableChanges(changes: MilestoneDetectionChange[]): MilestoneDetectionChange[] {
  return changes.filter(
    (change) => change.hasMilestoneChange && change.action !== "NONE" && change.milestoneTitle
  );
}
