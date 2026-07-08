import type { VisionProvider, VisionResult } from "@fieldos/ai";
import type { StorageProvider } from "@fieldos/shared";

export interface PhotoAnalysisServiceOptions {
  provider: VisionProvider;
  storageProvider: StorageProvider;
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
  private readonly storageProvider: StorageProvider;

  constructor(options: PhotoAnalysisServiceOptions) {
    this.provider = options.provider;
    this.storageProvider = options.storageProvider;
  }

  async analyze(input: AnalyzePhotoInput): Promise<VisionResult> {
    const image = await this.storageProvider.download(input.storageKey);

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
}
