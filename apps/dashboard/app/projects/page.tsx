"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Skeleton
} from "@fieldos/ui";
import { FolderKanban, Plus, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";
import { z } from "zod";

import { AppShell } from "../../components/app-shell";
import { AuthGuard } from "../../components/auth-guard";
import { OrganizationOnboarding } from "../../components/organization-onboarding";
import { OrganizationSelector } from "../../components/organization-selector";
import {
  api,
  type DashboardProject,
  type Project,
  type ProjectStateHealth,
  type ProjectStatus
} from "../../lib/api";
import { useOperationsDashboard, useOrganizations, useProjects } from "../../lib/queries";
import { projectCode } from "../../lib/slug";
import { useActiveOrganizationStore } from "../../store/active-organization-store";

const createProjectFormSchema = z.object({
  code: z.string().trim().min(2),
  name: z.string().trim().min(1),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).default("ACTIVE")
});

type ProjectView = "all" | "active" | "needs_attention" | "critical";

export default function ProjectsPage() {
  return (
    <AuthGuard>
      <AppShell>
        <ProjectsContent />
      </AppShell>
    </AuthGuard>
  );
}

function ProjectsContent() {
  const queryClient = useQueryClient();
  const organizationsQuery = useOrganizations();
  const organizations = organizationsQuery.data?.organizations ?? [];
  const { activeOrganizationId, setActiveOrganizationId } = useActiveOrganizationStore();
  const activeOrganization =
    organizations.find((organization) => organization.id === activeOrganizationId) ??
    organizations[0];
  const projectsQuery = useProjects(activeOrganization?.id ?? null);
  const dashboardQuery = useOperationsDashboard(activeOrganization?.id ?? null);
  const projects = projectsQuery.data?.projects ?? [];
  const canCreateProject =
    activeOrganization?.role === "OWNER" || activeOrganization?.role === "ADMIN";
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [status, setStatus] = React.useState<ProjectStatus>("ACTIVE");
  const [codeEdited, setCodeEdited] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [view, setView] = React.useState<ProjectView>("all");
  const [showCreateForm, setShowCreateForm] = React.useState(false);

  const dashboardProjects = React.useMemo(
    () =>
      new Map(
        (dashboardQuery.data?.dashboard.projects ?? []).map((project) => [project.id, project])
      ),
    [dashboardQuery.data?.dashboard.projects]
  );
  const visibleProjects = projects.filter((project) =>
    matchesProjectView(project, dashboardProjects.get(project.id), view)
  );

  React.useEffect(() => {
    if (!activeOrganizationId && organizations[0]) {
      setActiveOrganizationId(organizations[0].id);
    }
  }, [activeOrganizationId, organizations, setActiveOrganizationId]);

  const mutation = useMutation({
    mutationFn: (body: { code: string; name: string; status: ProjectStatus }) =>
      api.createProject(activeOrganization?.id ?? "", {
        ...body,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      }),
    onSuccess: async () => {
      setName("");
      setCode("");
      setCodeEdited(false);
      setStatus("ACTIVE");
      setShowCreateForm(false);
      await queryClient.invalidateQueries({ queryKey: ["projects", activeOrganization?.id] });
    }
  });

  function handleNameChange(value: string) {
    setName(value);

    if (!codeEdited) {
      setCode(projectCode(value));
    }
  }

  if (organizationsQuery.isLoading) {
    return <Skeleton className="h-[560px] w-full" />;
  }

  if (organizations.length === 0) {
    return <OrganizationOnboarding />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<OrganizationSelector organizations={organizations} />}
        description="Create and manage projects for the active organization."
        title="Projects"
      />

      {canCreateProject ? (
        <div className="flex justify-end">
          <Button onClick={() => setShowCreateForm((value) => !value)} variant="secondary">
            {showCreateForm ? (
              <X aria-hidden="true" className="size-4" />
            ) : (
              <Plus aria-hidden="true" className="size-4" />
            )}
            {showCreateForm ? "Close" : "Create project"}
          </Button>
        </div>
      ) : null}

      {canCreateProject && showCreateForm ? (
        <Card id="create-project">
          <CardHeader>
            <CardTitle>Create Project</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 xl:grid-cols-[1fr_180px_180px_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                const parsed = createProjectFormSchema.safeParse({ code, name, status });

                if (!parsed.success) {
                  setValidationError("Enter a project name and code.");
                  return;
                }

                setValidationError(null);
                mutation.mutate(parsed.data);
              }}
            >
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Project name
                <input
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  value={name}
                  onChange={(event) => handleNameChange(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Project code
                <input
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  value={code}
                  onChange={(event) => {
                    setCodeEdited(true);
                    setCode(projectCode(event.target.value));
                  }}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Status
                <select
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as ProjectStatus)}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </label>
              <div className="flex items-end">
                <Button disabled={mutation.isPending} type="submit">
                  {mutation.isPending ? "Creating..." : "Create Project"}
                </Button>
              </div>
            </form>
            {validationError ? (
              <p className="mt-3 text-sm text-red-600">{validationError}</p>
            ) : null}
            {mutation.isError ? (
              <p className="mt-3 text-sm text-red-600">{(mutation.error as Error).message}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Project list</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="mb-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-md bg-slate-100 p-1"
            role="tablist"
          >
            <ProjectViewTab active={view === "all"} label="All" onClick={() => setView("all")} />
            <ProjectViewTab
              active={view === "active"}
              label="Active"
              onClick={() => setView("active")}
            />
            <ProjectViewTab
              active={view === "needs_attention"}
              label="Needs Attention"
              onClick={() => setView("needs_attention")}
            />
            <ProjectViewTab
              active={view === "critical"}
              label="Critical"
              onClick={() => setView("critical")}
            />
          </div>

          {projectsQuery.isLoading || dashboardQuery.isLoading ? (
            <ProjectListSkeleton />
          ) : projects.length === 0 ? (
            <EmptyState
              action={
                canCreateProject ? (
                  <button
                    className="text-sm font-medium text-[var(--text-primary)] hover:underline"
                    onClick={() => setShowCreateForm(true)}
                    type="button"
                  >
                    Create the first project
                  </button>
                ) : undefined
              }
              description="Create your first project to start organizing field updates from WhatsApp."
              icon={<FolderKanban aria-hidden="true" className="size-5" />}
              title="No projects yet"
            />
          ) : visibleProjects.length === 0 ? (
            <EmptyState
              description="No projects match this status."
              icon={<FolderKanban aria-hidden="true" className="size-5" />}
              title={`No ${projectViewLabel(view).toLowerCase()} projects`}
            />
          ) : (
            <div className="divide-y divide-slate-200">
              {visibleProjects.map((project) => {
                const dashboardProject = dashboardProjects.get(project.id);
                const health = getProjectHealth(project, dashboardProject);
                const lastActivityAt = dashboardProject?.lastActivityAt ?? project.updatedAt;

                return (
                  <Link
                    key={project.id}
                    className="flex items-center gap-3 py-4 hover:bg-slate-50"
                    href={`/projects/${project.id}`}
                  >
                    <span
                      aria-label={projectHealthLabel(health)}
                      className={`size-2.5 shrink-0 rounded-full ${projectStatusDot(health)}`}
                      role="img"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-950">{project.name}</div>
                      <div className="text-sm text-slate-500">{project.code}</div>
                      {dashboardProject?.healthReason ? (
                        <p className="mt-1 line-clamp-1 text-xs text-[var(--text-secondary)]">
                          {dashboardProject.healthReason}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge variant="muted">{projectHealthLabel(health)}</Badge>
                      {lastActivityAt ? (
                        <div
                          className="mt-1 text-xs text-[var(--text-secondary)]"
                          title={formatDateTime(lastActivityAt)}
                        >
                          Last activity {formatRelativeDate(lastActivityAt)}
                        </div>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectViewTab({
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

function ProjectListSkeleton() {
  return (
    <div className="divide-y divide-slate-200" aria-label="Loading projects">
      {Array.from({ length: 4 }, (_, index) => (
        <div className="flex h-[73px] items-center gap-3 py-4" key={index}>
          <Skeleton className="size-2.5 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40 max-w-[60%]" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="space-y-2">
            <Skeleton className="ml-auto h-5 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

function matchesProjectView(
  project: Project,
  dashboardProject: DashboardProject | undefined,
  view: ProjectView
) {
  if (view === "all") return true;

  const health = getProjectHealth(project, dashboardProject);
  if (view === "needs_attention") return health === "NEEDS_ATTENTION";
  if (view === "critical") return health === "CRITICAL";
  return health === "HEALTHY";
}

function getProjectHealth(
  project: Project,
  dashboardProject: DashboardProject | undefined
): ProjectStateHealth {
  if (dashboardProject?.health) return dashboardProject.health;
  return project.status === "ACTIVE" ? "HEALTHY" : "UNKNOWN";
}

function projectStatusDot(health: ProjectStateHealth) {
  if (health === "CRITICAL") return "bg-[var(--status-critical-text)]";
  if (health === "NEEDS_ATTENTION") return "bg-[var(--status-attention-text)]";
  if (health === "HEALTHY") return "bg-[var(--status-healthy-text)]";
  return "bg-[var(--text-secondary)]";
}

function projectHealthLabel(health: ProjectStateHealth) {
  if (health === "NEEDS_ATTENTION") return "Needs attention";
  if (health === "CRITICAL") return "Critical";
  if (health === "HEALTHY") return "Active";
  return "Inactive";
}

function projectViewLabel(view: ProjectView) {
  if (view === "needs_attention") return "Needs attention";
  return view.charAt(0).toUpperCase() + view.slice(1);
}

function formatRelativeDate(value: string) {
  const timestamp = new Date(value).getTime();
  const elapsedMs = Date.now() - timestamp;
  const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));

  if (elapsedDays <= 0) return "today";
  if (elapsedDays === 1) return "yesterday";
  if (elapsedDays < 7) return `${elapsedDays} days ago`;
  return formatDateTime(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}
