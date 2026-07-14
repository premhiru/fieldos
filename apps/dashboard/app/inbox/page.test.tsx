import { render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import InboxPage from "./page";

vi.mock("../../components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children)
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/inbox",
  useRouter: () => ({
    replace: vi.fn()
  })
}));

vi.mock("../../lib/queries", () => ({
  useConversations: () => ({
    data: {
      conversations: [
        {
          channel: "EMAIL",
          id: "conversation_1",
          isGroup: false,
          lastMessageAt: "2026-06-30T00:00:00.000Z",
          lastMessageBody: "Crew is on site.",
          project: {
            id: "project_1",
            name: "Warehouse rollout"
          },
          title: "Site check-in",
          updatedAt: "2026-06-30T00:00:00.000Z"
        }
      ]
    },
    isLoading: false
  }),
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
  })
}));

describe("InboxPage", () => {
  it("renders the conversation list", () => {
    render(React.createElement(InboxPage));

    expect(screen.getByRole("heading", { name: "Inbox" })).toBeTruthy();
    expect(screen.getByText("Site check-in")).toBeTruthy();
    expect(screen.getByText("Crew is on site.")).toBeTruthy();
  });
});
