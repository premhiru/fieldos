import {
  Prisma,
  type AIMessageClassification,
  type Milestone,
  type Project,
  type RecommendationActionType,
  type RecommendationType
} from "@fieldos/db";

import type {
  CoordinatorPrisma,
  MilestoneDetectionCandidate,
  MilestoneDetectorPort
} from "./types.js";

const datePhrasePattern =
  "today|tomorrow|yesterday|next week|next monday|next tuesday|next wednesday|next thursday|next friday|next saturday|next sunday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\\d{4}-\\d{2}-\\d{2}";

type ClassificationEvidence = AIMessageClassification & {
  message: {
    attachments: Array<{ transcript: string | null }>;
    body: string | null;
    occurredAt: Date;
    senderParticipant: { displayName: string };
  };
};

export class MilestoneCoordinator {
  constructor(
    private readonly prisma: CoordinatorPrisma,
    private readonly options: {
      detector?: MilestoneDetectorPort;
      evaluateCandidate?: (input: {
        action: RecommendationActionType;
        candidate: {
          confidence: "HIGH" | "MEDIUM" | "LOW";
          description: string;
          evidenceIds: string[];
          payload: Prisma.InputJsonValue;
          priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
          reason: string;
          scope: string;
          sourceEntityId: string;
          title: string;
          type: RecommendationType;
        };
        project: Project;
      }) => Promise<boolean>;
      now?: () => Date;
    } = {}
  ) {}

