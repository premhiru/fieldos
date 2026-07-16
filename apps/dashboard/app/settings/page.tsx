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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Check,
  CheckCircle2,
  MessageSquare,
  RefreshCw,
  Trash2,
  UserPlus
} from "lucide-react";
import * as React from "react";

import { AppShell } from "../../components/app-shell";
import { AuthGuard } from "../../components/auth-guard";
import { OrganizationOnboarding } from "../../components/organization-onboarding";
import { OrganizationSelector } from "../../components/organization-selector";
import {
  api,
  type Project,
  type TeamMember,
  type WhatsAppAccount,
  type WhatsAppChatMapping
} from "../../lib/api";
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
  const accounts = accountsQuery.data?.accounts ?? [];
  const [displayName, setDisplayName] = React.useState("");
  const [isAddingWhatsAppLine, setIsAddingWhatsAppLine] = React.useState(false);
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
      setDisplayName("");
      setIsAddingWhatsAppLine(false);
    }
  });

  React.useEffect(() => {
    if (!activeOrganizationId && organizations[0]) {
      setActiveOrganizationId(organizations[0].id);
    }
  }, [activeOrganizationId, organizations, setActiveOrganizationId]);

  React.useEffect(() => {
    setDisplayName("");
    setIsAddingWhatsAppLine(false);
  }, [activeOrganization?.id]);

  if (organizationsQuery.isLoading) return <Skeleton className="h-[680px]" />;

  if (organizations.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Settings</h1>
          <p className="text-sm text-slate-600">Account security</p>
        </div>
        <PasswordSecurityCard />
        <OrganizationOnboarding />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<OrganizationSelector organizations={organizations} />}
        description="Account, team, integrations, and workspace administration."
        title="Settings"
      />

      <nav
        aria-label="Settings sections"
        className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-3"
      >
        <a
          className="shrink-0 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          href="#security"
        >
          User settings
        </a>
        {canManage ? (
          <a
            className="shrink-0 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            href="#team"
          >
            Team & access
          </a>
        ) : null}
        <a
          className="shrink-0 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          href="#whatsapp"
        >
          Integrations
        </a>
        {canManage ? (
          <Link
            className="inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            href="/admin/operations"
          >
            <Activity aria-hidden="true" className="size-4" />
            Operations health
          </Link>
        ) : null}
      </nav>

      <section className="scroll-mt-24" id="security">
        <PasswordSecurityCard />
      </section>

      {canManage ? (
        <TeamSettingsSection
          actorRole={activeOrganization.role as "OWNER" | "ADMIN"}
          organizationId={activeOrganization.id}
          projects={projects}
        />
      ) : null}

      <section className="scroll-mt-24 space-y-4" id="whatsapp">
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Connect a dedicated business number for field operations. Personal WhatsApp accounts are
          not recommended because connected conversations can become shared workspace evidence.
        </div>

        {canManage && !accountsQuery.isLoading ? (
          accounts.length === 0 || isAddingWhatsAppLine ? (
            <WhatsAppSetupWizard
              currentStep={1}
              isPending={createAccountMutation.isPending}
              lineName={displayName}
              onContinue={() => createAccountMutation.mutate()}
              onLineNameChange={setDisplayName}
            />
          ) : (
            <div className="flex justify-end">
              <Button type="button" onClick={() => setIsAddingWhatsAppLine(true)}>
                Add WhatsApp line
              </Button>
            </div>
          )
        ) : null}
        {createAccountMutation.isError ? (
          <p className="text-sm text-[var(--status-critical-text)]">
            We could not create this line. Please try again.
          </p>
        ) : null}

        <div className="space-y-4">
          {accountsQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : accounts.length === 0 && !canManage ? (
            <Card>
              <CardContent>
                <EmptyState
                  description="Connect a dedicated business number to review and assign field conversations to projects."
                  icon={<MessageSquare aria-hidden="true" className="size-5" />}
                  title="No WhatsApp accounts connected"
                />
              </CardContent>
            </Card>
          ) : (
            accounts.map((account) => (
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
      </section>
    </div>
  );
}

function TeamSettingsSection({
  actorRole,
  organizationId,
  projects
}: {
  actorRole: "OWNER" | "ADMIN";
  organizationId: string;
  projects: Project[];
}) {
  const queryClient = useQueryClient();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"ADMIN" | "MEMBER" | "VIEWER">("MEMBER");
  const [projectIds, setProjectIds] = React.useState<string[]>([]);
  const [deliveryNotice, setDeliveryNotice] = React.useState<string | null>(null);
  const teamQuery = useQuery({
    queryFn: () => api.listTeam(organizationId),
    queryKey: ["team", organizationId],
    retry: false
  });
  const inviteMutation = useMutation({
    mutationFn: () => api.inviteTeamMember(organizationId, { email, projectIds, role }),
    onSuccess: async (result) => {
      await navigator.clipboard.writeText(result.invitationUrl);
      setDeliveryNotice(
        result.deliveryStatus === "SENT"
          ? "Invitation sent. The invite link was also copied."
          : "Email delivery was unavailable, so the invite link was copied for you to share."
      );
      setEmail("");
      setProjectIds([]);
      await queryClient.invalidateQueries({ queryKey: ["team", organizationId] });
    }
  });
  const resendMutation = useMutation({
    mutationFn: (invitationId: string) => api.resendTeamInvitation(organizationId, invitationId),
    onSuccess: async (result) => {
      await navigator.clipboard.writeText(result.invitationUrl);
      setDeliveryNotice(
        result.deliveryStatus === "SENT"
          ? "Invitation resent and its new link copied."
          : "Email delivery failed, but the new invite link was copied."
      );
      await queryClient.invalidateQueries({ queryKey: ["team", organizationId] });
    }
  });
  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) => api.revokeTeamInvitation(organizationId, invitationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team", organizationId] })
  });

  React.useEffect(() => {
    setDeliveryNotice(null);
  }, [organizationId]);

  return (
    <section className="scroll-mt-24 space-y-4" id="team">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">Team & Invitations</h2>
        <p className="text-sm text-slate-600">Manage organization roles and project access.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite team member</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setDeliveryNotice(null);
              inviteMutation.mutate();
            }}
          >
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Email
                <input
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Role
                <select
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                  onChange={(event) => {
                    const nextRole = event.target.value as "ADMIN" | "MEMBER" | "VIEWER";
                    setRole(nextRole);
                    if (nextRole === "ADMIN") setProjectIds([]);
                  }}
                  value={role}
                >
                  {actorRole === "OWNER" ? <option value="ADMIN">Admin</option> : null}
                  <option value="MEMBER">Member</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </label>
            </div>

            {role === "ADMIN" ? (
              <p className="text-sm text-slate-600">Admins can access every project.</p>
            ) : (
              <ProjectCheckboxes
                projectIds={projectIds}
                projects={projects}
                setProjectIds={setProjectIds}
              />
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={inviteMutation.isPending || !email.trim()} type="submit">
                <UserPlus aria-hidden="true" className="mr-2 h-4 w-4" />
                {inviteMutation.isPending ? "Inviting..." : "Send invitation"}
              </Button>
              {deliveryNotice ? <p className="text-sm text-emerald-700">{deliveryNotice}</p> : null}
              {inviteMutation.isError ? (
                <p className="text-sm text-red-700">{(inviteMutation.error as Error).message}</p>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-950">Members</h3>
        </div>
        {teamQuery.isLoading ? (
          <p className="p-4 text-sm text-slate-600">Loading team...</p>
        ) : teamQuery.isError ? (
          <p className="p-4 text-sm text-red-700">Unable to load team members.</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {(teamQuery.data?.members ?? []).map((member) => (
              <TeamMemberRow
                key={member.id}
                actorRole={actorRole}
                member={member}
                organizationId={organizationId}
                projects={projects}
              />
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-950">Invitations</h3>
        </div>
        {(teamQuery.data?.invitations ?? []).length === 0 ? (
          <p className="p-4 text-sm text-slate-600">No invitations yet.</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {teamQuery.data?.invitations.map((invitation) => (
              <div
                className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between"
                key={invitation.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-slate-950">
                      {invitation.email}
                    </p>
                    <Badge variant={invitation.status === "PENDING" ? "warning" : "muted"}>
                      {invitation.status}
                    </Badge>
                    <Badge variant="muted">{invitation.role}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {invitation.role === "ADMIN"
                      ? "All projects"
                      : invitation.projects.map((project) => project.name).join(", ") ||
                        "No projects assigned"}
                  </p>
                </div>
                {invitation.status === "PENDING" ? (
                  <div className="flex gap-2">
                    <Button
                      aria-label={`Resend invitation to ${invitation.email}`}
                      disabled={resendMutation.isPending}
                      onClick={() => resendMutation.mutate(invitation.id)}
                      title="Resend and copy new link"
                      type="button"
                      variant="secondary"
                    >
                      <RefreshCw aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label={`Revoke invitation to ${invitation.email}`}
                      disabled={revokeMutation.isPending}
                      onClick={() => revokeMutation.mutate(invitation.id)}
                      title="Revoke invitation"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4 text-red-700" />
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TeamMemberRow({
  actorRole,
  member,
  organizationId,
  projects
}: {
  actorRole: "OWNER" | "ADMIN";
  member: TeamMember;
  organizationId: string;
  projects: Project[];
}) {
  const queryClient = useQueryClient();
  const [role, setRole] = React.useState<"ADMIN" | "MEMBER" | "VIEWER">(
    member.role === "OWNER" ? "ADMIN" : member.role
  );
  const [projectIds, setProjectIds] = React.useState(member.projects.map((project) => project.id));
  const updateMutation = useMutation({
    mutationFn: () => api.updateTeamMember(organizationId, member.id, { projectIds, role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team", organizationId] })
  });
  const removeMutation = useMutation({
    mutationFn: () => api.removeTeamMember(organizationId, member.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team", organizationId] })
  });
  const protectedMember =
    member.role === "OWNER" || (actorRole !== "OWNER" && member.role === "ADMIN");

  if (protectedMember) {
    return (
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-950">{member.user.name}</p>
          <p className="truncate text-xs text-slate-600">{member.user.email}</p>
        </div>
        <Badge>{member.role}</Badge>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-950">{member.user.name}</p>
          <p className="truncate text-xs text-slate-600">{member.user.email}</p>
        </div>
        <label className="flex w-full flex-col gap-1 text-xs font-medium text-slate-700 md:w-40">
          Role
          <select
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
            onChange={(event) => {
              const nextRole = event.target.value as "ADMIN" | "MEMBER" | "VIEWER";
              setRole(nextRole);
              if (nextRole === "ADMIN") setProjectIds([]);
            }}
            value={role}
          >
            {actorRole === "OWNER" ? <option value="ADMIN">Admin</option> : null}
            <option value="MEMBER">Member</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </label>
        <Button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
          Save
        </Button>
        <Button
          aria-label={`Remove ${member.user.name}`}
          disabled={removeMutation.isPending}
          onClick={() => removeMutation.mutate()}
          title="Remove member"
          variant="ghost"
        >
          <Trash2 aria-hidden="true" className="h-4 w-4 text-red-700" />
        </Button>
      </div>
      {role === "ADMIN" ? (
        <p className="text-xs text-slate-600">Admins can access every project.</p>
      ) : (
        <ProjectCheckboxes
          compact
          projectIds={projectIds}
          projects={projects}
          setProjectIds={setProjectIds}
        />
      )}
      {updateMutation.isError || removeMutation.isError ? (
        <p className="text-sm text-red-700">
          {((updateMutation.error ?? removeMutation.error) as Error).message}
        </p>
      ) : null}
    </div>
  );
}

function ProjectCheckboxes({
  compact = false,
  projectIds,
  projects,
  setProjectIds
}: {
  compact?: boolean;
  projectIds: string[];
  projects: Project[];
  setProjectIds: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-700">Project access</legend>
      <div className={`grid gap-2 ${compact ? "md:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {projects.map((project) => (
          <label
            className="flex min-w-0 items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
            key={project.id}
          >
            <input
              checked={projectIds.includes(project.id)}
              onChange={(event) =>
                setProjectIds((current) =>
                  event.target.checked
                    ? [...current, project.id]
                    : current.filter((id) => id !== project.id)
                )
              }
              type="checkbox"
            />
            <span className="truncate">{project.name}</span>
          </label>
        ))}
      </div>
      {projects.length === 0 ? (
        <p className="text-sm text-slate-600">No projects available.</p>
      ) : null}
    </fieldset>
  );
}

function PasswordSecurityCard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: api.changePassword,
    onSuccess: async () => {
      queryClient.clear();
      router.replace("/login?passwordChanged=1");
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid max-w-xl gap-4"
          onSubmit={(event) => {
            event.preventDefault();

            if (currentPassword.length < 8 || newPassword.length < 8) {
              setValidationError("Passwords must contain at least 8 characters.");
              return;
            }

            if (currentPassword === newPassword) {
              setValidationError("Choose a new password that differs from your current password.");
              return;
            }

            if (newPassword !== confirmPassword) {
              setValidationError("New passwords do not match.");
              return;
            }

            setValidationError(null);
            mutation.mutate({ currentPassword, newPassword });
          }}
        >
          <PasswordField
            autoComplete="current-password"
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
          />
          <PasswordField
            autoComplete="new-password"
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
          />
          <PasswordField
            autoComplete="new-password"
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />
          {validationError ? <p className="text-sm text-red-600">{validationError}</p> : null}
          {mutation.isError ? (
            <p className="text-sm text-red-600">{(mutation.error as Error).message}</p>
          ) : null}
          <div>
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? "Updating..." : "Update password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordField({
  autoComplete,
  label,
  onChange,
  value
}: {
  autoComplete: string;
  label: string;
  onChange(value: string): void;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      {label}
      <input
        autoComplete={autoComplete}
        className="h-10 rounded-md border border-slate-300 px-3 text-sm"
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

type WhatsAppSetupStep = 1 | 2 | 3;

export function StepIndicator({ currentStep }: { currentStep: WhatsAppSetupStep }) {
  return (
    <div
      aria-label={`WhatsApp setup progress: step ${currentStep} of 3`}
      className="flex w-full max-w-sm items-center"
      role="img"
    >
      {[1, 2, 3].map((step, index) => {
        const isComplete = step < currentStep;
        const isCurrent = step === currentStep;

        return (
          <React.Fragment key={step}>
            <span
              className={[
                "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                isComplete
                  ? "border border-[var(--status-healthy-border)] bg-[var(--status-healthy-soft)] text-[var(--status-healthy-text)]"
                  : isCurrent
                    ? "bg-[var(--action-primary)] text-[var(--action-primary-text)]"
                    : "border border-[var(--border-default)] bg-[var(--surface)] text-[var(--text-disabled)]"
              ].join(" ")}
            >
              {isComplete ? <Check aria-hidden="true" className="size-4" /> : step}
            </span>
            {index < 2 ? (
              <span
                aria-hidden="true"
                className={`h-px min-w-6 flex-1 ${
                  isComplete ? "bg-[var(--status-healthy-text)]" : "bg-[var(--border-default)]"
                }`}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function WhatsAppSetupWizard({
  currentStep,
  isPending,
  lineName,
  onContinue,
  onLineNameChange
}: {
  currentStep: WhatsAppSetupStep;
  isPending: boolean;
  lineName: string;
  onContinue(): void;
  onLineNameChange?(value: string): void;
}) {
  return (
    <Card>
      <CardContent className="pt-5 sm:pt-6">
        <WhatsAppSetupWizardContent
          currentStep={currentStep}
          isPending={isPending}
          lineName={lineName}
          onContinue={onContinue}
          onLineNameChange={onLineNameChange}
        />
      </CardContent>
    </Card>
  );
}

export function WhatsAppSetupWizardContent({
  currentStep,
  isPending,
  lineName,
  onContinue,
  onLineNameChange,
  qr = null,
  qrWaitTimedOut = false
}: {
  currentStep: WhatsAppSetupStep;
  isPending: boolean;
  lineName: string;
  onContinue(): void;
  onLineNameChange?(value: string): void;
  qr?: string | null;
  qrWaitTimedOut?: boolean;
}) {
  if (currentStep === 2 && qr) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            Step 2 of 3 — Connect your phone
          </p>
          <StepIndicator currentStep={2} />
        </div>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Scan this code with WhatsApp
          </h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--text-secondary)]">
            <li>Open WhatsApp on your phone</li>
            <li>Tap Menu (&#8942;) then Linked Devices</li>
            <li>Tap Link a Device</li>
            <li>Point your camera at this code</li>
          </ol>
          <div className="flex justify-center py-2">
            <div className="rounded-md border border-[var(--border-default)] bg-white p-4">
              <QRCodeSVG value={qr} size={220} />
            </div>
          </div>
          <p className="text-center text-sm text-[var(--text-secondary)]">
            This code refreshes automatically. Keep this window open while scanning.
          </p>
        </div>
      </div>
    );
  }

  if (currentStep === 3) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            Step 3 of 3 — Finishing up
          </p>
          <StepIndicator currentStep={3} />
        </div>
        <div className="flex flex-col items-center py-8 text-center">
          <div
            aria-label="Connecting"
            className="mb-5 size-10 animate-spin rounded-full border-4 border-[var(--border-default)] border-t-[var(--action-primary)]"
            role="status"
          />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Connecting your WhatsApp...
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            This usually takes a few seconds. Don&apos;t close this window.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          Step 1 of 3 — Name your line
        </p>
        <StepIndicator currentStep={1} />
      </div>
      <div className="max-w-2xl space-y-3">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Set up your WhatsApp line
        </h2>
        <p className="text-sm leading-6 text-[var(--text-secondary)]">
          This will be the WhatsApp number your field team sends updates to. Use a dedicated
          business number — do not connect a personal account.
        </p>
      </div>
      <form
        className="max-w-xl space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onContinue();
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)]">
          Line name
          <input
            className="h-10 rounded-md border border-[var(--border-default)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] read-only:bg-[var(--surface-subtle)]"
            onChange={(event) => onLineNameChange?.(event.target.value)}
            placeholder="e.g. Site Dispatch"
            readOnly={!onLineNameChange}
            value={lineName}
          />
        </label>
        <Button disabled={isPending || !lineName.trim()} type="submit">
          {isPending ? "Continuing..." : "Continue"}
        </Button>
      </form>
      {qrWaitTimedOut ? (
        <p className="text-sm text-[var(--text-secondary)]">
          Having trouble? Try refreshing the page or contact support.
        </p>
      ) : null}
    </div>
  );
}

function WhatsAppConnectionFailure({
  isPending,
  onTryAgain
}: {
  isPending: boolean;
  onTryAgain(): void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          Step 2 of 3 — Connect your phone
        </p>
        <StepIndicator currentStep={2} />
      </div>
      <div className="rounded-md border border-[var(--status-critical-border)] bg-[var(--status-critical-soft)] p-4">
        <p className="font-medium text-[var(--status-critical-text)]">
          Connection failed. Please try scanning the code again.
        </p>
        <Button className="mt-4" disabled={isPending} type="button" onClick={onTryAgain}>
          {isPending ? "Trying again..." : "Try again"}
        </Button>
      </div>
    </div>
  );
}

export function WhatsAppAccountCard({
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
  const [ignoreCurrentConnectionError, setIgnoreCurrentConnectionError] = React.useState(false);
  const [qrWaitTimedOut, setQrWaitTimedOut] = React.useState(false);
  const [chatSearch, setChatSearch] = React.useState("");
  const [chatTypeFilter, setChatTypeFilter] = React.useState<"ALL" | "GROUPS" | "DIRECT">("ALL");
  const [projectFilter, setProjectFilter] = React.useState<"ALL" | "MAPPED" | "UNASSIGNED">("ALL");
  const [statusFilter, setStatusFilter] = React.useState<WhatsAppChatMapping["status"] | "ALL">(
    "ALL"
  );
  const isPairingStatus = account.status === "PENDING_QR" || account.status === "CONNECTING";
  const isConnected = account.status === "CONNECTED";
  const shouldPollQr = isPairingRequested || isPairingStatus;
  const chatsQuery = useQuery({
    enabled: isConnected,
    queryFn: () => api.listWhatsAppChats(account.id),
    queryKey: ["whatsapp-chats", account.id],
    refetchInterval: isConnected ? 5_000 : false,
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
      setIgnoreCurrentConnectionError(true);
      setIsPairingRequested(true);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-accounts", organizationId] });
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-qr", account.id] });
    },
    onError: () => {
      setIgnoreCurrentConnectionError(false);
    }
  });
  const disconnectMutation = useMutation({
    mutationFn: () => api.disconnectWhatsAppAccount(account.id),
    onSuccess: async () => {
      setIsPairingRequested(false);
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-accounts", organizationId] });
      await queryClient.removeQueries({ queryKey: ["whatsapp-chats", account.id] });
      await queryClient.removeQueries({ queryKey: ["whatsapp-qr", account.id] });
    }
  });
  const effectiveStatus =
    account.status === "CONNECTED" ? account.status : (qrQuery.data?.status ?? account.status);
  const isConnecting = effectiveStatus === "CONNECTING";
  const connectionFailed = account.status === "ERROR" && !ignoreCurrentConnectionError;
  const currentSetupStep = isConnecting ? 3 : qrQuery.data?.qr ? 2 : 1;
  const shouldShowPairing =
    isPairingRequested || isPairingStatus || connectMutation.isPending || isConnecting;
  const showSetupPanel = shouldShowPairing || connectionFailed;

  React.useEffect(() => {
    if (account.status === "CONNECTED") {
      setIsPairingRequested(false);
    }

    if (account.status !== "ERROR") {
      setIgnoreCurrentConnectionError(false);
    }
  }, [account.status]);

  React.useEffect(() => {
    if (qrQuery.data?.status && qrQuery.data.status !== account.status) {
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-accounts", organizationId] });
    }
  }, [account.status, organizationId, qrQuery.data?.status, queryClient]);

  React.useEffect(() => {
    if (!shouldShowPairing || isConnecting || qrQuery.data?.qr) {
      setQrWaitTimedOut(false);
      return;
    }

    const timeout = window.setTimeout(() => setQrWaitTimedOut(true), 10_000);
    return () => window.clearTimeout(timeout);
  }, [isConnecting, qrQuery.data?.qr, shouldShowPairing]);

  const chats = isConnected ? (chatsQuery.data?.chats ?? []) : [];
  const filteredChats = React.useMemo(() => {
    const normalizedSearch = chatSearch.trim().toLowerCase();

    return chats.filter((chat) => {
      const chatName = chat.chatName ?? chat.conversation?.title ?? "";
      const mappedProjectName = projects.find((project) => project.id === chat.projectId)?.name;
      const searchable = [chatName, chat.jid, chat.status, mappedProjectName ?? ""]
        .join(" ")
        .toLowerCase();

      if (normalizedSearch && !searchable.includes(normalizedSearch)) {
        return false;
      }

      if (chatTypeFilter === "GROUPS" && !chat.isGroup) {
        return false;
      }

      if (chatTypeFilter === "DIRECT" && chat.isGroup) {
        return false;
      }

      if (statusFilter !== "ALL" && chat.status !== statusFilter) {
        return false;
      }

      if (projectFilter === "MAPPED" && !chat.projectId) {
        return false;
      }

      if (projectFilter === "UNASSIGNED" && chat.projectId) {
        return false;
      }

      return true;
    });
  }, [chatSearch, chatTypeFilter, chats, projectFilter, projects, statusFilter]);
  const hasActiveFilters =
    chatSearch.trim() ||
    chatTypeFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    projectFilter !== "ALL";
  const clearChatFilters = () => {
    setChatSearch("");
    setChatTypeFilter("ALL");
    setProjectFilter("ALL");
    setStatusFilter("ALL");
  };

  return (
    <Card>
      {!showSetupPanel ? (
        <CardHeader>
          {isConnected ? (
            <div className="flex flex-col gap-4 rounded-md border border-[var(--status-healthy-border)] bg-[var(--status-healthy-soft)] p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-start gap-3 text-[var(--status-healthy-text)]">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                <div className="min-w-0">
                  <CardTitle className="text-[var(--status-healthy-text)]">
                    WhatsApp connected
                  </CardTitle>
                  <p className="mt-1 text-sm">
                    {account.displayName} · Connected {formatDate(account.lastConnectedAt)}
                  </p>
                </div>
              </div>
              {canManage ? (
                <Button
                  disabled={disconnectMutation.isPending}
                  type="button"
                  variant="danger"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Disconnect ${account.displayName}? New WhatsApp messages will stop syncing until it is reconnected.`
                      )
                    ) {
                      disconnectMutation.mutate();
                    }
                  }}
                >
                  {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>{account.displayName}</CardTitle>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  WhatsApp is not connected to this line.
                </p>
              </div>
              {canManage ? (
                <Button
                  disabled={connectMutation.isPending}
                  type="button"
                  onClick={() => connectMutation.mutate()}
                >
                  Connect WhatsApp
                </Button>
              ) : null}
            </div>
          )}
        </CardHeader>
      ) : null}
      <CardContent className={showSetupPanel ? "pt-5 sm:pt-6" : undefined}>
        {!showSetupPanel ? (
          <div className="grid gap-4 md:grid-cols-3">
            <StatusField label="Last connected" value={formatDate(account.lastConnectedAt)} />
            <StatusField label="Last message" value={formatDate(account.lastMessageAt)} />
            <StatusField label="Phone number" value={account.phoneNumber ?? "Not available"} />
          </div>
        ) : null}

        {connectionFailed ? (
          <WhatsAppConnectionFailure
            isPending={connectMutation.isPending}
            onTryAgain={() => connectMutation.mutate()}
          />
        ) : shouldShowPairing ? (
          <WhatsAppSetupWizardContent
            currentStep={currentSetupStep}
            isPending={connectMutation.isPending}
            lineName={account.displayName}
            qr={qrQuery.data?.qr ?? null}
            qrWaitTimedOut={qrWaitTimedOut}
            onContinue={() => connectMutation.mutate()}
          />
        ) : null}

        <div className={showSetupPanel ? "mt-6 border-t border-slate-200 pt-6" : "mt-6"}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Chats and Groups</h2>
              <p className="mt-1 text-xs text-slate-500">
                Showing {filteredChats.length} of {chats.length} discovered chats
              </p>
            </div>
            {hasActiveFilters ? (
              <Button type="button" variant="secondary" onClick={clearChatFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
          {!isConnected ? (
            <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Chats and groups will appear after this WhatsApp account is connected.
            </p>
          ) : chatsQuery.isLoading ? (
            <div className="mt-3 space-y-2">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton className="h-16 w-full" key={index} />
              ))}
            </div>
          ) : chats.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No chats discovered yet.</p>
          ) : (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(220px,1fr)_160px_170px_170px]">
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Search
                  <input
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                    placeholder="Name, JID, status, or project"
                    value={chatSearch}
                    onChange={(event) => setChatSearch(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Type
                  <select
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                    value={chatTypeFilter}
                    onChange={(event) =>
                      setChatTypeFilter(event.target.value as "ALL" | "GROUPS" | "DIRECT")
                    }
                  >
                    <option value="ALL">All</option>
                    <option value="GROUPS">Groups only</option>
                    <option value="DIRECT">Direct only</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Status
                  <select
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as WhatsAppChatMapping["status"] | "ALL")
                    }
                  >
                    <option value="ALL">All statuses</option>
                    <option value="DISCOVERED">Discovered</option>
                    <option value="ACTIVE">Active</option>
                    <option value="IGNORED">Ignored</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Project
                  <select
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                    value={projectFilter}
                    onChange={(event) =>
                      setProjectFilter(event.target.value as "ALL" | "MAPPED" | "UNASSIGNED")
                    }
                  >
                    <option value="ALL">All projects</option>
                    <option value="MAPPED">Mapped</option>
                    <option value="UNASSIGNED">Unassigned</option>
                  </select>
                </label>
              </div>

              {filteredChats.length === 0 ? (
                <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No chats match the current filters.
                </p>
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
                      {filteredChats.map((chat) => (
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
            </>
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
