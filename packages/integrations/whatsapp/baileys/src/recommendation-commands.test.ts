import { describe, expect, it } from "vitest";

import {
  parseWhatsAppRecommendationCommand,
  recommendationReference
} from "./recommendation-commands.js";

describe("WhatsApp recommendation commands", () => {
  it.each([
    [" APPROVE ", { type: "APPROVE" }],
    ["approve", { type: "APPROVE" }],
    ["APPROVE REC-1842", { type: "APPROVE" }],
    ["ReJeCt", { type: "REJECT" }],
    ["details", { type: "DETAILS" }],
    ["snooze   1 day", { days: 1, type: "SNOOZE" }],
    ["SNOOZE 3 DAYS", { days: 3, type: "SNOOZE" }],
    ["SNOOZE 1 WEEK", { days: 7, type: "SNOOZE" }],
    ["confirm rec-1842", { reference: "REC-1842", type: "CONFIRM" }],
    ["CANCEL REC-1842", { reference: "REC-1842", type: "CANCEL" }],
    ["JOIN", { type: "JOIN" }]
  ])("parses %s deterministically", (input, expected) => {
    expect(parseWhatsAppRecommendationCommand(input)).toEqual(expected);
  });

  it.each(["okay", "sure", "looks good", "go ahead", "can", "yes", "noted"])(
    "does not infer approval from %s",
    (input) => expect(parseWhatsAppRecommendationCommand(input)).toBeNull()
  );

  it("creates a short non-authoritative visible reference", () => {
    expect(recommendationReference("cmr-example-1842")).toBe("REC-MPLE1842");
  });
});
