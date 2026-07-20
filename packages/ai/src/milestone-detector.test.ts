import { describe, expect, it } from "vitest";

import { MilestoneDetector } from "./milestone-detector.js";
import type { AIProvider } from "./types.js";

describe("MilestoneDetector", () => {
  it("uses strict structured output and includes evidence-based date context", async () => {
    const provider = new MilestoneProvider();
    const detector = new MilestoneDetector({ provider });

    const changes = await detector.detectMilestones({
      existingMilestones: [
        {
          id: "milestone-1",
          plannedEndDate: "2026-07-13",
          plannedStartDate: null,
          status: "IN_PROGRESS",
          title: "Foundation Pour"
        }
      ],
      messageText: "We finished foundation pour today.",
      occurredAt: new Date("2026-07-13T08:00:00.000Z"),
      project: {
        id: "project-1",
        name: "Terminal 2",
        timezone: "Asia/Singapore"
      },
      projectState: {
        nextMilestone: "Foundation Pour",
        pendingDecisionSummary: null,
        recentProgressSummary: "Foundation work is in progress."
      },
      recentTimelineEvents: [
        {
          description: "Concrete placement began.",
          occurredAt: new Date("2026-07-12T08:00:00.000Z"),
          title: "Foundation work started"
        }
      ],
      relativeDateHints: { today: "2026-07-13" },
      sender: "Site Supervisor",
      voiceTranscript: null
    });

    expect(changes).toEqual([
      expect.objectContaining({
        action: "COMPLETE",
        actualEndDate: "2026-07-13",
        milestoneTitle: "Foundation Pour"
      })
    ]);
    expect(provider.model).toBe("openrouter/free");
    expect(provider.userPrompt).toContain('"timezone": "Asia/Singapore"');
    expect(provider.userPrompt).toContain('"today": "2026-07-13"');
    expect(provider.userPrompt).toContain("Foundation work started");
    expect(provider.systemPrompt).toContain("Never invent a date or milestone name");
  });

  it("allows NONE to abstain without inventing a milestone title", async () => {
    const detector = new MilestoneDetector({
      provider: {
        completeJson: async () => ({
          changes: [
            {
              action: "NONE",
              actualEndDate: null,
              actualStartDate: null,
              confidence: "LOW",
              description: null,
              hasMilestoneChange: false,
              milestoneTitle: null,
              originalDatePhrase: null,
              plannedEndDate: null,
              plannedStartDate: null,
              reason: "The message does not identify milestone scope.",
              status: null
            }
          ]
        })
      }
    });

    await expect(
      detector.detectMilestones({
        existingMilestones: [],
        messageText: "Done",
        occurredAt: new Date("2026-07-18T00:00:00.000Z"),
        project: { id: "project-1", name: "Terminal", timezone: "UTC" },
        projectState: null,
        recentTimelineEvents: [],
        relativeDateHints: {},
        sender: "Supervisor",
        voiceTranscript: null
      })
    ).resolves.toEqual([]);
  });
});

class MilestoneProvider implements AIProvider {
  model = "";
  systemPrompt = "";
  userPrompt = "";

  async completeJson(input: Parameters<AIProvider["completeJson"]>[0]): Promise<unknown> {
    this.model = input.model;
    this.systemPrompt = input.messages.find((message) => message.role === "system")?.content ?? "";
    this.userPrompt = input.messages.find((message) => message.role === "user")?.content ?? "";
    return {
      changes: [
        {
          action: "COMPLETE",
          actualEndDate: "2026-07-13",
          actualStartDate: null,
          confidence: "HIGH",
          description: null,
          hasMilestoneChange: true,
          milestoneTitle: "Foundation Pour",
          originalDatePhrase: "today",
          plannedEndDate: null,
          plannedStartDate: null,
          reason: "The update explicitly says the foundation pour was finished.",
          status: "COMPLETED"
        }
      ]
    };
  }
}
