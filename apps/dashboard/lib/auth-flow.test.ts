import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./api";
import { authenticateWithInvitation } from "./auth-flow";

describe("authenticateWithInvitation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts an invitation after authentication succeeds", async () => {
    const authenticate = vi.fn().mockResolvedValue({ user: { id: "user-1" } });
    const acceptInvitation = vi.spyOn(api, "acceptInvitation").mockResolvedValue({ ok: true });

    await expect(
      authenticateWithInvitation(authenticate, "valid-invitation-token")
    ).resolves.toEqual({ user: { id: "user-1" } });

    expect(authenticate).toHaveBeenCalledOnce();
    expect(acceptInvitation).toHaveBeenCalledWith("valid-invitation-token");
    expect(authenticate.mock.invocationCallOrder[0]).toBeLessThan(
      acceptInvitation.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
  });

  it("does not attempt invitation acceptance for normal authentication", async () => {
    const authenticate = vi.fn().mockResolvedValue({ user: { id: "user-1" } });
    const acceptInvitation = vi.spyOn(api, "acceptInvitation").mockResolvedValue({ ok: true });

    await authenticateWithInvitation(authenticate, "");

    expect(acceptInvitation).not.toHaveBeenCalled();
  });
});
