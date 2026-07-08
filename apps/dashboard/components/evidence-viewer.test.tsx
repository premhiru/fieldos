import { render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import { EvidenceViewer } from "./evidence-viewer";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: {
      evidence: {
        actionItems: [
          {
            description: "Review cable tray evidence.",
            id: "action_1",
            title: "Review cable tray"
          }
        ],
        conversation: {
          id: "conversation_1",
          title: "Site team"
        },
        createdAt: "2026-07-08T01:00:00.000Z",
        filename: "cable-tray.jpg",
        id: "attachment_1",
        message: {
          body: "Cable tray complete, needs inspection.",
          id: "message_1",
          occurredAt: "2026-07-08T01:00:00.000Z"
        },
        mimeType: "image/jpeg",
        organizationId: "organization_1",
        photoAnalysis: {
          detectedObjects: ["cable tray"],
          possibleIssues: ["missing label"],
          summary: "Photo shows completed cable tray work.",
          tags: ["electrical"]
        },
        project: {
          code: "T2",
          id: "project_1",
          name: "Terminal 2"
        },
        signedUrl: "https://api.fieldos.test/media/token",
        size: 2048,
        sourceWhatsAppMessage: {
          conversationTitle: "Site team",
          messageId: "message_1"
        },
        timelineEvents: [
          {
            description: "Evidence received from site.",
            id: "event_1",
            occurredAt: "2026-07-08T01:00:00.000Z",
            title: "Evidence received"
          }
        ],
        transcript: "Audio note transcript",
        transcriptionStatus: "COMPLETED"
      }
    },
    isError: false,
    isLoading: false
  })
}));

describe("EvidenceViewer", () => {
  it("renders evidence preview details from a signed evidence response", () => {
    render(React.createElement(EvidenceViewer, { evidenceId: "attachment_1", onClose: vi.fn() }));

    expect(screen.getByText("cable-tray.jpg")).toBeTruthy();
    expect(screen.getByAltText("cable-tray.jpg").getAttribute("src")).toBe(
      "https://api.fieldos.test/media/token"
    );
    expect(screen.getByText("Cable tray complete, needs inspection.")).toBeTruthy();
    expect(screen.getByText("Audio note transcript")).toBeTruthy();
    expect(screen.getByText("Photo shows completed cable tray work.")).toBeTruthy();
    expect(screen.getByText("Evidence received")).toBeTruthy();
    expect(screen.getByText("Review cable tray")).toBeTruthy();
  });
});
