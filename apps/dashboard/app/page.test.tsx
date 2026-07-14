import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import DashboardPage from "./page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    replace: vi.fn()
  })
}));

vi.mock("../lib/queries", () => ({
  useMe: () => ({ isError: false, isLoading: false }),
  useOrganizations: () => ({
    data: {
      organizations: []
    },
    isLoading: false
  }),
  useOperationsDashboard: () => ({
    data: undefined,
    isError: false,
    isLoading: false
  }),
  useProjects: () => ({
    data: {
      projects: []
    },
    isLoading: false
  })
}));

vi.mock("../components/organization-onboarding", () => ({
  OrganizationOnboarding: () => React.createElement("div", null, "Create your first organization")
}));

describe("DashboardPage", () => {
  it("renders the dashboard onboarding state", () => {
    const queryClient = new QueryClient();

    render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(DashboardPage)
      )
    );

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeTruthy();
    expect(screen.getByText("Create your first organization")).toBeTruthy();
  });
});
