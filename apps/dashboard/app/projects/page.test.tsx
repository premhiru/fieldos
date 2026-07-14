import { render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import ProjectsPage from "./page";

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
  useProjects: () => ({
    data: {
      projects: []
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
  it("renders projects after auth is mocked", () => {
    render(React.createElement(ProjectsPage));

    expect(screen.getByRole("heading", { name: "Projects" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create Project" })).toBeTruthy();
    expect(screen.getByText("No projects yet.")).toBeTruthy();
  });
});
