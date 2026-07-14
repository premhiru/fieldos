"use client";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@fieldos/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { AppShell } from "../../../components/app-shell";
import { AuthGuard } from "../../../components/auth-guard";
import { MilestoneSection } from "../../../components/milestone-section";
import {
  api,
  type AIMessageClassification,
  type ActionItem,
  type PhotoAnalysis,
  type ProjectTimelineEvent,
  type ProjectWhatsAppMessage
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
  const projectStateQuery = useQuery({
    enabled: Boolean(projectQuery.data?.project),
    queryFn: () => api.getProjectState(params.projectId),
    queryKey: ["project-state", params.projectId],
    retry: false
  });
  const recommendationsQuery = useQuery({
    enabled: Boolean(projectQuery.data?.project),
    queryFn: () => api.listProjectRecommendations(params.projectId, "PENDING"),
    queryKey: ["project-recommendations", params.projectId, "PENDING"],
    retry: false
  });
  const coordinatorRunsQuery = useQuery({
    enabled: Boolean(projectQuery.data?.project),
    queryFn: () => api.listProjectCoordinatorRuns(params.projectId),
    queryKey: ["project-coordinator-runs", params.projectId],
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
  const runCoordinatorsMutation = useMutation({
    mutationFn: () => api.runProjectCoordinators(params.projectId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["project-state", params.projectId] });
      await queryClient.invalidateQueries({
        queryKey: ["project-recommendations", params.projectId, "PENDING"]
      });
      await queryClient.invalidateQueries({
        queryKey: ["project-coordinator-runs", params.projectId]
      });
    }
  });
  const project = projectQuery.data?.project;
  const projectState = projectStateQuery.data?.state;
  const classifications = classificationsQuery.data?.classifications ?? [];
  const actionItems = actionItemsQuery.data?.actionItems ?? [];
  const photoAnalyses = photoAnalysisQuery.data?.analyses ?? [];
  const timelineEvents = project?.timelineEvents ?? [];
  const whatsAppMessages = project?.whatsAppMessages ?? [];

  if (projectQuery.isLoading) {
    return <p className="text-sm text-slate-600">Loading project...</p>;
  }

  if (projectQuery.isError || !project) {
    return <p className="text-sm text-red-600">Project not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-950">{project.name}</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{project.code}</span>
            <Badge variant="muted">{project.status}</Badge>
          </div>
        </div>
        <Link
          className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          href={`/projects/${project.id}/intelligence`}
        >
          Project Intelligence
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ProjectTimelineCard events={timelineEvents} />
        <ProjectWhatsAppMessagesCard messages={whatsAppMessages} />
        <Card>
          <CardHeader>
            <CardTitle>Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              className="text-sm font-medium text-slate-700 hover:text-slate-950"
              href={`/projects/${project.id}/intelligence`}
            >
              Open Project Intelligence
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Coordinator</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={projectState?.health === "CRITICAL" ? "warning" : "muted"}>
                  {formatStatus(projectState?.health ?? "UNKNOWN")}
                </Badge>
                <Badge variant="muted">{projectState?.completionPercent ?? 0}% Complete</Badge>
                <span className="text-sm text-slate-500">
                  Last update {formatTime(projectState?.lastActivityAt ?? null)}
                </span>
              </div>
              <Button
                disabled={runCoordinatorsMutation.isPending}
                onClick={() => runCoordinatorsMutation.mutate()}
                type="button"
                variant="secondary"
              >
                {runCoordinatorsMutation.isPending ? "Running..." : "Run Coordinators Now"}
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ProjectStateSummary
                label="Recent progress"
                value={projectState?.recentProgressSummary}
              />
              <ProjectStateSummary label="Recent risks" value={projectState?.recentRiskSummary} />
              <ProjectStateSummary label="Evidence" value={projectState?.recentEvidenceSummary} />
              <ProjectStateSummary
                label="Pending decisions"
                value={projectState?.pendingDecisionSummary}
              />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-950">Pending recommendations</div>
              {(recommendationsQuery.data?.recommendations ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">No pending recommendations.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {(recommendationsQuery.data?.recommendations ?? []).slice(0, 4).map((item) => (
                    <Link
                      className="block rounded-md border border-slate-200 p-3 text-sm hover:bg-slate-50"
                      href={`/recommendations/${item.id}`}
                      key={item.id}
                    >
                      <span className="font-medium text-slate-950">{item.title}</span>
                      <span className="ml-2 text-xs text-slate-500">
                        {formatStatus(item.priority)} - {formatStatus(item.sourceCoordinator)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <details className="rounded-md border border-slate-200 p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-950">
                View Coordinator History
              </summary>
              <div className="mt-3 space-y-2">
                {(coordinatorRunsQuery.data?.runs ?? []).slice(0, 8).map((run) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    key={run.id}
                  >
                    <span>
                      {formatStatus(run.coordinatorType)} - {formatStatus(run.status)}
                    </span>
                    <span className="text-slate-500">
                      {run.recommendationsCreated} created - {formatTime(run.startedAt)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </CardContent>
      </Card>

      <MilestoneSection projectId={project.id} projectState={projectState} />

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

function ProjectTimelineCard({ events }: { events: ProjectTimelineEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-slate-600">
            No timeline activity yet. New messages, Action Items, reports, and system events will
            appear here.
          </p>
        ) : (
          <div className="space-y-3">
            {events.slice(0, 5).map((event) => (
              <div className="border-l-2 border-slate-200 pl-3" key={event.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-950">{event.title}</span>
                  <Badge variant="muted">{formatStatus(event.sourceType)}</Badge>
                </div>
                {event.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{event.description}</p>
                ) : null}
                <p className="mt-1 text-xs text-slate-500">{formatTime(event.occurredAt)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectWhatsAppMessagesCard({ messages }: { messages: ProjectWhatsAppMessage[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp Messages</CardTitle>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <p className="text-sm text-slate-600">
            No WhatsApp messages mapped to this project yet. Activate a WhatsApp chat and assign it
            to this project to see updates here.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.slice(0, 5).map((message) => (
              <Link
                className="block rounded-md border border-slate-200 p-3 hover:bg-slate-50"
                href={`/inbox/${message.conversation.id}`}
                key={message.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-950">
                    {message.conversation.title}
                  </span>
                  <span className="text-xs text-slate-500">{formatTime(message.occurredAt)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {message.senderParticipant.displayName}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-700">
                  {getMessagePreview(message)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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

function ProjectStateSummary({
  label,
  value
}: Readonly<{
  label: string;
  value: string | null | undefined;
}>) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <p className="mt-1 text-sm text-slate-700">{value ?? "No signal detected."}</p>
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

function formatTime(value: string | null): string {
  if (!value) {
    return "No activity";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatStatus(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getMessagePreview(message: ProjectWhatsAppMessage): string {
  if (message.body?.trim()) {
    return message.body;
  }

  if (message.attachments.length > 0) {
    return message.attachments.map((attachment) => attachment.filename).join(", ");
  }

  return formatStatus(message.type);
}
