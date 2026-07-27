import { render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "./page";

class IntersectionObserverStub {
  disconnect() {}
  observe() {}
  unobserve() {}
}

describe("HomePage", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("routes prospective and returning users into the Caladrona app", () => {
    render(React.createElement(HomePage));

    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Caladrona");
    expect(screen.getAllByRole("link", { name: "Sign up" })[0]?.getAttribute("href")).toBe(
      "/signup"
    );
    expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe("/login");
  });
});
