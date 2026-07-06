"use client";

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@fieldos/ui";
import * as React from "react";

import { AppShell } from "../../components/app-shell";
import { AuthGuard } from "../../components/auth-guard";
import { OrganizationOnboarding } from "../../components/organization-onboarding";
import { OrganizationSelector } from "../../components/organization-selector";
import { useOperationsDashboard, useOrganizations } from "../../lib/queries";
import { useActiveOrganizationStore } from "../../store/active-organization-store";

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
  const organizationsQuery = useOrganizations();
  const { activeOrganizationId, setActiveOrganizationId } = useActiveOrganizationStore();
  const organizations = organizationsQuery.data?.organizations ?? [];
  const selectedOrganization =
    organizations.find((organization) => organization.id === activeOrganizationId) ??
    organizations[0];
  const dashboardQuery = useOperationsDashboard(selectedOrganization?.id ?? null);
  const groups = dashboardQuery.data?.dashboard.actionItems;

  React.useEffect(() => {
    if (!activeOrganizationId && organizations[0]) {
      setActiveOrganizationId(organizations[0].id);
    }
  }, [activeOrganizationId, organizations, setActiveOrganizationId]);

  if (organizationsQuery.isLoading) {
    return <p className="text-sm text-slate-600">Loading Action Items...</p>;
  }

  if (organizations.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-950">Action Items</h1>
        <OrganizationOnboarding />
      </div>
    );
  }

  const actionItems = groups
    ? [...groups.urgent, ...groups.high, ...groups.medium, ...groups.low]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Action Items</h1>
          <p className="text-sm text-slate-600">{selectedOrganization?.name}</p>
        </div>
        <OrganizationSelector organizations={organizations} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assigned to me</CardTitle>
        </CardHeader>
        <CardContent>
          {dashboardQuery.isLoading ? (
            <p className="text-sm text-slate-600">Loading assigned Action Items...</p>
          ) : actionItems.length === 0 ? (
            <p className="text-sm text-slate-600">No assigned Action Items.</p>
          ) : (
            <div className="space-y-3">
              {actionItems.map((actionItem) => (
                <div className="rounded-md border border-slate-200 p-3" key={actionItem.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-medium text-slate-950">{actionItem.title}</h2>
                    <Badge variant="muted">{actionItem.priority}</Badge>
                    <Badge variant="muted">{actionItem.status}</Badge>
                  </div>
                  {actionItem.description ? (
                    <p className="mt-2 text-sm text-slate-600">{actionItem.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-500">
                    {actionItem.project?.name ?? actionItem.suggestedProject?.name ?? "No project"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
