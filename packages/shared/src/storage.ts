import { createHmac, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

export interface StorageObjectInput {
  contentType?: string;
  data: Buffer | string;
  key: string;
}

export interface StoredObject {
  contentType: string | null;
  key: string;
  size: number;
}

export interface SignedUrlInput {
  baseUrl: string;
  expiresInSeconds: number;
  key: string;
}

export interface StorageProvider {
  upload(input: StorageObjectInput): Promise<StoredObject>;
  download(key: string): Promise<Buffer>;
  getSignedUrl(input: SignedUrlInput): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export class StorageAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageAccessError";
  }
}

export const storageProviderNameSchema = z.enum(["local", "r2"]).default("local");

export const storageEnvironmentSchema = z
  .object({
    R2_ACCESS_KEY_ID: z.string().trim().optional(),
    R2_ACCOUNT_ID: z.string().trim().optional(),
    R2_BUCKET: z.string().trim().optional(),
    R2_ENDPOINT: z.string().trim().url().optional(),
    R2_FORCE_PATH_STYLE: z
      .union([z.boolean(), z.string()])
      .transform((value) => value === true || value === "true")
      .default(true),
    R2_REGION: z.string().trim().min(1).default("auto"),
    R2_SECRET_ACCESS_KEY: z.string().trim().optional(),
    SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    STORAGE_PROVIDER: storageProviderNameSchema
  })
  .superRefine((value, context) => {
    if (value.STORAGE_PROVIDER !== "r2") {
      return;
    }

    for (const key of [
      "R2_ACCESS_KEY_ID",
      "R2_ACCOUNT_ID",
      "R2_BUCKET",
      "R2_ENDPOINT",
      "R2_SECRET_ACCESS_KEY"
    ] as const) {
      if (!value[key]) {
        context.addIssue({
          code: "custom",
          message: `${key} is required when STORAGE_PROVIDER=r2.`,
          path: [key]
        });
      }
    }
  });

export type StorageEnvironment = z.infer<typeof storageEnvironmentSchema>;

export interface CreateStorageProviderInput {
  local: {
    rootPath: string;
    signingSecret: string;
  };
  storage: StorageEnvironment;
}

export function createStorageProvider(input: CreateStorageProviderInput): StorageProvider {
  if (input.storage.STORAGE_PROVIDER === "r2") {
    return new R2StorageProvider({
      accessKeyId: requiredR2Value(input.storage.R2_ACCESS_KEY_ID, "R2_ACCESS_KEY_ID"),
      bucket: requiredR2Value(input.storage.R2_BUCKET, "R2_BUCKET"),
      endpoint: requiredR2Value(input.storage.R2_ENDPOINT, "R2_ENDPOINT"),
      forcePathStyle: input.storage.R2_FORCE_PATH_STYLE,
      region: input.storage.R2_REGION,
      secretAccessKey: requiredR2Value(input.storage.R2_SECRET_ACCESS_KEY, "R2_SECRET_ACCESS_KEY")
    });
  }

  return new LocalStorageProvider(input.local);
}

export class LocalStorageProvider implements StorageProvider {
  private readonly rootPath: string;
  private readonly signingSecret: string;

  constructor(input: { rootPath: string; signingSecret: string }) {
    this.rootPath = path.resolve(input.rootPath);
    this.signingSecret = input.signingSecret;
  }

  async upload(input: StorageObjectInput): Promise<StoredObject> {
    const target = this.resolveKey(input.key);
    const data = toBuffer(input.data);

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);

    return {
      contentType: input.contentType ?? null,
      key: input.key,
      size: data.byteLength
    };
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

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
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

export interface R2StorageProviderOptions {
  accessKeyId: string;
  bucket: string;
  client?: Pick<S3Client, "send">;
  endpoint: string;
  forcePathStyle: boolean;
  region: string;
  secretAccessKey: string;
}

export class R2StorageProvider implements StorageProvider {
  private readonly bucket: string;
  private readonly client: Pick<S3Client, "send">;

