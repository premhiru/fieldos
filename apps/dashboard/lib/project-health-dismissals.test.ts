import { describe, expect, it } from "vitest";

import { countUndismissedHealthWarnings } from "./project-health-dismissals";

describe("project health dismissals", () => {
  it("excludes acknowledged projects from the attention count", () => {
    const projects = [
      { health: "CRITICAL" as const, healthReason: "Safety issue", id: "critical" },
      { health: "NEEDS_ATTENTION" as const, healthReason: "Delayed", id: "attention" },
      { health: "HEALTHY" as const, healthReason: "On track", id: "healthy" }
    ];

    expect(countUndismissedHealthWarnings(projects, new Set(["critical"]))).toBe(1);
  });
});
