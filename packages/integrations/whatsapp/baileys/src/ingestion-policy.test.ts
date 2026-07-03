import { describe, expect, it } from "vitest";

import { decideWhatsAppIngestion } from "./ingestion-policy.js";

describe("decideWhatsAppIngestion", () => {
  it("skips discovered, ignored, and archived chats", () => {
    for (const status of ["DISCOVERED", "IGNORED", "ARCHIVED"] as const) {
      expect(
        decideWhatsAppIngestion({
          account: { status: "CONNECTED" },
          mapping: { projectId: "project_1", status }
        })
      ).toEqual({
        allowed: false,
        reasonSkipped: "MAPPING_NOT_ACTIVE"
      });
    }
  });

  it("allows active chats without a project so AI can suggest assignment", () => {
    expect(
      decideWhatsAppIngestion({
        account: { status: "CONNECTED" },
        mapping: { projectId: null, status: "ACTIVE" }
      })
    ).toEqual({
      allowed: true,
      reasonSkipped: null
    });
  });

  it("allows active chats with a mapped project", () => {
    expect(
      decideWhatsAppIngestion({
        account: { status: "CONNECTED" },
        mapping: { projectId: "project_1", status: "ACTIVE" }
      })
    ).toEqual({
      allowed: true,
      reasonSkipped: null
    });
  });

  it("skips disconnected accounts and missing mappings", () => {
    expect(
      decideWhatsAppIngestion({
        account: { status: "DISCONNECTED" },
        mapping: { projectId: "project_1", status: "ACTIVE" }
      }).reasonSkipped
    ).toBe("ACCOUNT_NOT_CONNECTED");

    expect(
      decideWhatsAppIngestion({
        account: { status: "CONNECTED" },
        mapping: null
      }).reasonSkipped
    ).toBe("MAPPING_MISSING");
  });
});
