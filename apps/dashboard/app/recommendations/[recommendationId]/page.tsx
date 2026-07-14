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
import { Check, Clock3, MessageSquareText, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { AppShell } from "../../../components/app-shell";
import { AuthGuard } from "../../../components/auth-guard";
import { api } from "../../../lib/api";

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
  const [draftBody, setDraftBody] = React.useState("");
  const draft = recommendation?.whatsAppDrafts?.[0] ?? null;
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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
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
