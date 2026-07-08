import path from "node:path";
import {
  buildEvidenceObjectKey,
  LocalStorageProvider,
  type StorageProvider
} from "@fieldos/shared";

export class BaileysFilesystemStorage {
  private readonly mediaStorageProvider: StorageProvider;

  constructor(
    private readonly rootPath = path.join(process.cwd(), ".storage"),
    mediaStorageProvider?: StorageProvider
  ) {
    this.mediaStorageProvider =
      mediaStorageProvider ??
      new LocalStorageProvider({
        rootPath: this.rootPath,
        signingSecret: "local-whatsapp-media-signing-secret"
      });
  }

  getSessionPath(sessionKey: string): string {
    return path.join(this.rootPath, sessionKey);
  }

  async writeMedia(input: {
    organizationId: string;
    accountId: string;
    messageId: string;
    projectId: string | null;
    evidenceId: string;
    filename: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<{ storageKey: string; size: number }> {
    const storageKey = buildEvidenceObjectKey({
      evidenceId: input.evidenceId,
      filename: `${input.messageId}-${input.filename}`,
      organizationId: input.organizationId,
      projectId: input.projectId
    });
    const stored = await this.mediaStorageProvider.upload({
      contentType: input.mimeType,
      data: input.buffer,
      key: storageKey
    });

    return {
      size: stored.size,
      storageKey: stored.key
    };
  }
}
