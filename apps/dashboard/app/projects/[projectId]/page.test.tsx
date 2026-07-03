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
              confidence: 0.9,
              id: "classification_1",
              location: "Lobby",
              priority: "HIGH",
              summary: "A lobby light failed."
            }
          ]
        },
        isLoading: false
      };
    }

    return {
      data: {
        suggestedTasks: [
          {
            description: "Rectify the failed lobby light.",
            id: "suggested_task_1",
            message: {
              body: "Lobby light failed.",
              conversation: {
                id: "conversation_1",
                title: "Site team"
              }
            },
            priority: "HIGH",
            status: "PENDING",
            title: "Fix lobby light"
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
  it("renders AI insights and pending suggested tasks", () => {
    render(React.createElement(ProjectDetailPage));

    expect(screen.getByRole("heading", { name: "AI Insights" })).toBeTruthy();
    expect(screen.getByText("A lobby light failed.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Suggested Tasks" })).toBeTruthy();
    expect(screen.getByText("Fix lobby light")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reject" })).toBeTruthy();
  });
});
