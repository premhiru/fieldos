import { createHmac, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface StorageObjectInput {
  contentType?: string;
  data: Buffer | string;
  key: string;
}

export interface SignedUrlInput {
  baseUrl: string;
  expiresInSeconds: number;
  key: string;
}

export interface StorageProvider {
  upload(input: StorageObjectInput): Promise<void>;
  download(key: string): Promise<Buffer>;
  getSignedUrl(input: SignedUrlInput): Promise<string>;
  delete(key: string): Promise<void>;
}

export class StorageAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageAccessError";
  }
}

export class LocalStorageProvider implements StorageProvider {
  private readonly rootPath: string;
  private readonly signingSecret: string;

  constructor(input: { rootPath: string; signingSecret: string }) {
    this.rootPath = path.resolve(input.rootPath);
    this.signingSecret = input.signingSecret;
  }

  async upload(input: StorageObjectInput): Promise<void> {
    const target = this.resolveKey(input.key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, input.data);
  }

  async download(key: string): Promise<Buffer> {
    return fs.readFile(this.resolveKey(key));
  }

  async getSignedUrl(input: SignedUrlInput): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + input.expiresInSeconds;
    const token = encodeStorageKey(input.key);
    const signature = this.sign(token, expires);
    const baseUrl = input.baseUrl.replace(/\/$/, "");

    return `${baseUrl}/media/${token}?expires=${expires}&signature=${signature}`;
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolveKey(key), { force: true });
  }

  verifySignedToken(input: { expires: number; signature: string; token: string }): string {
    if (!Number.isFinite(input.expires) || input.expires < Math.floor(Date.now() / 1000)) {
      throw new StorageAccessError("Signed media URL has expired.");
    }

    const expected = this.sign(input.token, input.expires);
    const actualBuffer = Buffer.from(input.signature);
    const expectedBuffer = Buffer.from(expected);

    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw new StorageAccessError("Signed media URL is invalid.");
    }

    return decodeStorageKey(input.token);
  }

  private sign(token: string, expires: number): string {
    return createHmac("sha256", this.signingSecret).update(`${token}.${expires}`).digest("hex");
  }

  private resolveKey(key: string): string {
    const target = path.resolve(this.rootPath, key);

    if (!target.startsWith(this.rootPath + path.sep) && target !== this.rootPath) {
      throw new StorageAccessError("Storage key resolves outside the configured root.");
    }

    return target;
  }
}

function encodeStorageKey(key: string): string {
  return Buffer.from(key, "utf8").toString("base64url");
}

function decodeStorageKey(token: string): string {
  return Buffer.from(token, "base64url").toString("utf8");
}
