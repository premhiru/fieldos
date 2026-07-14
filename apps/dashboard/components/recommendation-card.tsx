"use client";

import { Badge, Button } from "@fieldos/ui";
import { Check, Clock3, Edit3, MessageSquareText, X } from "lucide-react";
import Link from "next/link";

import type { Recommendation } from "../lib/api";

interface RecommendationCardProps {
  busy?: boolean;
  onApprove: () => void;
  onDismiss: () => void;
  onSnooze: () => void;
  recommendation: Recommendation;
}

export function RecommendationCard({
  busy = false,
  onApprove,
  onDismiss,
  onSnooze,
  recommendation
}: RecommendationCardProps) {
  const draft = recommendation.whatsAppDrafts?.[0];

  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className={priorityBar(recommendation.priority)} />
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={recommendation.priority === "URGENT" ? "warning" : "muted"}>
            {formatLabel(recommendation.priority)}
          </Badge>
          <span className="text-xs font-medium text-slate-500">{recommendation.project.name}</span>
          <Confidence confidence={recommendation.confidence} />
        </div>

        <h3 className="mt-4 text-base font-semibold text-slate-950">{recommendation.title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-700">{recommendation.description}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Why this matters</div>
            <p className="mt-1 text-sm leading-5 text-slate-700">{recommendation.reason}</p>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">On approval</div>
            <p className="mt-1 text-sm leading-5 text-slate-700">
              {approvalOutcome(recommendation.proposedActionType)}
            </p>
          </div>
        </div>

        {recommendation.sourceEntityType ? (
          <div className="mt-3 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-600">
            Evidence: {formatLabel(recommendation.sourceEntityType)}
          </div>
        ) : null}

        {draft ? (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
              <MessageSquareText aria-hidden="true" className="size-4" />
              WhatsApp draft
            </div>
            <p className="mt-2 line-clamp-3 text-sm text-emerald-950">{draft.messageBody}</p>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <Button className="h-9" disabled={busy} onClick={onApprove} type="button">
            <Check aria-hidden="true" className="size-4" />
            Approve
          </Button>
          <Link
            className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-100 px-3 text-sm font-medium text-slate-950 hover:bg-slate-200"
            href={`/recommendations/${recommendation.id}`}
          >
            <Edit3 aria-hidden="true" className="size-4" />
            Edit
          </Link>
          <Button className="h-9 px-3" disabled={busy} onClick={onSnooze} variant="ghost">
            <Clock3 aria-hidden="true" className="size-4" />
            Snooze 24h
          </Button>
          <Button className="h-9 px-3" disabled={busy} onClick={onDismiss} variant="ghost">
            <X aria-hidden="true" className="size-4" />
            Dismiss
          </Button>
        </div>
      </div>
    </article>
  );
}

function Confidence({ confidence }: { confidence: Recommendation["confidence"] }) {
  const active = confidence === "HIGH" ? 3 : confidence === "MEDIUM" ? 2 : 1;

  return (
    <span className="ml-auto inline-flex items-center gap-2 text-xs font-medium text-slate-600">
      <span className="inline-flex gap-1" aria-hidden="true">
        {[1, 2, 3].map((level) => (
          <span
            className={
              level <= active
                ? confidence === "LOW"
                  ? "h-2 w-4 rounded-sm bg-red-500"
                  : confidence === "MEDIUM"
                    ? "h-2 w-4 rounded-sm bg-amber-500"
                    : "h-2 w-4 rounded-sm bg-emerald-500"
                : "h-2 w-4 rounded-sm bg-slate-200"
            }
            key={level}
          />
        ))}
      </span>
      {confidence === "HIGH"
        ? "High confidence"
        : confidence === "MEDIUM"
          ? "Needs review"
          : "Low confidence"}
    </span>
  );
}

function priorityBar(priority: Recommendation["priority"]) {
  if (priority === "URGENT") return "h-1 bg-red-500";
  if (priority === "HIGH") return "h-1 bg-amber-500";
  if (priority === "MEDIUM") return "h-1 bg-blue-500";
  return "h-1 bg-slate-300";
}

function approvalOutcome(action: Recommendation["proposedActionType"]) {
  const outcomes: Partial<Record<Recommendation["proposedActionType"], string>> = {
    CREATE_ACTION_ITEM: "Creates an Action Item for the project team.",
    CREATE_MILESTONE: "Adds the proposed milestone to the project plan.",
    UPDATE_MILESTONE: "Updates the matching project milestone.",
    COMPLETE_MILESTONE: "Marks the matching milestone as completed.",
    START_MILESTONE: "Marks the matching milestone as in progress.",
    SEND_WHATSAPP_MESSAGE_DRAFT: "Approves the draft for review and sending.",
    GENERATE_REPORT: "Queues a grounded project report.",
    REVIEW_EVIDENCE: "Records the evidence review for follow-up."
  };
  return outcomes[action] ?? formatLabel(action);
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
