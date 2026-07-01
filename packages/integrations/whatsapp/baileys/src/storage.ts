import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export class BaileysFilesystemStorage {
  constructor(private readonly rootPath = path.join(process.cwd(), ".storage")) {}

  getSessionPath(organizationId: string, accountId: string): string {
    return path.join(this.rootPath, "baileys", organizationId, accountId);
  }

  async writeMedia(input: {
    organizationId: string;
    accountId: string;
    messageId: string;
    filename: string;
    buffer: Buffer;
  }): Promise<{ storageKey: string; size: number }> {
    const relativeKey = path.join(
      "whatsapp-media",
      input.organizationId,
      input.accountId,
      `${input.messageId}-${sanitizeFilename(input.filename)}`
    );
    const absolutePath = path.join(this.rootPath, relativeKey);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.buffer);

    return {
      size: input.buffer.byteLength,
      storageKey: relativeKey.replaceAll("\\", "/")
    };
  }
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}
