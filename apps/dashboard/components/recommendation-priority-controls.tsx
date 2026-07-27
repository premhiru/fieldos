"use client";

import { Button } from "@fieldos/ui";
import { Trash2 } from "lucide-react";

export type RecommendationPriorityFilter = "ALL" | "HIGH" | "MEDIUM";

interface RecommendationPriorityControlsProps {
  activeFilter: RecommendationPriorityFilter;
  counts: Record<RecommendationPriorityFilter, number>;
  dismissing?: boolean;
  onChange: (filter: RecommendationPriorityFilter) => void;
  onDismissAll: (filter: Exclude<RecommendationPriorityFilter, "ALL">) => void;
}

const filters: RecommendationPriorityFilter[] = ["ALL", "HIGH", "MEDIUM"];

export function RecommendationPriorityControls({
  activeFilter,
  counts,
  dismissing = false,
  onChange,
  onDismissAll
}: RecommendationPriorityControlsProps) {
  const dismissibleFilter = activeFilter === "ALL" ? null : activeFilter;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div
        aria-label="Recommendation priority"
        className="inline-flex rounded-md border border-[var(--border-default)] bg-[var(--surface-subtle)] p-1"
        role="tablist"
      >
        {filters.map((filter) => (
          <button
            aria-selected={activeFilter === filter}
            className={
              activeFilter === filter
                ? "h-8 rounded-sm bg-[var(--surface)] px-3 text-sm font-medium text-[var(--text-primary)] shadow-xs"
                : "h-8 rounded-sm px-3 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }
            key={filter}
            onClick={() => onChange(filter)}
            role="tab"
            type="button"
          >
            {formatLabel(filter)} ({counts[filter]})
          </button>
        ))}
      </div>

      {dismissibleFilter && counts[dismissibleFilter] > 0 ? (
        <Button
          className="h-9 text-[var(--status-critical-text)]"
          disabled={dismissing}
          onClick={() => onDismissAll(dismissibleFilter)}
          type="button"
          variant="ghost"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          {dismissing ? "Dismissing..." : `Dismiss all ${formatLabel(dismissibleFilter)}`}
        </Button>
      ) : null}
    </div>
  );
}

function formatLabel(value: RecommendationPriorityFilter) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
