"use client";

import { Badge, Button, EmptyState, PageHeader, Skeleton } from "@fieldos/ui";
import { Check, ClipboardCheck, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { AppShell } from "../../components/app-shell";
import { ActionItemAssigneeSelect } from "../../components/action-item-assignee-select";
import { AuthGuard } from "../../components/auth-guard";
import { OrganizationOnboarding } from "../../components/organization-onboarding";
import { OrganizationSelector } from "../../components/organization-selector";
import { api, type ActionItem } from "../../lib/api";
import { useMe, useOperationsDashboard, useOrganizations } from "../../lib/queries";
import { useActiveOrganizationStore } from "../../store/active-organization-store";

type ActionView = "assigned" | "unassigned" | "team" | "overdue" | "completed";

export default function ActionItemsPage() {
  return (
    <AuthGuard>
      <AppShell>
        <ActionItemsContent />
      </AppShell>
    </AuthGuard>
  );
}

function ActionItemsContent() {
  const queryClient = useQueryClient();
  const organizationsQuery = useOrganizations();
  const meQuery = useMe();
  const { activeOrganizationId, setActiveOrganizationId } = useActiveOrganizationStore();
  const organizations = organizationsQuery.data?.organizations ?? [];
  const organization =
    organizations.find((item) => item.id === activeOrganizationId) ?? organizations[0];
  const dashboardQuery = useOperationsDashboard(organization?.id ?? null);
  const [view, setView] = React.useState<ActionView>("assigned");

  React.useEffect(() => {
    if (!activeOrganizationId && organizations[0]) setActiveOrganizationId(organizations[0].id);
  }, [activeOrganizationId, organizations, setActiveOrganizationId]);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["operations-dashboard", organization?.id] });
  const acceptMutation = useMutation({ mutationFn: api.acceptActionItem, onSuccess: refresh });
  const completeMutation = useMutation({ mutationFn: api.completeActionItem, onSuccess: refresh });
  const dismissMutation = useMutation({ mutationFn: api.ignoreActionItem, onSuccess: refresh });

  if (organizationsQuery.isLoading) return <Skeleton className="h-72" />;
  if (organizations.length === 0) return <OrganizationOnboarding />;

  const groups = dashboardQuery.data?.dashboard.actionItems;
  const all = groups ? [...groups.urgent, ...groups.high, ...groups.medium, ...groups.low] : [];
  const assigned = all.filter((item) => item.assignedToUserId === meQuery.data?.user.id);
  const unassigned = all.filter((item) => item.assignedToUserId === null);
  const team = all.filter(
    (item) => item.assignedToUserId !== null && item.assignedToUserId !== meQuery.data?.user.id
  );
  const overdue = all.filter(isOverdue);
  const completed = groups?.completed ?? [];
  const visible =
    view === "assigned"
      ? assigned
      : view === "unassigned"
        ? unassigned
        : view === "team"
          ? team
          : view === "overdue"
            ? overdue
            : completed;
  const busy = acceptMutation.isPending || completeMutation.isPending || dismissMutation.isPending;

  return (
    <div className="space-y-7">
      <PageHeader
        actions={<OrganizationSelector organizations={organizations} />}
        description="Complete assigned follow-ups without leaving the page."
        title="Action Items"
      />

      <div
        className="inline-flex max-w-full gap-1 overflow-x-auto rounded-md bg-slate-100 p-1"
        role="tablist"
      >
        <ViewTab
          active={view === "assigned"}
          count={assigned.length}
          label="Assigned to me"
          onClick={() => setView("assigned")}
        />
        <ViewTab
          active={view === "unassigned"}
          count={unassigned.length}
          label="Unassigned"
          onClick={() => setView("unassigned")}
        />
        <ViewTab
          active={view === "team"}
          count={team.length}
          label="Team"
          onClick={() => setView("team")}
        />
        <ViewTab
          active={view === "overdue"}
          count={overdue.length}
          label="Overdue"
          onClick={() => setView("overdue")}
        />
        <ViewTab
          active={view === "completed"}
          count={completed.length}
          label="Completed"
          onClick={() => setView("completed")}
        />
      </div>

      {dashboardQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          description={emptyDescription(view)}
          icon={<ClipboardCheck aria-hidden="true" className="size-5" />}
          title={emptyTitle(view)}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((item) => (
            <ActionItemCard
              actionItem={item}
              busy={busy}
              completed={view === "completed"}
              key={item.id}
              onAccept={() => acceptMutation.mutate(item.id)}
              onComplete={() => completeMutation.mutate(item.id)}
              onDismiss={() => dismissMutation.mutate(item.id)}
              overdueDays={view === "overdue" ? getDaysOverdue(item) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ViewTab({
  active,
  count,
  label,
  onClick
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={
        active
          ? "inline-flex h-9 items-center whitespace-nowrap rounded-md bg-white px-4 text-sm font-medium text-slate-950 shadow-sm"
          : "inline-flex h-9 items-center whitespace-nowrap rounded-md px-4 text-sm font-medium text-slate-600 hover:text-slate-950"
      }
      onClick={onClick}
      role="tab"
      type="button"
    >
      <span>{label}</span>
      <span
        className={`ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs ${
          label === "Overdue" && count > 0
            ? "bg-[var(--status-critical-soft)] text-[var(--status-critical-text)]"
            : "bg-slate-200 text-slate-600"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function ActionItemCard({
  actionItem,
  busy,
  completed = false,
  onAccept,
  onComplete,
  onDismiss,
  overdueDays
}: {
  actionItem: ActionItem;
  busy: boolean;
  completed?: boolean;
  onAccept: () => void;
  onComplete: () => void;
  onDismiss: () => void;
  overdueDays?: number;
}) {
  return (
    <article
      className={`relative overflow-hidden rounded-lg border border-slate-200 bg-white p-5 pl-6 shadow-sm ${completed ? "opacity-70" : ""}`}
    >
      <div className={priorityBar(actionItem.priority)} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {completed ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
            <Check aria-hidden="true" className="size-5" />
          </span>
        ) : (
          <button
            aria-label={`Complete ${actionItem.title}`}
            className="flex size-10 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-400 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700"
            disabled={busy}
            onClick={onComplete}
            type="button"
          >
            <Check aria-hidden="true" className="size-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={
                completed
                  ? "font-semibold text-[var(--text-secondary)] line-through"
                  : "font-semibold text-slate-950"
              }
            >
              {actionItem.title}
            </h2>
            <Badge variant={actionItem.priority === "URGENT" ? "warning" : "muted"}>
              {formatLabel(actionItem.priority)}
            </Badge>
          </div>
          {overdueDays ? (
            <p className="mt-1 text-sm font-medium text-[var(--status-critical-text)]">
              {overdueDays} {overdueDays === 1 ? "day" : "days"} overdue
            </p>
          ) : null}
          {completed ? (
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {formatCompletionDate(actionItem.updatedAt)}
            </p>
          ) : null}
          {actionItem.description ? (
            <p className="mt-2 text-sm leading-6 text-slate-600">{actionItem.description}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
            <span>{actionItem.project?.name ?? "No project"}</span>
            <span>
              {actionItem.dueDate ? `Due ${formatDate(actionItem.dueDate)}` : "Due date not set"}
            </span>
            <span>Opened {formatDate(actionItem.createdAt)}</span>
          </div>
          {!completed ? (
            <div className="mt-4 space-y-3">
              <ActionItemAssigneeSelect actionItem={actionItem} />
              <div className="flex flex-wrap gap-2">
                {actionItem.status === "PENDING" ? (
                  <Button className="h-9" disabled={busy} onClick={onAccept} variant="secondary">
                    Accept
                  </Button>
                ) : null}
                <Button className="h-9 px-3" disabled={busy} onClick={onDismiss} variant="ghost">
                  <X aria-hidden="true" className="size-4" />
                  Dismiss
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function priorityBar(priority: ActionItem["priority"]) {
  if (priority === "URGENT") return "absolute inset-y-0 left-0 w-1 bg-red-500";
  if (priority === "HIGH") return "absolute inset-y-0 left-0 w-1 bg-amber-500";
  if (priority === "MEDIUM") return "absolute inset-y-0 left-0 w-1 bg-blue-500";
  return "absolute inset-y-0 left-0 w-1 bg-slate-300";
}

function emptyDescription(view: ActionView) {
  if (view === "completed") return "Completed work will appear here for reference.";
  if (view === "overdue") return "Nothing is currently past its due date.";
  if (view === "unassigned") return "New follow-ups waiting for an owner will appear here.";
  if (view === "team") return "Work assigned to other project members will appear here.";
  return "New work assigned to your account will appear here.";
}

function emptyTitle(view: ActionView) {
  if (view === "assigned") return "Nothing assigned to you";
  if (view === "unassigned") return "No unassigned Action Items";
  if (view === "team") return "Nothing assigned to the team";
  if (view === "overdue") return "No overdue Action Items";
  return "No completed Action Items";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function isOverdue(actionItem: ActionItem) {
  if (actionItem.status !== "PENDING" && actionItem.status !== "ACCEPTED") return false;

  const deadline = getActionItemDeadline(actionItem);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return deadline.getTime() < today.getTime();
}

function getDaysOverdue(actionItem: ActionItem) {
  const deadline = getActionItemDeadline(actionItem);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(1, Math.ceil((today.getTime() - deadline.getTime()) / (24 * 60 * 60 * 1000)));
}

function getActionItemDeadline(actionItem: ActionItem) {
  if (actionItem.dueDate) return new Date(actionItem.dueDate);
  return new Date(new Date(actionItem.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000);
}

function formatCompletionDate(value: string) {
  const updatedAt = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completedDay = new Date(updatedAt);
  completedDay.setHours(0, 0, 0, 0);
  const days = Math.max(
    0,
    Math.floor((today.getTime() - completedDay.getTime()) / (24 * 60 * 60 * 1000))
  );

  return `Completed ${days} ${days === 1 ? "day" : "days"} ago`;
}

function formatLabel(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
