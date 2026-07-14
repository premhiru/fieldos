import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../lib/api";
import { MilestoneSection } from "./milestone-section";

describe("MilestoneSection", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows milestone state and evidence-backed recommendations", async () => {
    vi.spyOn(api, "listProjectMilestones").mockResolvedValue({
      milestones: [
        {
          actualEndDate: "2026-07-13T00:00:00.000Z",
          actualStartDate: null,
          createdAt: "2026-07-13T00:00:00.000Z",
          createdByUserId: null,
          description: null,
          id: "milestone-1",
          organizationId: "org-1",
          plannedEndDate: "2026-07-13T00:00:00.000Z",
          plannedStartDate: null,
          priority: "HIGH",
          projectId: "project-1",
          source: "AI_RECOMMENDATION",
          sourceMessageId: "message-1",
          sourceRecommendationId: "recommendation-1",
          status: "COMPLETED",
          title: "Foundation Pour",
          updatedAt: "2026-07-13T00:00:00.000Z"
        }
      ]
    });
    vi.spyOn(api, "listMilestoneRecommendations").mockResolvedValue({
      recommendations: [
        {
          confidence: "HIGH",
          evidence: {
            attachments: [],
            conversationId: "conversation-1",
            messageBody: "We finished the foundation pour today.",
            messageId: "message-1",
            occurredAt: "2026-07-13T08:00:00.000Z",
            sender: "Site Supervisor",
            timelineEvent: null,
            voiceTranscript: null
          },
          id: "recommendation-1",
          proposedActionPayload: {
            actualEndDate: "2026-07-13",
            milestoneTitle: "Foundation Pour",
            originalDatePhrase: "today",
            proposedStatus: "COMPLETED"
          },
          proposedActionType: "COMPLETE_MILESTONE",
          reason: "The field update explicitly reports completion.",
          title: "Complete milestone: Foundation Pour"
        }
      ] as never
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <MilestoneSection projectId="project-1" projectState={undefined} />
      </QueryClientProvider>
    );

    expect(await screen.findAllByText("Foundation Pour")).toHaveLength(2);
    expect(screen.getByText("AI Milestone Recommendations")).toBeTruthy();
    expect(screen.getByText(/We finished the foundation pour today\./)).toBeTruthy();
    expect(screen.getByText("High Confidence")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Review evidence" })).toBeTruthy();
  });
});
