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
                  analysisStatus: "NO_OPERATIONAL_CONCLUSION",
                  claimedContext: "Installation is complete.",
                  claimSupport: "UNABLE_TO_DETERMINE",
                  detectedObjects: ["Runway Light", "Cable"],
                  limitations: ["Testing and hidden wiring cannot be determined."],
                  overallConfidence: "HIGH",
                  possibleIssues: [
                    {
                      basis: "The fitting appears angled relative to the visible cable route.",
                      confidence: 0.55,
                      issue: "Possible alignment concern",
                      requiresHumanReview: true
                    }
                  ],
                  progressEvidence: {
                    reason: "One image cannot establish installation completion or testing.",
                    scope: null,
                    usable: false
                  },
                  safetySignal: { present: false, reason: null, severity: null },
                  summary: "A runway light fitting and cable are visible.",
                  tags: ["runway light", "cable", "needs review"],
                  visibleObservations: [
                    {
                      confidence: 0.9,
                      observation: "A runway light fitting and cable are visible."
                    }
                  ]
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
    expect(result.overallConfidence).toBe(0.9);
    expect(result.analysisStatus).toBe("NO_OPERATIONAL_CONCLUSION");
    expect(result.progressEvidence.usable).toBe(false);
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
                    analysisStatus: "NO_OPERATIONAL_CONCLUSION",
                    claimedContext: null,
                    claimSupport: "UNABLE_TO_DETERMINE",
                    detectedObjects: ["Equipment"],
                    limitations: ["Asset condition and operation cannot be determined."],
                    overallConfidence: 0.8,
                    possibleIssues: [],
                    progressEvidence: {
                      reason: "No project scope is visibly established.",
                      scope: null,
                      usable: false
                    },
                    safetySignal: { present: false, reason: null, severity: null },
                    summary: "Equipment is visible.",
                    tags: ["equipment"],
                    visibleObservations: [
                      { confidence: 0.8, observation: "A piece of equipment is visible." }
                    ]
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

  it("makes one bounded repair attempt for structurally invalid output", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify(
                    calls === 1
                      ? { summary: "A cabinet is visible." }
                      : {
                          analysisStatus: "NO_OPERATIONAL_CONCLUSION",
                          claimedContext: null,
                          claimSupport: "UNABLE_TO_DETERMINE",
                          detectedObjects: ["Electrical Cabinet", "Cable"],
                          limitations: [
                            "Testing, hidden wiring, and compliance cannot be assessed."
                          ],
                          overallConfidence: 0.72,
                          possibleIssues: [],
                          progressEvidence: {
                            reason:
                              "The image has no identified work scope or before/after context.",
                            scope: null,
                            usable: false
                          },
                          safetySignal: { present: false, reason: null, severity: null },
                          summary: "A cabinet and loose cables are visible.",
                          tags: ["electrical cabinet", "cable"],
                          visibleObservations: [
                            {
                              confidence: 0.84,
                              observation: "Loose cables are visible near a cabinet."
                            }
                          ]
                        }
                  )
                }
              }
            ]
          })
        } as Response;
      })
    );
    const provider = new OpenAICompatibleVisionProvider({
      apiKey: "test-key",
      baseUrl: "https://vision.example.test",
      model: "vision-test"
    });

    const result = await provider.analyze({
      context: { conversationTitle: null, messageText: null, projectName: null },
      image: { base64: "aW1hZ2U=", filename: "cabinet.jpg", mimeType: "image/jpeg" }
    });

    expect(calls).toBe(2);
    expect(result.analysisStatus).toBe("NO_OPERATIONAL_CONCLUSION");
    expect(result.progressEvidence.usable).toBe(false);
  });
});