  constructor(options: R2StorageProviderOptions) {
    this.bucket = options.bucket;
    this.client =
      options.client ??
      new S3Client({
        credentials: {
          accessKeyId: options.accessKeyId,
          secretAccessKey: options.secretAccessKey
        },
        endpoint: options.endpoint,
        forcePathStyle: options.forcePathStyle,
        region: options.region
      } satisfies S3ClientConfig);
  }

  async upload(input: StorageObjectInput): Promise<StoredObject> {
    const data = toBuffer(input.data);

    await this.client.send(
      new PutObjectCommand({
        Body: data,
        Bucket: this.bucket,
        ContentType: input.contentType,
        Key: input.key
      })
    );

    return {
      contentType: input.contentType ?? null,
      key: input.key,
      size: data.byteLength
    };
  }

  async download(key: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key
      })
    );

    if (!result.Body) {
      throw new StorageAccessError("Stored object has no body.");
    }

    return bodyToBuffer(result.Body);
  }

  async getSignedUrl(input: SignedUrlInput): Promise<string> {
    return getSignedUrl(
      this.client as S3Client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: input.key
      }),
      {
        expiresIn: input.expiresInSeconds
      }
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key
      })
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key
        })
      );
      return true;
    } catch (error: unknown) {
      if (isObjectNotFoundError(error)) {
        return false;
      }

      throw error;
    }
  }
}

export function buildEvidenceObjectKey(input: {
  evidenceId: string;
  filename: string;
  organizationId: string;
  projectId: string | null;
}): string {
  return [
    "organizations",
    sanitizeObjectKeySegment(input.organizationId),
    "projects",
    sanitizeObjectKeySegment(input.projectId ?? "unassigned"),
    "evidence",
    sanitizeObjectKeySegment(input.evidenceId),
    sanitizeFilename(input.filename)
  ].join("/");
}

export function buildProjectReportObjectKey(input: {
  organizationId: string;
  projectId: string;
  reportId: string;
}): string {
  return [
    "organizations",
    sanitizeObjectKeySegment(input.organizationId),
    "projects",
    sanitizeObjectKeySegment(input.projectId),
    "reports",
    `${sanitizeObjectKeySegment(input.reportId)}.pdf`
  ].join("/");
}

export function sanitizeFilename(filename: string): string {
  const sanitized = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");

  return sanitized.length > 0 ? sanitized : "file";
}

function sanitizeObjectKeySegment(segment: string): string {
  const sanitized = segment.replace(/[^a-zA-Z0-9._-]/g, "_");

  return sanitized.length > 0 ? sanitized : "unknown";
}

function requiredR2Value(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required when STORAGE_PROVIDER=r2.`);
  }

  return value;
}

function toBuffer(data: Buffer | string): Buffer {
  return Buffer.isBuffer(data) ? data : Buffer.from(data);
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (body instanceof Readable) {
    const chunks: Buffer[] = [];

    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "transformToByteArray" in body &&
    typeof body.transformToByteArray === "function"
  ) {
    return Buffer.from(await body.transformToByteArray());
  }

  throw new StorageAccessError("Stored object body is not readable.");
}

function isObjectNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    ("$metadata" in error || "name" in error) &&
    ((hasStatusCode(error) && error.$metadata.httpStatusCode === 404) ||
      (hasName(error) && ["NoSuchKey", "NotFound", "NotFoundError"].includes(error.name)))
  );
}

function hasStatusCode(error: object): error is { $metadata: { httpStatusCode: number } } {
  return (
    "$metadata" in error &&
    typeof error.$metadata === "object" &&
    error.$metadata !== null &&
    "httpStatusCode" in error.$metadata &&
    typeof error.$metadata.httpStatusCode === "number"
  );
}

function hasName(error: object): error is { name: string } {
  return "name" in error && typeof error.name === "string";
}

function encodeStorageKey(key: string): string {
  return Buffer.from(key, "utf8").toString("base64url");
}

function decodeStorageKey(token: string): string {
  return Buffer.from(token, "base64url").toString("utf8");
}
