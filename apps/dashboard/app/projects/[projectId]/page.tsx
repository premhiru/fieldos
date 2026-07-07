"use client";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@fieldos/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { AppShell } from "../../../components/app-shell";
import { AuthGuard } from "../../../components/auth-guard";
import {
  api,
  type AIMessageClassification,
  type ActionItem,
  type PhotoAnalysis
} from "../../../lib/api";

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
  const photoAnalysisQuery = useQuery({
    enabled: Boolean(projectQuery.data?.project),
    queryFn: () => api.listProjectPhotoAnalysis(params.projectId, { limit: 8 }),
    queryKey: ["project-photo-analysis", params.projectId],
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
  const [projectQuestion, setProjectQuestion] = React.useState("");
  const projectSearchMutation = useMutation({
    mutationFn: () =>
      api.askProjectSearch(params.projectId, {
        question: projectQuestion
      })
  });
  const project = projectQuery.data?.project;
  const classifications = classificationsQuery.data?.classifications ?? [];
  const actionItems = actionItemsQuery.data?.actionItems ?? [];
  const photoAnalyses = photoAnalysisQuery.data?.analyses ?? [];

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
          <CardTitle>Ask about this project</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();

              if (projectQuestion.trim()) {
                projectSearchMutation.mutate();
              }
            }}
          >
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                className="h-10 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
                onChange={(event) => setProjectQuestion(event.target.value)}
                placeholder="Ask about defects, messages, inspections, or pending work..."
                value={projectQuestion}
              />
              <Button disabled={!projectQuestion.trim() || projectSearchMutation.isPending}>
                Ask
              </Button>
            </div>
          </form>
          {projectSearchMutation.data ? (
            <div className="mt-4 rounded-md border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <Badge variant="muted">{projectSearchMutation.data.confidence} Confidence</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-800">
                {projectSearchMutation.data.answer}
              </p>
              <div className="mt-3 space-y-2">
                {projectSearchMutation.data.sources.map((source) => (
                  <div
                    className="rounded-md bg-slate-50 p-2 text-xs text-slate-600"
                    key={`${source.sourceType}-${source.sourceId}`}
                  >
                    <div className="font-medium text-slate-950">{source.title}</div>
                    <div>{source.snippet}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

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
          <CardTitle>Photo Intelligence</CardTitle>
        </CardHeader>
        <CardContent>
          {photoAnalysisQuery.isLoading ? (
            <p className="text-sm text-slate-600">Loading photo intelligence...</p>
          ) : photoAnalyses.length === 0 ? (
            <p className="text-sm text-slate-600">No photo analysis yet.</p>
          ) : (
            <div className="space-y-3">
              {photoAnalyses.map((analysis) => (
                <PhotoAnalysisRow analysis={analysis} key={analysis.id} />
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

function PhotoAnalysisRow({ analysis }: { analysis: PhotoAnalysis }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="muted">{getVisionConfidenceLabel(analysis.confidence)}</Badge>
        {analysis.tags.slice(0, 4).map((tag) => (
          <Badge key={tag} variant="muted">
            {tag}
          </Badge>
        ))}
      </div>
      <p className="mt-2 text-sm text-slate-950">{analysis.summary}</p>
      {analysis.detectedObjects.length > 0 ? (
        <p className="mt-1 text-xs text-slate-500">
          Detected: {analysis.detectedObjects.join(", ")}
        </p>
      ) : null}
      {analysis.possibleIssues.length > 0 ? (
        <p className="mt-1 text-xs text-slate-500">
          Possible Issues: {analysis.possibleIssues.join(", ")}
        </p>
      ) : null}
      <Link
        className="mt-2 inline-flex text-xs font-medium text-slate-600 hover:text-slate-950"
        href={`/inbox/${analysis.message.conversation.id}`}
      >
        Source message: {analysis.evidence.filename}
      </Link>
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

function getVisionConfidenceLabel(confidence: number): string {
  if (confidence >= 0.75) {
    return "High";
  }

  if (confidence >= 0.45) {
    return "Needs Review";
  }

  return "Low";
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
