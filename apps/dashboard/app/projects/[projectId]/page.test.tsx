import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import ProjectDetailPage from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ projectId: "project_1" }),
  usePathname: () => "/projects/project_1",
  useRouter: () => ({
    replace: vi.fn()
  })
}));

vi.mock("../../../lib/queries", () => ({
  useMe: () => ({ isError: false, isLoading: false })
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    isPending: false,
    mutate: vi.fn()
  }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "project") {
      return {
        data: {
          project: {
            code: "PRJ-001",
            id: "project_1",
            name: "Warehouse rollout",
            organizationId: "organization_1",
            status: "ACTIVE",
            timelineEvents: [
              {
                createdAt: "2026-07-03T00:00:00.000Z",
                description: "New inbound site update.",
                eventType: "MESSAGE_RECEIVED",
                id: "event_1",
                occurredAt: "2026-07-03T00:00:00.000Z",
                organizationId: "organization_1",
                projectId: "project_1",
                sourceId: "message_1",
                sourceType: "MESSAGE",
                title: "WhatsApp message received"
              }
            ],
            whatsAppMessages: [
              {
                attachments: [],
                body: "Terminal 2 runway lighting completed.",
                conversation: {
                  id: "conversation_1",
                  title: "Site team"
                },
                conversationId: "conversation_1",
                createdAt: "2026-07-03T00:00:00.000Z",
                direction: "INBOUND",
                externalMessageId: "wa_message_1",
                id: "message_1",
                occurredAt: "2026-07-03T00:00:00.000Z",
                processingStatus: "AI_COMPLETE",
                senderParticipant: {
                  conversationId: "conversation_1",
                  createdAt: "2026-07-03T00:00:00.000Z",
                  displayName: "Site Lead",
                  externalIdentifier: "site-lead",
                  id: "participant_1",
                  role: "contact"
                },
                senderParticipantId: "participant_1",
                type: "TEXT"
              }
            ]
          }
        },
        isError: false,
        isLoading: false
      };
    }

    if (queryKey[0] === "project-ai-classifications") {
      return {
        data: {
          classifications: [
            {
              category: "DEFECT",
              actionRequired: true,
              confidence: 0.9,
              id: "classification_1",
              location: "Lobby",
              summary: "A lobby light failed."
            }
          ]
        },
        isLoading: false
      };
    }

    if (queryKey[0] === "project-state") {
      return {
        data: {
          state: {
            completionPercent: 62,
            health: "CRITICAL",
            healthReason: "A safety-related update requires immediate review.",
            lastActivityAt: "2026-07-03T00:00:00.000Z",
            nextMilestone: "Electrical inspection",
            pendingDecisionSummary: "Confirm who will isolate the affected circuit.",
            recentBlockerSummary: "Exposed uncapped electrical wires require verification.",
            recentProgressSummary: "Interior renovation is in progress.",
            recentRiskSummary: "Schedule an electrical safety inspection."
          }
        },
        isLoading: false
      };
    }

    return {
      data: {
        actionItems: [
          {
            description: "Rectify the failed lobby light.",
            id: "action_item_1",
            classificationId: "classification_1",
            confidence: 0.9,
            assignedToUserId: null,
            messageId: "message_1",
            organizationId: "organization_1",
            projectId: "project_1",
            priority: "HIGH",
            suggestedProjectId: null,
            message: {
              body: "Lobby light failed.",
              conversation: {
                id: "conversation_1",
                title: "Site team"
              }
            },
            status: "PENDING",
            suggestedProject: null,
            title: "Fix lobby light",
            type: "FOLLOW_UP"
          }
        ]
      },
      isLoading: false
    };
  },
  useQueryClient: () => ({
    invalidateQueries: vi.fn()
  })
}));

describe("ProjectDetailPage", () => {
  it("renders the simplified project command center", () => {
    window.localStorage.clear();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(React.createElement(ProjectDetailPage));

    expect(screen.getByRole("heading", { name: "Project Brief" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Recommended Actions" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "What's Changed" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Quick Links" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Timeline/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Evidence/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Milestones/ })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Reports/ }).length).toBeGreaterThan(0);
    expect(screen.getByText("Fix lobby light")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ignore" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: /Assignee for Fix lobby light/ })).toBeTruthy();

    const viewIssueButton = screen.getByRole("button", { name: "View issue" });
    expect(viewIssueButton.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen.queryByText("Exposed uncapped electrical wires require verification.")
    ).toBeNull();

    fireEvent.click(viewIssueButton);

    expect(screen.getByRole("heading", { name: "What needs attention" })).toBeTruthy();
    expect(
      screen.getByText("Exposed uncapped electrical wires require verification.")
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review evidence" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide issue" }).getAttribute("aria-expanded")).toBe(
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "Dismiss warning" }));

    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.queryByRole("heading", { name: "What needs attention" })).toBeNull();
    expect(screen.getByText("Warning dismissed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restore" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));

    expect(screen.getByRole("button", { name: "View issue" })).toBeTruthy();
  }, 15_000);
});
