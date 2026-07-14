"use client";

import { Badge, Button, Skeleton } from "@fieldos/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flag,
  Pencil,
  Plus,
  Sparkles,
  X
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import {
  api,
  type Milestone,
  type MilestoneInput,
  type MilestonePriority,
  type MilestoneRecommendation,
  type MilestoneStatus,
  type ProjectState
} from "../lib/api";

type EditorState =
  | { mode: "create" }
  | { milestone: Milestone; mode: "edit" }
  | { mode: "recommendation"; recommendation: MilestoneRecommendation }
  | null;

const emptyForm: MilestoneInput = {
  actualEndDate: null,
  actualStartDate: null,
  description: null,
  plannedEndDate: null,
  plannedStartDate: null,
  priority: "MEDIUM",
  status: "PLANNED",
  title: ""
};

export function MilestoneSection({
  projectId,
  projectState
}: Readonly<{ projectId: string; projectState: ProjectState | undefined }>) {
  const queryClient = useQueryClient();
  const [editor, setEditor] = React.useState<EditorState>(null);
  const milestonesQuery = useQuery({
    queryFn: () => api.listProjectMilestones(projectId),
    queryKey: ["project-milestones", projectId],
    retry: false
  });
  const recommendationsQuery = useQuery({
    queryFn: () => api.listMilestoneRecommendations(projectId),
    queryKey: ["milestone-recommendations", projectId],
    retry: false
  });

  const refresh = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["project-milestones", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["milestone-recommendations", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["project-state", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["operations-dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["recommendations"] })
    ]);
  }, [projectId, queryClient]);
  const approveMutation = useMutation({
    mutationFn: (recommendationId: string) => api.approveMilestoneRecommendation(recommendationId),
    onSuccess: refresh
  });
  const dismissMutation = useMutation({
    mutationFn: (recommendationId: string) => api.dismissRecommendation(recommendationId),
    onSuccess: refresh
  });

  const milestones = milestonesQuery.data?.milestones ?? [];
  const recommendations = recommendationsQuery.data?.recommendations ?? [];
  const summary = {
    completed: milestones.filter((item) => item.status === "COMPLETED").length,
    delayed: milestones.filter((item) => item.status === "DELAYED").length,
    inProgress: milestones.filter((item) => item.status === "IN_PROGRESS").length,
    upcoming: milestones.filter((item) => item.status === "PLANNED").length
  };

  return (
    <section className="scroll-mt-24 space-y-5 border-y border-slate-200 py-6" id="milestones">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Flag aria-hidden="true" className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-950">Milestones</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Planned work, field-confirmed progress, and updates awaiting approval.
          </p>
        </div>
        <Button onClick={() => setEditor({ mode: "create" })} type="button" variant="secondary">
          <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
          New milestone
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200 lg:grid-cols-4">
        <SummaryCell icon={CheckCircle2} label="Completed" value={summary.completed} />
        <SummaryCell icon={Clock3} label="In Progress" value={summary.inProgress} />
        <SummaryCell icon={CalendarDays} label="Upcoming" value={summary.upcoming} />
        <SummaryCell icon={AlertTriangle} label="Delayed" value={summary.delayed} warning />
      </div>

      {projectState?.nextMilestone ? (
        <div className="flex flex-wrap items-center gap-2 border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm">
          <span className="font-semibold text-emerald-950">Next milestone</span>
          <span className="text-emerald-900">{projectState.nextMilestone}</span>
          {projectState.nextMilestoneDate ? (
            <span className="text-emerald-700">{formatDate(projectState.nextMilestoneDate)}</span>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden="true" className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-slate-950">AI Milestone Recommendations</h3>
          {recommendations.length > 0 ? (
            <Badge variant="warning">{recommendations.length}</Badge>
          ) : null}
        </div>
        {recommendationsQuery.isLoading ? (
          <p className="text-sm text-slate-600">Reviewing milestone evidence...</p>
        ) : recommendations.length === 0 ? (
          <p className="text-sm text-slate-600">No milestone updates awaiting approval.</p>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {recommendations.map((recommendation) => (
              <RecommendationCard
                disabled={approveMutation.isPending || dismissMutation.isPending}
                key={recommendation.id}
                onApprove={() => approveMutation.mutate(recommendation.id)}
                onDismiss={() => dismissMutation.mutate(recommendation.id)}
                onReview={() => setEditor({ mode: "recommendation", recommendation })}
                recommendation={recommendation}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-950">Milestone Timeline</h3>
        {milestonesQuery.isLoading ? (
          <div className="space-y-2" aria-label="Loading milestones">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : milestones.length === 0 ? (
          <div className="border border-dashed border-slate-300 px-5 py-8 text-center">
            <Flag aria-hidden="true" className="mx-auto h-6 w-6 text-slate-400" />
            <p className="mt-2 text-sm font-medium text-slate-800">No milestones yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Add one manually or approve a suggestion from field evidence.
            </p>
          </div>
        ) : (
          <div className="relative space-y-0 border-l-2 border-slate-200 pl-5">
            {milestones.map((milestone) => (
              <MilestoneRow
                key={milestone.id}
                milestone={milestone}
                onEdit={() => setEditor({ milestone, mode: "edit" })}
              />
            ))}
          </div>
        )}
      </div>

      {editor ? (
        <MilestoneEditor
          editor={editor}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null);
            await refresh();
          }}
          projectId={projectId}
        />
      ) : null}
    </section>
  );
}

function SummaryCell({
  icon: Icon,
  label,
  value,
  warning = false
}: Readonly<{
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: number;
  warning?: boolean;
}>) {
  return (
    <div className="flex min-h-24 items-center gap-3 bg-white p-4">
      <Icon className={warning ? "h-5 w-5 text-amber-600" : "h-5 w-5 text-slate-500"} />
      <div>
        <div className="text-2xl font-semibold text-slate-950">{value}</div>
        <div className="text-xs font-medium text-slate-500">{label}</div>
      </div>
    </div>
  );
}

function RecommendationCard({
  disabled,
  onApprove,
  onDismiss,
  onReview,
  recommendation
}: Readonly<{
  disabled: boolean;
  onApprove: () => void;
  onDismiss: () => void;
  onReview: () => void;
  recommendation: MilestoneRecommendation;
}>) {
  const payload = readPayload(recommendation.proposedActionPayload);
  const resolvedDate = firstDate(payload);
  return (
    <article className="rounded-md border border-emerald-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="muted">Milestone Update Suggested</Badge>
        <Badge variant={recommendation.confidence === "LOW" ? "warning" : "muted"}>
          {confidenceLabel(recommendation.confidence)}
        </Badge>
      </div>
      <h4 className="mt-3 font-semibold text-slate-950">
        {payload.milestoneTitle ?? recommendation.title}
      </h4>
      <p className="mt-1 text-sm text-slate-700">{proposedChangeText(recommendation, payload)}</p>
      {payload.originalDatePhrase || resolvedDate ? (
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <div className="bg-slate-50 p-2 text-slate-600">
            Original:{" "}
            {payload.originalDatePhrase ? `"${payload.originalDatePhrase}"` : "Not stated"}
          </div>
          <div className="bg-slate-50 p-2 text-slate-600">
            Resolved: {resolvedDate ? formatDate(resolvedDate) : "Needs review"}
          </div>
        </div>
      ) : null}
      {recommendation.evidence?.messageBody ? (
        <blockquote className="mt-3 border-l-2 border-slate-300 pl-3 text-sm italic text-slate-600">
          "{recommendation.evidence.messageBody}"
        </blockquote>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button className="h-9 px-3 text-xs" onClick={onReview} type="button" variant="secondary">
          Review evidence
        </Button>
        <Button className="h-9 px-3 text-xs" disabled={disabled} onClick={onApprove} type="button">
          Approve
        </Button>
        <Button
          className="h-9 px-3 text-xs"
          disabled={disabled}
          onClick={onDismiss}
          type="button"
          variant="ghost"
        >
          Dismiss
        </Button>
      </div>
    </article>
  );
}

function MilestoneRow({ milestone, onEdit }: { milestone: Milestone; onEdit: () => void }) {
  const date =
    milestone.actualEndDate ??
    milestone.actualStartDate ??
    milestone.plannedStartDate ??
    milestone.plannedEndDate;
  return (
    <div className="relative border-b border-slate-100 py-4 last:border-b-0">
      <span className="absolute -left-[27px] top-6 h-3 w-3 rounded-full border-2 border-white bg-slate-500" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-950">{milestone.title}</span>
            <MilestoneStatusBadge status={milestone.status} />
            <Badge variant="muted">{formatStatus(milestone.source)}</Badge>
          </div>
          {milestone.description ? (
            <p className="mt-1 text-sm text-slate-600">{milestone.description}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{date ? formatDate(date) : "Date not set"}</span>
            <span>{formatStatus(milestone.priority)} priority</span>
            {milestone.sourceMessageId ? <span>Evidence linked</span> : null}
          </div>
        </div>
        <button
          aria-label={`Edit ${milestone.title}`}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-950"
          onClick={onEdit}
          title="Edit milestone"
          type="button"
        >
          <Pencil aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function MilestoneEditor({
  editor,
  onClose,
  onSaved,
  projectId
}: Readonly<{
  editor: Exclude<EditorState, null>;
  onClose: () => void;
  onSaved: () => Promise<void>;
  projectId: string;
}>) {
  const recommendation = editor.mode === "recommendation" ? editor.recommendation : null;
  const payload = readPayload(recommendation?.proposedActionPayload);
  const initial =
    editor.mode === "edit"
      ? milestoneToForm(editor.milestone)
      : editor.mode === "recommendation"
        ? payloadToForm(payload)
        : emptyForm;
  const [form, setForm] = React.useState<MilestoneInput>(initial);
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editor.mode === "create") return api.createMilestone(projectId, form);
      if (editor.mode === "edit") return api.updateMilestone(editor.milestone.id, form);
      return api.editAndApproveMilestoneRecommendation(editor.recommendation.id, form);
    },
    onSuccess: onSaved
  });
  const deleteMutation = useMutation({
    mutationFn: () =>
      editor.mode === "edit"
        ? api.deleteMilestone(editor.milestone.id)
        : Promise.resolve({ ok: true as const }),
    onSuccess: onSaved
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30" role="presentation">
      <aside
        aria-label="Milestone review"
        className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-emerald-700">
              {editor.mode === "recommendation"
                ? "Review AI suggestion"
                : editor.mode === "edit"
                  ? "Edit milestone"
                  : "New milestone"}
            </p>
            <h3 className="mt-1 text-xl font-semibold text-slate-950">
              {form.title || "Milestone details"}
            </h3>
          </div>
          <button
            aria-label="Close milestone review"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        {recommendation?.evidence ? (
          <div className="mt-6 space-y-3 border-y border-slate-200 py-5">
            <div className="text-sm font-semibold text-slate-950">Source evidence</div>
            <blockquote className="border-l-2 border-emerald-500 pl-3 text-sm text-slate-700">
              {recommendation.evidence.messageBody ??
                recommendation.evidence.voiceTranscript ??
                "Evidence attached"}
            </blockquote>
            <div className="text-xs text-slate-500">
              {recommendation.evidence.sender} -{" "}
              {formatDateTime(recommendation.evidence.occurredAt)}
            </div>
            {recommendation.evidence.voiceTranscript ? (
              <div className="bg-slate-50 p-3 text-sm text-slate-700">
                <div className="mb-1 text-xs font-semibold text-slate-500">Voice transcript</div>
                {recommendation.evidence.voiceTranscript}
              </div>
            ) : null}
            {recommendation.evidence.timelineEvent ? (
              <div className="bg-slate-50 p-3 text-sm text-slate-700">
                <div className="mb-1 text-xs font-semibold text-slate-500">
                  Related timeline event
                </div>
                <div className="font-medium text-slate-900">
                  {recommendation.evidence.timelineEvent.title}
                </div>
                {recommendation.evidence.timelineEvent.description ? (
                  <p className="mt-1">{recommendation.evidence.timelineEvent.description}</p>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Link
                className="text-xs font-medium text-slate-700 underline"
                href={`/inbox/${recommendation.evidence.conversationId}`}
              >
                Open original message
              </Link>
              {recommendation.evidence.attachments.map((attachment) => (
                <span className="text-xs text-slate-500" key={attachment.id}>
                  {attachment.filename}
                </span>
              ))}
            </div>
            <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-950">
              <div className="text-xs font-semibold text-emerald-700">
                Why FieldOS suggested this
              </div>
              <p className="mt-1">{recommendation.reason}</p>
              <p className="mt-2 text-xs text-emerald-800">
                {confidenceLabel(recommendation.confidence)}
              </p>
            </div>
          </div>
        ) : null}

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
        >
          <Field label="Title">
            <input
              className={inputClass}
              maxLength={160}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              required
              value={form.title}
            />
          </Field>
          <Field label="Description">
            <textarea
              className={`${inputClass} min-h-24 py-2`}
              onChange={(event) => setForm({ ...form, description: event.target.value || null })}
              value={form.description ?? ""}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status">
              <select
                className={inputClass}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value as MilestoneStatus })
                }
                value={form.status}
              >
                {(["PLANNED", "IN_PROGRESS", "COMPLETED", "DELAYED", "CANCELLED"] as const).map(
                  (status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  )
                )}
              </select>
            </Field>
            <Field label="Priority">
              <select
                className={inputClass}
                onChange={(event) =>
                  setForm({ ...form, priority: event.target.value as MilestonePriority })
                }
                value={form.priority}
              >
                {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((priority) => (
                  <option key={priority} value={priority}>
                    {formatStatus(priority)}
                  </option>
                ))}
              </select>
            </Field>
            <DateField
              label="Planned start"
              onChange={(value) => setForm({ ...form, plannedStartDate: value })}
              value={form.plannedStartDate}
            />
            <DateField
              label="Planned end"
              onChange={(value) => setForm({ ...form, plannedEndDate: value })}
              value={form.plannedEndDate}
            />
            <DateField
              label="Actual start"
              onChange={(value) => setForm({ ...form, actualStartDate: value })}
              value={form.actualStartDate}
            />
            <DateField
              label="Actual end"
              onChange={(value) => setForm({ ...form, actualEndDate: value })}
              value={form.actualEndDate}
            />
          </div>
          {recommendation && (payload.originalDatePhrase || firstDate(payload)) ? (
            <div className="grid gap-2 rounded-md border border-slate-200 p-3 text-xs sm:grid-cols-2">
              <div>
                <span className="font-semibold text-slate-700">Original phrase</span>
                <div className="mt-1 text-slate-600">
                  {payload.originalDatePhrase ?? "Not stated"}
                </div>
              </div>
              <div>
                <span className="font-semibold text-slate-700">Resolved date</span>
                <div className="mt-1 text-slate-600">
                  {firstDate(payload) ? formatDate(firstDate(payload)!) : "Needs review"}
                </div>
              </div>
            </div>
          ) : null}
          {saveMutation.isError || deleteMutation.isError ? (
            <p className="text-sm text-red-700">
              {((saveMutation.error ?? deleteMutation.error) as Error).message}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
            {editor.mode === "edit" ? (
              <Button
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (window.confirm("Delete this milestone?")) deleteMutation.mutate();
                }}
                type="button"
                variant="ghost"
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button onClick={onClose} type="button" variant="secondary">
                Cancel
              </Button>
              <Button disabled={!form.title.trim() || saveMutation.isPending} type="submit">
                {saveMutation.isPending
                  ? "Saving..."
                  : editor.mode === "recommendation"
                    ? "Edit & Approve"
                    : "Save milestone"}
              </Button>
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
}

function Field({ children, label }: Readonly<{ children: React.ReactNode; label: string }>) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function DateField({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (value: string | null) => void;
  value?: string | null;
}) {
  return (
    <Field label={label}>
      <input
        className={inputClass}
        onChange={(event) => onChange(event.target.value || null)}
        type="date"
        value={dateInput(value)}
      />
    </Field>
  );
}

const inputClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950";

function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  return (
    <Badge
      variant={status === "DELAYED" ? "warning" : status === "COMPLETED" ? "success" : "muted"}
    >
      {formatStatus(status)}
    </Badge>
  );
}

function readPayload(value: unknown): Record<string, string | null> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, typeof item === "string" ? item : null])
  );
}

function payloadToForm(payload: Record<string, string | null>): MilestoneInput {
  return {
    actualEndDate: payload.actualEndDate,
    actualStartDate: payload.actualStartDate,
    description: payload.description,
    plannedEndDate: payload.plannedEndDate,
    plannedStartDate: payload.plannedStartDate,
    priority: "MEDIUM",
    status: (payload.proposedStatus as MilestoneStatus | null) ?? "PLANNED",
    title: payload.milestoneTitle ?? ""
  };
}

function milestoneToForm(milestone: Milestone): MilestoneInput {
  return {
    actualEndDate: dateInput(milestone.actualEndDate) || null,
    actualStartDate: dateInput(milestone.actualStartDate) || null,
    description: milestone.description,
    plannedEndDate: dateInput(milestone.plannedEndDate) || null,
    plannedStartDate: dateInput(milestone.plannedStartDate) || null,
    priority: milestone.priority,
    status: milestone.status,
    title: milestone.title
  };
}

function firstDate(payload: Record<string, string | null>): string | null {
  return (
    payload.actualEndDate ??
    payload.actualStartDate ??
    payload.plannedStartDate ??
    payload.plannedEndDate ??
    null
  );
}

function proposedChangeText(
  recommendation: MilestoneRecommendation,
  payload: Record<string, string | null>
): string {
  const date = firstDate(payload);
  const status = payload.proposedStatus
    ? formatStatus(payload.proposedStatus)
    : formatStatus(recommendation.proposedActionType);
  return `${status}${date ? ` on ${formatDate(date)}` : ""}`;
}

function confidenceLabel(value: string): string {
  return value === "HIGH"
    ? "High Confidence"
    : value === "MEDIUM"
      ? "Needs Review"
      : "Low Confidence";
}

function dateInput(value: string | null | undefined): string {
  return value?.slice(0, 10) ?? "";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric"
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}

function formatStatus(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
