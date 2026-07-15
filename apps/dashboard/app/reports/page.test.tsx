import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import ReportsPage from "./page";

const { generateProjectReport, pendingReports } = vi.hoisted(() => ({
  generateProjectReport: vi.fn(),
  pendingReports: new Map<string, (value: unknown) => void>()
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
      projects: [
        { code: "TERMINAL-2", id: "project-1", name: "Terminal 2" },
        { code: "RUNWAY-4", id: "project-2", name: "Runway 4" }
      ]
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

describe("ReportsPage", () => {
  it("shows recent reports and keeps report generation state independent per card", async () => {
    generateProjectReport.mockImplementation(
      (projectId: string) =>
        new Promise((resolve) => {
          pendingReports.set(projectId, resolve);
        })
    );
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
    });

    render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(ReportsPage)
      )
    );

    expect(screen.getByRole("heading", { name: "Recent Reports" })).toBeTruthy();
    expect(screen.getByText("Morning Brief")).toBeTruthy();
    expect(screen.getAllByText("Terminal 2").length).toBeGreaterThan(0);
    expect(screen.getByText("Generated 2 hours ago")).toBeTruthy();

    const generateButtons = screen.getAllByRole("button", { name: "Generate Report" });
    fireEvent.click(generateButtons[0]!);

    await waitFor(() => {
      expect(generateProjectReport).toHaveBeenCalledWith("project-1", "MORNING_BRIEF");
      expect(screen.getAllByRole("button", { name: "Generating..." })).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: "Generate Report" })).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate Report" }));
    await waitFor(() => {
      expect(generateProjectReport).toHaveBeenCalledWith("project-2", "MORNING_BRIEF");
      expect(screen.getAllByRole("button", { name: "Generating..." })).toHaveLength(2);
    });

    await act(async () => {
      pendingReports.get("project-1")?.({ report: { id: "report-1" } });
    });
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Report queued" })).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: "Generating..." })).toHaveLength(1);
    });

    await act(async () => {
      pendingReports.get("project-2")?.({ report: { id: "report-2" } });
    });
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Report queued" })).toHaveLength(2);
    });
  });
});
