"use client";

import { PageHeader, Skeleton } from "@fieldos/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";

import { AppShell } from "../../../../components/app-shell";
import { AuthGuard } from "../../../../components/auth-guard";
import { MilestoneSection } from "../../../../components/milestone-section";
import { api } from "../../../../lib/api";

export default function ProjectMilestonesPage() {
  return (
    <AuthGuard>
      <AppShell>
        <ProjectMilestones />
      </AppShell>
    </AuthGuard>
  );
}

function ProjectMilestones() {
  const params = useParams<{ projectId: string }>();
  const projectQuery = useQuery({
    queryFn: () => api.getProject(params.projectId),
    queryKey: ["project", params.projectId],
    retry: false
  });
  const stateQuery = useQuery({
    enabled: Boolean(projectQuery.data?.project),
    queryFn: () => api.getProjectState(params.projectId),
    queryKey: ["project-state", params.projectId],
    retry: false
  });

  if (projectQuery.isLoading) return <Skeleton className="h-[560px]" />;
  const project = projectQuery.data?.project;
  if (!project)
    return <p className="text-sm text-[var(--status-critical-text)]">Project not found.</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Link
            className="text-sm font-medium text-[var(--text-primary)] hover:underline"
            href={`/projects/${project.id}`}
          >
            Back to project
          </Link>
        }
        description={`${project.code} · Plan and confirm meaningful delivery stages.`}
        title="Milestones"
      />
      <MilestoneSection projectId={project.id} projectState={stateQuery.data?.state} />
    </div>
  );
}
