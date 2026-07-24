"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Skeleton
} from "@fieldos/ui";
import { Check, ChevronDown, Clock3, MessageSquareText, RotateCcw, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { AppShell } from "../../../components/app-shell";
import { AuthGuard } from "../../../components/auth-guard";
import {
  api,
  type AIMessageClassification,
  type EvidenceView,
  type PhotoAnalysis,
  type Recommendation,
  type UnifiedEvidenceContext
} from "../../../lib/api";

type SourceEvidence =
  | { context: UnifiedEvidenceContext; type: "MESSAGE" }
  | { analysis: PhotoAnalysis; evidence: EvidenceView; type: "PHOTO_ANALYSIS" }
  | { classification: AIMessageClassification; type: "AI_CLASSIFICATION" };

export default function RecommendationDetailPage() {
  return (
    <AuthGuard>
      <AppShell>
        <RecommendationDetailContent />
      </AppShell>
    </AuthGuard>
  );
}

function RecommendationDetailContent() {
  const params = useParams<{ recommendationId: string }>();
  const queryClient = useQueryClient();
  const recommendationQuery = useQuery({
    queryFn: () => api.getRecommendation(params.recommendationId),
    queryKey: ["recommendation", params.recommendationId],
    retry: false
  });
  const recommendation = recommendationQuery.data?.recommendation;
  const deliveriesQuery = useQuery({
    queryFn: () => api.listRecommendationDeliveries(params.recommendationId),
    queryKey: ["recommendation-deliveries", params.recommendationId],
    refetchInterval: 30_000,
    retry: false
  });
  const retryDeliveryMutation = useMutation({
    mutationFn: (deliveryId: string) =>
      api.retryRecommendationDelivery(deliveryId, recommendation?.organizationId ?? ""),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["recommendation-deliveries", params.recommendationId]
      })
  });
  const [draftBody, setDraftBody] = React.useState("");
  const draft = recommendation?.whatsAppDrafts?.[0] ?? null;
  const sourceEvidenceQuery = useQuery({
    enabled: Boolean(recommendation?.sourceEntityId),
    queryFn: () => loadSourceEvidence(recommendation as Recommendation),
    queryKey: [
      "recommendation-source-evidence",
      recommendation?.sourceEntityType,
      recommendation?.sourceEntityId
    ],
    retry: false
  });
  const approveMutation = useMutation({
    mutationFn: () => api.approveRecommendation(params.recommendationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["recommendation", params.recommendationId]
      });
    }
  });
  const dismissMutation = useMutation({
    mutationFn: () => api.dismissRecommendation(params.recommendationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["recommendation", params.recommendationId]
      });
    }
  });
  const updateDraftMutation = useMutation({
    mutationFn: () => api.updateWhatsAppDraft(draft?.id ?? "", { messageBody: draftBody }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["recommendation", params.recommendationId]
      });
    }
  });
  const sendDraftMutation = useMutation({
    mutationFn: () => api.sendWhatsAppDraft(draft?.id ?? ""),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["recommendation", params.recommendationId]
      });
    }
  });

  React.useEffect(() => {
    if (draft) {
      setDraftBody(draft.messageBody);
    }
  }, [draft]);

  if (recommendationQuery.isLoading) return <Skeleton className="h-[620px]" />;

  if (recommendationQuery.isError || !recommendation) {
    return <p className="text-sm text-red-600">Recommendation not found.</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <Link className="text-sm font-medium text-slate-600 hover:text-slate-950" href="/">
        Back to recommendations
      </Link>
      <PageHeader
        description={recommendation.project.name}
        eyebrow="Recommendation"
        title={recommendation.title}
      />
      <div className="flex flex-wrap gap-2">
        <Badge variant={recommendation.priority === "URGENT" ? "warning" : "muted"}>
          {formatStatus(recommendation.priority)}
        </Badge>
        <Badge
          variant={
            recommendation.confidence === "HIGH"
              ? "success"
              : recommendation.confidence === "LOW"
                ? "warning"
                : "muted"
          }
        >
          {formatConfidence(recommendation.confidence)}
        </Badge>
        <Badge variant={recommendation.status === "PENDING" ? "warning" : "muted"}>
          {formatStatus(recommendation.status)}
        </Badge>
      </div>

      <section
        className="border-y border-[var(--border-subtle)] py-4"
        aria-labelledby="whatsapp-delivery-heading"
      >
        <div className="flex items-center gap-2">
          <MessageSquareText className="size-4 text-[var(--text-secondary)]" />
          <h2 className="font-semibold text-[var(--text-primary)]" id="whatsapp-delivery-heading">
            WhatsApp delivery
          </h2>
        </div>
        {deliveriesQuery.isLoading ? (
          <Skeleton className="mt-3 h-12" />
        ) : (deliveriesQuery.data?.deliveries?.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            This recommendation has not been sent through WhatsApp.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {deliveriesQuery.data?.deliveries?.map((delivery) => (
              <div
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
                key={delivery.id}
              >
                <span className="text-[var(--text-primary)]">
                  {delivery.recipientPerson?.displayName ?? "Configured project group"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-secondary)]">
                    {formatStatus(delivery.deliveryStatus)}
                    {delivery.deliveredAt
                      ? ` · ${new Date(delivery.deliveredAt).toLocaleString()}`
                      : ""}
                    {delivery.respondedAt
                      ? ` · Responded ${new Date(delivery.respondedAt).toLocaleString()}`
                      : ""}
                  </span>
                  {delivery.deliveryStatus === "FAILED" ? (
                    <Button
                      disabled={retryDeliveryMutation.isPending}
                      onClick={() => retryDeliveryMutation.mutate(delivery.id)}
                      variant="ghost"
                    >
                      <RotateCcw className="size-4" /> Retry
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>What happened</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <p className="leading-6 text-slate-700">{recommendation.description}</p>
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    Why you are seeing this
                  </div>
                  <p className="mt-2 leading-6 text-slate-700">{recommendation.reason}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    Supporting evidence
                  </div>
                  <p className="mt-2 text-slate-700">
                    {recommendation.sourceEntityType ?? "Project state"}{" "}
                    {recommendation.sourceEntityId ? `· ${recommendation.sourceEntityId}` : ""}
                  </p>
                </div>
                <div className="rounded-md border border-blue-100 bg-blue-50 p-4">
                  <div className="text-xs font-semibold uppercase text-blue-700">
                    What approval will do
                  </div>
                  <p className="mt-2 font-medium text-slate-950">
                    {formatStatus(recommendation.proposedActionType)}
                  </p>
                  <div className="mt-2 space-y-1 text-sm text-slate-700">
                    {formatPayload(recommendation.proposedActionPayload)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <SourceEvidenceSection
            evidence={sourceEvidenceQuery.data ?? null}
            loading={sourceEvidenceQuery.isLoading}
            status={recommendation.status}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Decision</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendation.status === "PENDING" ? (
                <div className="flex flex-col gap-2">
                  <Button
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate()}
                    type="button"
                  >
                    <Check aria-hidden="true" className="size-4" />
                    Approve
                  </Button>
                  <Button onClick={() => window.history.back()} type="button" variant="secondary">
                    <Clock3 aria-hidden="true" className="size-4" />
                    Snooze 24h
                  </Button>
                  <Button
                    disabled={dismissMutation.isPending}
                    onClick={() => dismissMutation.mutate()}
                    type="button"
                    variant="ghost"
                  >
                    <X aria-hidden="true" className="size-4" />
                    Dismiss
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  This recommendation is {formatStatus(recommendation.status).toLowerCase()}.
                </p>
              )}
              <Link
                className="inline-flex text-sm font-medium text-slate-600 hover:text-slate-950"
                href={`/projects/${recommendation.projectId}`}
              >
                Open {recommendation.project.name}
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {draft ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <MessageSquareText aria-hidden="true" className="size-4" />
                WhatsApp draft preview
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <textarea
                className="min-h-32 w-full rounded-md border border-slate-300 p-3 text-sm outline-none focus:border-slate-950"
                onChange={(event) => setDraftBody(event.target.value)}
                value={draftBody}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!draftBody.trim() || updateDraftMutation.isPending}
                  onClick={() => updateDraftMutation.mutate()}
                  type="button"
                  variant="secondary"
                >
                  Save Draft
                </Button>
                <Button
                  disabled={sendDraftMutation.isPending || draft.status === "SENT"}
                  onClick={() => {
                    const confirmed = window.confirm(
                      "Send this WhatsApp draft to the active project conversation?"
                    );

                    if (confirmed) {
                      sendDraftMutation.mutate();
                    }
                  }}
                  type="button"
                >
                  {draft.status === "APPROVED" ? "Send Again" : "Send"}
                </Button>
                <Badge variant={draft.status === "FAILED" ? "warning" : "muted"}>
                  {formatDraftStatus(draft.status)}
                </Badge>
              </div>
              {sendDraftMutation.data?.result.sent === false &&
              "queued" in sendDraftMutation.data.result ? (
                <p className="text-sm text-slate-600">
                  Draft approved and queued. The FieldOS worker will send it through the connected
                  WhatsApp line.
                </p>
              ) : null}
              {sendDraftMutation.data?.result.sent === false &&
              "error" in sendDraftMutation.data.result ? (
                <p className="text-sm text-red-600">{sendDraftMutation.data.result.error}</p>
              ) : null}
              {sendDraftMutation.data?.result.sent === true ? (
                <p className="text-sm text-emerald-700">Draft sent and recommendation completed.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function SourceEvidenceSection({
  evidence,
  loading,
  status
}: Readonly<{
  evidence: SourceEvidence | null;
  loading: boolean;
  status: Recommendation["status"] | undefined;
}>) {
  const [expanded, setExpanded] = React.useState(() => status === "PENDING");
  const initialStatusResolved = React.useRef(status !== undefined);
  const previousStatus = React.useRef(status);
  const userHasToggled = React.useRef(false);

  React.useEffect(() => {
    if (
      status !== undefined &&
      (!initialStatusResolved.current || previousStatus.current !== status)
    ) {
      initialStatusResolved.current = true;
      previousStatus.current = status;
      userHasToggled.current = false;
      setExpanded(status === "PENDING");
    }
  }, [status]);

  const toggle = () => {
    userHasToggled.current = true;
    setExpanded((current) => !current);
  };

  return (
    <Card>
      <CardHeader>
        <button
          aria-expanded={expanded}
          className="flex w-full items-center justify-between gap-3 text-left"
          onClick={toggle}
          type="button"
        >
          <CardTitle>Source Evidence</CardTitle>
          <ChevronDown
            aria-hidden="true"
            className={`size-4 shrink-0 text-[var(--text-secondary)] ${
              userHasToggled.current ? "transition-transform" : ""
            } ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </CardHeader>
      {expanded ? (
        <CardContent>
          {loading ? (
            <div aria-label="Loading source evidence" className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : evidence ? (
            <SourceEvidenceContent evidence={evidence} />
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">Source evidence unavailable</p>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}

function SourceEvidenceContent({ evidence }: Readonly<{ evidence: SourceEvidence }>) {
  if (evidence.type === "MESSAGE") {
    return (
      <blockquote className="border-l-4 border-[var(--border-strong)] bg-[var(--surface)] p-4 text-[var(--text-primary)]">
        <p className="whitespace-pre-wrap text-sm leading-6">
          {evidence.context.messageText || "Message content unavailable"}
        </p>
        <footer className="mt-3 text-xs text-[var(--text-secondary)]">
          {evidence.context.sender.displayName} in {evidence.context.conversation.title} ·{" "}
          {formatEvidenceTimestamp(evidence.context.timestamp)}
        </footer>
      </blockquote>
    );
  }

  if (evidence.type === "PHOTO_ANALYSIS") {
    return (
      <div className="space-y-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={evidence.evidence.filename}
          className="max-h-72 w-full rounded-md border border-[var(--border)] bg-[var(--canvas)] object-contain"
          src={evidence.evidence.signedUrl}
        />
        <p className="text-sm leading-6 text-[var(--text-primary)]">{evidence.analysis.summary}</p>
        <ConfidenceBadge confidence={evidence.analysis.confidence} />
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div>
        <span className="text-[var(--text-secondary)]">Category</span>
        <p className="mt-1 font-medium text-[var(--text-primary)]">
          {evidence.classification.category
            ? formatStatus(evidence.classification.category)
            : "Unclassified"}
        </p>
      </div>
      <div>
        <span className="text-[var(--text-secondary)]">Summary</span>
        <p className="mt-1 leading-6 text-[var(--text-primary)]">
          {evidence.classification.summary || "Summary unavailable"}
        </p>
      </div>
      <ConfidenceBadge confidence={evidence.classification.confidence} />
    </div>
  );
}

function ConfidenceBadge({ confidence }: Readonly<{ confidence: number | null }>) {
  const level = numericConfidenceLevel(confidence);
  const variant = level === "HIGH" ? "success" : level === "LOW" ? "warning" : "muted";

  return <Badge variant={variant}>{formatConfidence(level)}</Badge>;
}

function numericConfidenceLevel(confidence: number | null): Recommendation["confidence"] {
  if (confidence !== null && confidence >= 0.8) return "HIGH";
  if (confidence !== null && confidence >= 0.55) return "MEDIUM";
  return confidence === null ? "MEDIUM" : "LOW";
}

async function loadSourceEvidence(recommendation: Recommendation): Promise<SourceEvidence | null> {
  const sourceId = recommendation.sourceEntityId;
  if (!sourceId) return null;

  if (recommendation.sourceEntityType === "MESSAGE") {
    const response = await api.getMessageContext(sourceId);
    return response.context ? { context: response.context, type: "MESSAGE" } : null;
  }

  if (recommendation.sourceEntityType === "PHOTO_ANALYSIS") {
    const { analysis } = await api.getPhotoAnalysis(sourceId);
    const { evidence } = await api.getEvidenceView(analysis.evidenceId);
    return { analysis, evidence, type: "PHOTO_ANALYSIS" };
  }

  if (
    recommendation.sourceEntityType === "AI_CLASSIFICATION" ||
    recommendation.sourceEntityType === "CLASSIFICATION"
  ) {
    const { classifications } = await api.listProjectAIClassifications(recommendation.projectId);
    const classification = classifications.find((item) => item.id === sourceId);
    return classification ? { classification, type: "AI_CLASSIFICATION" } : null;
  }

  return null;
}

function formatEvidenceTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatStatus(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatConfidence(value: string): string {
  if (value === "HIGH") {
    return "High Confidence";
  }

  if (value === "MEDIUM") {
    return "Needs Review";
  }

  return "Low Confidence";
}

function formatDraftStatus(value: string): string {
  if (value === "APPROVED") {
    return "Queued For Send";
  }

  return formatStatus(value);
}

function formatPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return <p>No additional fields are required.</p>;
  }

  const entries = Object.entries(value).filter(([, item]) => item !== null && item !== "");
  if (entries.length === 0) return <p>No additional fields are required.</p>;

  return entries.map(([key, item]) => (
    <p key={key}>
      <span className="font-medium">{formatStatus(key)}:</span> {String(item)}
    </p>
  ));
}
