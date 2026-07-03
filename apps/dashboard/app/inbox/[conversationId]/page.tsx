"use client";

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@fieldos/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";

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
    retry: false
  });
  const messagesQuery = useQuery({
    enabled: Boolean(conversationQuery.data?.conversation),
    queryFn: () => api.listConversationMessages(params.conversationId),
    queryKey: ["conversation-messages", params.conversationId],
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
          {message.senderParticipant.displayName} · {formatDate(message.occurredAt)}
        </div>
        <div className="mt-2 text-sm">
          {message.type === "TEXT" || message.type === "SYSTEM" ? (
            message.body
          ) : (
            <MediaPlaceholder type={message.type} />
          )}
        </div>
        {message.attachments.length > 0 ? (
          <div className="mt-3 space-y-2">
            {message.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              >
                {attachment.filename}
              </div>
            ))}
          </div>
        ) : null}
        <AIMessagePanel messageId={message.id} outbound={outbound} />
      </div>
    </div>
  );
}

function AIMessagePanel({ messageId, outbound }: { messageId: string; outbound: boolean }) {
  const queryClient = useQueryClient();
  const classificationQuery = useQuery({
    queryFn: () => api.getMessageClassification(messageId),
    queryKey: ["message-classification", messageId],
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
          <div>Priority: {classification.priority}</div>
          <div>
            Confidence:{" "}
            {classification.confidence === null
              ? "Unknown"
              : `${Math.round(classification.confidence * 100)}%`}
          </div>
          <div>Status: {classification.status}</div>
          {classification.suggestedTaskTitle ? (
            <div>Suggested task: {classification.suggestedTaskTitle}</div>
          ) : null}
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
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="font-medium text-slate-950">{attachment.filename}</div>
      <div className="mt-1 text-xs text-slate-500">
        {attachment.mimeType} · {formatBytes(attachment.size)}
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
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
