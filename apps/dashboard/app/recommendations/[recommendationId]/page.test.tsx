import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import RecommendationDetailPage from "./page";

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
              confidence: "HIGH",
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
        data: {
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
        },
        isError: false,
        isLoading: false
      };
    },
    useQueryClient: () => ({ invalidateQueries: vi.fn() })
  };
});

describe("RecommendationDetailPage", () => {
  it("expands message evidence by default for a pending recommendation", async () => {
    render(React.createElement(RecommendationDetailPage));

    await waitFor(() => {
      expect(screen.getByText("Standing water is blocking the east gate.")).toBeTruthy();
    });
    expect(screen.getByText(/Jordan Lee in Site Team/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Source Evidence" }));
    expect(screen.queryByText("Standing water is blocking the east gate.")).toBeNull();
  });
});
