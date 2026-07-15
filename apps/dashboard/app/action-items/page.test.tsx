import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import type { ActionItem } from "../../lib/api";

import ActionItemsPage from "./page";

const now = new Date();
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

const assignedItem = actionItem({
  assignedToUserId: "user-1",
  createdAt: daysAgo(1),
  id: "assigned-1",
  title: "Confirm inspection"
});
const overdueItem = actionItem({
  createdAt: daysAgo(10),
  id: "overdue-1",
  title: "Review delayed works"
});
const completedItem = actionItem({
  completedAt: daysAgo(2),
  createdAt: daysAgo(12),
  id: "completed-1",
  status: "COMPLETED",
  title: "Upload progress photos",
  updatedAt: daysAgo(2)
});

vi.mock("../../components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children)
}));

vi.mock("../../components/auth-guard", () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children)
}));

vi.mock("../../lib/queries", () => ({
  useMe: () => ({ data: { user: { id: "user-1" } } }),
  useOperationsDashboard: () => ({
    data: {
      dashboard: {
        actionItems: {
          completed: [completedItem],
          high: [],
          low: [],
          medium: [assignedItem, overdueItem],
          urgent: []
        }
      }
    },
    isLoading: false
  }),
  useOrganizations: () => ({
    data: {
      organizations: [{ id: "organization-1", name: "FieldOS", role: "OWNER", slug: "fieldos" }]
    },
    isLoading: false
  })
}));

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useMutation: () => ({ isPending: false, mutate: vi.fn() }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() })
  };
});

describe("ActionItemsPage", () => {
  it("shows tab counts and wires overdue and completed views", () => {
    render(React.createElement(ActionItemsPage));

    expect(screen.getByRole("tab", { name: /Assigned to me/ }).textContent).toContain("1");
    expect(screen.getByRole("tab", { name: /Overdue/ }).textContent).toContain("1");
    expect(screen.getByRole("tab", { name: /Completed/ }).textContent).toContain("1");

    const overdueTab = screen.getByRole("tab", { name: /Overdue/ });
    expect(overdueTab.querySelector("span:last-child")?.className).toContain(
      "text-[var(--status-critical-text)]"
    );

    fireEvent.click(overdueTab);
    expect(screen.getByText("Review delayed works")).toBeTruthy();
    expect(screen.getByText(/days overdue/)).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /Completed/ }));
    expect(screen.getByText("Upload progress photos").className).toContain("line-through");
    expect(screen.getByText("Completed 2 days ago")).toBeTruthy();
  });
});

function actionItem(overrides: Partial<ActionItem>): ActionItem {
  return {
    acceptedAt: null,
    acceptedByUserId: null,
    assignedToUserId: null,
    classificationId: null,
    completedAt: null,
    confidence: null,
    createdAt: daysAgo(1),
    description: null,
    id: "action-item",
    ignoredAt: null,
    ignoredByUserId: null,
    messageId: "message-1",
    organizationId: "organization-1",
    priority: "MEDIUM",
    project: { code: "PROJECT", id: "project-1", name: "Project One" },
    projectId: "project-1",
    status: "PENDING",
    suggestedProjectId: null,
    title: "Action Item",
    type: "FOLLOW_UP",
    updatedAt: daysAgo(1),
    ...overrides
  };
}
