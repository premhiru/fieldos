"use client";

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@fieldos/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";

import { AppShell } from "../../../components/app-shell";
import { AuthGuard } from "../../../components/auth-guard";
import { api, type AIMessageClassification, type ActionItem } from "../../../lib/api";

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
  const actionItemsQuery = useQuery({
    enabled: Boolean(projectQuery.data?.project),
    queryFn: () => api.listProjectActionItems(params.projectId),
    queryKey: ["project-action-items", params.projectId],
    retry: false
  });
  const acceptMutation = useMutation({
    mutationFn: (actionItemId: string) => api.acceptActionItem(actionItemId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["project-action-items", params.projectId]
      });
    }
  });
  const ignoreMutation = useMutation({
    mutationFn: (actionItemId: string) => api.ignoreActionItem(actionItemId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["project-action-items", params.projectId]
      });
    }
  });
  const project = projectQuery.data?.project;
  const classifications = classificationsQuery.data?.classifications ?? [];
  const actionItems = actionItemsQuery.data?.actionItems ?? [];

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
          <CardTitle>Action Items</CardTitle>
        </CardHeader>
        <CardContent>
          {actionItemsQuery.isLoading ? (
            <p className="text-sm text-slate-600">Loading Action Items...</p>
          ) : actionItems.length === 0 ? (
            <p className="text-sm text-slate-600">No Action Items yet.</p>
          ) : (
            <div className="space-y-3">
              {actionItems.map((actionItem) => (
                <ActionItemRow
                  key={actionItem.id}
                  actionItem={actionItem}
                  onAccept={() => acceptMutation.mutate(actionItem.id)}
                  onIgnore={() => ignoreMutation.mutate(actionItem.id)}
                  pending={acceptMutation.isPending || ignoreMutation.isPending}
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
        <Badge variant="muted">{getConfidenceLabel(classification.confidence)}</Badge>
        {classification.actionRequired ? <Badge variant="muted">Action Required</Badge> : null}
      </div>
      <p className="mt-2 text-sm text-slate-950">{classification.summary ?? "No summary"}</p>
      <p className="mt-1 text-xs text-slate-500">
        Location: {classification.location ?? "Unknown"}
      </p>
    </div>
  );
}

function ActionItemRow({
  actionItem,
  onAccept,
  onIgnore,
  pending
}: {
  actionItem: ActionItem;
  onAccept: () => void;
  onIgnore: () => void;
  pending: boolean;
}) {
  const acceptLabel =
    actionItem.type === "PROJECT_SUGGESTION" ? "Accept suggested project" : "Accept";

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-slate-950">{actionItem.title}</h3>
            <Badge variant="muted">{actionItem.status}</Badge>
            <Badge variant="muted">{getConfidenceLabel(actionItem.confidence)}</Badge>
          </div>
          {actionItem.description ? (
            <p className="mt-1 text-sm text-slate-600">{actionItem.description}</p>
          ) : null}
          {actionItem.suggestedProject ? (
            <p className="mt-1 text-xs text-slate-500">
              Suggested project: {actionItem.suggestedProject.name}
            </p>
          ) : null}
          {actionItem.message ? (
            <Link
              className="mt-2 inline-flex text-xs font-medium text-slate-600 hover:text-slate-950"
              href={`/inbox/${actionItem.message.conversation.id}`}
            >
              Source message: {actionItem.message.body ?? actionItem.message.conversation.title}
            </Link>
          ) : null}
        </div>
        {actionItem.status === "PENDING" ? (
          <div className="flex gap-2">
            <button
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50"
              disabled={pending}
              onClick={onIgnore}
              type="button"
            >
              Ignore
            </button>
            <button
              className="rounded-md bg-slate-950 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              disabled={pending}
              onClick={onAccept}
              type="button"
            >
              {acceptLabel}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getConfidenceLabel(confidence: number | null): string {
  if (confidence === null) {
    return "Needs Review";
  }

  if (confidence >= 0.8) {
    return "High Confidence";
  }

  if (confidence >= 0.55) {
    return "Needs Review";
  }

  return "Low Confidence";
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
