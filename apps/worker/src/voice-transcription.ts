import type { StorageProvider } from "@fieldos/shared";

interface VoiceTranscriberOptions {
  apiKey?: string;
  model: string;
  storageProvider: StorageProvider;
}

export class VoiceTranscriptionConfigurationError extends Error {
  constructor(message = "Voice transcription is not configured.") {
    super(message);
    this.name = "VoiceTranscriptionConfigurationError";
  }
}

export class VoiceTranscriptionService {
  constructor(private readonly options: VoiceTranscriberOptions) {}

  async transcribe(input: {
    filename: string;
    mimeType: string;
    storageKey: string;
  }): Promise<string> {
    if (!this.options.apiKey) {
      throw new VoiceTranscriptionConfigurationError();
    }

    const buffer = await this.options.storageProvider.download(input.storageKey);
    const fileData = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer;
    const formData = new FormData();
    formData.set("model", this.options.model);
    formData.set("file", new Blob([fileData], { type: input.mimeType }), input.filename);

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
}

function isTranscriptionResponse(payload: unknown): payload is { text: string } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "text" in payload &&
    typeof payload.text === "string"
  );
}
