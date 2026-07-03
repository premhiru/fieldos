import { render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import ConversationDetailPage from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ conversationId: "conversation_1" }),
  usePathname: () => "/inbox/conversation_1",
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
    if (queryKey[0] === "conversation") {
      return {
        data: {
          conversation: {
            channel: "WHATSAPP",
            id: "conversation_1",
            isGroup: false,
            project: { id: "project_1", name: "Warehouse rollout" },
            title: "Site team"
          }
        },
        isError: false,
        isLoading: false
      };
    }

    if (queryKey[0] === "conversation-messages") {
      return {
        data: {
          messages: [
            message("message_pending"),
            message("message_completed"),
            message("message_failed")
          ]
        },
        isLoading: false
      };
    }

    if (queryKey[0] === "message-classification") {
      const messageId = queryKey[1];

      if (messageId === "message_completed") {
        return {
          data: {
            classification: {
              category: "DEFECT",
              confidence: 0.9,
              location: "Lobby",
              priority: "HIGH",
              reasoningSummary: "The message requests rectification.",
              status: "COMPLETED",
              suggestedTaskTitle: "Fix lobby light",
              summary: "A lobby light failed."
            }
          },
          isLoading: false
        };
      }

      if (messageId === "message_failed") {
        return {
          data: {
            classification: {
              errorMessage: "AI not configured.",
              status: "FAILED"
            }
          },
          isLoading: false
        };
      }
    }

    return {
      data: {
        classification: null
      },
      isLoading: false
    };
  },
  useQueryClient: () => ({
    invalidateQueries: vi.fn()
  })
}));

describe("ConversationDetailPage AI panel", () => {
  it("renders pending, completed, and failed AI states", () => {
    render(React.createElement(ConversationDetailPage));

    expect(screen.getAllByText("AI classification pending")).toHaveLength(1);
    expect(screen.getByText("Category: DEFECT")).toBeTruthy();
    expect(screen.getByText("AI classification failed: AI not configured.")).toBeTruthy();
  });
});

function message(id: string) {
  return {
    attachments: [],
    body: "Lobby light failed, please rectify.",
    conversationId: "conversation_1",
    createdAt: "2026-07-03T00:00:00.000Z",
    direction: "INBOUND",
    externalMessageId: id,
    id,
    occurredAt: "2026-07-03T00:00:00.000Z",
    senderParticipant: {
      createdAt: "2026-07-03T00:00:00.000Z",
      displayName: "Supervisor",
      externalIdentifier: "supervisor",
      id: "participant_1",
      role: "contact"
    },
    senderParticipantId: "participant_1",
    type: "TEXT"
  };
}
