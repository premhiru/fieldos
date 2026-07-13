import { render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  })
}));

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useMutation: () => ({
      isPending: false,
      mutate: vi.fn()
    }),
    useQueryClient: () => ({
      invalidateQueries: vi.fn()
    })
  };
});

describe("LoginPage", () => {
  it("renders the login form", () => {
    render(React.createElement(LoginPage));

    expect(screen.getByText("Log in to FieldOS")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log in" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Forgot password?" })).toBeTruthy();
  });
});
