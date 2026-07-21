import type { PrismaClient, UnifiedEvidenceContext } from "@fieldos/db";

import type { ClassifyMessageV2Input } from "./types.js";

const precedingMessageLimit = 4;
const subsequentMessageLimit = 4;

export async function buildClassificationDecisionContext(
  prisma: PrismaClient,
  input: UnifiedEvidenceContext
): Promise<ClassifyMessageV2Input> {
  const projectId = input.project?.id;
  const timezone = input.project?.timezone ?? "UTC";
  const photoEvidenceIds = input.attachedPhotos.map((attachment) => attachment.id);
  const [
    activeMilestones,
    openActionItems,
    projectState,
    precedingMessages,
    subsequentMessages,
    recentTimelineEvents,
    unresolvedExpectations,
    photoAnalyses
  ] = await Promise.all([
    projectId
      ? prisma.milestone.findMany({
          orderBy: { updatedAt: "desc" },
          select: { id: true, plannedEndDate: true, status: true, title: true },
          take: 10,
          where: { projectId, status: { in: ["PLANNED", "IN_PROGRESS", "DELAYED"] } }
        })
      : [],
    projectId
      ? prisma.actionItem.findMany({
          orderBy: { updatedAt: "desc" },
          select: { id: true, status: true, title: true },
          take: 10,
          where: { projectId, status: { in: ["PENDING", "ACCEPTED"] } }
        })
      : [],
    projectId
      ? prisma.projectState.findUnique({
          select: {
            health: true,
            nextMilestone: true,
            pendingDecisionSummary: true,
            recentBlockerSummary: true,
            recentProgressSummary: true
          },
          where: { projectId }
        })
      : null,
    prisma.message.findMany({
      orderBy: { occurredAt: "desc" },
      select: {
        body: true,
        direction: true,
        id: true,
        occurredAt: true,
        senderParticipant: { select: { displayName: true } }
      },
      take: precedingMessageLimit,
      where: {
        conversationId: input.conversation.id,
        id: { not: input.messageId },
        occurredAt: { lt: input.timestamp }
      }
    }),
    prisma.message.findMany({
      orderBy: { occurredAt: "asc" },
      select: {
        body: true,
        direction: true,
        id: true,
        occurredAt: true,
        senderParticipant: { select: { displayName: true } }
      },
      take: subsequentMessageLimit,
      where: {
        conversationId: input.conversation.id,
        occurredAt: { gt: input.timestamp }
      }
    }),
    projectId
      ? prisma.event.findMany({
          orderBy: { occurredAt: "desc" },
          select: { description: true, eventType: true, id: true, occurredAt: true, title: true },
          take: 10,
          where: { projectId }
        })
      : [],
    projectId
      ? prisma.outstandingExpectation.findMany({
          orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
          select: {
            dueAt: true,
            expectedResponder: true,
            id: true,
            requestedItem: true,
            sourceMessageId: true,
            type: true
          },
          take: 10,
          where: {
            conversationId: input.conversation.id,
            projectId,
            status: "OPEN"
          }
        })
      : [],
    photoEvidenceIds.length > 0
      ? prisma.photoAnalysis.findMany({
          orderBy: { createdAt: "desc" },
          select: {
            analysisStatus: true,
            claimSupport: true,
            evidenceId: true,
            limitations: true,
            operationalConclusion: true,
            summary: true
          },
          take: 4,
          where: { evidenceId: { in: photoEvidenceIds } }
        })
      : []
  ]);

  const recentMessages = [
    ...precedingMessages.reverse().map((message) => ({
      body: message.body,
      direction: message.direction,
      id: message.id,
      occurredAt: message.occurredAt,
      relation: "PRECEDING" as const,
      senderName: normalizedSenderName(message.senderParticipant.displayName)
    })),
    ...subsequentMessages.map((message) => ({
      body: message.body,
      direction: message.direction,
      id: message.id,
      occurredAt: message.occurredAt,
      relation: "SUBSEQUENT" as const,
      senderName: normalizedSenderName(message.senderParticipant.displayName)
    }))
  ];

  return {
    ...input,
    activeMilestones: activeMilestones.map((milestone) => ({
      ...milestone,
      plannedEndDate: milestone.plannedEndDate?.toISOString() ?? null
    })),
    openActionItems,
    operatingContext: buildOperatingContext(input.timestamp, timezone),
    photoAnalyses: photoAnalyses.map((analysis) => ({
      ...analysis,
      limitations: jsonStringArray(analysis.limitations)
    })),
    projectState,
    recentMessages,
    recentTimelineEvents: recentTimelineEvents.reverse(),
    replyContext: null,
    unresolvedExpectations
  };
}

function buildOperatingContext(timestamp: Date, timezone: string) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" }).format(
    timestamp
  ) as "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  return {
    isWeekend: weekday === "Saturday" || weekday === "Sunday",
    localDateTime: new Intl.DateTimeFormat("en-CA", {
      dateStyle: "short",
      hour12: false,
      timeStyle: "medium",
      timeZone: timezone
    }).format(timestamp),
    timezone,
    weekday
  };
}

function normalizedSenderName(value: string): string {
  return value.trim() || "Unknown sender";
}

function jsonStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
