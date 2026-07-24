"use client";

import { Badge, Button, EmptyState, PageHeader, Skeleton } from "@fieldos/ui";
import { Check, RefreshCw, Send, Users } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { AppShell } from "../../../../components/app-shell";
import { AuthGuard } from "../../../../components/auth-guard";
import {
  api,
  type ProjectPerson,
  type RecommendationType,
  type WhatsAppRecommendationRoutingMode
} from "../../../../lib/api";
import { useOrganizations } from "../../../../lib/queries";

const filters = [
  "all",
  "platform",
  "whatsapp",
  "external",
  "review",
  "invited",
  "inactive"
] as const;
const recommendationTypes: RecommendationType[] = [
  "PROGRESS_UPDATE",
  "FOLLOW_UP",
  "INSPECTION",
  "REPORT",
  "RISK",
  "MISSING_UPDATE",
  "APPROVAL_REQUIRED",
  "CLIENT_UPDATE",
  "SUPPLIER_DELAY",
  "GENERAL",
  "CREATE_MILESTONE",
  "UPDATE_MILESTONE",
  "COMPLETE_MILESTONE",
  "START_MILESTONE",
  "DELAY_MILESTONE"
];

export default function ProjectPeoplePage() {
  return (
    <AuthGuard>
      <AppShell>
        <ProjectPeople />
      </AppShell>
    </AuthGuard>
  );
}

