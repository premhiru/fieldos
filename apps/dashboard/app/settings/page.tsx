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
  const [isPairingRequested, setIsPairingRequested] = React.useState(false);
  const isPairingStatus = account.status === "PENDING_QR" || account.status === "CONNECTING";
  const shouldPollQr = isPairingRequested || isPairingStatus;
  const chatsQuery = useQuery({
    queryFn: () => api.listWhatsAppChats(account.id),
    queryKey: ["whatsapp-chats", account.id],
    retry: false
  });
  const qrQuery = useQuery({
    enabled: shouldPollQr,
    queryFn: () => api.getWhatsAppQr(account.id),
    queryKey: ["whatsapp-qr", account.id],
    refetchInterval: 2_000,
    retry: false
  });
  const connectMutation = useMutation({
    mutationFn: () => api.connectWhatsAppAccount(account.id),
    onMutate: () => {
      setIsPairingRequested(true);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-accounts", organizationId] });
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-qr", account.id] });
    }
  });
  const disconnectMutation = useMutation({
    mutationFn: () => api.disconnectWhatsAppAccount(account.id),
    onSuccess: async () => {
      setIsPairingRequested(false);
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-accounts", organizationId] });
      await queryClient.removeQueries({ queryKey: ["whatsapp-qr", account.id] });
    }
  });
  const shouldShowPairing = isPairingRequested || isPairingStatus || connectMutation.isPending;

  React.useEffect(() => {
    if (account.status === "CONNECTED") {
      setIsPairingRequested(false);
    }
  }, [account.status]);

  React.useEffect(() => {
    if (qrQuery.data?.status && qrQuery.data.status !== account.status) {
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-accounts", organizationId] });
    }
  }, [account.status, organizationId, qrQuery.data?.status, queryClient]);

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

        {shouldShowPairing ? (
          <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <div className="flex min-h-[252px] w-full items-center justify-center rounded-md border border-slate-200 bg-white p-4 md:w-[252px] md:flex-none">
                {qrQuery.data?.qr ? (
                  <QRCodeSVG value={qrQuery.data.qr} size={220} />
                ) : (
                  <div className="text-center text-sm text-slate-600">
                    <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                    Waiting for QR code...
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h2 className="text-base font-semibold text-slate-950">Pair WhatsApp</h2>
                <p className="text-sm text-slate-600">
                  Keep this panel visible while reconnecting. Existing chats stay below after the
                  pairing code appears.
                </p>
                <Badge variant="muted">{qrQuery.data?.status ?? account.status}</Badge>
                {qrQuery.isError ? (
                  <p className="text-sm text-red-600">{(qrQuery.error as Error).message}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className={shouldShowPairing ? "mt-6 border-t border-slate-200 pt-6" : "mt-6"}>
          <h2 className="text-sm font-semibold text-slate-950">Chats and Groups</h2>
          {chatsQuery.isLoading ? (
            <p className="mt-3 text-sm text-slate-600">Loading chats...</p>
          ) : (chatsQuery.data?.chats ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No chats discovered yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                    <th className="py-3 pr-4">Chat/group name</th>
                    <th className="py-3 pr-4">Type</th>
                    <th className="py-3 pr-4">JID</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Mapped project</th>
                    <th className="py-3 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {chatsQuery.data?.chats.map((chat) => (
                    <ChatMappingRow
                      key={chat.id}
                      accountId={account.id}
                      canManage={canManage}
                      chat={chat}
                      projects={projects}
                    />
                  ))}
                </tbody>
              </table>
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
  const [selectedProjectId, setSelectedProjectId] = React.useState(chat.projectId ?? "");
  React.useEffect(() => {
    setSelectedProjectId(chat.projectId ?? "");
  }, [chat.projectId]);
  const invalidateChats = async () => {
    await queryClient.invalidateQueries({ queryKey: ["whatsapp-chats", accountId] });
    await queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };
  const updateProjectMutation = useMutation({
    mutationFn: (projectId: string | null) => api.updateWhatsAppChatMapping(chat.id, { projectId }),
    onSuccess: invalidateChats
  });
  const activateMutation = useMutation({
    mutationFn: () => api.activateWhatsAppChatMapping(chat.id, { projectId: selectedProjectId }),
    onSuccess: invalidateChats
  });
  const ignoreMutation = useMutation({
    mutationFn: () => api.ignoreWhatsAppChatMapping(chat.id),
    onSuccess: invalidateChats
  });
  const archiveMutation = useMutation({
    mutationFn: () => api.archiveWhatsAppChatMapping(chat.id),
    onSuccess: invalidateChats
  });
  const isMutating =
    updateProjectMutation.isPending ||
    activateMutation.isPending ||
    ignoreMutation.isPending ||
    archiveMutation.isPending;

  return (
    <tr>
      <td className="py-4 pr-4 font-medium text-slate-950">
        {chat.chatName ?? chat.conversation?.title ?? chat.jid}
      </td>
      <td className="py-4 pr-4 text-slate-600">{chat.isGroup ? "Group" : "Direct"}</td>
      <td className="py-4 pr-4 font-mono text-xs text-slate-500">{chat.jid}</td>
      <td className="py-4 pr-4">
        <Badge variant="muted">{chat.status}</Badge>
      </td>
      <td className="py-4 pr-4">
        <select
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          disabled={!canManage || isMutating}
          value={selectedProjectId}
          onChange={(event) => {
            const nextProjectId = event.target.value;
            setSelectedProjectId(nextProjectId);
            if (chat.status === "ACTIVE" && nextProjectId) {
              updateProjectMutation.mutate(nextProjectId);
            }
          }}
        >
          <option disabled={chat.status === "ACTIVE"} value="">
            Unassigned
          </option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </td>
      <td className="py-4 pr-4">
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!canManage || !selectedProjectId || isMutating || chat.status === "ACTIVE"}
            type="button"
            onClick={() => activateMutation.mutate()}
          >
            Activate
          </Button>
          <Button
            disabled={!canManage || isMutating || chat.status === "IGNORED"}
            type="button"
            variant="secondary"
            onClick={() => ignoreMutation.mutate()}
          >
            Ignore
          </Button>
          <Button
            disabled={!canManage || isMutating || chat.status === "ARCHIVED"}
            type="button"
            variant="secondary"
            onClick={() => archiveMutation.mutate()}
          >
            Archive
          </Button>
        </div>
      </td>
    </tr>
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
