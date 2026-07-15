"use client";

import { Button, EmptyState, PageHeader, Skeleton } from "@fieldos/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, LoaderCircle } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { AppShell } from "../../components/app-shell";
import { AuthGuard } from "../../components/auth-guard";
import { OrganizationOnboarding } from "../../components/organization-onboarding";
import { OrganizationSelector } from "../../components/organization-selector";
import { api, type ProjectReportType } from "../../lib/api";
import { useOrganizations, useProjects, useRecentReports } from "../../lib/queries";
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
  const reportsQuery = useRecentReports(organization?.id ?? null);

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

  if (!organization) {
    return <OrganizationOnboarding />;
  }

  const projects = projectsQuery.data?.projects ?? [];
  const reports = reportsQuery.data?.reports ?? [];
  return (
    <div className="space-y-8">
      <PageHeader
        actions={<OrganizationSelector organizations={organizations} />}
        description="Daily summaries, weekly progress, evidence, and generated project reports."
        title="Reports"
      />

      <section aria-labelledby="recent-reports-heading" className="space-y-3">
        <div>
          <h2
            className="text-lg font-semibold text-[var(--text-primary)]"
            id="recent-reports-heading"
          >
            Recent Reports
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            The latest generated intelligence across your projects.
          </p>
        </div>

        {reportsQuery.isLoading ? (
          <RecentReportsSkeleton />
        ) : reports.length === 0 ? (
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface)] px-5 py-8 text-sm text-[var(--text-secondary)]">
            No reports generated yet. Open a project to generate your first report.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-default)] rounded-lg border border-[var(--border-default)] bg-[var(--surface)]">
            {reports.map((report) => (
              <Link
                className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-[var(--surface-subtle)] sm:px-5"
                href={`/projects/${report.projectId}/intelligence`}
                key={report.id}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--surface-muted)] text-[var(--text-secondary)]">
                  <FileText aria-hidden="true" className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-[var(--text-primary)]">
                    {reportTypeLabel(report.type)}
                  </span>
                  <span className="block truncate text-sm text-[var(--text-secondary)]">
                    {report.project.name}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs text-[var(--text-secondary)]">
                  Generated {formatRelativeTime(report.generatedAt ?? report.updatedAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="project-reports-heading" className="space-y-3">
        <div>
          <h2
            className="text-lg font-semibold text-[var(--text-primary)]"
            id="project-reports-heading"
          >
            Project Reports
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Open a project workspace or queue a fresh Morning Brief.
          </p>
        </div>

        {projectsQuery.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton className="h-44" key={index} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            action={
              <Link
                className="text-sm font-medium text-[var(--text-primary)] underline"
                href="/projects"
              >
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
              <ProjectReportCard
                key={project.id}
                organizationId={organization.id}
                project={project}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProjectReportCard({
  organizationId,
  project
}: Readonly<{
  organizationId: string;
  project: { code: string; id: string; name: string };
}>) {
  const queryClient = useQueryClient();
  const [successful, setSuccessful] = React.useState(false);
  const successTimer = React.useRef<number | null>(null);
  const generateReportMutation = useMutation({
    mutationFn: () => api.generateProjectReport(project.id, "MORNING_BRIEF"),
    onSuccess: async () => {
      setSuccessful(true);
      await queryClient.invalidateQueries({ queryKey: ["recent-reports", organizationId] });

      if (successTimer.current) window.clearTimeout(successTimer.current);
      successTimer.current = window.setTimeout(() => setSuccessful(false), 3_000);
    }
  });

  React.useEffect(
    () => () => {
      if (successTimer.current) window.clearTimeout(successTimer.current);
    },
    []
  );

  return (
    <article className="rounded-lg border border-[var(--border-default)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
      <Link className="group block" href={`/projects/${project.id}/intelligence`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="truncate font-semibold text-[var(--text-primary)]">{project.name}</div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">{project.code}</div>
          </div>
          <FileText aria-hidden="true" className="size-5 shrink-0 text-[var(--text-tertiary)]" />
        </div>
        <p className="mt-5 text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
          Open intelligence and reports
        </p>
      </Link>
      <Button
        className="mt-4 w-full"
        disabled={generateReportMutation.isPending}
        onClick={() => generateReportMutation.mutate()}
        type="button"
        variant="secondary"
      >
        {generateReportMutation.isPending ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : successful ? (
          <Check aria-hidden="true" className="size-4" />
        ) : (
          <FileText aria-hidden="true" className="size-4" />
        )}
        {generateReportMutation.isPending
          ? "Generating..."
          : successful
            ? "Report queued"
            : "Generate Report"}
      </Button>
    </article>
  );
}

function RecentReportsSkeleton() {
  return (
    <div
      aria-label="Loading recent reports"
      className="divide-y divide-[var(--border-default)] rounded-lg border border-[var(--border-default)] bg-[var(--surface)]"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <div className="flex items-center gap-3 px-4 py-4 sm:px-5" key={index}>
          <Skeleton className="size-9 shrink-0 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48 max-w-[60%]" />
          </div>
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

function reportTypeLabel(type: ProjectReportType): string {
  return type === "MORNING_BRIEF"
    ? "Morning Brief"
    : type === "DAILY_SUMMARY"
      ? "Daily Summary"
      : type === "WEEKLY_PROGRESS"
        ? "Weekly Progress"
        : type === "RISK_SUMMARY"
          ? "Risk Summary"
          : "Pending Decisions";
}

function formatRelativeTime(value: string): string {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1_000));

  if (elapsedSeconds < 60) return "just now";
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}
