import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildEvidenceObjectKey,
  buildProjectReportObjectKey,
  createStorageProvider,
  LocalStorageProvider,
  R2StorageProvider,
  storageEnvironmentSchema
} from "./storage.js";

describe("LocalStorageProvider", () => {
  it("generates expiring signed URLs and verifies them", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "fieldos-storage-"));
    const provider = new LocalStorageProvider({
      rootPath,
      signingSecret: "test-storage-secret"
    });

    try {
      await writeFile(path.join(rootPath, "photo.jpg"), "image");
      const signedUrl = await provider.getSignedUrl({
        baseUrl: "https://api.example.test",
        expiresInSeconds: 60,
        key: "photo.jpg"
      });
      const url = new URL(signedUrl);
      const key = provider.verifySignedToken({
        expires: Number(url.searchParams.get("expires")),
        signature: url.searchParams.get("signature") ?? "",
        token: url.pathname.split("/").at(-1) ?? ""
      });

      expect(key).toBe("photo.jpg");
      await expect(provider.download(key)).resolves.toEqual(Buffer.from("image"));
      await expect(provider.exists(key)).resolves.toBe(true);
    } finally {
      await rm(rootPath, { force: true, recursive: true });
    }
  });
});

describe("R2 storage configuration", () => {
  it("fails fast when R2 is selected without required environment variables", () => {
    const parsed = storageEnvironmentSchema.safeParse({
      STORAGE_PROVIDER: "r2"
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining([
        "R2_ACCESS_KEY_ID",
        "R2_ACCOUNT_ID",
        "R2_BUCKET",
        "R2_ENDPOINT",
        "R2_SECRET_ACCESS_KEY"
      ])
    );
  });

  it("creates local storage when STORAGE_PROVIDER is local", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "fieldos-storage-"));
    const provider = createStorageProvider({
      local: {
        rootPath,
        signingSecret: "test-storage-secret"
      },
      storage: storageEnvironmentSchema.parse({
        STORAGE_PROVIDER: "local"
      })
    });

    try {
      await provider.upload({
        contentType: "text/plain",
        data: "hello",
        key: "dev/hello.txt"
      });

      await expect(provider.download("dev/hello.txt")).resolves.toEqual(Buffer.from("hello"));
    } finally {
      await rm(rootPath, { force: true, recursive: true });
    }
  });

  it("generates R2 signed URLs without exposing a local media path", async () => {
    const provider = new R2StorageProvider({
      accessKeyId: "test-access-key",
      bucket: "fieldos-test",
      endpoint: "https://example-account.r2.cloudflarestorage.com",
      forcePathStyle: true,
      region: "auto",
      secretAccessKey: "test-secret-key"
    });

    const signedUrl = await provider.getSignedUrl({
      baseUrl: "https://api.fieldos.test",
      expiresInSeconds: 900,
      key: "organizations/org/projects/project/reports/report.pdf"
    });
    const url = new URL(signedUrl);

    expect(url.hostname).toBe("example-account.r2.cloudflarestorage.com");
    expect(url.pathname).toContain(
      "/fieldos-test/organizations/org/projects/project/reports/report.pdf"
    );
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(signedUrl).not.toContain("/media/");
  });

  it("uploads, downloads, checks, and deletes R2 objects through the S3 client", async () => {
    const client = new MockS3Client();
    const provider = new R2StorageProvider({
      accessKeyId: "test-access-key",
      bucket: "fieldos-test",
      client,
      endpoint: "https://example-account.r2.cloudflarestorage.com",
      forcePathStyle: true,
      region: "auto",
      secretAccessKey: "test-secret-key"
    });

    const stored = await provider.upload({
      contentType: "image/jpeg",
      data: Buffer.from("photo"),
      key: "organizations/org/projects/project/evidence/evidence/photo.jpg"
    });

    expect(stored).toEqual({
      contentType: "image/jpeg",
      key: "organizations/org/projects/project/evidence/evidence/photo.jpg",
      size: 5
    });
    await expect(provider.exists(stored.key)).resolves.toBe(true);
    await expect(provider.download(stored.key)).resolves.toEqual(Buffer.from("photo"));

    await provider.delete(stored.key);
    await expect(provider.exists(stored.key)).resolves.toBe(false);
  });
});

describe("object key helpers", () => {
  it("builds safe namespaced keys for evidence and reports", () => {
    expect(
      buildEvidenceObjectKey({
        evidenceId: "evidence/1",
        filename: "../bad site photo (1).jpg",
        organizationId: "org_1",
        projectId: "project_1"
      })
    ).toBe("organizations/org_1/projects/project_1/evidence/evidence_1/bad_site_photo__1_.jpg");

    expect(
      buildProjectReportObjectKey({
        organizationId: "org_1",
        projectId: "project_1",
        reportId: "report/1"
      })
    ).toBe("organizations/org_1/projects/project_1/reports/report_1.pdf");
  });
});

class MockS3Client {
  private readonly objects = new Map<string, Buffer>();

  async send(command: { constructor: { name: string }; input?: Record<string, unknown> }) {
    const input = command.input ?? {};
    const key = String(input.Key);

    if (command.constructor.name === "PutObjectCommand") {
      this.objects.set(key, Buffer.from(input.Body as Buffer));
      return {};
    }

    if (command.constructor.name === "GetObjectCommand") {
      const object = this.objects.get(key);

      if (!object) {
        throw notFoundError();
      }

      return {
        Body: object
      };
    }

    if (command.constructor.name === "HeadObjectCommand") {
      if (!this.objects.has(key)) {
        throw notFoundError();
      }

      return {};
    }

    if (command.constructor.name === "DeleteObjectCommand") {
      this.objects.delete(key);
      return {};
    }

    throw new Error(`Unexpected S3 command ${command.constructor.name}.`);
  }
}

function notFoundError(): Error & { $metadata: { httpStatusCode: number }; name: string } {
  const error = new Error("Not found") as Error & {
    $metadata: { httpStatusCode: number };
    name: string;
  };
  error.name = "NoSuchKey";
  error.$metadata = { httpStatusCode: 404 };
  return error;
}
