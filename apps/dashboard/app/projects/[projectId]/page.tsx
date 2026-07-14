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
import { Camera, ChevronDown, FileText, Sparkles } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { AppShell } from "../../../components/app-shell";
import { AuthGuard } from "../../../components/auth-guard";
import { MilestoneSection } from "../../../components/milestone-section";
import { RecommendationCard } from "../../../components/recommendation-card";
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
  const approveRecommendationMutation = useMutation({
    mutationFn: api.approveRecommendation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["project-recommendations", params.projectId, "PENDING"]
      });
      await queryClient.invalidateQueries({ queryKey: ["project-state", params.projectId] });
    }
  });
  const dismissRecommendationMutation = useMutation({
    mutationFn: (id: string) => api.dismissRecommendation(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["project-recommendations", params.projectId, "PENDING"]
      });
    }
  });
  const [snoozedRecommendationIds, setSnoozedRecommendationIds] = React.useState<string[]>([]);
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

  if (projectQuery.isLoading) return <Skeleton className="h-[720px]" />;

  if (projectQuery.isError || !project) {
    return <p className="text-sm text-red-600">Project not found.</p>;
  }

  const recommendations = (recommendationsQuery.data?.recommendations ?? []).filter(
    (item) => !snoozedRecommendationIds.includes(item.id)
  );

  return (
    <div className="space-y-10">
      <PageHeader
        actions={
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
            href={`/projects/${project.id}/intelligence`}
          >
            <FileText aria-hidden="true" className="size-4" />
            Reports
          </Link>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{project.code}</span>
            <Badge variant="muted">{formatStatus(project.status)}</Badge>
          </span>
        }
        title={project.name}
      />

      <section
        aria-labelledby="project-brief-heading"
        className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950" id="project-brief-heading">
              Project Brief
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Last updated {formatTime(projectState?.lastActivityAt ?? null)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={projectState?.health === "CRITICAL" ? "warning" : "success"}>
              {formatStatus(projectState?.health ?? "UNKNOWN")}
            </Badge>
            <Badge variant="muted">{projectState?.completionPercent ?? 0}% complete</Badge>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ProjectStateSummary label="Progress" value={projectState?.recentProgressSummary} />
          <ProjectStateSummary label="Risks" value={projectState?.recentRiskSummary} />
          <ProjectStateSummary label="Evidence" value={projectState?.recentEvidenceSummary} />
          <ProjectStateSummary label="Decisions" value={projectState?.pendingDecisionSummary} />
        </div>
        <details className="mt-5 border-t border-slate-100 pt-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950">
            <ChevronDown aria-hidden="true" className="size-4" />
            Coordinator details
          </summary>
          <div className="mt-4 flex flex-col gap-4">
            <Button
              className="w-fit"
              disabled={runCoordinatorsMutation.isPending}
              onClick={() => runCoordinatorsMutation.mutate()}
              variant="secondary"
            >
              {runCoordinatorsMutation.isPending ? "Refreshing brief..." : "Refresh project brief"}
            </Button>
            {(coordinatorRunsQuery.data?.runs ?? []).slice(0, 5).map((run) => (
              <div className="flex flex-wrap justify-between gap-2 text-sm" key={run.id}>
                <span>
                  {formatStatus(run.coordinatorType)} · {formatStatus(run.status)}
                </span>
                <span className="text-slate-500">{formatTime(run.startedAt)}</span>
              </div>
            ))}
          </div>
        </details>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Recommendations</h2>
          <p className="mt-1 text-sm text-slate-600">
            Decisions suggested from this project's latest evidence.
          </p>
        </div>
        {recommendations.length === 0 ? (
          <EmptyState
            description="FieldOS has not identified a project decision that needs your approval."
            icon={<Sparkles aria-hidden="true" className="size-5" />}
            title="No recommendations to review"
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {recommendations.map((item) => (
              <RecommendationCard
                busy={
                  approveRecommendationMutation.isPending || dismissRecommendationMutation.isPending
                }
                key={item.id}
                onApprove={() => approveRecommendationMutation.mutate(item.id)}
                onDismiss={() => dismissRecommendationMutation.mutate(item.id)}
                onSnooze={() => setSnoozedRecommendationIds((ids) => [...ids, item.id])}
                recommendation={item}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-950">Timeline</h2>
        <ProjectTimelineCard events={timelineEvents} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Evidence</h2>
          <p className="mt-1 text-sm text-slate-600">
            Messages, photos, and interpreted field updates.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <ProjectWhatsAppMessagesCard messages={whatsAppMessages} />
          <Card>
            <CardHeader>
              <CardTitle>Photo Intelligence</CardTitle>
            </CardHeader>
            <CardContent>
              {photoAnalysisQuery.isLoading ? (
                <Skeleton className="h-36" />
              ) : photoAnalyses.length === 0 ? (
                <EmptyState
                  description="Image analysis will appear after project photos are received."
                  icon={<Camera aria-hidden="true" className="size-5" />}
                  title="No photo evidence yet"
                />
              ) : (
                <div className="space-y-3">
                  {photoAnalyses.slice(0, 4).map((analysis) => (
                    <PhotoAnalysisRow analysis={analysis} key={analysis.id} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <details className="rounded-lg border border-slate-200 bg-white p-5">
          <summary className="cursor-pointer text-sm font-medium text-slate-950">
            AI evidence classifications
          </summary>
          <div className="mt-4 space-y-3">
            {classifications.map((classification) => (
              <AIInsightRow classification={classification} key={classification.id} />
            ))}
          </div>
        </details>
      </section>

      <MilestoneSection projectId={project.id} projectState={projectState} />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-950">Reports</h2>
        <Link
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-300"
          href={`/projects/${project.id}/intelligence`}
        >
          <span>
            <span className="block font-semibold text-slate-950">
              Project intelligence and reports
            </span>
            <span className="mt-1 block text-sm text-slate-600">
              Review summaries, risks, pending decisions, and generated exports.
            </span>
          </span>
          <FileText aria-hidden="true" className="size-5 text-slate-400" />
        </Link>
      </section>

      <details className="rounded-lg border border-slate-200 bg-white p-5">
        <summary className="cursor-pointer text-sm font-semibold text-slate-950">
          Ask FieldOS and review Action Items
        </summary>
        <div className="mt-5 space-y-6">
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
          <div>
            <h3 className="font-semibold text-slate-950">Action Items</h3>
            {actionItemsQuery.isLoading ? (
              <Skeleton className="mt-3 h-32" />
            ) : actionItems.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No Action Items for this project.</p>
            ) : (
              <div className="mt-3 space-y-3">
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
          </div>
        </div>
      </details>
    </div>
  );
}

function ProjectTimelineCard({ events }: { events: ProjectTimelineEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project activity</CardTitle>
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
