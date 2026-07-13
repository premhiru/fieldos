import { render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import ResetPasswordPage from "./page";

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useMutation: () => ({
      isError: false,
      isPending: false,
      isSuccess: false,
      mutate: vi.fn()
    })
  };
});

describe("ResetPasswordPage", () => {
  it("rejects a reset page without a token", async () => {
    window.history.replaceState({}, "", "/reset-password");
    render(React.createElement(ResetPasswordPage));

    await waitFor(() => {
      expect(screen.getByText("This password reset link is invalid.")).toBeTruthy();
    });
    expect(screen.getByRole("link", { name: "Request another reset link" })).toBeTruthy();
  });
});
