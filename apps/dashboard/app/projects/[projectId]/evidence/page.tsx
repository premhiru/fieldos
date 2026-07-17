"use client";

import { Badge, EmptyState, PageHeader, Skeleton } from "@fieldos/ui";
import { FileImage, MessageSquareText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";

import { AppShell } from "../../../../components/app-shell";
import { AuthGuard } from "../../../../components/auth-guard";
import {
  api,
  type AIMessageClassification,
  type PhotoAnalysis,
  type ProjectWhatsAppMessage
} from "../../../../lib/api";

export default function ProjectEvidencePage() {
  return (
    <AuthGuard>
      <AppShell>
        <ProjectEvidence />
      </AppShell>
    </AuthGuard>
  );
}

function ProjectEvidence() {
  const params = useParams<{ projectId: string }>();
  const projectQuery = useQuery({
    queryFn: () => api.getProject(params.projectId),
    queryKey: ["project", params.projectId],
    retry: false
  });
  const photoQuery = useQuery({
    enabled: Boolean(projectQuery.data?.project),
    queryFn: () => api.listProjectPhotoAnalysis(params.projectId, { limit: 24 }),
    queryKey: ["project-photo-analysis", params.projectId],
    retry: false
  });
  const summariesQuery = useQuery({
    enabled: Boolean(projectQuery.data?.project),
    queryFn: () => api.listProjectAIClassifications(params.projectId),
    queryKey: ["project-ai-classifications", params.projectId],
    retry: false
  });

  if (projectQuery.isLoading) return <Skeleton className="h-[640px]" />;
  const project = projectQuery.data?.project;
  if (!project)
    return <p className="text-sm text-[var(--status-critical-text)]">Project not found.</p>;
  const messages = project.whatsAppMessages ?? [];
  const analyses = photoQuery.data?.analyses ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <Link
            className="text-sm font-medium text-[var(--text-primary)] hover:underline"
            href={`/projects/${project.id}`}
          >
            Back to project
          </Link>
        }
        description={`${project.code} · Messages, photos, and field records linked to this project.`}
        title="Project Evidence"
      />
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Field messages</h2>
        {messages.length === 0 ? (
          <EmptyState
            description="Messages will appear after an active WhatsApp chat is linked to this project."
            icon={<MessageSquareText aria-hidden="true" className="size-5" />}
            title="No messages linked"
          />
        ) : (
          <div className="divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)]">
            {messages.map((message) => (
              <MessageEvidence key={message.id} message={message} />
            ))}
          </div>
        )}
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Photo summaries</h2>
        {photoQuery.isLoading ? (
          <Skeleton className="h-64" />
        ) : analyses.length === 0 ? (
          <EmptyState
            description="Photo summaries will appear when field images are received."
            icon={<FileImage aria-hidden="true" className="size-5" />}
            title="No photo evidence"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {analyses.map((analysis) => (
              <PhotoEvidence analysis={analysis} key={analysis.id} />
            ))}
          </div>
        )}
      </section>
      {(summariesQuery.data?.classifications.length ?? 0) > 0 ? (
        <details className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
          <summary className="cursor-pointer font-medium text-[var(--text-primary)]">
            Message summaries
          </summary>
          <div className="mt-4 space-y-3">
            {summariesQuery.data?.classifications.map((summary) => (
              <MessageSummary key={summary.id} summary={summary} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function MessageEvidence({ message }: { message: ProjectWhatsAppMessage }) {
  return (
    <Link
      className="block p-4 hover:bg-[var(--surface-subtle)]"
      href={`/inbox/${message.conversation.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-[var(--text-primary)]">{message.conversation.title}</div>
          <div className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {message.senderParticipant.displayName}
          </div>
        </div>
        <time className="text-xs text-[var(--text-secondary)]">
          {formatDate(message.occurredAt)}
        </time>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        {message.body?.trim() ||
          message.attachments.map((item) => item.filename).join(", ") ||
          "Media update"}
      </p>
    </Link>
  );
}

function PhotoEvidence({ analysis }: { analysis: PhotoAnalysis }) {
  const evidenceQuery = useQuery({
    queryFn: () => api.getEvidenceView(analysis.evidenceId),
    queryKey: ["evidence-view", analysis.evidenceId],
    retry: false
  });
  return (
    <article className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)]">
      <div className="aspect-[4/3] bg-[var(--surface-subtle)]">
        {evidenceQuery.data?.evidence.signedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={analysis.evidence.filename}
            className="h-full w-full object-cover"
            src={evidenceQuery.data.evidence.signedUrl}
          />
        ) : (
          <Skeleton className="h-full w-full" />
        )}
      </div>
      <div className="p-4">
        <Badge variant="muted">{confidenceLabel(analysis.confidence)}</Badge>
        <p className="mt-3 text-sm leading-6 text-[var(--text-primary)]">{analysis.summary}</p>
        <Link
          className="mt-3 inline-flex text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          href={`/inbox/${analysis.message.conversation.id}`}
        >
          View source message
        </Link>
      </div>
    </article>
  );
}

function MessageSummary({ summary }: { summary: AIMessageClassification }) {
  return (
    <div className="rounded-md border border-[var(--border-subtle)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="muted">{formatLabel(summary.category ?? "FIELD_UPDATE")}</Badge>
        <Badge variant="muted">{confidenceLabel(summary.confidence)}</Badge>
      </div>
      <p className="mt-2 text-sm text-[var(--text-primary)]">
        {summary.summary ?? "No summary available."}
      </p>
    </div>
  );
}

function confidenceLabel(confidence: number | null): string {
  if (confidence !== null && confidence >= 0.8) return "High confidence";
  if (confidence !== null && confidence < 0.55) return "Low confidence";
  return "Needs review";
}

function formatLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}
