import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import ReportsPage from "./page";

const { generateProjectReport } = vi.hoisted(() => ({
  generateProjectReport: vi.fn().mockResolvedValue({ report: { id: "report-new" } })
}));

vi.mock("../../components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children)
}));

vi.mock("../../components/auth-guard", () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children)
}));

vi.mock("../../lib/api", () => ({
  api: { generateProjectReport }
}));

vi.mock("../../lib/queries", () => ({
  useOrganizations: () => ({
    data: {
      organizations: [{ id: "organization-1", name: "FieldOS", role: "OWNER", slug: "fieldos" }]
    },
    isLoading: false
  }),
  useProjects: () => ({
    data: {
      projects: [{ code: "TERMINAL-2", id: "project-1", name: "Terminal 2" }]
    },
    isLoading: false
  }),
  useRecentReports: () => ({
    data: {
      reports: [
        {
          generatedAt: new Date(Date.now() - 2 * 60 * 60 * 1_000).toISOString(),
          id: "report-1",
          project: { code: "TERMINAL-2", id: "project-1", name: "Terminal 2" },
          projectId: "project-1",
          type: "MORNING_BRIEF",
          updatedAt: new Date().toISOString()
        }
      ]
    },
    isLoading: false
  })
}));

vi.mock("../../store/active-organization-store", () => ({
  useActiveOrganizationStore: () => ({
    activeOrganizationId: "organization-1",
    setActiveOrganizationId: vi.fn()
  })
}));

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useMutation: (options: { mutationFn: (projectId: string) => Promise<unknown> }) => ({
      isPending: false,
      mutate: (projectId: string) => void options.mutationFn(projectId),
      variables: undefined
    }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() })
  };
});

describe("ReportsPage", () => {
  it("shows recent reports and generates a Morning Brief from a project card", async () => {
    render(React.createElement(ReportsPage));

    expect(screen.getByRole("heading", { name: "Recent Reports" })).toBeTruthy();
    expect(screen.getByText("Morning Brief")).toBeTruthy();
    expect(screen.getAllByText("Terminal 2").length).toBeGreaterThan(0);
    expect(screen.getByText("Generated 2 hours ago")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Generate Report" }));

    await waitFor(() => {
      expect(generateProjectReport).toHaveBeenCalledWith("project-1", "MORNING_BRIEF");
    });
  });
});
