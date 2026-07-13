import { render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import ForgotPasswordPage from "./page";

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

describe("ForgotPasswordPage", () => {
  it("renders the reset-link request form", () => {
    render(React.createElement(ForgotPasswordPage));

    expect(screen.getByText("Reset your password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Return to login" })).toBeTruthy();
  });
});
