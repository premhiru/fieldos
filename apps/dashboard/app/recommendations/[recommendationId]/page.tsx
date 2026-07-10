"use client";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@fieldos/ui";
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

  if (recommendationQuery.isLoading) {
    return <p className="text-sm text-slate-600">Loading recommendation...</p>;
  }

  if (recommendationQuery.isError || !recommendation) {
    return <p className="text-sm text-red-600">Recommendation not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link className="text-sm font-medium text-slate-600 hover:text-slate-950" href="/">
          Back to Command Center
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">{recommendation.title}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="muted">{formatStatus(recommendation.priority)}</Badge>
          <Badge variant="muted">{formatConfidence(recommendation.confidence)}</Badge>
          <Badge variant="muted">{formatStatus(recommendation.sourceCoordinator)}</Badge>
          <Badge variant={recommendation.status === "PENDING" ? "warning" : "muted"}>
            {formatStatus(recommendation.status)}
          </Badge>
        </div>
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Recommendation Detail</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div>
                <div className="font-medium text-slate-950">Explanation</div>
                <p className="mt-1 text-slate-700">{recommendation.description}</p>
              </div>
              <div>
                <div className="font-medium text-slate-950">Reason</div>
                <p className="mt-1 text-slate-700">{recommendation.reason}</p>
              </div>
              <div>
                <div className="font-medium text-slate-950">Evidence Used</div>
                <p className="mt-1 text-slate-700">
                  {recommendation.sourceEntityType ?? "Project state"}{" "}
                  {recommendation.sourceEntityId ? `- ${recommendation.sourceEntityId}` : ""}
                </p>
              </div>
              <div>
                <div className="font-medium text-slate-950">Proposed Action</div>
                <p className="mt-1 text-slate-700">
                  {formatStatus(recommendation.proposedActionType)}
                </p>
                <pre className="mt-2 overflow-x-auto rounded-md bg-slate-950 p-3 text-xs text-white">
                  {JSON.stringify(recommendation.proposedActionPayload ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendation.status === "PENDING" ? (
                <div className="flex gap-2">
                  <Button
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate()}
                    type="button"
                  >
                    Approve
                  </Button>
                  <Button
                    disabled={dismissMutation.isPending}
                    onClick={() => dismissMutation.mutate()}
                    type="button"
                    variant="secondary"
                  >
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
            <CardTitle>WhatsApp Draft</CardTitle>
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