function ProjectPeople() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const organizations = useOrganizations();
  const organization = organizations.data?.organizations[0] ?? null;
  const [filter, setFilter] = React.useState<(typeof filters)[number]>("all");
  const projectQuery = useQuery({
    queryFn: () => api.getProject(projectId),
    queryKey: ["project", projectId]
  });
  const peopleQuery = useQuery({
    queryFn: () => api.listProjectPeople(projectId, filter),
    queryKey: ["project-people", projectId, filter]
  });
  const allPeopleQuery = useQuery({
    queryFn: () => api.listProjectPeople(projectId, "all"),
    queryKey: ["project-people", projectId, "all"]
  });
  const settingQuery = useQuery({
    queryFn: () => api.getWhatsAppRecommendationSetting(projectId),
    queryKey: ["whatsapp-recommendation-setting", projectId]
  });
  const [enabled, setEnabled] = React.useState(false);
  const [routingMode, setRoutingMode] =
    React.useState<WhatsAppRecommendationRoutingMode>("PLATFORM_ONLY");
  const [approvers, setApprovers] = React.useState<string[]>([]);
  const [allowedTypes, setAllowedTypes] = React.useState<RecommendationType[]>([]);
  const [groupApprovalsEnabled, setGroupApprovalsEnabled] = React.useState(false);
  const [quietHoursStart, setQuietHoursStart] = React.useState("19:00");
  const [quietHoursEnd, setQuietHoursEnd] = React.useState("07:00");
  const [sendUrgentOnly, setSendUrgentOnly] = React.useState(true);
  const [requireConfirmation, setRequireConfirmation] = React.useState(true);

  React.useEffect(() => {
    const setting = settingQuery.data?.setting;
    if (setting) {
      setEnabled(setting.enabled);
      setRoutingMode(setting.routingMode);
      setApprovers(setting.namedApprovers.map((item) => item.person.id));
      setAllowedTypes(setting.allowedRecommendationTypes);
      setGroupApprovalsEnabled(setting.groupApprovalsEnabled);
      setQuietHoursStart(setting.quietHoursStart ?? "19:00");
      setQuietHoursEnd(setting.quietHoursEnd ?? "07:00");
      setSendUrgentOnly(setting.sendUrgentOnly);
      setRequireConfirmation(setting.requireSecondConfirmationForHighImpact);
    }
  }, [settingQuery.data?.setting]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["project-people", projectId] });
  const saveSetting = useMutation({
    mutationFn: () =>
      api.updateWhatsAppRecommendationSetting(projectId, {
        allowedRecommendationTypes: allowedTypes,
        dailyProjectLimit: 10,
        dailyRecipientLimit: 5,
        deliveryCooldownMinutes: 30,
        enabled,
        groupApprovalsEnabled,
        namedApproverPersonIds: approvers,
        quietHoursEnd,
        quietHoursStart,
        requireSecondConfirmationForHighImpact: requireConfirmation,
        routingMode,
        sendUrgentOnly,
        timezone: projectQuery.data?.project.timezone ?? "UTC"
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["whatsapp-recommendation-setting", projectId] })
  });
  const testDelivery = useMutation({
    mutationFn: () => api.testWhatsAppRecommendationDelivery(projectId)
  });
  const updatePerson = useMutation({
    mutationFn: ({ personId, body }: { personId: string; body: Record<string, unknown> }) =>
      api.updateProjectPerson(personId, organization?.id ?? "", body),
    onSuccess: refresh
  });
  const updateParticipant = useMutation({
    mutationFn: ({
      participantId,
      body
    }: {
      participantId: string;
      body: Record<string, unknown>;
    }) => api.updateProjectParticipant(participantId, organization?.id ?? "", body),
    onSuccess: refresh
  });
  const invite = useMutation({
    mutationFn: (personId: string) =>
      api.createWhatsAppInvitation(projectId, { personId, role: "MEMBER" }),
    onSuccess: refresh
  });
  const ignoreReview = useMutation({
    mutationFn: (reviewId: string) => api.ignoreIdentityReview(reviewId, organization?.id ?? ""),
    onSuccess: refresh
  });
  const mergeReview = useMutation({
    mutationFn: ({ reviewId, targetPersonId }: { reviewId: string; targetPersonId: string }) =>
      api.mergeIdentityReview(reviewId, organization?.id ?? "", targetPersonId),
    onSuccess: refresh
  });
  const isAdmin = organization?.role === "OWNER" || organization?.role === "ADMIN";

  if (projectQuery.isLoading || organizations.isLoading) return <Skeleton className="h-[620px]" />;
  const project = projectQuery.data?.project;
  if (!project)
    return <p className="text-sm text-[var(--status-critical-text)]">Project not found.</p>;

  return (
    <div className="space-y-7">
      <Link
        className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        href={`/projects/${projectId}`}
      >
        Back to project
      </Link>
      <PageHeader
        description="Project participants, WhatsApp contacts, and platform access"
        title={`${project.name} People`}
      />

      {isAdmin ? (
        <section
          className="space-y-5 border-y border-[var(--border-subtle)] py-6"
          aria-labelledby="delivery-heading"
        >
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]" id="delivery-heading">
              WhatsApp recommendations
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Route selected operational decisions privately to verified FieldOS users.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex items-center gap-3 text-sm font-medium text-[var(--text-primary)]">
              <input
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                type="checkbox"
              />{" "}
              Enable delivery
            </label>
            <label className="text-sm text-[var(--text-secondary)]">
              Routing mode
              <select
                className="mt-1 h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[var(--text-primary)]"
                onChange={(event) =>
                  setRoutingMode(event.target.value as WhatsAppRecommendationRoutingMode)
                }
                value={routingMode}
              >
                <option value="PLATFORM_ONLY">Platform only</option>
                <option value="PRIVATE_PROJECT_MANAGER">Private project manager</option>
                <option value="PRIVATE_NAMED_APPROVERS">Private named approvers</option>
                <option value="PRIVATE_CONNECTED_ACCOUNT_OWNER">Connected account owner</option>
                <option value="PROJECT_GROUP">Project group (external visibility)</option>
              </select>
            </label>
            <div className="flex items-end gap-2">
              <Button disabled={saveSetting.isPending} onClick={() => saveSetting.mutate()}>
                <Check className="size-4" /> Save settings
              </Button>
              <Button
                disabled={testDelivery.isPending || !enabled}
                onClick={() => testDelivery.mutate()}
                variant="secondary"
              >
                <Send className="size-4" /> Test delivery
              </Button>
            </div>
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-[var(--text-primary)]">
              Recommendation types
            </legend>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              {recommendationTypes.map((type) => (
                <label
                  className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"
                  key={type}
                >
                  <input
                    checked={allowedTypes.includes(type)}
                    onChange={(event) =>
                      setAllowedTypes((current) =>
                        event.target.checked
                          ? [...current, type]
                          : current.filter((item) => item !== type)
                      )
                    }
                    type="checkbox"
                  />
                  {label(type)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm text-[var(--text-secondary)]">
              Quiet hours start
              <input
                className="mt-1 h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[var(--text-primary)]"
                onChange={(event) => setQuietHoursStart(event.target.value)}
                type="time"
                value={quietHoursStart}
              />
            </label>
            <label className="text-sm text-[var(--text-secondary)]">
              Quiet hours end
              <input
                className="mt-1 h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[var(--text-primary)]"
                onChange={(event) => setQuietHoursEnd(event.target.value)}
                type="time"
                value={quietHoursEnd}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                checked={sendUrgentOnly}
                onChange={(event) => setSendUrgentOnly(event.target.checked)}
                type="checkbox"
              />
              Urgent only
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                checked={requireConfirmation}
                onChange={(event) => setRequireConfirmation(event.target.checked)}
                type="checkbox"
              />
              Confirm high-impact actions
            </label>
          </div>
          {routingMode === "PROJECT_GROUP" ? (
            <div className="space-y-2 border-l-2 border-[var(--status-attention-text)] pl-4">
              <p className="text-sm text-[var(--status-attention-text)]">
                Group delivery may be visible to external participants. Sensitive recommendations
                are always blocked.
              </p>
              <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <input
                  checked={groupApprovalsEnabled}
                  onChange={(event) => setGroupApprovalsEnabled(event.target.checked)}
                  type="checkbox"
                />
                Allow independently authorized users to approve from the group
              </label>
            </div>
          ) : null}
          {routingMode === "PRIVATE_NAMED_APPROVERS" || routingMode === "PROJECT_GROUP" ? (
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">
                Authorized approvers
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                {(allPeopleQuery.data?.people ?? [])
                  .filter((item) => item.person.userId)
                  .map((item) => (
                    <label
                      className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"
                      key={item.person.id}
                    >
                      <input
                        checked={approvers.includes(item.person.id)}
                        onChange={(event) =>
                          setApprovers((current) =>
                            event.target.checked
                              ? [...current, item.person.id]
                              : current.filter((id) => id !== item.person.id)
                          )
                        }
                        type="checkbox"
                      />{" "}
                      {item.person.displayName}
                    </label>
                  ))}
              </div>
            </div>
          ) : null}
          {testDelivery.isSuccess ? (
            <p className="text-sm text-[var(--status-healthy-text)]">Test recommendation queued.</p>
          ) : null}
          {testDelivery.isError ? (
            <p className="text-sm text-[var(--status-critical-text)]">
              {(testDelivery.error as Error).message}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1" role="tablist">
            {filters.map((item) => (
              <Button
                key={item}
                onClick={() => setFilter(item)}
                variant={filter === item ? "default" : "ghost"}
              >
                {label(item)}
              </Button>
            ))}
          </div>
          <Button onClick={() => refresh()} variant="secondary">
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>
        {peopleQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : (peopleQuery.data?.people.length ?? 0) === 0 ? (
          <EmptyState
            description="Activate a WhatsApp project group to discover its participants."
            icon={<Users className="size-5" />}
            title="No project participants yet"
          />
        ) : (
          <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
            {peopleQuery.data?.people.map((participant) => (
              <PersonRow
                actions={{ ignoreReview, invite, mergeReview, updateParticipant, updatePerson }}
                admin={isAdmin}
                allPeople={allPeopleQuery.data?.people ?? []}
                key={participant.id}
                participant={participant}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface PersonRowActions {
  ignoreReview: { mutate(id: string): void };
  invite: { isPending: boolean; mutate(id: string): void };
  mergeReview: { mutate(input: { reviewId: string; targetPersonId: string }): void };
  updateParticipant: {
    mutate(input: { body: Record<string, unknown>; participantId: string }): void;
  };
  updatePerson: { mutate(input: { body: Record<string, unknown>; personId: string }): void };
}

function PersonRow({
  actions,
  admin,
  allPeople,
  participant
}: {
  actions: PersonRowActions;
  admin: boolean;
  allPeople: ProjectPerson[];
  participant: ProjectPerson;
}) {
  const person = participant.person;
  const review = person.identityReviews[0];
  const invitation = person.whatsAppInvitations[0];
  return (
    <div className="grid gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-[var(--text-primary)]">{person.displayName}</span>
          <Badge variant={person.userId ? "success" : "muted"}>
            {person.userId ? "FieldOS user" : "Contact"}
          </Badge>
          {review ? <Badge variant="warning">Needs review</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {person.company ?? "Company not set"} | {participant.role ?? "Role not assigned"} |
          WhatsApp{" "}
          {person.identities[0]?.verificationStatus.toLowerCase().replaceAll("_", " ") ??
            "not linked"}
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Last seen {new Date(participant.lastSeenAt).toLocaleString()}{" "}
          {invitation ? `| Invitation ${invitation.status.toLowerCase()}` : ""}
        </p>
      </div>
      {admin ? (
        <div className="flex flex-wrap gap-2">
          <select
            aria-label={`Project role for ${person.displayName}`}
            className="h-10 rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-2 text-sm text-[var(--text-primary)]"
            onChange={(event) =>
              actions.updateParticipant.mutate({
                body: { role: event.target.value || null },
                participantId: participant.id
              })
            }
            value={participant.role ?? ""}
          >
            <option value="">No role</option>
            <option value="PROJECT_MANAGER">Project manager</option>
            <option value="SITE_MANAGER">Site manager</option>
            <option value="CONTRACTOR">Contractor</option>
            <option value="CLIENT">Client</option>
            <option value="SUPPLIER">Supplier</option>
          </select>
          {!person.userId ? (
            <>
              <Button
                disabled={actions.invite.isPending}
                onClick={() => actions.invite.mutate(person.id)}
                variant="secondary"
              >
                <Send className="size-4" /> WhatsApp invite
              </Button>
              <Link
                className="inline-flex h-10 items-center px-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                href="/settings?section=team"
              >
                Email invite
              </Link>
            </>
          ) : null}
          {person.type !== "EXTERNAL" ? (
            <Button
              onClick={() =>
                actions.updatePerson.mutate({ personId: person.id, body: { type: "EXTERNAL" } })
              }
              variant="ghost"
            >
              Mark external
            </Button>
          ) : null}
          {participant.participantStatus === "ACTIVE" ? (
            <Button
              onClick={() =>
                actions.updateParticipant.mutate({
                  participantId: participant.id,
                  body: { status: "INACTIVE" }
                })
              }
              variant="ghost"
            >
              Deactivate
            </Button>
          ) : null}
          {review ? (
            <>
              <select
                aria-label={`Merge identity for ${person.displayName}`}
                className="h-10 rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-2 text-sm text-[var(--text-primary)]"
                defaultValue=""
                onChange={(event) => {
                  if (event.target.value) {
                    actions.mergeReview.mutate({
                      reviewId: review.id,
                      targetPersonId: event.target.value
                    });
                  }
                }}
              >
                <option value="">Merge with...</option>
                {allPeople
                  .filter((item) => item.person.id !== person.id)
                  .map((item) => (
                    <option key={item.person.id} value={item.person.id}>
                      {item.person.displayName}
                    </option>
                  ))}
              </select>
              <Button onClick={() => actions.ignoreReview.mutate(review.id)} variant="ghost">
                Ignore identity
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
