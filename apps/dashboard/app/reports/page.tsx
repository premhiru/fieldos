"use client";

import { EmptyState, PageHeader, Skeleton } from "@fieldos/ui";
import { FileText } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { AppShell } from "../../components/app-shell";
import { AuthGuard } from "../../components/auth-guard";
import { OrganizationOnboarding } from "../../components/organization-onboarding";
import { OrganizationSelector } from "../../components/organization-selector";
import { useOrganizations, useProjects } from "../../lib/queries";
import { useActiveOrganizationStore } from "../../store/active-organization-store";

export default function ReportsPage() {
  return (
    <AuthGuard>
      <AppShell>
        <ReportsContent />
      </AppShell>
    </AuthGuard>
  );
}

function ReportsContent() {
  const organizationsQuery = useOrganizations();
  const { activeOrganizationId, setActiveOrganizationId } = useActiveOrganizationStore();
  const organizations = organizationsQuery.data?.organizations ?? [];
  const organization =
    organizations.find((item) => item.id === activeOrganizationId) ?? organizations[0];
  const projectsQuery = useProjects(organization?.id ?? null);

  React.useEffect(() => {
    if (!activeOrganizationId && organizations[0]) {
      setActiveOrganizationId(organizations[0].id);
    }
  }, [activeOrganizationId, organizations, setActiveOrganizationId]);

  if (organizationsQuery.isLoading) {
    return <Skeleton className="h-72 w-full" />;
  }

  if (organizations.length === 0) {
    return <OrganizationOnboarding />;
  }

  const projects = projectsQuery.data?.projects ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        actions={<OrganizationSelector organizations={organizations} />}
        description="Daily summaries, weekly progress, evidence, and generated project reports."
        title="Reports"
      />

      {projectsQuery.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton className="h-32" key={index} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          action={
            <Link className="text-sm font-medium text-slate-950 underline" href="/projects">
              Create a project
            </Link>
          }
          description="Reports are organized by project so every summary stays grounded in its operational record."
          icon={<FileText aria-hidden="true" className="size-5" />}
          title="No project reports yet"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link
              className="group rounded-lg border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
              href={`/projects/${project.id}/intelligence`}
              key={project.id}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-950">{project.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{project.code}</div>
                </div>
                <FileText aria-hidden="true" className="size-5 text-slate-400" />
              </div>
              <p className="mt-5 text-sm text-slate-600 group-hover:text-slate-950">
                Open intelligence and reports
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
