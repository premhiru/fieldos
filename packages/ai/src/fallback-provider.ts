import type { AIProvider, VisionProvider, VisionRequest, VisionResult } from "./types.js";

export interface AIProviderTarget {
  model: string;
  provider: AIProvider;
}

export class FallbackAIProvider implements AIProvider {
  constructor(
    private readonly primary: AIProviderTarget,
    private readonly fallback: AIProviderTarget,
    private readonly onFallback?: (error: unknown) => void
  ) {}

  async completeJson(input: Parameters<AIProvider["completeJson"]>[0]): Promise<unknown> {
    try {
      return await this.primary.provider.completeJson({ ...input, model: this.primary.model });
    } catch (error: unknown) {
      this.onFallback?.(error);
      return this.fallback.provider.completeJson({ ...input, model: this.fallback.model });
    }
  }
}

export class FallbackVisionProvider implements VisionProvider {
  constructor(
    private readonly primary: VisionProvider,
    private readonly fallback: VisionProvider,
    private readonly onFallback?: (error: unknown) => void
  ) {}

  async analyze(input: VisionRequest): Promise<VisionResult> {
    try {
      return await this.primary.analyze(input);
    } catch (error: unknown) {
      this.onFallback?.(error);
      return this.fallback.analyze(input);
    }
  }
}
