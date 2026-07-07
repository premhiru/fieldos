"use client";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@fieldos/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";

import { AppShell } from "../components/app-shell";
import { AuthGuard } from "../components/auth-guard";
import { OrganizationOnboarding } from "../components/organization-onboarding";
import { OrganizationSelector } from "../components/organization-selector";
import { api, type ActionItem, type DashboardHealth } from "../lib/api";
import { useMe, useOperationsDashboard, useOrganizations } from "../lib/queries";
import { useActiveOrganizationStore } from "../store/active-organization-store";

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
  const organizationsQuery = useOrganizations();
  const meQuery = useMe();
  const { activeOrganizationId, setActiveOrganizationId } = useActiveOrganizationStore();
  const organizations = organizationsQuery.data?.organizations ?? [];
  const selectedOrganization =
    organizations.find((organization) => organization.id === activeOrganizationId) ??
    organizations[0];
  const dashboardQuery = useOperationsDashboard(selectedOrganization?.id ?? null);
  const dashboard = dashboardQuery.data?.dashboard;
  const queryClient = useQueryClient();

  const invalidateDashboard = React.useCallback(() => {
    if (selectedOrganization) {
      void queryClient.invalidateQueries({
        queryKey: ["operations-dashboard", selectedOrganization.id]
      });
    }
  }, [queryClient, selectedOrganization]);

  const acceptMutation = useMutation({
    mutationFn: (actionItemId: string) => api.acceptActionItem(actionItemId),
    onSuccess: invalidateDashboard
  });
  const completeMutation = useMutation({
    mutationFn: (actionItemId: string) => api.completeActionItem(actionItemId),
    onSuccess: invalidateDashboard
  });
  const dismissMutation = useMutation({
    mutationFn: (actionItemId: string) => api.ignoreActionItem(actionItemId),
    onSuccess: invalidateDashboard
  });

  React.useEffect(() => {
    if (!activeOrganizationId && organizations[0]) {
      setActiveOrganizationId(organizations[0].id);
    }
  }, [activeOrganizationId, organizations, setActiveOrganizationId]);

  if (organizationsQuery.isLoading) {
    return <p className="text-sm text-slate-600">Loading command center...</p>;
  }

  if (organizations.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-950">Operations Command Center</h1>
        <OrganizationOnboarding />
      </div>
    );
  }

  const greetingName = meQuery.data?.user.name ?? "there";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {getGreeting()}, {greetingName}
          </p>
          <h1 className="text-2xl font-semibold text-slate-950">Operations Command Center</h1>
          <p className="text-sm text-slate-600">{selectedOrganization?.name}</p>
        </div>
        <OrganizationSelector organizations={organizations} />
      </div>

      {dashboardQuery.isLoading ? (
        <p className="text-sm text-slate-600">Loading operations...</p>
      ) : dashboardQuery.isError || !dashboard ? (
        <Card>
          <CardContent>
            <p className="text-sm text-slate-600">Unable to load operations data.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Active Projects" value={dashboard.summary.activeProjects} />
            <SummaryCard label="Healthy Projects" value={dashboard.summary.healthyProjects} />
            <SummaryCard
              label="Needs Attention"
              value={dashboard.summary.projectsNeedingAttention}
            />
            <SummaryCard label="Critical Projects" value={dashboard.summary.criticalProjects} />
            <SummaryCard label="Open Action Items" value={dashboard.summary.openActionItems} />
            <SummaryCard
              label="High Priority Items"
              value={dashboard.summary.highPriorityActionItems}
            />
            <SummaryCard label="Today's Activity" value={dashboard.summary.todaysActivityCount} />
            <SummaryCard label="Pending AI Reviews" value={dashboard.summary.pendingAIReviews} />
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Projects Requiring Attention</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.projects.length === 0 ? (
                  <p className="text-sm text-slate-600">No active projects yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="py-2 pr-4 font-medium">Project</th>
                          <th className="py-2 pr-4 font-medium">Health</th>
                          <th className="py-2 pr-4 font-medium">Last Activity</th>
                          <th className="py-2 pr-4 font-medium">Highest Priority Issue</th>
                          <th className="py-2 pr-4 font-medium">Open Items</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {dashboard.projects.slice(0, 8).map((project) => (
                          <tr key={project.id}>
                            <td className="py-3 pr-4">
                              <Link
                                className="font-medium text-slate-950 hover:text-slate-700"
                                href={`/projects/${project.id}`}
                              >
                                {project.name}
                              </Link>
                              <div className="text-xs text-slate-500">{project.code}</div>
                            </td>
                            <td className="py-3 pr-4">
                              <HealthBadge health={project.health} />
                            </td>
                            <td className="py-3 pr-4 text-slate-600">
                              {formatTime(project.lastActivityAt)}
                            </td>
                            <td className="max-w-[260px] py-3 pr-4 text-slate-600">
                              {project.highestPriorityIssue ?? "No open issue"}
                            </td>
                            <td className="py-3 pr-4 text-slate-950">
                              {project.openActionItemCount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Daily Brief</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboard.brief.bullets.map((bullet) => (
                    <div
                      key={bullet}
                      className="rounded-md border border-slate-200 p-3 text-sm text-slate-700"
                    >
                      {bullet}
                    </div>
                  ))}
                  <Badge variant="muted">
                    {dashboard.brief.generatedBy === "AI"
                      ? "AI Generated"
                      : "Deterministic Fallback"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>My Action Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  {(["urgent", "high", "medium", "low"] as const).map((group) => (
                    <ActionItemGroup
                      key={group}
                      actionItems={dashboard.actionItems[group]}
                      disabled={
                        acceptMutation.isPending ||
                        completeMutation.isPending ||
                        dismissMutation.isPending
                      }
                      label={group}
                      onAccept={(id) => acceptMutation.mutate(id)}
                      onComplete={(id) => completeMutation.mutate(id)}
                      onDismiss={(id) => dismissMutation.mutate(id)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Evidence</CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboard.recentActivity.length === 0 ? (
                    <p className="text-sm text-slate-600">No recent evidence updates.</p>
                  ) : (
                    <div className="space-y-3">
                      {dashboard.recentActivity.map((activity) => (
                        <div
                          key={activity.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-950">
                              {activity.title}
                            </div>
                            {activity.description ? (
                              <div className="mt-1 line-clamp-2 text-xs text-slate-600">
                                {extractVisualSummary(activity.description)}
                              </div>
                            ) : null}
                            <div className="text-xs text-slate-500">
                              {activity.projectName} - {formatTime(activity.occurredAt)}
                            </div>
                          </div>
                          <Link
                            className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-slate-100 px-3 text-xs font-medium text-slate-950 hover:bg-slate-200"
                            href={
                              activity.conversationId
                                ? `/inbox/${activity.conversationId}`
                                : `/projects/${activity.projectId}`
                            }
                          >
                            {activity.conversationId ? "Open Update" : "View Project"}
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Milestones</CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboard.milestones.length === 0 ? (
                    <p className="text-sm text-slate-600">No upcoming milestones.</p>
                  ) : (
                    <div className="space-y-3">
                      {dashboard.milestones.map((milestone) => (
                        <div
                          key={milestone.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3"
                        >
                          <div>
                            <div className="text-sm font-medium text-slate-950">
                              {milestone.title}
                            </div>
                            <div className="text-xs text-slate-500">
                              {milestone.project.name} - {formatDate(milestone.dueDate)}
                            </div>
                          </div>
                          <Badge variant={milestone.status === "OVERDUE" ? "warning" : "muted"}>
                            {formatStatus(milestone.status)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <Card>
      <CardContent>
        <div className="text-sm font-medium text-slate-500">{label}</div>
        <div className="mt-2 text-3xl font-semibold text-slate-950">{value}</div>
      </CardContent>
    </Card>
  );
}

function HealthBadge({ health }: Readonly<{ health: DashboardHealth }>) {
  if (health === "CRITICAL") {
    return <Badge variant="warning">Critical</Badge>;
  }

  if (health === "NEEDS_ATTENTION") {
    return <Badge variant="warning">Needs Attention</Badge>;
  }

  return <Badge variant="success">Healthy</Badge>;
}

function ActionItemGroup({
  actionItems,
  disabled,
  label,
  onAccept,
  onComplete,
  onDismiss
}: Readonly<{
  actionItems: ActionItem[];
  disabled: boolean;
  label: "urgent" | "high" | "medium" | "low";
  onAccept: (id: string) => void;
  onComplete: (id: string) => void;
  onDismiss: (id: string) => void;
}>) {
  if (actionItems.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      {actionItems.map((actionItem) => (
        <div key={actionItem.id} className="rounded-md border border-slate-200 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-950">{actionItem.title}</div>
              <div className="mt-1 text-xs text-slate-500">
                {actionItem.project?.name ?? actionItem.suggestedProject?.name ?? "No project"} -{" "}
                {formatTime(actionItem.createdAt)} - {formatStatus(actionItem.type)} -{" "}
                {formatStatus(actionItem.status)}
              </div>
              {actionItem.description ? (
                <p className="mt-2 text-sm text-slate-600">{actionItem.description}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                className="h-8 px-3 text-xs"
                disabled={disabled}
                onClick={() => onAccept(actionItem.id)}
                variant="secondary"
              >
                Accept
              </Button>
              <Button
                className="h-8 px-3 text-xs"
                disabled={disabled}
                onClick={() => onComplete(actionItem.id)}
                variant="secondary"
              >
                Complete
              </Button>
              <Button
                className="h-8 px-3 text-xs"
                disabled={disabled}
                onClick={() => onDismiss(actionItem.id)}
                variant="ghost"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function formatTime(value: string | null): string {
  if (!value) {
    return "No activity";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium"
  }).format(new Date(value));
}

function formatStatus(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function extractVisualSummary(description: string): string {
  return (
    description
      .split("\n")
      .find((line) => line.startsWith("Visual Summary:"))
      ?.replace("Visual Summary:", "")
      .trim() ?? description
  );
}
