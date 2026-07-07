import { readFile } from "node:fs/promises";
import path from "node:path";

import type { VisionProvider, VisionResult } from "@fieldos/ai";

export interface PhotoAnalysisServiceOptions {
  provider: VisionProvider;
  storageRootPath: string;
}

export interface AnalyzePhotoInput {
  conversationTitle: string | null;
  filename: string;
  messageText: string | null;
  mimeType: string;
  projectName: string | null;
  storageKey: string;
}

export class PhotoAnalysisService {
  private readonly provider: VisionProvider;
  private readonly storageRootPath: string;

  constructor(options: PhotoAnalysisServiceOptions) {
    this.provider = options.provider;
    this.storageRootPath = path.resolve(options.storageRootPath);
  }

  async analyze(input: AnalyzePhotoInput): Promise<VisionResult> {
    const imagePath = this.resolveStoragePath(input.storageKey);
    const image = await readFile(imagePath);

    return this.provider.analyze({
      context: {
        conversationTitle: input.conversationTitle,
        messageText: input.messageText,
        projectName: input.projectName
      },
      image: {
        base64: image.toString("base64"),
        filename: input.filename,
        mimeType: input.mimeType
      }
    });
  }

  private resolveStoragePath(storageKey: string): string {
    const resolved = path.resolve(this.storageRootPath, storageKey);
    const relative = path.relative(this.storageRootPath, resolved);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Attachment storage key resolves outside the configured media root.");
    }

    return resolved;
  }
}
