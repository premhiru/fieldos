"use client";

import { Badge, Button, EmptyState, PageHeader, Skeleton } from "@fieldos/ui";
import { History } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { AppShell } from "../../../../components/app-shell";
import { AuthGuard } from "../../../../components/auth-guard";
import { api, type ProjectTimelineEvent } from "../../../../lib/api";

export default function ProjectTimelinePage() {
  return (
    <AuthGuard>
      <AppShell>
        <ProjectTimeline />
      </AppShell>
    </AuthGuard>
  );
}

function ProjectTimeline() {
  const params = useParams<{ projectId: string }>();
  const [showAll, setShowAll] = React.useState(false);
  const projectQuery = useQuery({
    queryFn: () => api.getProject(params.projectId),
    queryKey: ["project", params.projectId],
    retry: false
  });

  if (projectQuery.isLoading) return <Skeleton className="h-[560px]" />;
  const project = projectQuery.data?.project;
  if (!project)
    return <p className="text-sm text-[var(--status-critical-text)]">Project not found.</p>;

  const allEvents = project.timelineEvents ?? [];
  const events = showAll ? allEvents : allEvents.filter(isSignificantEvent);

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Link
            className="text-sm font-medium text-[var(--text-primary)] hover:underline"
            href={`/projects/${project.id}`}
          >
            Back to project
          </Link>
        }
        description={`${project.code} · Significant changes are shown by default.`}
        title="Project Timeline"
      />
      <div className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
        <p className="text-sm text-[var(--text-secondary)]">
          {showAll ? `${allEvents.length} total events` : `${events.length} significant events`}
        </p>
        <Button onClick={() => setShowAll((value) => !value)} variant="secondary">
          {showAll ? "Show significant only" : "Show all activity"}
        </Button>
      </div>
      {events.length === 0 ? (
        <EmptyState
          description={
            showAll
              ? "Project activity will appear here as field updates are received."
              : "No significant changes have been recorded. Show all activity to review every update."
          }
          icon={<History aria-hidden="true" className="size-5" />}
          title="No timeline events"
        />
      ) : (
        <div className="relative space-y-0 before:absolute before:bottom-4 before:left-[7px] before:top-4 before:w-px before:bg-[var(--border-subtle)]">
          {events.map((event) => (
            <article className="relative grid grid-cols-[16px_1fr] gap-4 py-4" key={event.id}>
              <span className="z-10 mt-1 size-4 rounded-full border-4 border-[var(--surface)] bg-[var(--color-primary)]" />
              <div className="min-w-0 rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-medium text-[var(--text-primary)]">{event.title}</h2>
                    <Badge variant="muted">{eventLabel(event.sourceType)}</Badge>
                  </div>
                  <time className="text-xs text-[var(--text-secondary)]">
                    {formatDate(event.occurredAt)}
                  </time>
                </div>
                {event.description ? (
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    {event.description}
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function isSignificantEvent(event: ProjectTimelineEvent): boolean {
  if (["MILESTONE", "RECOMMENDATION", "REPORT", "ACTION_ITEM"].includes(event.sourceType))
    return true;
  return /approved|blocked|completed|decision|delay|inspection|risk|variation/i.test(
    `${event.eventType} ${event.title}`
  );
}

function eventLabel(value: string): string {
  if (value === "ACTION_ITEM") return "Action Item";
  if (value === "RECOMMENDATION") return "Decision";
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}
