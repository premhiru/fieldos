"use client";

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@fieldos/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { AppShell } from "../../../components/app-shell";
import { AuthGuard } from "../../../components/auth-guard";
import { api, type Attachment, type Message } from "../../../lib/api";

export default function ConversationDetailPage() {
  return (
    <AuthGuard>
      <AppShell>
        <ConversationDetailContent />
      </AppShell>
    </AuthGuard>
  );
}

function ConversationDetailContent() {
  const params = useParams<{ conversationId: string }>();
  const conversationQuery = useQuery({
    queryFn: () => api.getConversation(params.conversationId),
    queryKey: ["conversation", params.conversationId],
    refetchInterval: 5_000,
    retry: false
  });
  const messagesQuery = useQuery({
    enabled: Boolean(conversationQuery.data?.conversation),
    queryFn: () => api.listConversationMessages(params.conversationId),
    queryKey: ["conversation-messages", params.conversationId],
    refetchInterval: 5_000,
    retry: false
  });
  const conversation = conversationQuery.data?.conversation;
  const messages = messagesQuery.data?.messages ?? [];
  const attachments = messages.flatMap((message) => message.attachments);

  if (conversationQuery.isLoading) {
    return <p className="text-sm text-slate-600">Loading conversation...</p>;
  }

  if (conversationQuery.isError || !conversation) {
    return <p className="text-sm text-red-600">Conversation not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5">
        <Link className="text-sm font-medium text-slate-600 hover:text-slate-950" href="/inbox">
          Back to inbox
        </Link>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">{conversation.title}</h1>
            <p className="text-sm text-slate-600">
              {conversation.project?.name ?? "Unassigned project"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="muted">{conversation.channel}</Badge>
            {conversation.isGroup ? <Badge variant="muted">GROUP</Badge> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Messages</CardTitle>
          </CardHeader>
          <CardContent>
            {messagesQuery.isLoading ? (
              <p className="text-sm text-slate-600">Loading messages...</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-slate-600">No messages yet.</p>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            )}

            <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4">
              <textarea
                className="h-24 w-full resize-none rounded-md border border-slate-300 bg-white p-3 text-sm"
                disabled
                placeholder="Composer disabled until channel adapters are connected"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            {attachments.length === 0 ? (
              <p className="text-sm text-slate-600">No attachments.</p>
            ) : (
              <div className="space-y-3">
                {attachments.map((attachment) => (
                  <AttachmentRow key={attachment.id} attachment={attachment} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const outbound = message.direction === "OUTBOUND";
  const evidenceSummary = getEvidenceSummary(message.attachments);

  return (
    <div className={outbound ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          outbound
            ? "max-w-[80%] rounded-md bg-slate-950 px-4 py-3 text-white"
            : "max-w-[80%] rounded-md border border-slate-200 bg-white px-4 py-3 text-slate-950"
        }
      >
        <div className={outbound ? "text-xs text-slate-300" : "text-xs text-slate-500"}>
          {message.senderParticipant.displayName} - {formatDate(message.occurredAt)}
        </div>
        <div className="mt-2 space-y-2 text-sm">
          {message.body ? <p>{message.body}</p> : null}
          {message.type !== "TEXT" && message.type !== "SYSTEM" ? (
            <MediaPlaceholder type={message.type} />
          ) : null}
        </div>
        {evidenceSummary.labels.length > 0 ? (
          <MessageEvidencePanel
            attachments={message.attachments}
            outbound={outbound}
            summary={evidenceSummary}
          />
        ) : null}
        <AIMessagePanel messageId={message.id} outbound={outbound} />
      </div>
    </div>
  );
}

function MessageEvidencePanel({
  attachments,
  outbound,
  summary
}: {
  attachments: Attachment[];
  outbound: boolean;
  summary: EvidenceSummaryView;
}) {
  const [open, setOpen] = React.useState(false);
  const transcript = attachments
    .map((attachment) => attachment.transcript?.trim())
    .filter((value): value is string => Boolean(value))
    .join("\n\n");
  const failedTranscript = attachments.find(
    (attachment) => attachment.transcriptionStatus === "FAILED"
  );
  const pendingTranscript = attachments.some(
    (attachment) => attachment.transcriptionStatus === "PENDING"
  );

  return (
    <div
      className={
        outbound
          ? "mt-3 rounded-md border border-slate-700 bg-slate-900 p-3 text-xs text-slate-200"
          : "mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium">Evidence Summary</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {summary.labels.map((label) => (
              <span
                className={
                  outbound
                    ? "rounded border border-slate-700 px-2 py-1"
                    : "rounded border border-slate-200 bg-white px-2 py-1"
                }
                key={label}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        <button
          className={
            outbound
              ? "rounded border border-slate-600 px-2 py-1 text-xs"
              : "rounded border border-slate-300 px-2 py-1 text-xs"
          }
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? "Hide media" : "Show media"}
        </button>
      </div>

      {transcript ? (
        <div className="mt-3 rounded border border-slate-300 p-2">
          <div className="font-medium">Voice transcript</div>
          <p className="mt-1 whitespace-pre-wrap leading-5">{transcript}</p>
        </div>
      ) : pendingTranscript ? (
        <p className="mt-3">Voice transcript pending.</p>
      ) : failedTranscript ? (
        <p className="mt-3">
          Voice transcript unavailable
          {failedTranscript.transcriptionError ? `: ${failedTranscript.transcriptionError}` : ""}.
        </p>
      ) : null}

      {open ? (
        <div className="mt-3 space-y-2">
          {attachments.map((attachment) => (
            <AttachmentRow attachment={attachment} key={attachment.id} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AIMessagePanel({ messageId, outbound }: { messageId: string; outbound: boolean }) {
  const queryClient = useQueryClient();
  const classificationQuery = useQuery({
    queryFn: () => api.getMessageClassification(messageId),
    queryKey: ["message-classification", messageId],
    refetchInterval: 10_000,
    retry: false
  });
  const classifyMutation = useMutation({
    mutationFn: () => api.classifyMessage(messageId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["message-classification", messageId] });
    }
  });
  const classification = classificationQuery.data?.classification;
  const surfaceClass = outbound
    ? "mt-3 rounded-md border border-slate-700 bg-slate-900 p-3 text-xs text-slate-200"
    : "mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700";

  return (
    <div className={surfaceClass}>
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium">AI</div>
        <button
          className={
            outbound
              ? "rounded border border-slate-600 px-2 py-1 text-xs text-white disabled:opacity-50"
              : "rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
          }
          disabled={classifyMutation.isPending}
          onClick={() => classifyMutation.mutate()}
          type="button"
        >
          Re-run AI classification
        </button>
      </div>

      {classificationQuery.isLoading ? (
        <p className="mt-2">AI classification pending</p>
      ) : !classification ? (
        <p className="mt-2">AI classification pending</p>
      ) : classification.status === "PENDING" ? (
        <p className="mt-2">AI classification pending</p>
      ) : classification.status === "FAILED" ? (
        <p className="mt-2">
          AI classification failed
          {classification.errorMessage ? `: ${classification.errorMessage}` : ""}
        </p>
      ) : (
        <div className="mt-2 grid gap-1">
          <div>Category: {classification.category ?? "UNKNOWN"}</div>
          <div>Summary: {classification.summary ?? "No summary"}</div>
          <div>Location: {classification.location ?? "Unknown"}</div>
          <div>Action required: {classification.actionRequired ? "Yes" : "No"}</div>
          <div>Confidence: {getConfidenceLabel(classification.confidence)}</div>
          <div>Status: {classification.status}</div>
          {classification.reasoningSummary ? (
            <div>Reason: {classification.reasoningSummary}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MediaPlaceholder({ type }: { type: Message["type"] }) {
  const labelByType: Record<Message["type"], string> = {
    DOCUMENT: "Document attachment",
    IMAGE: "Image attachment",
    SYSTEM: "System message",
    TEXT: "Text message",
    VIDEO: "Video attachment",
    VOICE: "Voice note"
  };

  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-slate-600">
      {labelByType[type]}
    </div>
  );
}

function AttachmentRow({ attachment }: { attachment: Attachment }) {
  const [analysisOpen, setAnalysisOpen] = React.useState(false);
  const analysis = attachment.photoAnalysis;

  return (
    <div className="rounded-md border border-slate-200 p-3">
      {attachment.mimeType.toLowerCase().startsWith("image/") ? (
        <div className="mb-3 flex h-24 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-xs font-medium text-slate-500">
          Photo
        </div>
      ) : null}
      <div className="font-medium text-slate-950">{attachment.filename}</div>
      <div className="mt-1 text-xs text-slate-500">
        {attachment.mimeType} - {formatBytes(attachment.size)}
      </div>
      {analysis ? (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500">Visual Summary</div>
              <p className="mt-1 text-sm text-slate-700">{analysis.summary}</p>
            </div>
            <Badge variant="muted">{getVisionConfidenceLabel(analysis.confidence)}</Badge>
          </div>
          {analysis.tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {analysis.tags.slice(0, 6).map((tag) => (
                <span
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                  key={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {analysis.possibleIssues.length > 0 ? (
            <div className="mt-2 text-xs text-slate-600">
              Possible Issues: {analysis.possibleIssues.join(", ")}
            </div>
          ) : null}
          <button
            className="mt-3 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white"
            onClick={() => setAnalysisOpen(true)}
            type="button"
          >
            Open Full Analysis
          </button>
        </div>
      ) : attachment.mimeType.toLowerCase().startsWith("image/") ? (
        <p className="mt-2 text-xs text-slate-500">Visual analysis pending.</p>
      ) : null}
      {attachment.transcript ? (
        <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">
          {attachment.transcript}
        </p>
      ) : attachment.transcriptionStatus === "FAILED" ? (
        <p className="mt-2 text-xs text-slate-500">
          Transcript unavailable
          {attachment.transcriptionError ? `: ${attachment.transcriptionError}` : ""}.
        </p>
      ) : null}
      {analysisOpen && analysis ? (
        <PhotoAnalysisPanel attachment={attachment} onClose={() => setAnalysisOpen(false)} />
      ) : null}
    </div>
  );
}

function PhotoAnalysisPanel({
  attachment,
  onClose
}: {
  attachment: Attachment;
  onClose: () => void;
}) {
  const analysis = attachment.photoAnalysis;

  if (!analysis) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30">
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">Photo Intelligence</div>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">{attachment.filename}</h2>
          </div>
          <button
            className="rounded border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="mt-6 flex h-56 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm font-medium text-slate-500">
          Original Photo
        </div>

        <div className="mt-6 space-y-5">
          <AnalysisSection title="Summary">
            <p>{analysis.summary}</p>
          </AnalysisSection>
          <AnalysisSection title="Detected Objects">
            <TagList emptyLabel="Unable to determine." values={analysis.detectedObjects} />
          </AnalysisSection>
          <AnalysisSection title="Possible Issues">
            <TagList
              emptyLabel="No obvious issue visible. Needs Review."
              values={analysis.possibleIssues}
            />
          </AnalysisSection>
          <AnalysisSection title="Confidence">
            <Badge variant="muted">{getVisionConfidenceLabel(analysis.confidence)}</Badge>
          </AnalysisSection>
          <AnalysisSection title="Source Message">
            <p>{attachment.messageId}</p>
          </AnalysisSection>
          <AnalysisSection title="Linked Action Items">
            <p>None linked.</p>
          </AnalysisSection>
        </div>
      </div>
    </div>
  );
}

function AnalysisSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="text-sm text-slate-700">
      <h3 className="text-xs font-semibold uppercase text-slate-500">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function TagList({ emptyLabel, values }: { emptyLabel: string; values: string[] }) {
  if (values.length === 0) {
    return <p>{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span className="rounded border border-slate-200 px-2 py-1 text-xs" key={value}>
          {value}
        </span>
      ))}
    </div>
  );
}

interface EvidenceSummaryView {
  documentCount: number;
  labels: string[];
  pdfCount: number;
  photoCount: number;
  videoCount: number;
  voiceNoteCount: number;
}

function getEvidenceSummary(attachments: Attachment[]): EvidenceSummaryView {
  const photoCount = attachments.filter((attachment) =>
    attachment.mimeType.toLowerCase().startsWith("image/")
  ).length;
  const voiceNoteCount = attachments.filter((attachment) =>
    attachment.mimeType.toLowerCase().startsWith("audio/")
  ).length;
  const videoCount = attachments.filter((attachment) =>
    attachment.mimeType.toLowerCase().startsWith("video/")
  ).length;
  const documents = attachments.filter((attachment) => {
    const mimeType = attachment.mimeType.toLowerCase();
    return mimeType === "application/pdf" || mimeType.startsWith("application/");
  });
  const pdfCount = documents.filter(
    (attachment) =>
      attachment.mimeType.toLowerCase() === "application/pdf" ||
      attachment.filename.toLowerCase().endsWith(".pdf")
  ).length;
  const labels = [
    formatCount(photoCount, "Photo", "Photos"),
    formatCount(voiceNoteCount, "Voice Note", "Voice Notes"),
    formatCount(pdfCount, "PDF", "PDFs"),
    formatCount(documents.length - pdfCount, "Document", "Documents"),
    formatCount(videoCount, "Video", "Videos")
  ].filter((label): label is string => Boolean(label));

  return {
    documentCount: documents.length,
    labels,
    pdfCount,
    photoCount,
    videoCount,
    voiceNoteCount
  };
}

function formatCount(count: number, singular: string, plural: string): string | null {
  if (count <= 0) {
    return null;
  }

  return `${count} ${count === 1 ? singular : plural}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
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

function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
