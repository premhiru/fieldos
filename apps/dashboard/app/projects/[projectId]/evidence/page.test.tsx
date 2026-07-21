import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProjectEvidencePage from "./page";

const mocks = vi.hoisted(() => ({
  deleteEvidence: vi.fn(),
  invalidateQueries: vi.fn(),
  removeQueries: vi.fn(),
  role: "OWNER" as "ADMIN" | "OWNER" | "VIEWER"
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ projectId: "project_1" }),
  usePathname: () => "/projects/project_1/evidence",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}));

vi.mock("../../../../lib/api", () => ({
  api: {
    deleteEvidence: mocks.deleteEvidence,
    listNotifications: vi.fn().mockResolvedValue({ notifications: [] }),
    markNotificationRead: vi.fn(),
    submitFeedback: vi.fn()
  }
}));

vi.mock("../../../../lib/queries", () => ({
  useMe: () => ({ isError: false, isLoading: false }),
  useOrganizations: () => ({
    data: {
      organizations: [
        {
          id: "organization_1",
          isDemo: false,
          name: "Acme Field Ops",
          role: mocks.role,
          slug: "acme"
        }
      ]
    }
  })
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: { mutationFn: () => Promise<void>; onSuccess: () => Promise<void> }) => ({
    isError: false,
    isPending: false,
    mutate: async () => {
      await options.mutationFn();
      await options.onSuccess();
    }
  }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "project") {
      return {
        data: {
          project: {
            code: "PRJ-001",
            id: "project_1",
            name: "Warehouse rollout",
            organizationId: "organization_1",
            status: "ACTIVE",
            whatsAppMessages: []
          }
        },
        isLoading: false
      };
    }

    if (queryKey[0] === "project-photo-analysis") {
      return {
        data: {
          analyses: [
            {
              confidence: 0.91,
              conversationId: "conversation_1",
              createdAt: "2026-07-21T00:00:00.000Z",
              detectedObjects: ["Cable tray"],
              evidence: {
                filename: "site-photo.jpg",
                mimeType: "image/jpeg",
                storageKey: "private-key"
              },
              evidenceId: "evidence_1",
              id: "analysis_1",
              message: {
                body: "Cable tray installation update.",
                conversation: { id: "conversation_1", title: "Site team" },
                id: "message_1",
                occurredAt: "2026-07-21T00:00:00.000Z"
              },
              messageId: "message_1",
              organizationId: "organization_1",
              possibleIssues: [],
              project: { code: "PRJ-001", id: "project_1", name: "Warehouse rollout" },
              projectId: "project_1",
              provider: "test",
              summary: "Cable tray installation is visible.",
              tags: []
            }
          ]
        },
        isLoading: false
      };
    }

    if (queryKey[0] === "evidence-view") {
      return {
        data: {
          evidence: {
            signedUrl: "https://example.test/site-photo.jpg"
          }
        }
      };
    }

    return { data: { classifications: [] }, isLoading: false };
  },
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
    removeQueries: mocks.removeQueries
  })
}));

describe("ProjectEvidencePage", () => {
  beforeEach(() => {
    mocks.role = "OWNER";
    mocks.deleteEvidence.mockReset().mockResolvedValue(undefined);
    mocks.invalidateQueries.mockReset().mockResolvedValue(undefined);
    mocks.removeQueries.mockReset();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("lets an owner permanently delete media after confirmation", async () => {
    render(React.createElement(ProjectEvidencePage));

    fireEvent.click(screen.getByRole("button", { name: "Delete site-photo.jpg" }));

    await waitFor(() => expect(mocks.deleteEvidence).toHaveBeenCalledWith("evidence_1"));
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("source message will remain")
    );
    expect(mocks.removeQueries).toHaveBeenCalledWith({
      queryKey: ["evidence-view", "evidence_1"]
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["project-photo-analysis", "project_1"]
    });
  });

  it("does not show the destructive control to viewers", () => {
    mocks.role = "VIEWER";
    render(React.createElement(ProjectEvidencePage));

    expect(screen.queryByRole("button", { name: "Delete site-photo.jpg" })).toBeNull();
  });
});
