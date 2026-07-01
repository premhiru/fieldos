"use client";

import { Badge, Card, CardContent } from "@fieldos/ui";
import Link from "next/link";
import * as React from "react";

import { AppShell } from "../../components/app-shell";
import { AuthGuard } from "../../components/auth-guard";
import { OrganizationOnboarding } from "../../components/organization-onboarding";
import { OrganizationSelector } from "../../components/organization-selector";
import type { Conversation } from "../../lib/api";
import { useConversations, useOrganizations } from "../../lib/queries";
import { useActiveOrganizationStore } from "../../store/active-organization-store";

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
  const activeOrganization =
    organizations.find((organization) => organization.id === activeOrganizationId) ??
    organizations[0];
  const [search, setSearch] = React.useState("");
  const conversationsQuery = useConversations(activeOrganization?.id ?? null, search);
  const conversations = conversationsQuery.data?.conversations ?? [];

  React.useEffect(() => {
    if (!activeOrganizationId && organizations[0]) {
      setActiveOrganizationId(organizations[0].id);
    }
  }, [activeOrganizationId, organizations, setActiveOrganizationId]);

  if (organizationsQuery.isLoading) {
    return <p className="text-sm text-slate-600">Loading inbox...</p>;
  }

  if (organizations.length === 0) {
    return <OrganizationOnboarding />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Inbox</h1>
          <p className="text-sm text-slate-600">
            Unified conversations for {activeOrganization?.name}.
          </p>
        </div>
        <OrganizationSelector organizations={organizations} />
      </div>

      <label className="block text-sm font-medium text-slate-700">
        Search
        <input
          className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm md:max-w-md"
          placeholder="Search conversations and messages"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      <Card>
        <CardContent>
          {conversationsQuery.isLoading ? (
            <p className="text-sm text-slate-600">Loading conversations...</p>
          ) : conversations.length === 0 ? (
            <EmptyInbox />
          ) : (
            <ConversationTable conversations={conversations} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConversationTable({ conversations }: { conversations: Conversation[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
            <th className="py-3 pr-4">Conversation</th>
            <th className="py-3 pr-4">Channel</th>
            <th className="py-3 pr-4">Last Message</th>
            <th className="py-3 pr-4">Project</th>
            <th className="py-3">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {conversations.map((conversation) => (
            <tr key={conversation.id} className="align-top hover:bg-slate-50">
              <td className="py-4 pr-4">
                <Link
                  className="font-medium text-slate-950 hover:text-slate-700"
                  href={`/inbox/${conversation.id}`}
                >
                  {conversation.title}
                </Link>
                {conversation.isGroup ? (
                  <div className="mt-1 text-xs text-slate-500">Group conversation</div>
                ) : null}
              </td>
              <td className="py-4 pr-4">
                <Badge variant="muted">{conversation.channel}</Badge>
              </td>
              <td className="max-w-xs truncate py-4 pr-4 text-slate-600">
                {conversation.lastMessageBody ?? "No messages yet"}
              </td>
              <td className="py-4 pr-4 text-slate-600">
                {conversation.project?.name ?? "Unassigned"}
              </td>
              <td className="whitespace-nowrap py-4 text-slate-500">
                {formatDate(conversation.lastMessageAt ?? conversation.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyInbox() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="relative h-24 w-28 rounded-md border border-slate-300 bg-white shadow-sm">
        <div className="absolute left-4 right-4 top-5 h-2 rounded bg-slate-200" />
        <div className="absolute left-4 right-8 top-10 h-2 rounded bg-slate-200" />
        <div className="absolute bottom-0 left-0 right-0 h-8 rounded-b-md border-t border-slate-300 bg-slate-100" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-slate-950">No conversations yet.</h2>
        <p className="mt-1 text-sm text-slate-600">
          Seed data or connectors will populate this inbox.
        </p>
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
