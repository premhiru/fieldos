"use client";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@fieldos/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import * as React from "react";

import { AppShell } from "../../components/app-shell";
import { AuthGuard } from "../../components/auth-guard";
import { OrganizationOnboarding } from "../../components/organization-onboarding";
import { OrganizationSelector } from "../../components/organization-selector";
import { api, type Project, type WhatsAppAccount, type WhatsAppChatMapping } from "../../lib/api";
import { useOrganizations, useProjects } from "../../lib/queries";
import { useActiveOrganizationStore } from "../../store/active-organization-store";

export default function SettingsPage() {
  return (
    <AuthGuard>
      <AppShell>
        <SettingsContent />
      </AppShell>
    </AuthGuard>
  );
}

function SettingsContent() {
  const queryClient = useQueryClient();
  const organizationsQuery = useOrganizations();
  const organizations = organizationsQuery.data?.organizations ?? [];
  const { activeOrganizationId, setActiveOrganizationId } = useActiveOrganizationStore();
  const activeOrganization =
    organizations.find((organization) => organization.id === activeOrganizationId) ??
    organizations[0];
  const projectsQuery = useProjects(activeOrganization?.id ?? null);
  const projects = projectsQuery.data?.projects ?? [];
  const accountsQuery = useQuery({
    enabled: Boolean(activeOrganization?.id),
    queryFn: () => api.listWhatsAppAccounts(activeOrganization?.id ?? ""),
    queryKey: ["whatsapp-accounts", activeOrganization?.id],
    retry: false
  });
  const [displayName, setDisplayName] = React.useState("Dispatch line");
  const canManage = activeOrganization?.role === "OWNER" || activeOrganization?.role === "ADMIN";
  const createAccountMutation = useMutation({
    mutationFn: () =>
      api.createWhatsAppAccount({
        displayName,
        organizationId: activeOrganization?.id ?? ""
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["whatsapp-accounts", activeOrganization?.id]
      });
    }
  });

  React.useEffect(() => {
    if (!activeOrganizationId && organizations[0]) {
      setActiveOrganizationId(organizations[0].id);
    }
  }, [activeOrganizationId, organizations, setActiveOrganizationId]);

  if (organizationsQuery.isLoading) {
    return <p className="text-sm text-slate-600">Loading settings...</p>;
  }

  if (organizations.length === 0) {
    return <OrganizationOnboarding />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Settings</h1>
          <p className="text-sm text-slate-600">WhatsApp Connections</p>
        </div>
        <OrganizationSelector organizations={organizations} />
      </div>

      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        This connector uses WhatsApp Web pairing through Baileys. Use dedicated business numbers
        only. Do not connect personal WhatsApp accounts. For enterprise deployments, FieldOS will
        support the official Meta WhatsApp Cloud API later.
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Connect WhatsApp</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-3 md:flex-row md:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                createAccountMutation.mutate();
              }}
            >
              <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
                Display name
                <input
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
              <Button
                disabled={createAccountMutation.isPending || !displayName.trim()}
                type="submit"
              >
                {createAccountMutation.isPending ? "Creating..." : "Connect WhatsApp"}
              </Button>
            </form>
            {createAccountMutation.isError ? (
              <p className="mt-3 text-sm text-red-600">
                {(createAccountMutation.error as Error).message}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        {accountsQuery.isLoading ? (
          <p className="text-sm text-slate-600">Loading WhatsApp accounts...</p>
        ) : (accountsQuery.data?.accounts ?? []).length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-slate-600">No WhatsApp accounts connected.</p>
            </CardContent>
          </Card>
        ) : (
          accountsQuery.data?.accounts.map((account) => (
            <WhatsAppAccountCard
              key={account.id}
              account={account}
              canManage={canManage}
              organizationId={activeOrganization?.id ?? ""}
              projects={projects}
            />
          ))
        )}
      </div>
    </div>
  );
}

function WhatsAppAccountCard({
  account,
  canManage,
  organizationId,
  projects
}: {
  account: WhatsAppAccount;
  canManage: boolean;
  organizationId: string;
  projects: Project[];
}) {
  const queryClient = useQueryClient();
  const chatsQuery = useQuery({
    queryFn: () => api.listWhatsAppChats(account.id),
    queryKey: ["whatsapp-chats", account.id],
    retry: false
  });
  const qrQuery = useQuery({
    enabled: account.status === "PENDING_QR" || account.status === "CONNECTING",
    queryFn: () => api.getWhatsAppQr(account.id),
    queryKey: ["whatsapp-qr", account.id],
    refetchInterval: 2_000,
    retry: false
  });
  const connectMutation = useMutation({
    mutationFn: () => api.connectWhatsAppAccount(account.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-accounts", organizationId] });
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-qr", account.id] });
    }
  });
  const disconnectMutation = useMutation({
    mutationFn: () => api.disconnectWhatsAppAccount(account.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-accounts", organizationId] });
    }
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>{account.displayName}</CardTitle>
            <p className="mt-1 text-sm text-slate-600">
              {account.phoneNumber ?? "No phone number yet"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">{account.status}</Badge>
            {canManage ? (
              <>
                <Button
                  disabled={connectMutation.isPending}
                  type="button"
                  onClick={() => connectMutation.mutate()}
                >
                  Connect
                </Button>
                <Button
                  disabled={disconnectMutation.isPending}
                  type="button"
                  variant="secondary"
                  onClick={() => disconnectMutation.mutate()}
                >
                  Disconnect
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <StatusField label="Last connected" value={formatDate(account.lastConnectedAt)} />
          <StatusField label="Last message" value={formatDate(account.lastMessageAt)} />
          <StatusField label="Connector" value={account.connectorType} />
        </div>

        {qrQuery.data?.qr ? (
          <div className="mt-5 inline-flex rounded-md border border-slate-200 bg-white p-4">
            <QRCodeSVG value={qrQuery.data.qr} size={220} />
          </div>
        ) : null}

        <div className="mt-6">
          <h2 className="text-sm font-semibold text-slate-950">Chats and Groups</h2>
          {chatsQuery.isLoading ? (
            <p className="mt-3 text-sm text-slate-600">Loading chats...</p>
          ) : (chatsQuery.data?.chats ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No chats received yet.</p>
          ) : (
            <div className="mt-3 divide-y divide-slate-200">
              {chatsQuery.data?.chats.map((chat) => (
                <ChatMappingRow
                  key={chat.id}
                  accountId={account.id}
                  canManage={canManage}
                  chat={chat}
                  projects={projects}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ChatMappingRow({
  accountId,
  canManage,
  chat,
  projects
}: {
  accountId: string;
  canManage: boolean;
  chat: WhatsAppChatMapping;
  projects: Project[];
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (projectId: string | null) => api.updateWhatsAppChatMapping(chat.id, { projectId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-chats", accountId] });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
  });

  return (
    <div className="grid gap-3 py-4 md:grid-cols-[1fr_220px] md:items-center">
      <div>
        <div className="font-medium text-slate-950">{chat.chatName ?? chat.conversation.title}</div>
        <div className="mt-1 text-xs text-slate-500">
          {chat.jid} - {chat.isGroup ? "Group" : "Direct"}
        </div>
      </div>
      <select
        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        disabled={!canManage || mutation.isPending}
        value={chat.projectId ?? ""}
        onChange={(event) => mutation.mutate(event.target.value || null)}
      >
        <option value="">Unassigned</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatusField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-950">{value}</div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
