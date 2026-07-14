"use client";

import { Badge, EmptyState, PageHeader, Skeleton } from "@fieldos/ui";
import { ArrowLeft, Inbox as InboxIcon, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";

import { AppShell } from "../../components/app-shell";
import { AuthGuard } from "../../components/auth-guard";
import { OrganizationOnboarding } from "../../components/organization-onboarding";
import { OrganizationSelector } from "../../components/organization-selector";
import { api, type Conversation, type Message } from "../../lib/api";
import { useConversations, useOrganizations } from "../../lib/queries";
import { useActiveOrganizationStore } from "../../store/active-organization-store";

type InboxFilter = "all" | "unread" | "groups" | "direct" | "unassigned";

export default function InboxPage() {
  return (
    <AuthGuard>
      <AppShell>
        <InboxContent />
      </AppShell>
    </AuthGuard>
  );
}

function InboxContent() {
  const organizationsQuery = useOrganizations();
  const organizations = organizationsQuery.data?.organizations ?? [];
  const { activeOrganizationId, setActiveOrganizationId } = useActiveOrganizationStore();
  const organization =
    organizations.find((item) => item.id === activeOrganizationId) ?? organizations[0];
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<InboxFilter>("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [readIds, setReadIds] = React.useState<string[]>([]);
  const conversationsQuery = useConversations(organization?.id ?? null, search);

  React.useEffect(() => {
    if (!activeOrganizationId && organizations[0]) setActiveOrganizationId(organizations[0].id);
  }, [activeOrganizationId, organizations, setActiveOrganizationId]);

  React.useEffect(() => {
    if (!organization?.id) return;
    const stored = window.localStorage.getItem(`fieldos-inbox-read-${organization.id}`);
    setReadIds(stored ? (JSON.parse(stored) as string[]) : []);
  }, [organization?.id]);

  if (organizationsQuery.isLoading) return <Skeleton className="h-[680px]" />;
  if (organizations.length === 0) return <OrganizationOnboarding />;

  const conversations = filterConversations(
    conversationsQuery.data?.conversations ?? [],
    filter,
    readIds
  );

  function selectConversation(id: string) {
    setSelectedId(id);
    if (!organization || readIds.includes(id)) return;
    const next = [...readIds, id];
    setReadIds(next);
    window.localStorage.setItem(`fieldos-inbox-read-${organization.id}`, JSON.stringify(next));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<OrganizationSelector organizations={organizations} />}
        description="Messages and field evidence from every connected channel."
        title="Inbox"
      />

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:grid lg:h-[calc(100vh-13rem)] lg:min-h-[620px] lg:grid-cols-[380px_minmax(0,1fr)]">
        <section
          className={
            selectedId
              ? "hidden border-r border-slate-200 lg:flex lg:flex-col"
              : "flex flex-col border-r border-slate-200"
          }
        >
          <div className="border-b border-slate-200 p-4">
            <label className="relative block">
              <span className="sr-only">Search conversations</span>
              <Search aria-hidden="true" className="absolute left-3 top-3 size-4 text-slate-400" />
              <input
                className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-slate-950"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search inbox"
                value={search}
              />
            </label>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {(["all", "unread", "groups", "direct", "unassigned"] as const).map((item) => (
                <button
                  aria-pressed={filter === item}
                  className={
                    filter === item
                      ? "h-8 shrink-0 rounded-md bg-slate-950 px-3 text-xs font-medium text-white"
                      : "h-8 shrink-0 rounded-md bg-slate-100 px-3 text-xs font-medium text-slate-600 hover:bg-slate-200"
                  }
                  key={item}
                  onClick={() => setFilter(item)}
                  type="button"
                >
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversationsQuery.isLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 6 }, (_, index) => (
                  <Skeleton className="h-24" key={index} />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <EmptyState
                action={
                  <Link
                    className="text-sm font-medium text-slate-950 underline"
                    href="/settings#whatsapp"
                  >
                    Manage connections
                  </Link>
                }
                description="Connect or activate a channel to bring field conversations into this workspace."
                icon={<InboxIcon aria-hidden="true" className="size-5" />}
                title="No conversations found"
              />
            ) : (
              conversations.map((conversation) => (
                <ConversationRow
                  active={selectedId === conversation.id}
                  conversation={conversation}
                  key={conversation.id}
                  onClick={() => selectConversation(conversation.id)}
                  unread={!readIds.includes(conversation.id)}
                />
              ))
            )}
          </div>
        </section>

        <section className={selectedId ? "block min-w-0" : "hidden min-w-0 lg:block"}>
          {selectedId ? (
            <ConversationPreview conversationId={selectedId} onBack={() => setSelectedId(null)} />
          ) : (
            <EmptyState
              className="h-full"
              description="Choose a conversation to review messages and evidence without leaving the inbox."
              icon={<InboxIcon aria-hidden="true" className="size-5" />}
              title="Select a conversation"
            />
          )}
        </section>
      </div>
    </div>
  );
}

function ConversationRow({
  active,
  conversation,
  onClick,
  unread
}: {
  active: boolean;
  conversation: Conversation;
  onClick: () => void;
  unread: boolean;
}) {
  return (
    <button
      className={
        active
          ? "block w-full border-b border-slate-100 bg-slate-100 p-4 text-left"
          : "block w-full border-b border-slate-100 p-4 text-left hover:bg-slate-50"
      }
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start gap-3">
        <span
          className={
            unread ? "mt-1.5 size-2 shrink-0 rounded-full bg-blue-600" : "mt-1.5 size-2 shrink-0"
          }
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span
              className={
                unread
                  ? "truncate text-sm font-semibold text-slate-950"
                  : "truncate text-sm font-medium text-slate-800"
              }
            >
              {conversation.title}
            </span>
            <span className="shrink-0 text-xs text-slate-500">
              {formatRelativeDate(conversation.lastMessageAt ?? conversation.updatedAt)}
            </span>
          </span>
          <span className="mt-1 block truncate text-sm text-slate-600">
            {conversation.lastMessageBody ?? "No messages yet"}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="muted">{conversation.channel}</Badge>
            <span className="max-w-40 truncate text-xs text-slate-500">
              {conversation.project?.name ?? "Unassigned"}
            </span>
          </span>
        </span>
      </div>
    </button>
  );
}

function ConversationPreview({
  conversationId,
  onBack
}: {
  conversationId: string;
  onBack: () => void;
}) {
  const conversationQuery = useQuery({
    queryFn: () => api.getConversation(conversationId),
    queryKey: ["conversation", conversationId],
    retry: false
  });
  const messagesQuery = useQuery({
    enabled: Boolean(conversationQuery.data),
    queryFn: () => api.listConversationMessages(conversationId),
    queryKey: ["conversation-messages", conversationId],
    refetchInterval: 5_000,
    retry: false
  });
  const conversation = conversationQuery.data?.conversation;
  const messages = messagesQuery.data?.messages ?? [];

  if (conversationQuery.isLoading) return <Skeleton className="m-5 h-[560px]" />;
  if (!conversation)
    return (
      <EmptyState
        description="This conversation is no longer available."
        title="Conversation unavailable"
      />
    );

  return (
    <div className="flex h-full min-h-[620px] flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
        <button
          aria-label="Back to conversations"
          className="flex size-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 lg:hidden"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-slate-950">{conversation.title}</h2>
          <p className="truncate text-xs text-slate-500">
            {conversation.project?.name ?? "Unassigned"}
          </p>
        </div>
        <Link
          className="text-xs font-medium text-slate-600 hover:text-slate-950"
          href={`/inbox/${conversation.id}`}
        >
          Full details
        </Link>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-4 sm:p-6">
        {messagesQuery.isLoading ? (
          <Skeleton className="h-72" />
        ) : messages.length === 0 ? (
          <EmptyState
            description="New messages will appear here as they arrive."
            title="No messages yet"
          />
        ) : (
          messages.map((message) => <MessagePreview key={message.id} message={message} />)
        )}
      </div>
      <div className="border-t border-slate-200 bg-white p-4">
        <textarea
          aria-label="Message composer"
          className="h-20 w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-3 text-sm"
          disabled
          placeholder="Replying from FieldOS is not available for this channel"
        />
      </div>
    </div>
  );
}

function MessagePreview({ message }: { message: Message }) {
  const outbound = message.direction === "OUTBOUND";
  return (
    <div className={outbound ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          outbound
            ? "max-w-[88%] rounded-lg bg-slate-950 px-4 py-3 text-white sm:max-w-[72%]"
            : "max-w-[88%] rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-950 sm:max-w-[72%]"
        }
      >
        <div className={outbound ? "text-xs text-slate-300" : "text-xs text-slate-500"}>
          {message.senderParticipant.displayName} - {formatDate(message.occurredAt)}
        </div>
        <p className="mt-2 text-sm leading-6">{message.body ?? formatMessageType(message.type)}</p>
        {message.attachments.length > 0 ? (
          <div
            className={
              outbound
                ? "mt-3 border-t border-slate-700 pt-2 text-xs text-slate-300"
                : "mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500"
            }
          >
            {message.attachments.length} attachment{message.attachments.length === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function filterConversations(
  conversations: Conversation[],
  filter: InboxFilter,
  readIds: string[]
) {
  if (filter === "unread") return conversations.filter((item) => !readIds.includes(item.id));
  if (filter === "groups") return conversations.filter((item) => item.isGroup);
  if (filter === "direct") return conversations.filter((item) => !item.isGroup);
  if (filter === "unassigned") return conversations.filter((item) => !item.projectId);
  return conversations;
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}

function formatMessageType(value: Message["type"]) {
  return `${value.charAt(0)}${value.slice(1).toLowerCase()} message`;
}
