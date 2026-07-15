import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import RecommendationDetailPage from "./page";

const { sourceEvidenceState } = vi.hoisted(() => ({
  sourceEvidenceState: {
    value: {
      context: {
        conversation: {
          channel: "WHATSAPP",
          id: "conversation-1",
          isGroup: true,
          title: "Site Team"
        },
        messageText: "Standing water is blocking the east gate.",
        sender: {
          displayName: "Jordan Lee",
          externalIdentifier: "jordan",
          id: "participant-1"
        },
        timestamp: "2026-07-15T02:00:00.000Z"
      },
      type: "MESSAGE"
    } as unknown
  }
}));

vi.mock("../../../components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children)
}));

vi.mock("../../../components/auth-guard", () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children)
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ recommendationId: "recommendation-1" })
}));

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useMutation: () => ({ isPending: false, mutate: vi.fn() }),
    useQuery: (options: { queryKey: unknown[] }) => {
      if (options.queryKey[0] === "recommendation") {
        return {
          data: {
            recommendation: {
              confidence: "MEDIUM",
              description: "Site access is blocked by standing water.",
              id: "recommendation-1",
              priority: "HIGH",
              project: { code: "TERMINAL-2", id: "project-1", name: "Terminal 2" },
              projectId: "project-1",
              proposedActionPayload: {},
              proposedActionType: "CREATE_ACTION_ITEM",
              reason: "The latest field message reports a safety issue.",
              sourceEntityId: "message-1",
              sourceEntityType: "MESSAGE",
              status: "PENDING",
              title: "Review site access",
              whatsAppDrafts: []
            }
          },
          isError: false,
          isLoading: false
        };
      }

      return {
        data: sourceEvidenceState.value,
        isError: false,
        isLoading: false
      };
    },
    useQueryClient: () => ({ invalidateQueries: vi.fn() })
  };
});

describe("RecommendationDetailPage", () => {
  it("expands message evidence by default for a pending recommendation", async () => {
    sourceEvidenceState.value = {
      context: {
        conversation: {
          channel: "WHATSAPP",
          id: "conversation-1",
          isGroup: true,
          title: "Site Team"
        },
        messageText: "Standing water is blocking the east gate.",
        sender: {
          displayName: "Jordan Lee",
          externalIdentifier: "jordan",
          id: "participant-1"
        },
        timestamp: "2026-07-15T02:00:00.000Z"
      },
      type: "MESSAGE"
    };
    render(React.createElement(RecommendationDetailPage));

    await waitFor(() => {
      expect(screen.getByText("Standing water is blocking the east gate.")).toBeTruthy();
    });
    expect(screen.getByText(/Jordan Lee in Site Team/)).toBeTruthy();

    const toggle = screen.getByRole("button", { name: "Source Evidence" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.querySelector("svg")?.classList.contains("transition-transform")).toBe(false);

    fireEvent.click(toggle);
    expect(screen.queryByText("Standing water is blocking the east gate.")).toBeNull();
    expect(toggle.querySelector("svg")?.classList.contains("transition-transform")).toBe(true);
  });

  it("maps numeric evidence confidence to the standard confidence badge", () => {
    sourceEvidenceState.value = {
      classification: {
        category: "SAFETY",
        confidence: 0.87,
        id: "classification-1",
        summary: "Site access is unsafe."
      },
      type: "AI_CLASSIFICATION"
    };

    render(React.createElement(RecommendationDetailPage));

    const badge = screen.getByText("High Confidence");
    expect(badge.className).toContain("status-healthy-text");
  });
});
