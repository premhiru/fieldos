import { describe, expect, it } from "vitest";

import { assessProjectHealth } from "./project-health.js";

const now = new Date("2026-07-16T08:00:00.000Z");

describe("assessProjectHealth", () => {
  it("returns unknown when the project has no activity", () => {
    expect(assessProjectHealth(baseInput({ lastActivityAt: null }))).toEqual({
      reason: "No field activity has been recorded yet.",
      status: "UNKNOWN"
    });
  });

  it("treats urgent work and multiple overdue milestones as critical", () => {
    expect(assessProjectHealth(baseInput({ urgentActionItemCount: 1 })).status).toBe("CRITICAL");
    expect(assessProjectHealth(baseInput({ overdueMilestoneCount: 2 })).status).toBe("CRITICAL");
  });

  it("returns needs attention for high priority work", () => {
    expect(assessProjectHealth(baseInput({ highPriorityActionItemCount: 1 }))).toEqual({
      reason: "1 high-priority action item needs review.",
      status: "NEEDS_ATTENTION"
    });
  });

  it("returns healthy for a recently active project without open concerns", () => {
    expect(assessProjectHealth(baseInput()).status).toBe("HEALTHY");
  });
});

function baseInput(
  overrides: Partial<Parameters<typeof assessProjectHealth>[0]> = {}
): Parameters<typeof assessProjectHealth>[0] {
  return {
    highPriorityActionItemCount: 0,
    lastActivityAt: new Date("2026-07-16T07:00:00.000Z"),
    now,
    openActionItemCount: 0,
    overdueMilestoneCount: 0,
    urgentActionItemCount: 0,
    ...overrides
  };
}
