"use client";

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@fieldos/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";

import { AppShell } from "../../../components/app-shell";
import { AuthGuard } from "../../../components/auth-guard";
import { api, type AIMessageClassification, type SuggestedTask } from "../../../lib/api";

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
  const queryClient = useQueryClient();
  const projectQuery = useQuery({
    queryFn: () => api.getProject(params.projectId),
    queryKey: ["project", params.projectId],
    retry: false
  });
  const classificationsQuery = useQuery({
    enabled: Boolean(projectQuery.data?.project),
    queryFn: () => api.listProjectAIClassifications(params.projectId),
    queryKey: ["project-ai-classifications", params.projectId],
    retry: false
  });
  const suggestedTasksQuery = useQuery({
    enabled: Boolean(projectQuery.data?.project),
    queryFn: () => api.listProjectSuggestedTasks(params.projectId),
    queryKey: ["project-suggested-tasks", params.projectId],
    retry: false
  });
  const acceptMutation = useMutation({
    mutationFn: (suggestedTaskId: string) => api.acceptSuggestedTask(suggestedTaskId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["project-suggested-tasks", params.projectId]
      });
    }
  });
  const rejectMutation = useMutation({
    mutationFn: (suggestedTaskId: string) => api.rejectSuggestedTask(suggestedTaskId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["project-suggested-tasks", params.projectId]
      });
    }
  });
  const project = projectQuery.data?.project;
  const classifications = classificationsQuery.data?.classifications ?? [];
  const suggestedTasks = suggestedTasksQuery.data?.suggestedTasks ?? [];

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

      <Card>
        <CardHeader>
          <CardTitle>AI Insights</CardTitle>
        </CardHeader>
        <CardContent>
          {classificationsQuery.isLoading ? (
            <p className="text-sm text-slate-600">Loading AI insights...</p>
          ) : classifications.length === 0 ? (
            <p className="text-sm text-slate-600">No AI insights yet.</p>
          ) : (
            <div className="space-y-3">
              {classifications.map((classification) => (
                <AIInsightRow key={classification.id} classification={classification} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suggested Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {suggestedTasksQuery.isLoading ? (
            <p className="text-sm text-slate-600">Loading suggested tasks...</p>
          ) : suggestedTasks.length === 0 ? (
            <p className="text-sm text-slate-600">No suggested tasks yet.</p>
          ) : (
            <div className="space-y-3">
              {suggestedTasks.map((suggestedTask) => (
                <SuggestedTaskRow
                  key={suggestedTask.id}
                  onAccept={() => acceptMutation.mutate(suggestedTask.id)}
                  onReject={() => rejectMutation.mutate(suggestedTask.id)}
                  pending={acceptMutation.isPending || rejectMutation.isPending}
                  suggestedTask={suggestedTask}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AIInsightRow({ classification }: { classification: AIMessageClassification }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="muted">{classification.category ?? "UNKNOWN"}</Badge>
        <Badge variant="muted">{classification.priority}</Badge>
        <span className="text-xs text-slate-500">
          {classification.confidence === null
            ? "Unknown confidence"
            : `${Math.round(classification.confidence * 100)}% confidence`}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-950">{classification.summary ?? "No summary"}</p>
      <p className="mt-1 text-xs text-slate-500">
        Location: {classification.location ?? "Unknown"}
      </p>
    </div>
  );
}

function SuggestedTaskRow({
  onAccept,
  onReject,
  pending,
  suggestedTask
}: {
  onAccept: () => void;
  onReject: () => void;
  pending: boolean;
  suggestedTask: SuggestedTask;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-slate-950">{suggestedTask.title}</h3>
            <Badge variant="muted">{suggestedTask.priority}</Badge>
            <Badge variant="muted">{suggestedTask.status}</Badge>
          </div>
          {suggestedTask.description ? (
            <p className="mt-1 text-sm text-slate-600">{suggestedTask.description}</p>
          ) : null}
          {suggestedTask.message ? (
            <Link
              className="mt-2 inline-flex text-xs font-medium text-slate-600 hover:text-slate-950"
              href={`/inbox/${suggestedTask.message.conversation.id}`}
            >
              Source message:{" "}
              {suggestedTask.message.body ?? suggestedTask.message.conversation.title}
            </Link>
          ) : null}
        </div>
        {suggestedTask.status === "PENDING" ? (
          <div className="flex gap-2">
            <button
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50"
              disabled={pending}
              onClick={onReject}
              type="button"
            >
              Reject
            </button>
            <button
              className="rounded-md bg-slate-950 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              disabled={pending}
              onClick={onAccept}
              type="button"
            >
              Accept
            </button>
          </div>
        ) : null}
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
