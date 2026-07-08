import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { LocalStorageProvider } from "./storage.js";

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
    } finally {
      await rm(rootPath, { force: true, recursive: true });
    }
  });
});
