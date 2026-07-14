"use client";

import { Badge, Button, EmptyState, PageHeader, Skeleton } from "@fieldos/ui";
import { Check, ClipboardCheck, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { AppShell } from "../../components/app-shell";
import { AuthGuard } from "../../components/auth-guard";
import { OrganizationOnboarding } from "../../components/organization-onboarding";
import { OrganizationSelector } from "../../components/organization-selector";
import { api, type ActionItem } from "../../lib/api";
import { useMe, useOperationsDashboard, useOrganizations } from "../../lib/queries";
import { useActiveOrganizationStore } from "../../store/active-organization-store";

type ActionView = "assigned" | "overdue" | "completed";

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
  const visible = view === "assigned" ? assigned : [];
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
          label="Assigned to me"
          onClick={() => setView("assigned")}
        />
        <ViewTab active={view === "overdue"} label="Overdue" onClick={() => setView("overdue")} />
        <ViewTab
          active={view === "completed"}
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
          title={view === "assigned" ? "Nothing assigned to you" : `No ${view} Action Items`}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((item) => (
            <ActionItemCard
              actionItem={item}
              busy={busy}
              key={item.id}
              onAccept={() => acceptMutation.mutate(item.id)}
              onComplete={() => completeMutation.mutate(item.id)}
              onDismiss={() => dismissMutation.mutate(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ViewTab({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={
        active
          ? "h-9 whitespace-nowrap rounded-md bg-white px-4 text-sm font-medium text-slate-950 shadow-sm"
          : "h-9 whitespace-nowrap rounded-md px-4 text-sm font-medium text-slate-600 hover:text-slate-950"
      }
      onClick={onClick}
      role="tab"
      type="button"
    >
      {label}
    </button>
  );
}

function ActionItemCard({
  actionItem,
  busy,
  onAccept,
  onComplete,
  onDismiss
}: {
  actionItem: ActionItem;
  busy: boolean;
  onAccept: () => void;
  onComplete: () => void;
  onDismiss: () => void;
}) {
  return (
    <article className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-5 pl-6 shadow-sm">
      <div className={priorityBar(actionItem.priority)} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <button
          aria-label={`Complete ${actionItem.title}`}
          className="flex size-10 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-400 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700"
          disabled={busy}
          onClick={onComplete}
          type="button"
        >
          <Check aria-hidden="true" className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-950">{actionItem.title}</h2>
            <Badge variant={actionItem.priority === "URGENT" ? "warning" : "muted"}>
              {formatLabel(actionItem.priority)}
            </Badge>
          </div>
          {actionItem.description ? (
            <p className="mt-2 text-sm leading-6 text-slate-600">{actionItem.description}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
            <span>{actionItem.project?.name ?? "No project"}</span>
            <span>Due date not set</span>
            <span>Opened {formatDate(actionItem.createdAt)}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
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
  if (view === "completed") return "Completed work will move here when history is available.";
  if (view === "overdue") return "Nothing with a tracked due date currently needs escalation.";
  return "New work assigned to your account will appear here.";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function formatLabel(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