  async run(project: Project): Promise<number> {
    const [milestones, classifications, recentTimelineEvents, projectState] = await Promise.all([
      this.prisma.milestone.findMany({
        orderBy: [{ updatedAt: "desc" }],
        where: { projectId: project.id }
      }),
      this.prisma.aIMessageClassification.findMany({
        include: {
          message: {
            include: {
              attachments: { select: { transcript: true } },
              senderParticipant: { select: { displayName: true } }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 12,
        where: {
          projectId: project.id,
          status: "COMPLETED"
        }
      }),
      this.prisma.event.findMany({
        orderBy: { occurredAt: "desc" },
        select: { description: true, occurredAt: true, title: true },
        take: 10,
        where: { projectId: project.id }
      }),
      this.prisma.projectState.findUnique({
        select: {
          nextMilestone: true,
          pendingDecisionSummary: true,
          recentProgressSummary: true
        },
        where: { projectId: project.id }
      })
    ]);
    let created = 0;

    for (const classification of classifications as ClassificationEvidence[]) {
      created += await this.reviewEvidence(
        project,
        milestones,
        classification,
        recentTimelineEvents,
        projectState
      );
    }

    return created;
  }

  private async reviewEvidence(
    project: Project,
    milestones: Milestone[],
    classification: ClassificationEvidence,
    recentTimelineEvents: Array<{
      description: string | null;
      occurredAt: Date;
      title: string;
    }>,
    projectState: {
      nextMilestone: string | null;
      pendingDecisionSummary: string | null;
      recentProgressSummary: string | null;
    } | null
  ): Promise<number> {
    const transcript = classification.message.attachments
      .map((attachment) => attachment.transcript?.trim())
      .filter((value): value is string => Boolean(value))
      .join("\n");
    const evidenceText = [classification.message.body, transcript].filter(Boolean).join("\n");

    if (!evidenceText.trim()) {
      return 0;
    }

    const relativeDateHints = buildRelativeDateHints(
      evidenceText,
      classification.message.occurredAt,
      project.timezone
    );
    let changes = detectMilestoneChanges(
      evidenceText,
      classification.message.occurredAt,
      project.timezone
    );

    if (changes.length === 0 && this.options.detector) {
      changes = await this.options.detector.detectMilestones({
        existingMilestones: milestones.map((milestone) => ({
          id: milestone.id,
          plannedEndDate: toDateOnly(milestone.plannedEndDate),
          plannedStartDate: toDateOnly(milestone.plannedStartDate),
          status: milestone.status,
          title: milestone.title
        })),
        messageText: classification.message.body,
        occurredAt: classification.message.occurredAt,
        project: {
          id: project.id,
          name: project.name,
          timezone: project.timezone
        },
        projectState,
        recentTimelineEvents,
        relativeDateHints,
        sender: classification.message.senderParticipant.displayName.trim() || "Unknown sender",
        voiceTranscript: transcript || null
      });
    }

    let created = 0;
    for (const change of changes.slice(0, 5)) {
      if (
        !change.hasMilestoneChange ||
        change.action === "NONE" ||
        !change.milestoneTitle?.trim()
      ) {
        continue;
      }
      const wasCreated = await this.upsertRecommendation({
        change: { ...change, milestoneTitle: change.milestoneTitle },
        classification,
        evidenceText,
        milestones,
        project
      });
      if (wasCreated) created += 1;
    }
    return created;
  }

  private async upsertRecommendation(input: {
    change: MilestoneDetectionCandidate & { milestoneTitle: string };
    classification: ClassificationEvidence;
    evidenceText: string;
    milestones: Milestone[];
    project: Project;
  }): Promise<boolean> {
    const match = matchExistingMilestone(input.change.milestoneTitle, input.milestones);
    const action = resolveRecommendationAction(input.change, match);
    const type = resolveRecommendationType(input.change, match);
    const title = buildRecommendationTitle(action, input.change.milestoneTitle);
    const payload = {
      actualEndDate: input.change.actualEndDate,
      actualStartDate: input.change.actualStartDate,
      description: input.change.description,
      evidenceMessageId: input.classification.messageId,
      evidenceSummary: input.change.reason,
      milestoneTitle: match?.title ?? input.change.milestoneTitle,
      originalDatePhrase: input.change.originalDatePhrase,
      plannedEndDate: input.change.plannedEndDate,
      plannedStartDate: input.change.plannedStartDate,
      proposedStatus: input.change.status,
      targetMilestoneId: match?.id ?? null
    };
    const existingRecommendations = await this.prisma.recommendation.findMany({
      orderBy: { createdAt: "desc" },
      where: {
        OR: [{ status: "PENDING" }, { sourceEntityId: input.classification.messageId }],
        projectId: input.project.id,
        sourceCoordinator: "MILESTONE"
      }
    });
    const duplicate = existingRecommendations.find((recommendation) =>
      isDuplicateRecommendation(recommendation.proposedActionPayload, action, payload)
    );
    const data = {
      confidence: input.change.confidence,
      description: input.change.description ?? input.change.reason,
      priority: input.change.action === "DELAY" ? ("HIGH" as const) : ("MEDIUM" as const),
      proposedActionPayload: payload,
      reason: input.change.reason,
      sourceEntityId: input.classification.messageId,
      sourceEntityType: "MESSAGE",
      title
    };

    if (this.options.evaluateCandidate) {
      return this.options.evaluateCandidate({
        action,
        candidate: {
          confidence: data.confidence,
          description: data.description,
          evidenceIds: [input.classification.messageId],
          payload,
          priority: data.priority,
          reason: data.reason,
          scope: payload.milestoneTitle,
          sourceEntityId: input.classification.messageId,
          title: data.title,
          type
        },
        project: input.project
      });
    }

    if (duplicate) {
      if (duplicate.status !== "PENDING") return false;
      await this.prisma.recommendation.update({ data, where: { id: duplicate.id } });
      return false;
    }

    await this.prisma.recommendation.create({
      data: {
        ...data,
        organizationId: input.project.organizationId,
        projectId: input.project.id,
        proposedActionType: action,
        sourceCoordinator: "MILESTONE",
        type
      }
    });
    return true;
  }
}

export function detectMilestoneChanges(
  text: string,
  occurredAt: Date,
  timezone: string
): MilestoneDetectionCandidate[] {
  const clauses = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .split(/[,;.!]|\band\s+(?=(?:we\s+)?(?:start|starting|begin|beginning|commence|commencing))/i)
    .map((clause) => clause.trim())
    .filter(Boolean);
  const changes: MilestoneDetectionCandidate[] = [];

  for (const clause of clauses) {
    const delayed = clause.match(
      new RegExp(
        `^(?:we\\s+)?(.+?)\\s+(?:is\\s+)?(?:delayed|postponed|rescheduled)(?:\\s+(?:by|until|to)\\s+(${datePhrasePattern}|.+))?$`,
        "i"
      )
    );
    if (delayed?.[1]) {
      const phrase = cleanDatePhrase(delayed[2]);
      changes.push(
        change({
          action: "DELAY",
          milestoneTitle: cleanMilestoneTitle(delayed[1]),
          originalDatePhrase: phrase,
          plannedEndDate: toDateOnly(resolveDatePhrase(phrase, occurredAt, timezone)),
          reason: `The field update reports that ${cleanMilestoneTitle(delayed[1])} is delayed.`,
          status: "DELAYED"
        })
      );
      continue;
    }

    const moved = clause.match(
      new RegExp(`^(?:the\\s+)?(.+?)\\s+(?:is\\s+)?moved\\s+to\\s+(${datePhrasePattern}|.+)$`, "i")
    );
    if (moved?.[1]) {
      const phrase = cleanDatePhrase(moved[2]);
      changes.push(
        change({
          action: "UPDATE",
          milestoneTitle: cleanMilestoneTitle(moved[1]),
          originalDatePhrase: phrase,
          plannedEndDate: toDateOnly(resolveDatePhrase(phrase, occurredAt, timezone)),
          reason: `The field update reschedules ${cleanMilestoneTitle(moved[1])}.`,
          status: "PLANNED"
        })
      );
      continue;
    }

    const completedPrefix = clause.match(
      new RegExp(
        `^(?:we\\s+)?(?:have\\s+)?(?:finished|completed)\\s+(?:the\\s+)?(.+?)(?:\\s+(${datePhrasePattern}))?$`,
        "i"
      )
    );
    const completedSuffix = clause.match(
      new RegExp(
        `^(?:the\\s+)?(.+?)\\s+(?:is\\s+)?(?:done|finished|completed)(?:\\s+(${datePhrasePattern}))?$`,
        "i"
      )
    );
    const completed = completedPrefix ?? completedSuffix;
    if (completed?.[1]) {
      const phrase = cleanDatePhrase(completed[2]) ?? "today";
      const milestoneTitle = cleanMilestoneTitle(completed[1]);
      changes.push(
        change({
          action: "COMPLETE",
          actualEndDate: toDateOnly(resolveDatePhrase(phrase, occurredAt, timezone)),
          milestoneTitle,
          originalDatePhrase: completed[2] ? phrase : null,
          reason: `The field update explicitly reports that ${milestoneTitle} was completed.`,
          status: "COMPLETED"
        })
      );
      continue;
    }

    const starting = clause.match(
      new RegExp(
        `^(?:we\\s+)?(?:will\\s+)?(?:start|starting|begin|beginning|commence|commencing)\\s+(?:the\\s+)?(.+?)(?:\\s+(${datePhrasePattern}))?$`,
        "i"
      )
    );
    if (starting?.[1]) {
      const phrase = cleanDatePhrase(starting[2]);
      const resolved = resolveDatePhrase(phrase, occurredAt, timezone);
      const needsDateReview = Boolean(phrase && !resolved);
      const future = Boolean(
        resolved && resolved.getTime() > dateOnly(occurredAt, timezone).getTime()
      );
      const milestoneTitle = cleanMilestoneTitle(starting[1]);
      changes.push(
        change({
          action: future || needsDateReview ? "CREATE" : "START",
          actualStartDate:
            future || needsDateReview
              ? null
              : toDateOnly(resolved ?? dateOnly(occurredAt, timezone)),
          milestoneTitle,
          originalDatePhrase: phrase,
          plannedStartDate: future ? toDateOnly(resolved) : null,
          reason:
            future || needsDateReview
              ? `The field update schedules ${milestoneTitle} to start ${phrase}.`
              : `The field update reports that ${milestoneTitle} has started.`,
          status: future || needsDateReview ? "PLANNED" : "IN_PROGRESS"
        })
      );
      continue;
    }

    const started = clause.match(
      new RegExp(
        `^(?:the\\s+)?(.+?)\\s+(?:has\\s+)?(?:started|commenced)(?:\\s+(${datePhrasePattern}))?$`,
        "i"
      )
    );
    if (started?.[1]) {
      const phrase = cleanDatePhrase(started[2]) ?? "today";
      const milestoneTitle = cleanMilestoneTitle(started[1]);
      changes.push(
        change({
          action: "START",
          actualStartDate: toDateOnly(resolveDatePhrase(phrase, occurredAt, timezone)),
          milestoneTitle,
          originalDatePhrase: started[2] ? phrase : null,
          reason: `The field update reports that ${milestoneTitle} has started.`,
          status: "IN_PROGRESS"
        })
      );
    }
  }

  return changes.filter((item) => (item.milestoneTitle?.length ?? 0) > 1);
}

export function matchExistingMilestone(title: string, milestones: Milestone[]): Milestone | null {
  const normalized = normalizeMilestoneTitle(title);
  const exact = milestones.find(
    (milestone) => normalizeMilestoneTitle(milestone.title) === normalized
  );
  if (exact) return exact;

  const targetTokens = new Set(normalized.split(" ").filter(Boolean));
  let best: { milestone: Milestone; score: number } | null = null;
  for (const milestone of milestones) {
    const candidateTokens = new Set(
      normalizeMilestoneTitle(milestone.title).split(" ").filter(Boolean)
    );
    const intersection = [...targetTokens].filter((token) => candidateTokens.has(token)).length;
    const union = new Set([...targetTokens, ...candidateTokens]).size;
    const score = union > 0 ? intersection / union : 0;
    if (score >= 0.6 && (!best || score > best.score)) best = { milestone, score };
  }
  return best?.milestone ?? null;
}

export function resolveDatePhrase(
  phrase: string | null | undefined,
  occurredAt: Date,
  timezone: string
): Date | null {
  if (!phrase) return null;
  const normalized = phrase
    .trim()
    .toLowerCase()
    .replace(/^until\s+/, "");
  const base = dateOnly(occurredAt, timezone);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return new Date(`${normalized}T00:00:00.000Z`);
  if (normalized === "today") return base;
  if (normalized === "tomorrow") return addDays(base, 1);
  if (normalized === "yesterday") return addDays(base, -1);
  if (normalized === "next week") return null;

  const weekdayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday"
  ];
  const weekday = normalized.replace(/^next\s+/, "");
  const targetDay = weekdayNames.indexOf(weekday);
  if (targetDay >= 0) {
    let days = (targetDay - base.getUTCDay() + 7) % 7;
    if (days === 0 || normalized.startsWith("next ")) days += 7;
    return addDays(base, days);
  }
  return null;
}

export function normalizeMilestoneTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(start|starting|complete|completed|finish|finished|the|work|works)\b/g, " ")
    .replace(/\b(concrete foundation|foundation concrete)\b/g, "foundation")
    .replace(/\b(walls?)\b/g, "wall construction")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function buildRelativeDateHints(text: string, occurredAt: Date, timezone: string) {
  const matches = text.toLowerCase().match(new RegExp(`\\b(${datePhrasePattern})\\b`, "gi")) ?? [];
  return Object.fromEntries(
    [...new Set(matches.map((value) => value.toLowerCase()))].map((phrase) => [
      phrase,
      toDateOnly(resolveDatePhrase(phrase, occurredAt, timezone))
    ])
  );
}

function change(
  input: Partial<MilestoneDetectionCandidate> &
    Pick<MilestoneDetectionCandidate, "action" | "milestoneTitle" | "reason" | "status">
): MilestoneDetectionCandidate {
  const hasResolvedDate = Boolean(
    input.actualEndDate || input.actualStartDate || input.plannedEndDate || input.plannedStartDate
  );
  return {
    action: input.action,
    actualEndDate: input.actualEndDate ?? null,
    actualStartDate: input.actualStartDate ?? null,
    confidence: input.originalDatePhrase && !hasResolvedDate ? "MEDIUM" : "HIGH",
    description: input.description ?? null,
    hasMilestoneChange: true,
    milestoneTitle: input.milestoneTitle,
    originalDatePhrase: input.originalDatePhrase ?? null,
    plannedEndDate: input.plannedEndDate ?? null,
    plannedStartDate: input.plannedStartDate ?? null,
    reason: input.reason,
    status: input.status
  };
}

function resolveRecommendationAction(
  change: MilestoneDetectionCandidate,
  match: Milestone | null
): RecommendationActionType {
  if (!match) return "CREATE_MILESTONE";
  if (change.action === "COMPLETE") return "COMPLETE_MILESTONE";
  if (change.action === "START" && change.actualStartDate) return "START_MILESTONE";
  return "UPDATE_MILESTONE";
}

function resolveRecommendationType(
  change: MilestoneDetectionCandidate,
  match: Milestone | null
): RecommendationType {
  if (!match) return "CREATE_MILESTONE";
  if (change.action === "COMPLETE") return "COMPLETE_MILESTONE";
  if (change.action === "START") return "START_MILESTONE";
  if (change.action === "DELAY") return "DELAY_MILESTONE";
  return "UPDATE_MILESTONE";
}

function buildRecommendationTitle(action: RecommendationActionType, milestoneTitle: string) {
  const prefix = {
    COMPLETE_MILESTONE: "Complete milestone",
    CREATE_MILESTONE: "Create milestone",
    START_MILESTONE: "Start milestone",
    UPDATE_MILESTONE: "Update milestone"
  } as const;
  return `${prefix[action as keyof typeof prefix] ?? "Update milestone"}: ${milestoneTitle}`;
}

function isDuplicateRecommendation(
  existingPayload: Prisma.JsonValue,
  action: RecommendationActionType,
  payload: Record<string, unknown>
): boolean {
  const existing = getPayload(existingPayload);
  const existingActionDate =
    existing.actualEndDate ??
    existing.actualStartDate ??
    existing.plannedEndDate ??
    existing.plannedStartDate;
  const actionDate =
    payload.actualEndDate ??
    payload.actualStartDate ??
    payload.plannedEndDate ??
    payload.plannedStartDate;
  return (
    normalizeMilestoneTitle(String(existing.milestoneTitle ?? "")) ===
      normalizeMilestoneTitle(String(payload.milestoneTitle ?? "")) &&
    existing.evidenceMessageId === payload.evidenceMessageId &&
    existingActionDate === actionDate &&
    action === actionForPayload(existing)
  );
}

function actionForPayload(payload: Record<string, unknown>): RecommendationActionType {
  if (!payload.targetMilestoneId) return "CREATE_MILESTONE";
  if (payload.proposedStatus === "COMPLETED") return "COMPLETE_MILESTONE";
  if (payload.proposedStatus === "IN_PROGRESS" && payload.actualStartDate) return "START_MILESTONE";
  return "UPDATE_MILESTONE";
}

function getPayload(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanMilestoneTitle(value: string): string {
  return value
    .replace(/^(?:we\s+|the\s+)/i, "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function cleanDatePhrase(value: string | undefined): string | null {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/^until\s+/, "");
  return normalized || null;
}

function dateOnly(value: Date, timezone: string): Date {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: timezone,
      year: "numeric"
    }).formatToParts(value);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((item) => item.type === type)?.value);
    return new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
  } catch {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
}

function addDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function toDateOnly(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}
