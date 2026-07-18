import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createConfiguredVisionProvider,
  OpenAICompatibleVisionProvider
} from "./vision-provider.js";

describe("OpenAICompatibleVisionProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a multimodal request and parses structured vision output", async () => {
    const requests: RequestInit[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(init ?? {});
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  confidence: "0.68",
                  detectedObjects: ["Runway Light", "Cable"],
                  possibleIssues: ["Possible alignment issue. Needs Review."],
                  summary: "Runway lighting installation appears substantially complete.",
                  tags: ["runway light", "installation", "needs review"]
                })
              }
            }
          ]
        })
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAICompatibleVisionProvider({
      apiKey: "test-key",
      baseUrl: "https://vision.example.test",
      model: "vision-test"
    });
    const result = await provider.analyze({
      context: {
        conversationTitle: "Site updates",
        messageText: "Photos from today.",
        projectName: "Runway Works"
      },
      image: {
        base64: "aW1hZ2U=",
        filename: "site.jpg",
        mimeType: "image/jpeg"
      }
    });

    expect(result.tags).toContain("runway light");
    expect(result.confidence).toBe(0.68);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://vision.example.test/chat/completions",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(JSON.parse(String(requests[0]?.body)).model).toBe("vision-test");
  });

  it("falls back to OpenRouter vision when Kimi vision is unavailable", async () => {
    const urls: string[] = [];
    const onFallback = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);

        if (url.startsWith("https://api.moonshot.ai")) {
          return new Response(null, { status: 503 });
        }

        return {
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    confidence: 0.8,
                    detectedObjects: ["Equipment"],
                    possibleIssues: [],
                    summary: "Equipment is visible.",
                    tags: ["equipment"]
                  })
                }
              }
            ]
          }),
          ok: true
        } as Response;
      })
    );
    const provider = createConfiguredVisionProvider({
      fallbackApiKey: "openrouter-key",
      kimiApiKey: "kimi-key",
      onFallback
    });

    await expect(
      provider.analyze({
        context: {
          conversationTitle: "Site updates",
          messageText: null,
          projectName: "Runway Works"
        },
        image: {
          base64: "aW1hZ2U=",
          filename: "site.jpg",
          mimeType: "image/jpeg"
        }
      })
    ).resolves.toMatchObject({ summary: "Equipment is visible." });
    expect(urls).toEqual([
      "https://api.moonshot.ai/v1/chat/completions",
      "https://openrouter.ai/api/v1/chat/completions"
    ]);
    expect(onFallback).toHaveBeenCalledOnce();
  });
});
