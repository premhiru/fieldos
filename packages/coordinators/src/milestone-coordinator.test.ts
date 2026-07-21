import type { Milestone } from "@fieldos/db";
import { describe, expect, it } from "vitest";

import {
  MilestoneCoordinator,
  detectMilestoneChanges,
  matchExistingMilestone,
  normalizeMilestoneTitle,
  resolveDatePhrase
} from "./milestone-coordinator.js";

const occurredAt = new Date("2026-07-13T08:00:00.000Z");

describe("milestone intelligence", () => {
  it("extracts two milestone changes from one field update", () => {
    const changes = detectMilestoneChanges(
      "We finished foundation pour today, starting walls Monday.",
      occurredAt,
      "Asia/Singapore"
    );

    expect(changes).toHaveLength(2);
    expect(changes[0]).toMatchObject({
      action: "COMPLETE",
      actualEndDate: "2026-07-13",
      milestoneTitle: "Foundation Pour",
      status: "COMPLETED"
    });
    expect(changes[1]).toMatchObject({
      action: "CREATE",
      milestoneTitle: "Walls",
      plannedStartDate: "2026-07-20",
      status: "PLANNED"
    });
  });

  it("detects a delayed milestone and resolves the next Friday", () => {
    const changes = detectMilestoneChanges(
      "CCR testing delayed until Friday.",
      occurredAt,
      "Asia/Singapore"
    );

    expect(changes).toEqual([
      expect.objectContaining({
        action: "DELAY",
        milestoneTitle: "Ccr Testing",
        plannedEndDate: "2026-07-17",
        status: "DELAYED"
      })
    ]);
  });

  it("detects explicit completion without inventing a stated date", () => {
    const [change] = detectMilestoneChanges(
      "Taxiway Alpha lights done.",
      occurredAt,
      "Asia/Singapore"
    );

    expect(change).toMatchObject({
      action: "COMPLETE",
      actualEndDate: "2026-07-13",
      milestoneTitle: "Taxiway Alpha Lights",
      originalDatePhrase: null,
      status: "COMPLETED"
    });
  });

  it("does not suggest a milestone for vague praise", () => {
    expect(detectMilestoneChanges("Looks good, thanks.", occurredAt, "Asia/Singapore")).toEqual([]);
  });

  it.each([
    "Delivery completed.",
    "Inspection report completed.",
    "Temporary barrier completed.",
    "Testing completed with two failures."
  ])("does not turn incidental or incomplete work into a milestone: %s", (message) => {
    expect(detectMilestoneChanges(message, occurredAt, "Asia/Singapore")).toEqual([]);
  });

  it("keeps ambiguous relative dates planned and marked for review", () => {
    const [change] = detectMilestoneChanges(
      "Starting walls next week.",
      occurredAt,
      "Asia/Singapore"
    );

    expect(change).toMatchObject({
      action: "CREATE",
      actualStartDate: null,
      confidence: "MEDIUM",
      originalDatePhrase: "next week",
      plannedStartDate: null,
      status: "PLANNED"
    });
    expect(resolveDatePhrase("next week", occurredAt, "Asia/Singapore")).toBeNull();
  });

  it("matches common construction milestone synonyms", () => {
    const foundation = createMilestone("Foundation Concrete Pour");
    const walls = createMilestone("Wall Construction");

    expect(matchExistingMilestone("foundation pour", [foundation, walls])?.id).toBe(foundation.id);
    expect(matchExistingMilestone("walls", [foundation, walls])?.id).toBe(walls.id);
    expect(normalizeMilestoneTitle("The wall works completed")).toBe("wall construction");
  });

  it("updates an identical pending recommendation instead of duplicating it", async () => {
    const pending: Array<Record<string, unknown>> = [];
    const prisma = {
      aIMessageClassification: {
        findMany: async () => [
          {
            createdAt: occurredAt,
            message: {
              attachments: [],
              body: "Taxiway Alpha lights done.",
              occurredAt,
              senderParticipant: { displayName: "Site Supervisor" }
            },
            messageId: "message-1",
            projectId: "project-1",
            status: "COMPLETED"
          }
        ]
      },
      event: { findMany: async () => [] },
      milestone: { findMany: async () => [] },
      projectState: { findUnique: async () => null },
      recommendation: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          pending.push({
            ...data,
            createdAt: occurredAt,
            id: "recommendation-1",
            status: "PENDING"
          });
          return pending[0];
        },
        findMany: async () => pending,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(pending[0] ?? {}, data);
          return pending[0];
        }
      }
    };
    const coordinator = new MilestoneCoordinator(prisma as never);
    const project = {
      code: "T2",
      createdAt: occurredAt,
      id: "project-1",
      name: "Terminal 2",
      organizationId: "org-1",
      status: "ACTIVE",
      timezone: "Asia/Singapore",
      updatedAt: occurredAt
    } as const;

    await expect(coordinator.run(project)).resolves.toBe(1);
    await expect(coordinator.run(project)).resolves.toBe(0);
    pending[0]!.status = "COMPLETED";
    await expect(coordinator.run(project)).resolves.toBe(0);
    expect(pending).toHaveLength(1);
  });
});

function createMilestone(title: string): Milestone {
  return {
    actualEndDate: null,
    actualStartDate: null,
    createdAt: new Date(),
    createdByUserId: null,
    description: null,
    id: `milestone-${title}`,
    organizationId: "org-1",
    plannedEndDate: null,
    plannedStartDate: null,
    priority: "MEDIUM",
    projectId: "project-1",
    source: "MANUAL",
    sourceMessageId: null,
    sourceRecommendationId: null,
    status: "PLANNED",
    title,
    updatedAt: new Date()
  };
}
