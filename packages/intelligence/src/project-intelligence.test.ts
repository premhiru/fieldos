import { describe, expect, it } from "vitest";

import { ProjectIntelligenceService } from "./project-intelligence.js";
import { weeklyReportToMarkdown, weeklyReportToPdfBuffer } from "./report-export.js";
import type { ProjectIntelligenceContext } from "./types.js";

const generatedAt = new Date("2026-07-08T02:00:00.000Z");

describe("ProjectIntelligenceService", () => {
  const service = new ProjectIntelligenceService();

  it("generates a grounded morning brief", () => {
    const brief = service.generateMorningBrief(context());

    expect(brief.bullets.length).toBeGreaterThanOrEqual(4);
    expect(brief.bullets.length).toBeLessThanOrEqual(8);
    expect(brief.bullets[0]?.sources[0]?.type).toBe("TIMELINE_EVENT");
    expect(brief.bullets.some((item) => item.text.includes("Priority"))).toBe(true);
  });

  it("generates daily and weekly summaries from project evidence", () => {
    const daily = service.generateDailySummary(context());
    const weekly = service.generateWeeklyReport(context());

    expect(daily.evidenceReceived[0]?.text).toContain("handover.pdf");
    expect(weekly.executiveSummary[0]?.text).toContain("timeline events");
    expect(weekly.recentEvidence).toHaveLength(2);
  });

  it("generates risk summary and pending decisions", () => {
    const risks = service.generateRiskSummary(context());
    const decisions = service.generatePendingDecisions(context());

    expect(risks[0]?.title).toContain("cable");
    expect(decisions[0]?.category).toBe("HIGH_PRIORITY_ACTION_ITEM");
  });

  it("exports weekly report to markdown and PDF", () => {
    const report = service.generateWeeklyReport(context());

    expect(weeklyReportToMarkdown(report)).toContain("Executive Summary");
    expect(weeklyReportToPdfBuffer(report).subarray(0, 5).toString()).toBe("%PDF-");
  });
});

function context(): ProjectIntelligenceContext {
  return {
    actionItems: [
      {
        createdAt: generatedAt,
        description: "Review the loose cable photo and assign rectification.",
        id: "action_1",
        messageId: "message_1",
        priority: "HIGH",
        status: "PENDING",
        title: "Review loose cable",
        type: "FOLLOW_UP",
        updatedAt: generatedAt
      }
    ],
    classifications: [
      {
        actionRequired: true,
        category: "DEFECT",
        confidence: 0.86,
        createdAt: generatedAt,
        id: "classification_1",
        location: "Lobby",
        messageId: "message_1",
        reasoningSummary: "The message describes a loose cable.",
        status: "COMPLETED",
        summary: "Loose cable reported.",
        updatedAt: generatedAt
      }
    ],
    evidence: [
      {
        createdAt: generatedAt,
        filename: "handover.pdf",
        id: "evidence_1",
        messageId: "message_1",
        mimeType: "application/pdf",
        transcript: null,
        transcriptionStatus: "NOT_REQUIRED"
      },
      {
        createdAt: generatedAt,
        filename: "voice.ogg",
        id: "evidence_2",
        messageId: "message_1",
        mimeType: "audio/ogg",
        transcript: "Cable needs review.",
        transcriptionStatus: "COMPLETED"
      }
    ],
    events: [
      {
        description: "Site update received.",
        eventType: "MESSAGE_RECEIVED",
        id: "event_1",
        occurredAt: new Date("2026-07-07T05:00:00.000Z"),
        sourceId: "message_1",
        sourceType: "MESSAGE",
        title: "Site Update"
      }
    ],
    generatedAt,
    milestones: [
      {
        dueDate: new Date("2026-07-09T00:00:00.000Z"),
        id: "milestone_1",
        status: "UPCOMING",
        title: "Inspection"
      }
    ],
    photoAnalyses: [
      {
        confidence: 0.8,
        createdAt: generatedAt,
        detectedObjects: ["Cable"],
        evidenceId: "evidence_photo",
        id: "photo_1",
        possibleIssues: ["Loose cable visible."],
        summary: "Cable appears loose.",
        tags: ["cable"]
      }
    ],
    project: {
      code: "T2",
      id: "project_1",
      name: "Terminal 2",
      status: "ACTIVE"
    }
  };
}
