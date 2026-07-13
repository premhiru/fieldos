import { render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import InvitationPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() })
}));

vi.mock("../../lib/queries", () => ({
  useMe: () => ({ data: undefined, isError: true, isLoading: false })
}));

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useMutation: () => ({ isPending: false, mutate: vi.fn() }),
    useQuery: ({ enabled }: { enabled: boolean }) =>
      enabled
        ? {
            data: {
              invitation: {
                email: "invitee@example.com",
                expiresAt: new Date(Date.now() + 60_000).toISOString(),
                organization: { id: "organization_1", name: "Acme Field Ops" },
                projects: [{ id: "project_1", name: "Terminal Upgrade" }],
                role: "MEMBER",
                status: "PENDING"
              }
            },
            isError: false,
            isLoading: false
          }
        : { data: undefined, isError: false, isLoading: true },
    useQueryClient: () => ({ invalidateQueries: vi.fn() })
  };
});

describe("InvitationPage", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/invite#token=valid-invitation-token-that-is-long-enough");
  });

  it("shows invitation details and authentication choices", async () => {
    render(React.createElement(InvitationPage));

    await waitFor(() => expect(screen.getByText("Acme Field Ops")).toBeTruthy());
    expect(screen.getByText("invitee@example.com")).toBeTruthy();
    expect(screen.getByText("Terminal Upgrade")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create account" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Log in" })).toBeTruthy();
  });
});
