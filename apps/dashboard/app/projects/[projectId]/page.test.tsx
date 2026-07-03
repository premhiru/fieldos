import { render, screen } from "@testing-library/react";
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
            status: "ACTIVE"
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

    return {
      data: {
        actionItems: [
          {
            description: "Rectify the failed lobby light.",
            id: "action_item_1",
            confidence: 0.9,
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

describe("ProjectDetailPage AI sections", () => {
  it("renders AI insights and pending Action Items", () => {
    render(React.createElement(ProjectDetailPage));

    expect(screen.getByRole("heading", { name: "AI Insights" })).toBeTruthy();
    expect(screen.getByText("A lobby light failed.")).toBeTruthy();
    expect(screen.getAllByText("High Confidence").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Action Items" })).toBeTruthy();
    expect(screen.getByText("Fix lobby light")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ignore" })).toBeTruthy();
  });
});
