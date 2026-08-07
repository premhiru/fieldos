"use client";

import * as React from "react";

import type { ProjectStateHealth } from "./api";

const storagePrefix = "caladrona:project-health-warning:";
const dismissalChangeEvent = "caladrona:project-health-dismissal-change";
const volatileDismissals = new Map<string, string>();

export interface DismissibleProjectHealth {
  health: ProjectStateHealth;
  healthReason: string;
  id: string;
}

export function dismissProjectHealthWarning(project: DismissibleProjectHealth): void {
  const value = fingerprint(project);
  volatileDismissals.set(project.id, value);
  try {
    window.localStorage.setItem(storageKey(project.id), value);
  } catch {
    // The event still updates the current view when browser storage is unavailable.
  }
  window.dispatchEvent(new Event(dismissalChangeEvent));
}

export function restoreProjectHealthWarning(projectId: string): void {
  volatileDismissals.delete(projectId);
  try {
    window.localStorage.removeItem(storageKey(projectId));
  } catch {
    // The event still updates the current view when browser storage is unavailable.
  }
  window.dispatchEvent(new Event(dismissalChangeEvent));
}

export function countUndismissedHealthWarnings(
  projects: DismissibleProjectHealth[],
  dismissedProjectIds: ReadonlySet<string>
): number {
  return projects.filter(
    (project) =>
      ["CRITICAL", "NEEDS_ATTENTION"].includes(project.health) &&
      !dismissedProjectIds.has(project.id)
  ).length;
}

export function useDismissedProjectHealth(
  projects: DismissibleProjectHealth[]
): ReadonlySet<string> {
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    const refresh = () => setVersion((value) => value + 1);
    window.addEventListener("storage", refresh);
    window.addEventListener(dismissalChangeEvent, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(dismissalChangeEvent, refresh);
    };
  }, []);

  return React.useMemo(() => {
    const dismissedIds = new Set<string>();
    for (const project of projects) {
      if (hasMatchingDismissal(project)) dismissedIds.add(project.id);
    }
    return dismissedIds;
  }, [projects, version]);
}

function hasMatchingDismissal(project: DismissibleProjectHealth): boolean {
  try {
    const stored =
      window.localStorage.getItem(storageKey(project.id)) ?? volatileDismissals.get(project.id);
    if (!stored) return false;

    const parsed = JSON.parse(stored) as unknown;
    return (
      Array.isArray(parsed) && parsed[0] === project.health && parsed[1] === project.healthReason
    );
  } catch {
    return false;
  }
}

function fingerprint(project: DismissibleProjectHealth): string {
  return JSON.stringify([project.health, project.healthReason]);
}

function storageKey(projectId: string): string {
  return `${storagePrefix}${projectId}`;
}
