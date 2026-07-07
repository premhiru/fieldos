import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenAICompatibleVisionProvider } from "./vision-provider.js";

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
                  confidence: 0.68,
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
    expect(fetchMock).toHaveBeenCalledWith(
      "https://vision.example.test/chat/completions",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(JSON.parse(String(requests[0]?.body)).model).toBe("vision-test");
  });
});
