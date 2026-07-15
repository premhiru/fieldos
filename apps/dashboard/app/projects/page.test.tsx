import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import ProjectsPage from "./page";

let projects: Array<Record<string, unknown>> = [];
let dashboardProjects: Array<Record<string, unknown>> = [];

vi.mock("../../components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children)
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects",
  useRouter: () => ({
    replace: vi.fn()
  })
}));

vi.mock("../../lib/queries", () => ({
  useMe: () => ({ isError: false, isLoading: false }),
  useOrganizations: () => ({
    data: {
      organizations: [
        {
          id: "organization_1",
          name: "Acme",
          role: "OWNER",
          slug: "acme"
        }
      ]
    },
    isLoading: false
  }),
  useOperationsDashboard: () => ({
    data: {
      dashboard: {
        projects: dashboardProjects
      }
    },
    isLoading: false
  }),
  useProjects: () => ({
    data: {
      projects
    },
    isLoading: false
  })
}));

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useMutation: () => ({
      isPending: false,
      mutate: vi.fn()
    }),
    useQueryClient: () => ({
      invalidateQueries: vi.fn()
    })
  };
});

describe("ProjectsPage", () => {
  it("renders the guided project empty state", () => {
    projects = [];
    dashboardProjects = [];
    render(React.createElement(ProjectsPage));

    expect(screen.getByRole("heading", { name: "Projects" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create Project" })).toBeTruthy();
    expect(screen.getByText("No projects yet")).toBeTruthy();
    expect(
      screen.getByText("Create your first project to start organizing field updates from WhatsApp.")
    ).toBeTruthy();
  });

  it("filters projects by operational health", () => {
    projects = [
      {
        code: "ACTIVE-1",
        id: "project-active",
        name: "Active Project",
        organizationId: "organization_1",
        status: "ACTIVE",
        updatedAt: "2026-07-14T00:00:00.000Z"
      },
      {
        code: "CRITICAL-1",
        id: "project-critical",
        name: "Critical Project",
        organizationId: "organization_1",
        status: "ACTIVE",
        updatedAt: "2026-07-14T00:00:00.000Z"
      }
    ];
    dashboardProjects = [
      {
        health: "HEALTHY",
        id: "project-active",
        lastActivityAt: "2026-07-14T00:00:00.000Z"
      },
      {
        health: "CRITICAL",
        id: "project-critical",
        lastActivityAt: "2026-07-13T00:00:00.000Z"
      }
    ];

    render(React.createElement(ProjectsPage));
    fireEvent.click(screen.getByRole("tab", { name: "Critical" }));

    expect(screen.getByText("Critical Project")).toBeTruthy();
    expect(screen.queryByText("Active Project")).toBeNull();
    expect(screen.getByText(/Last activity/)).toBeTruthy();
  });
});
