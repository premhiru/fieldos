"use client";

import { Badge, Button, EmptyState, PageHeader, Skeleton } from "@fieldos/ui";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Flag,
  History,
  Images,
  ListTodo,
  Users
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { ActionItemAssigneeSelect } from "../../../components/action-item-assignee-select";
import { AppShell } from "../../../components/app-shell";
import { AuthGuard } from "../../../components/auth-guard";
import { RecommendationCard } from "../../../components/recommendation-card";
import {
  api,
  type ActionItem,
  type ProjectStateHealth,
  type ProjectTimelineEvent
} from "../../../lib/api";

export default function ProjectDetailPage() {
  return (
    <AuthGuard>
      <AppShell>
        <ProjectCommandCenter />
      </AppShell>
    </AuthGuard>
  );
}

function ProjectCommandCenter() {
  const params = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const projectQuery = useQuery({
    queryFn: () => api.getProject(params.projectId),
    queryKey: ["project", params.projectId],
    retry: false
  });
  const projectStateQuery = useQuery({
    enabled: Boolean(projectQuery.data?.project),
    queryFn: () => api.getProjectState(params.projectId),
    queryKey: ["project-state", params.projectId],
    refetchInterval: 30_000,
    retry: false
  });
  const recommendationsQuery = useQuery({
    enabled: Boolean(projectQuery.data?.project),
    queryFn: () => api.listProjectRecommendations(params.projectId, "PENDING"),
    queryKey: ["project-recommendations", params.projectId, "PENDING"],
    refetchInterval: 30_000,
    retry: false
  });
  const actionItemsQuery = useQuery({
    enabled: Boolean(projectQuery.data?.project),
    queryFn: () => api.listProjectActionItems(params.projectId),
    queryKey: ["project-action-items", params.projectId],
    refetchInterval: 30_000,
    retry: false
  });
  const approveRecommendationMutation = useMutation({
    mutationFn: api.approveRecommendation,
    onSuccess: refreshProject
  });
  const dismissRecommendationMutation = useMutation({
    mutationFn: (id: string) => api.dismissRecommendation(id),
    onSuccess: refreshProject
  });
  const acceptActionItemMutation = useMutation({
    mutationFn: (id: string) => api.acceptActionItem(id),
    onSuccess: refreshProject
  });
  const ignoreActionItemMutation = useMutation({
    mutationFn: (id: string) => api.ignoreActionItem(id),
    onSuccess: refreshProject
  });
  const [snoozedRecommendationIds, setSnoozedRecommendationIds] = React.useState<string[]>([]);

  async function refreshProject() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["project-recommendations", params.projectId, "PENDING"]
      }),
      queryClient.invalidateQueries({ queryKey: ["project-action-items", params.projectId] }),
      queryClient.invalidateQueries({ queryKey: ["project-state", params.projectId] }),
      queryClient.invalidateQueries({ queryKey: ["operations-dashboard"] })
    ]);
  }

  if (projectQuery.isLoading) return <ProjectPageSkeleton />;

  const project = projectQuery.data?.project;
  if (projectQuery.isError || !project) {
    return <p className="text-sm text-[var(--status-critical-text)]">Project not found.</p>;
  }

  const projectState = projectStateQuery.data?.state;
  const recommendations = (recommendationsQuery.data?.recommendations ?? []).filter(
    (item) => !snoozedRecommendationIds.includes(item.id)
  );
  const openActionItems = (actionItemsQuery.data?.actionItems ?? []).filter((item) =>
    ["PENDING", "ACCEPTED"].includes(item.status)
  );
  const significantEvents = (project.timelineEvents ?? []).filter(isSignificantEvent).slice(0, 5);

  return (
    <div className="space-y-8">
      <PageHeader
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{project.code}</span>
            <Badge variant="muted">{formatLabel(project.status)}</Badge>
          </span>
        }
        title={project.name}
      />

      <section
        aria-labelledby="project-brief-heading"
        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <h2
              className="text-xs font-semibold uppercase text-[var(--text-secondary)]"
              id="project-brief-heading"
            >
              Project Brief
            </h2>
            <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
              {projectState?.recentProgressSummary ?? "No concise project update is available yet."}
            </p>
            <div className="mt-4 flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`mt-1.5 size-2.5 shrink-0 rounded-full ${healthDot(projectState?.health)}`}
              />
              <div>
                <div className="font-medium text-[var(--text-primary)]">
                  {healthLabel(projectState?.health)}
                </div>
                <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                  {projectState?.healthReason ??
                    "Project health will appear after the first update."}
                </p>
              </div>
            </div>
          </div>
          <div className="grid min-w-[240px] grid-cols-2 gap-px overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--border-subtle)]">
            <BriefMetric label="Progress" value={`${projectState?.completionPercent ?? 0}%`} />
            <BriefMetric
              label="Next milestone"
              value={projectState?.nextMilestone ?? "Not scheduled"}
            />
          </div>
        </div>
        <p className="mt-5 text-xs text-[var(--text-secondary)]">
          Last meaningful activity {formatTime(projectState?.lastActivityAt ?? null)}
        </p>
      </section>

      <section aria-labelledby="recommended-actions-heading" className="space-y-4">
        <div>
          <h2
            className="text-xl font-semibold text-[var(--text-primary)]"
            id="recommended-actions-heading"
          >
            Recommended Actions
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Review the decisions and follow-ups that can move this project forward.
          </p>
        </div>
        {recommendationsQuery.isLoading ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        ) : recommendations.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {recommendations.map((recommendation) => (
              <RecommendationCard
                busy={
                  approveRecommendationMutation.isPending || dismissRecommendationMutation.isPending
                }
                key={recommendation.id}
                onApprove={() => approveRecommendationMutation.mutate(recommendation.id)}
                onDismiss={() => dismissRecommendationMutation.mutate(recommendation.id)}
                onSnooze={() => setSnoozedRecommendationIds((ids) => [...ids, recommendation.id])}
                recommendation={recommendation}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            description="There are no project decisions waiting for your review."
            icon={<CheckCircle2 aria-hidden="true" className="size-5" />}
            title="No recommendations pending"
          />
        )}

        {openActionItems.length > 0 ? (
          <div className="divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)]">
            {openActionItems.slice(0, 3).map((item) => (
              <ProjectActionItem
                actionItem={item}
                busy={acceptActionItemMutation.isPending || ignoreActionItemMutation.isPending}
                key={item.id}
                onAccept={() => acceptActionItemMutation.mutate(item.id)}
                onIgnore={() => ignoreActionItemMutation.mutate(item.id)}
              />
            ))}
            <Link
              className="flex items-center justify-between px-4 py-3 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
              href={`/action-items?projectId=${project.id}`}
            >
              View all Action Items
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="changes-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]" id="changes-heading">
              What&apos;s Changed
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Milestones, decisions, reports, and material project updates.
            </p>
          </div>
          <Link
            className="shrink-0 text-sm font-medium text-[var(--text-primary)] hover:underline"
            href={`/projects/${project.id}/timeline`}
          >
            Full timeline
          </Link>
        </div>
        {significantEvents.length === 0 ? (
          <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)]">
            No significant project changes have been recorded yet.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-5">
            {significantEvents.map((event) => (
              <div className="py-4" key={event.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium text-[var(--text-primary)]">{event.title}</p>
                  <time className="text-xs text-[var(--text-secondary)]">
                    {formatTime(event.occurredAt)}
                  </time>
                </div>
                {event.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">
                    {event.description}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="quick-links-heading" className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]" id="quick-links-heading">
          Quick Links
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <QuickLink href={`/projects/${project.id}/timeline`} icon={History} label="Timeline" />
          <QuickLink href={`/projects/${project.id}/evidence`} icon={Images} label="Evidence" />
          <QuickLink href={`/projects/${project.id}/people`} icon={Users} label="People" />
          <QuickLink href={`/projects/${project.id}/milestones`} icon={Flag} label="Milestones" />
          <QuickLink
            href={`/projects/${project.id}/intelligence`}
            icon={FileText}
            label="Reports"
          />
          <QuickLink
            href={`/action-items?projectId=${project.id}`}
            icon={ListTodo}
            label="Action Items"
          />
        </div>
      </section>
    </div>
  );
}

function BriefMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-[var(--surface)] p-3">
      <div className="text-xs text-[var(--text-secondary)]">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]" title={value}>
        {value}
      </div>
    </div>
  );
}

function ProjectActionItem({
  actionItem,
  busy,
  onAccept,
  onIgnore
}: {
  actionItem: ActionItem;
  busy: boolean;
  onAccept: () => void;
  onIgnore: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium text-[var(--text-primary)]">{actionItem.title}</h3>
          <Badge variant={actionItem.priority === "URGENT" ? "warning" : "muted"}>
            {formatLabel(actionItem.priority)}
          </Badge>
        </div>
        {actionItem.description ? (
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{actionItem.description}</p>
        ) : null}
        <div className="mt-3 max-w-sm">
          <ActionItemAssigneeSelect actionItem={actionItem} />
        </div>
      </div>
      {actionItem.status === "PENDING" ? (
        <div className="flex shrink-0 gap-2">
          <Button disabled={busy} onClick={onIgnore} variant="ghost">
            Ignore
          </Button>
          <Button disabled={busy} onClick={onAccept}>
            Accept
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label
}: {
  href: string;
  icon: typeof History;
  label: string;
}) {
  return (
    <Link
      className="flex min-h-14 items-center justify-between gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)]"
      href={href}
    >
      <span className="flex items-center gap-2">
        <Icon aria-hidden="true" className="size-4 text-[var(--text-secondary)]" />
        {label}
      </span>
      <ArrowRight aria-hidden="true" className="size-4 text-[var(--text-secondary)]" />
    </Link>
  );
}

function ProjectPageSkeleton() {
  return (
    <div aria-label="Loading project" className="space-y-8">
      <Skeleton className="h-20 max-w-xl" />
      <Skeleton className="h-52" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-52" />
    </div>
  );
}

function isSignificantEvent(event: ProjectTimelineEvent): boolean {
  if (["MILESTONE", "RECOMMENDATION", "REPORT", "ACTION_ITEM"].includes(event.sourceType)) {
    return true;
  }

  return /approved|blocked|completed|decision|delay|inspection|risk|variation/i.test(
    `${event.eventType} ${event.title}`
  );
}

function healthDot(health: ProjectStateHealth | undefined): string {
  if (health === "CRITICAL") return "bg-[var(--status-critical-text)]";
  if (health === "NEEDS_ATTENTION") return "bg-[var(--status-attention-text)]";
  if (health === "HEALTHY") return "bg-[var(--status-healthy-text)]";
  return "bg-[var(--text-disabled)]";
}

function healthLabel(health: ProjectStateHealth | undefined): string {
  if (health === "CRITICAL") return "Critical";
  if (health === "NEEDS_ATTENTION") return "Needs attention";
  if (health === "HEALTHY") return "Healthy";
  return "Awaiting activity";
}

function formatTime(value: string | null): string {
  if (!value) return "not yet recorded";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}

function formatLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
