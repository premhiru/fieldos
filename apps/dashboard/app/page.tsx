"use client";

import { Badge, Button, EmptyState, PageHeader, Skeleton } from "@fieldos/ui";
import {
  Activity,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Inbox,
  Sparkles,
  TriangleAlert
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";

import { AppShell } from "../components/app-shell";
import { AuthGuard } from "../components/auth-guard";
import { OrganizationOnboarding } from "../components/organization-onboarding";
import { OrganizationSelector } from "../components/organization-selector";
import { RecommendationCard } from "../components/recommendation-card";
import { api, type ActionItem, type Recommendation } from "../lib/api";
import { useMe, useOperationsDashboard, useOrganizations } from "../lib/queries";
import { useActiveOrganizationStore } from "../store/active-organization-store";

const snoozeStorageKey = "fieldos-snoozed-recommendations";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <AppShell>
        <DashboardContent />
      </AppShell>
    </AuthGuard>
  );
}

function DashboardContent() {
  const queryClient = useQueryClient();
  const organizationsQuery = useOrganizations();
  const meQuery = useMe();
  const { activeOrganizationId, setActiveOrganizationId } = useActiveOrganizationStore();
  const organizations = organizationsQuery.data?.organizations ?? [];
  const organization =
    organizations.find((item) => item.id === activeOrganizationId) ?? organizations[0];
  const dashboardQuery = useOperationsDashboard(organization?.id ?? null);
  const recommendationsQuery = useQuery({
    enabled: Boolean(organization?.id),
    queryFn: () => api.listRecommendations(organization?.id ?? "", "PENDING"),
    queryKey: ["recommendations", organization?.id, "PENDING"],
    retry: false
  });
  const [snoozed, setSnoozed] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    if (!activeOrganizationId && organizations[0]) {
      setActiveOrganizationId(organizations[0].id);
    }
  }, [activeOrganizationId, organizations, setActiveOrganizationId]);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(snoozeStorageKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Record<string, number>;
      setSnoozed(
        Object.fromEntries(Object.entries(parsed).filter(([, until]) => until > Date.now()))
      );
    } catch {
      window.localStorage.removeItem(snoozeStorageKey);
    }
  }, []);

  const refresh = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["operations-dashboard", organization?.id] }),
      queryClient.invalidateQueries({
        queryKey: ["recommendations", organization?.id, "PENDING"]
      })
    ]);
  }, [organization?.id, queryClient]);

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveRecommendation(id),
    onSuccess: refresh
  });
  const dismissMutation = useMutation({
    mutationFn: (id: string) => api.dismissRecommendation(id),
    onSuccess: refresh
  });
  const completeMutation = useMutation({
    mutationFn: (id: string) => api.completeActionItem(id),
    onSuccess: refresh
  });

  if (organizationsQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (organizations.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <OrganizationOnboarding />
      </div>
    );
  }

  const dashboard = dashboardQuery.data?.dashboard;
  const recommendations = (recommendationsQuery.data?.recommendations ?? []).filter(
    (recommendation) => !snoozed[recommendation.id]
  );
  const actionItems = dashboard
    ? [
        ...dashboard.actionItems.urgent,
        ...dashboard.actionItems.high,
        ...dashboard.actionItems.medium,
        ...dashboard.actionItems.low
      ].filter((item) => item.assignedToUserId === meQuery.data?.user.id)
    : [];
  const recentMessages =
    dashboard?.recentActivity.filter((item) => item.sourceType === "MESSAGE").length ?? 0;

  function snoozeRecommendation(id: string) {
    const next = { ...snoozed, [id]: Date.now() + 24 * 60 * 60 * 1000 };
    setSnoozed(next);
    window.localStorage.setItem(snoozeStorageKey, JSON.stringify(next));
  }

  return (
    <div className="space-y-9">
      <PageHeader
        actions={<OrganizationSelector organizations={organizations} />}
        description={organization?.name}
        eyebrow={`${getGreeting()}, ${meQuery.data?.user.name ?? "there"}`}
        title="What needs your attention today"
      />

      {dashboardQuery.isLoading ? (
        <DashboardSkeleton />
      ) : dashboardQuery.isError || !dashboard ? (
        <EmptyState
          action={
            <Button onClick={() => dashboardQuery.refetch()} variant="secondary">
              Try again
            </Button>
          }
          description="FieldOS could not load your operational summary. Your project data is unchanged."
          icon={<Activity aria-hidden="true" className="size-5" />}
          title="Dashboard temporarily unavailable"
        />
      ) : (
        <>
          <section
            aria-label="Today's summary"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          >
            <SummaryMetric
              href="/projects"
              icon={TriangleAlert}
              label="Projects needing attention"
              tone="amber"
              value={
                dashboard.summary.projectsNeedingAttention + dashboard.summary.criticalProjects
              }
            />
            <SummaryMetric
              href="/inbox"
              icon={Inbox}
              label="Unread messages"
              value={recentMessages}
            />
            <SummaryMetric
              href="#recommendations"
              icon={Sparkles}
              label="Pending recommendations"
              tone="blue"
              value={recommendations.length}
            />
            <SummaryMetric
              href="/action-items"
              icon={ClipboardCheck}
              label="Outstanding Action Items"
              tone="red"
              value={actionItems.length}
            />
          </section>

          <section id="recommendations" className="scroll-mt-24 space-y-4">
            <SectionHeader
              count={recommendations.length}
              description="Review the next best actions suggested from project evidence."
              title="My Recommendations"
            />
            {recommendationsQuery.isLoading ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <Skeleton className="h-80" />
                <Skeleton className="h-80" />
              </div>
            ) : recommendations.length === 0 ? (
              <EmptyState
                description="New recommendations will appear here when FieldOS identifies a decision or follow-up in your project evidence."
                icon={<CheckCircle2 aria-hidden="true" className="size-5" />}
                title="You are all caught up"
              />
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {sortRecommendations(recommendations).map((recommendation) => (
                  <RecommendationCard
                    busy={approveMutation.isPending || dismissMutation.isPending}
                    key={recommendation.id}
                    onApprove={() => approveMutation.mutate(recommendation.id)}
                    onDismiss={() => dismissMutation.mutate(recommendation.id)}
                    onSnooze={() => snoozeRecommendation(recommendation.id)}
                    recommendation={recommendation}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
            <div className="space-y-4">
              <SectionHeader
                actionHref="/action-items"
                actionLabel="View all"
                count={actionItems.length}
                title="My Action Items"
              />
              {actionItems.length === 0 ? (
                <EmptyState
                  description="Items assigned to you will appear here for quick completion."
                  icon={<ClipboardCheck aria-hidden="true" className="size-5" />}
                  title="No assigned Action Items"
                />
              ) : (
                <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                  {actionItems.slice(0, 6).map((item) => (
                    <ActionItemRow
                      actionItem={item}
                      busy={completeMutation.isPending}
                      key={item.id}
                      onComplete={() => completeMutation.mutate(item.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <SectionHeader title="Recent Activity" />
              <div className="rounded-lg border border-slate-200 bg-white px-5">
                {dashboard.recentActivity.slice(0, 10).map((activity) => (
                  <Link
                    className="block border-b border-slate-100 py-4 last:border-b-0 hover:text-slate-700"
                    href={
                      activity.conversationId
                        ? `/inbox/${activity.conversationId}`
                        : `/projects/${activity.projectId}`
                    }
                    key={activity.id}
                  >
                    <div className="text-sm font-medium text-slate-950">{activity.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {activity.projectName} · {formatTime(activity.occurredAt)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryMetric({
  href,
  icon: Icon,
  label,
  tone = "slate",
  value
}: {
  href: string;
  icon: typeof Activity;
  label: string;
  tone?: "amber" | "blue" | "red" | "slate";
  value: number;
}) {
  const tones = {
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-600"
  };
  return (
    <Link
      className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300"
      href={href}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={`flex size-9 items-center justify-center rounded-md ${tones[tone]}`}>
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <span className="text-2xl font-semibold text-slate-950">{value}</span>
      </div>
      <div className="mt-3 text-sm font-medium text-slate-600">{label}</div>
    </Link>
  );
}

function SectionHeader({
  actionHref,
  actionLabel,
  count,
  description,
  title
}: {
  actionHref?: string;
  actionLabel?: string;
  count?: number;
  description?: string;
  title: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          {typeof count === "number" && count > 0 ? <Badge variant="muted">{count}</Badge> : null}
        </div>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {actionHref && actionLabel ? (
        <Link className="text-sm font-medium text-slate-600 hover:text-slate-950" href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function ActionItemRow({
  actionItem,
  busy,
  onComplete
}: {
  actionItem: ActionItem;
  busy: boolean;
  onComplete: () => void;
}) {
  return (
    <div className="flex gap-3 p-4">
      <button
        aria-label={`Complete ${actionItem.title}`}
        className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-400 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700"
        disabled={busy}
        onClick={onComplete}
        type="button"
      >
        <Check aria-hidden="true" className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-medium text-slate-950">{actionItem.title}</div>
          <Badge variant={actionItem.priority === "URGENT" ? "warning" : "muted"}>
            {formatLabel(actionItem.priority)}
          </Badge>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {actionItem.project?.name ?? "No project"} · Opened {formatTime(actionItem.createdAt)}
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-label="Loading dashboard">
      <Skeleton className="h-16 w-full max-w-lg" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-28" key={index} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

function sortRecommendations(recommendations: Recommendation[]) {
  const rank = { HIGH: 1, LOW: 3, MEDIUM: 2, URGENT: 0 };
  return [...recommendations].sort((a, b) => rank[a.priority] - rank[b.priority]);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
