import { access, readFile } from "node:fs/promises";
import path from "node:path";

interface VoiceTranscriberOptions {
  apiKey?: string;
  model: string;
  storageRootPath: string;
}

export class VoiceTranscriptionConfigurationError extends Error {
  constructor(message = "Voice transcription is not configured.") {
    super(message);
    this.name = "VoiceTranscriptionConfigurationError";
  }
}

export class VoiceTranscriptionService {
  private readonly storageRootPath: string;

  constructor(private readonly options: VoiceTranscriberOptions) {
    this.storageRootPath = path.resolve(options.storageRootPath);
  }

  async transcribe(input: {
    filename: string;
    mimeType: string;
    storageKey: string;
  }): Promise<string> {
    if (!this.options.apiKey) {
      throw new VoiceTranscriptionConfigurationError();
    }

    const mediaPath = this.resolveStoragePath(input.storageKey);
    await access(mediaPath);
    const buffer = await readFile(mediaPath);
    const formData = new FormData();
    formData.set("model", this.options.model);
    formData.set("file", new Blob([buffer], { type: input.mimeType }), input.filename);

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      body: formData,
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`
      },
      method: "POST"
    });

    if (!response.ok) {
      throw new Error(`Voice transcription failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as unknown;

    if (!isTranscriptionResponse(payload)) {
      throw new Error("Voice transcription returned an invalid response.");
    }

    return payload.text.trim();
  }

  private resolveStoragePath(storageKey: string): string {
    const mediaPath = path.resolve(this.storageRootPath, storageKey);
    const relative = path.relative(this.storageRootPath, mediaPath);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Attachment storage key resolves outside the configured media root.");
    }

    return mediaPath;
  }
}

function isTranscriptionResponse(payload: unknown): payload is { text: string } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "text" in payload &&
    typeof payload.text === "string"
  );
}
