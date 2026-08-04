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

  it("batches large recommendation dismissals within the API safety limit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ dismissed: 500 }), {
          headers: { "Content-Type": "application/json" },
          status: 200
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ dismissed: 101 }), {
          headers: { "Content-Type": "application/json" },
          status: 200
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.dismissRecommendations(
      Array.from({ length: 601 }, (_, index) => `recommendation-${index}`),
      "Bulk dismissed from dashboard."
    );

    expect(result).toEqual({ dismissed: 601 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string).recommendationIds
    ).toHaveLength(500);
    expect(
      JSON.parse((fetchMock.mock.calls[1]?.[1] as RequestInit).body as string).recommendationIds
    ).toHaveLength(101);
  });
});
