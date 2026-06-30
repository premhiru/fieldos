"use client";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@fieldos/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";
import { z } from "zod";

import { AppShell } from "../../components/app-shell";
import { AuthGuard } from "../../components/auth-guard";
import { OrganizationOnboarding } from "../../components/organization-onboarding";
import { OrganizationSelector } from "../../components/organization-selector";
import { api, type ProjectStatus } from "../../lib/api";
import { useOrganizations, useProjects } from "../../lib/queries";
import { projectCode } from "../../lib/slug";
import { useActiveOrganizationStore } from "../../store/active-organization-store";

const createProjectFormSchema = z.object({
  code: z.string().trim().min(2),
  name: z.string().trim().min(1),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).default("ACTIVE")
});

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
  const projects = projectsQuery.data?.projects ?? [];
  const canCreateProject =
    activeOrganization?.role === "OWNER" || activeOrganization?.role === "ADMIN";
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [status, setStatus] = React.useState<ProjectStatus>("ACTIVE");
  const [codeEdited, setCodeEdited] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!activeOrganizationId && organizations[0]) {
      setActiveOrganizationId(organizations[0].id);
    }
  }, [activeOrganizationId, organizations, setActiveOrganizationId]);

  const mutation = useMutation({
    mutationFn: (body: { code: string; name: string; status: ProjectStatus }) =>
      api.createProject(activeOrganization?.id ?? "", body),
    onSuccess: async () => {
      setName("");
      setCode("");
      setCodeEdited(false);
      setStatus("ACTIVE");
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
    return <p className="text-sm text-slate-600">Loading projects...</p>;
  }

  if (organizations.length === 0) {
    return <OrganizationOnboarding />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Projects</h1>
          <p className="text-sm text-slate-600">
            Create and manage projects for the active organization.
          </p>
        </div>
        <OrganizationSelector organizations={organizations} />
      </div>

      {canCreateProject ? (
        <Card>
          <CardHeader>
            <CardTitle>Create Project</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 md:grid-cols-[1fr_180px_180px_auto]"
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
          {projectsQuery.isLoading ? (
            <p className="text-sm text-slate-600">Loading project list...</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-slate-600">No projects yet.</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  className="flex items-center justify-between py-4 hover:bg-slate-50"
                  href={`/projects/${project.id}`}
                >
                  <div>
                    <div className="font-medium text-slate-950">{project.name}</div>
                    <div className="text-sm text-slate-500">{project.code}</div>
                  </div>
                  <Badge variant="muted">{project.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
