"use client";

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@fieldos/ui";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { AppShell } from "../../../components/app-shell";
import { AuthGuard } from "../../../components/auth-guard";
import { api } from "../../../lib/api";

export default function ProjectDetailPage() {
  return (
    <AuthGuard>
      <AppShell>
        <ProjectDetailContent />
      </AppShell>
    </AuthGuard>
  );
}

function ProjectDetailContent() {
  const params = useParams<{ projectId: string }>();
  const projectQuery = useQuery({
    queryFn: () => api.getProject(params.projectId),
    queryKey: ["project", params.projectId],
    retry: false
  });
  const project = projectQuery.data?.project;

  if (projectQuery.isLoading) {
    return <p className="text-sm text-slate-600">Loading project...</p>;
  }

  if (projectQuery.isError || !project) {
    return <p className="text-sm text-red-600">Project not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-950">{project.name}</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{project.code}</span>
          <Badge variant="muted">{project.status}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <PlaceholderCard title="Timeline coming soon" />
        <PlaceholderCard title="WhatsApp messages coming soon" />
        <PlaceholderCard title="Reports coming soon" />
      </div>
    </div>
  );
}

function PlaceholderCard({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600">
          This section is intentionally empty for this slice.
        </p>
      </CardContent>
    </Card>
  );
}
