import { fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import {
  RecommendationPriorityControls,
  type RecommendationPriorityFilter
} from "./recommendation-priority-controls";

describe("RecommendationPriorityControls", () => {
  it("switches priority views and bulk dismisses only the active priority", () => {
    const onDismissAll = vi.fn();

    function Harness() {
      const [activeFilter, setActiveFilter] = React.useState<RecommendationPriorityFilter>("HIGH");

      return (
        <RecommendationPriorityControls
          activeFilter={activeFilter}
          counts={{ ALL: 9, HIGH: 3, MEDIUM: 6 }}
          onChange={setActiveFilter}
          onDismissAll={onDismissAll}
        />
      );
    }

    render(<Harness />);

    expect(screen.getByRole("tab", { name: "High (3)" }).getAttribute("aria-selected")).toBe(
      "true"
    );
    fireEvent.click(screen.getByRole("tab", { name: "Medium (6)" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss all Medium" }));

    expect(onDismissAll).toHaveBeenCalledWith("MEDIUM");

    fireEvent.click(screen.getByRole("tab", { name: "All (9)" }));
    expect(screen.queryByRole("button", { name: /Dismiss all/ })).toBeNull();
  });
});
