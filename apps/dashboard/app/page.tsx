"use client";

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@fieldos/ui";
import * as React from "react";

import { AppShell } from "../components/app-shell";
import { AuthGuard } from "../components/auth-guard";
import { OrganizationOnboarding } from "../components/organization-onboarding";
import { OrganizationSelector } from "../components/organization-selector";
import { useOrganizations, useProjects } from "../lib/queries";
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
  const { activeOrganizationId, setActiveOrganizationId } = useActiveOrganizationStore();
  const organizations = organizationsQuery.data?.organizations ?? [];
  const selectedOrganization =
    organizations.find((organization) => organization.id === activeOrganizationId) ??
    organizations[0];
  const projectsQuery = useProjects(selectedOrganization?.id ?? null);
  const projects = projectsQuery.data?.projects ?? [];

  React.useEffect(() => {
    if (!activeOrganizationId && organizations[0]) {
      setActiveOrganizationId(organizations[0].id);
    }
  }, [activeOrganizationId, organizations, setActiveOrganizationId]);

  if (organizationsQuery.isLoading) {
    return <p className="text-sm text-slate-600">Loading dashboard...</p>;
  }

  if (organizations.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-950">FieldOS Dashboard</h1>
        <OrganizationOnboarding />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">FieldOS Dashboard</h1>
          <p className="text-sm text-slate-600">
            Active organization: {selectedOrganization?.name}
          </p>
        </div>
        <OrganizationSelector organizations={organizations} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-950">{projects.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent projects</CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-sm text-slate-600">No projects yet.</p>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 5).map((project) => (
                <div key={project.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-950">{project.name}</div>
                    <div className="text-sm text-slate-500">{project.code}</div>
                  </div>
                  <Badge variant="muted">{project.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
