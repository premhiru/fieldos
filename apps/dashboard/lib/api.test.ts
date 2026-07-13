import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./api";

describe("dashboard API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the same-origin API proxy for authenticated requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { email: "invitee@example.com", id: "user-1" } }), {
        headers: { "Content-Type": "application/json" },
        status: 200
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.login({ email: "invitee@example.com", password: "password123" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({ credentials: "include", method: "POST" })
    );
  });
});
