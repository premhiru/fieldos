import { render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import SignupPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn()
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

describe("SignupPage", () => {
  it("renders the signup form", () => {
    render(React.createElement(SignupPage));

    expect(screen.getByText("Create your FieldOS account")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign up" })).toBeTruthy();
  });
});
