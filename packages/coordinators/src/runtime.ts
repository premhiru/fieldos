import {
  Prisma,
  queueWhatsAppDraftSendJob,
  queueProjectCoordinatorJobs,
  queueReportGenerationJob,
  queueSearchIndexJob,
  type CoordinatorRun,
  type CoordinatorRunStatus,
  type CoordinatorType,
  type AIDecisionEngineMode,
  type PrismaClient,
  type Project,
  type ProjectState,
  type Milestone,
  type Recommendation,
  type RecommendationPriority,
  type WhatsAppDraft
} from "@fieldos/db";
import { assessProjectHealth } from "@fieldos/intelligence";
import { createLogger } from "@fieldos/shared";

import type {
  CoordinatorOperationsMetrics,
  DraftSendResult,
  ProjectCoordinatorRunResult,
  ProjectCoordinatorRuntimeOptions,
  RecommendationApprovalResult,
  RecommendationInput,
  RecommendationWithProject,
  MilestoneApprovalResult,
  MilestoneRecommendationEdit,
  MilestoneRecommendationView,
  MilestoneWriteInput,
  WhatsAppDraftSender
} from "./types.js";
import {
  MilestoneCoordinator,
  type MilestoneClassificationEvidence
} from "./milestone-coordinator.js";
import {
  assessReportReadiness,
  isFollowUpEligible,
  isInspectionEligible,
  isRoutineProgress,
  semanticScopeForDecision
} from "./decision-policy.js";
import { RecommendationGate, type RecommendationCandidateInput } from "./recommendation-gate.js";

const logger = createLogger("fieldos-coordinators");
const followUpThresholdMs = 48 * 60 * 60 * 1000;
const highFollowUpThresholdMs = 72 * 60 * 60 * 1000;
const urgentFollowUpThresholdMs = 5 * 24 * 60 * 60 * 1000;
const recommendationDedupWindowMs = 7 * 24 * 60 * 60 * 1000;
const inspectionPattern =
  /\b(ready for inspection|pending inspection|completed|complete|installed|testing required|ready to inspect)\b/i;

function isWithinCoordinatorScanHours(now: Date, timezone: string | null | undefined): boolean {
  const resolvedTimezone = timezone?.trim() || "UTC";

  try {
    const hourPart = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: resolvedTimezone
    })
      .formatToParts(now)
      .find((part) => part.type === "hour");
    const hour = Number(hourPart?.value);
    return Number.isInteger(hour) && hour >= 7 && hour < 19;
  } catch {
    return isWithinCoordinatorScanHours(now, "UTC");
  }
}

function buildCoordinatorOperatingContext(now: Date, timezone: string) {
  const weekday = localWeekday(now, timezone);
  return {
    isOperatingHours: isWithinCoordinatorScanHours(now, timezone),
    isWeekend: weekday === "Saturday" || weekday === "Sunday",
    localDate: new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: timezone,
      year: "numeric"
    }).format(now),
    timezone,
    weekday
  };
}

function isMeaningfulCoordinatorEvent(eventType: string): boolean {
  return !/^(MESSAGE_RECEIVED|SEARCH_INDEXED|SYSTEM|REPORT_GENERATED)/i.test(eventType);
}

interface ProjectCoordinatorContext {
  actionItems: Array<{
    description: string | null;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    status: string;
    title: string;
  }>;
  events: Array<{
    description: string | null;
    occurredAt: Date;
    title: string;
  }>;
  highPriorityActionItemCount: number;
  hasAttentionSignal: boolean;
  hasSafetyIssue: boolean;
  lastActivityAt: Date | null;
  lastEvidenceAt: Date | null;
  lastReportAt: Date | null;
  lastWhatsAppUpdateAt: Date | null;
  milestones: Milestone[];
  openActionItemCount: number;
  overdueMilestoneCount: number;
  openActionItems: Array<{
    description: string | null;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    title: string;
  }>;
  photoAnalyses: Array<{
    createdAt: Date;
    summary: string;
  }>;
  project: Project;
  recommendations: Array<{
    status: string;
    title: string;
  }>;
  reports: Array<{
    createdAt: Date;
    generatedAt: Date | null;
    status: string;
  }>;
  urgentActionItemCount: number;
}

interface DecisionCoordinatorContext {
  activeMilestones: Array<{
    id: string;
    plannedEndDate: Date | null;
    plannedStartDate: Date | null;
    status: string;
    title: string;
  }>;
  classificationDecisions: Array<{
    completionClaim: "NONE" | "PARTIAL" | "CLAIMED" | "AMBIGUOUS";
    confidence: number;
    factualClaims: Prisma.JsonValue;
    inspectionReadiness: "NONE" | "NOT_READY" | "READY_CLAIMED" | "REQUESTED" | "AMBIGUOUS";
    locations: Prisma.JsonValue;
    operationalImpact: string;
    processedAt: Date;
    primaryCategory: string;
    recommendationEligible: boolean;
    responseExpectation: Prisma.JsonValue;
    secondarySignals: Prisma.JsonValue;
    summary: string;
    uncertainty: string | null;
    userFacingReason: string;
    classification: MilestoneClassificationEvidence;
  }>;
  expectations: Array<{
    confidence: number;
    conversation: {
      title: string;
      whatsAppMapping: { status: string; whatsappAccountId: string } | null;
    };
    conversationId: string;
    dueAt: Date | null;
    expectedResponder: string | null;
    id: string;
    requestedItem: string;
    sourceMessage: { occurredAt: Date };
    sourceMessageId: string;
    status: string;
  }>;
  milestones: Milestone[];
  openActionItems: Array<{
    assignedToUserId: string | null;
    description: string | null;
    id: string;
    priority: string;
    status: string;
    title: string;
    updatedAt: Date;
  }>;
  operatingContext: {
    isOperatingHours: boolean;
    isWeekend: boolean;
    localDate: string;
    timezone: string;
    weekday: string;
  };
  pendingRecommendations: Array<{
    id: string;
    proposedActionType: string;
    sourceEntityId: string | null;
    status: string;
    title: string;
    type: string;
    approvedAt: Date | null;
    completedAt: Date | null;
    dismissedAt: Date | null;
    updatedAt: Date;
  }>;
  project: Project;
  projectState: ProjectState;
  recentReports: Array<{ createdAt: Date; generatedAt: Date | null; status: string; type: string }>;
  recentTimelineEvents: Array<{
    description: string | null;
    eventType: string;
    id: string;
    occurredAt: Date;
    title: string;
  }>;
  recentMessages: Array<{
    attachments: Array<{
      filename: string;
      id: string;
      mimeType: string;
      photoAnalysis: {
        analysisStatus: string;
        claimSupport: string;
        limitations: Prisma.JsonValue;
        summary: string;
      } | null;
      transcript: string | null;
    }>;
    body: string | null;
    conversation: { channel: string; id: string; isGroup: boolean; title: string };
    direction: string;
    id: string;
    occurredAt: Date;
    senderParticipant: { displayName: string; role: string };
  }>;
  relevantEvidence: Array<{
    analysisStatus: string | null;
    claimSupport: string | null;
    evidenceId: string;
    filename: string;
    limitations: Prisma.JsonValue | null;
    messageId: string;
    mimeType: string;
    summary: string | null;
    transcript: string | null;
  }>;
}

export class NoopWhatsAppDraftSender implements WhatsAppDraftSender {
  async send(): Promise<{ externalMessageId?: string | null }> {
    throw new Error("WhatsApp draft sending is not configured for this deployment.");
  }
}

export class QueuedWhatsAppDraftSender implements WhatsAppDraftSender {
  constructor(private readonly prisma: PrismaClient) {}

  async send(input: {
    draftId: string;
    organizationId: string;
    projectId: string;
  }): Promise<{ queued: true }> {
    await queueWhatsAppDraftSendJob(this.prisma, {
      organizationId: input.organizationId,
      projectId: input.projectId,
      sourceId: input.draftId
    });

    return { queued: true };
  }
}

export class ProjectCoordinatorRuntime {
  private readonly decisionEngineMode: "legacy" | "shadow" | "v2";
  private readonly draftSender: WhatsAppDraftSender;
  private readonly recommendationGate: RecommendationGate;
  private readonly milestoneCoordinator: MilestoneCoordinator;
  private readonly milestoneCoordinatorV2: MilestoneCoordinator;
  private readonly now: () => Date;

  constructor(
    private readonly prisma: PrismaClient,
    options: ProjectCoordinatorRuntimeOptions = {}
  ) {
    this.draftSender = options.draftSender ?? new NoopWhatsAppDraftSender();
    this.now = options.now ?? (() => new Date());
    this.decisionEngineMode = options.decisionEngineMode ?? "legacy";
    this.recommendationGate = new RecommendationGate(prisma, this.now);
    this.milestoneCoordinator = new MilestoneCoordinator(prisma, {
      detector: options.milestoneDetector,
      now: this.now
    });
    this.milestoneCoordinatorV2 = new MilestoneCoordinator(prisma, {
      detector: options.milestoneDetector,
      evaluateCandidate: async ({ action, candidate, project }) =>
        (
          await this.recommendationGate.evaluate(
            project.organizationId,
            project.status,
            this.decisionEngineMode.toUpperCase() as Exclude<AIDecisionEngineMode, "LEGACY">,
            {
              confidence: candidate.confidence,
              description: candidate.description,
              businessKey: candidate.scope,
              evidenceLimitations: candidate.evidenceLimitations,
              evidenceIds: candidate.evidenceIds,
              evidenceSummary: candidate.evidenceSummary,
              expectedValue: candidate.expectedValue,
              materiality: candidate.materiality,
              priority: candidate.priority,
              projectId: project.id,
              proposedActionPayload: candidate.payload,
              proposedActionType: action,
              reason: candidate.reason,
              scope: candidate.scope,
              sourceCoordinator: "MILESTONE",
              sourceEntityId: candidate.sourceEntityId,
              sourceEntityType: "MESSAGE",
              title: candidate.title,
              type: candidate.type
            }
          )
        ).created,
      now: this.now
    });
  }

  async queueScheduledScan(): Promise<number> {
    const projects = await this.prisma.project.findMany({
      select: {
        id: true,
        organizationId: true,
        timezone: true
      },
      where: {
        status: "ACTIVE"
      }
    });

    let queued = 0;

    for (const project of projects) {
      if (!isWithinCoordinatorScanHours(this.now(), project.timezone)) {
        continue;
      }

      queued += await queueProjectCoordinatorJobs(this.prisma, {
        organizationId: project.organizationId,
        projectId: project.id,
        sourceId: project.id
      });
    }

    return queued;
  }

  async runLightweightCoordinators(projectId: string): Promise<ProjectCoordinatorRunResult> {
    return this.runCoordinatorSet(projectId, ["PROGRESS", "FOLLOW_UP", "INSPECTION", "REPORT"]);
  }

  async runMilestoneCoordinator(projectId: string): Promise<ProjectCoordinatorRunResult> {
    return this.runCoordinatorSet(projectId, ["MILESTONE"]);
  }

  async runProjectCoordinators(projectId: string): Promise<ProjectCoordinatorRunResult> {
    return this.runCoordinatorSet(projectId, [
      "PROGRESS",
      "FOLLOW_UP",
      "INSPECTION",
      "MILESTONE",
      "REPORT"
    ]);
  }

  private async runCoordinatorSet(
    projectId: string,
    coordinators: CoordinatorType[]
  ): Promise<ProjectCoordinatorRunResult> {
    const project = await this.requireProject(projectId);
    const projectState = await this.rebuildProjectState(projectId);
    const decisionContext = await this.loadDecisionCoordinatorContext(project, projectState);
    const results = [];

    for (const coordinatorType of coordinators) {
      const run = await this.startRun(project, coordinatorType);

      try {
        let recommendationsCreated = 0;

        if (this.decisionEngineMode !== "v2") {
          recommendationsCreated = await this.runCoordinator({
            coordinatorType,
            context: decisionContext
          });
        }

        if (decisionContext) {
          const v2Created = await this.runCoordinatorV2(coordinatorType, decisionContext);
          if (this.decisionEngineMode === "v2") {
            recommendationsCreated = v2Created;
          }
        }
        await this.finishRun(run.id, "COMPLETED", recommendationsCreated);
        results.push({ coordinatorType, recommendationsCreated });
      } catch (error) {
        await this.finishRun(
          run.id,
          "FAILED",
          0,
          error instanceof Error ? error.message : "Coordinator failed."
        );
        logger.warn(
          {
            coordinatorType,
            error,
            organizationId: project.organizationId,
            projectId: project.id
          },
          "project coordinator failed"
        );
        results.push({ coordinatorType, recommendationsCreated: 0 });
      }
    }

    return {
      projectState: await this.rebuildProjectState(projectId),
      results
    };
  }

  private async loadDecisionCoordinatorContext(
    project: Project,
    projectState: ProjectState
  ): Promise<DecisionCoordinatorContext> {
    const [
      milestones,
      classificationDecisions,
      expectations,
      openActionItems,
      pendingRecommendations,
      recentReports,
      recentTimelineEvents,
      recentMessages
    ] = await Promise.all([
      this.prisma.milestone.findMany({
        orderBy: { updatedAt: "desc" },
        take: 50,
        where: { projectId: project.id }
      }),
      this.prisma.aIClassificationDecision.findMany({
        include: {
          classification: {
            include: {
              message: {
                include: {
                  attachments: { select: { transcript: true } },
                  senderParticipant: { select: { displayName: true } }
                }
              }
            }
          }
        },
        orderBy: { processedAt: "desc" },
        take: 12,
        where: { projectId: project.id }
      }),
      this.prisma.outstandingExpectation.findMany({
        include: {
          conversation: {
            select: {
              title: true,
              whatsAppMapping: { select: { status: true, whatsappAccountId: true } }
            }
          },
          sourceMessage: { select: { occurredAt: true } }
        },
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
        take: 20,
        where: { projectId: project.id, status: "OPEN" }
      }),
      this.prisma.actionItem.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          assignedToUserId: true,
          description: true,
          id: true,
          priority: true,
          status: true,
          title: true,
          updatedAt: true
        },
        take: 20,
        where: { projectId: project.id, status: { in: ["PENDING", "ACCEPTED"] } }
      }),
      this.prisma.recommendation.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          approvedAt: true,
          completedAt: true,
          dismissedAt: true,
          proposedActionType: true,
          sourceEntityId: true,
          status: true,
          title: true,
          type: true,
          updatedAt: true
        },
        take: 30,
        where: {
          projectId: project.id,
          status: { in: ["PENDING", "APPROVED", "DISMISSED", "COMPLETED"] }
        }
      }),
      this.prisma.projectReport.findMany({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, generatedAt: true, status: true, type: true },
        take: 10,
        where: { projectId: project.id }
      }),
      this.prisma.event.findMany({
        orderBy: { occurredAt: "desc" },
        select: { description: true, eventType: true, id: true, occurredAt: true, title: true },
        take: 30,
        where: { projectId: project.id }
      }),
      this.prisma.message.findMany({
        include: {
          attachments: {
            select: {
              filename: true,
              id: true,
              mimeType: true,
              photoAnalysis: {
                select: {
                  analysisStatus: true,
                  claimSupport: true,
                  limitations: true,
                  summary: true
                }
              },
              transcript: true
            }
          },
          conversation: { select: { channel: true, id: true, isGroup: true, title: true } },
          senderParticipant: { select: { displayName: true, role: true } }
        },
        orderBy: { occurredAt: "desc" },
        take: 12,
        where: { conversation: { projectId: project.id } }
      })
    ]);

    const meaningfulTimelineEvents = recentTimelineEvents
      .filter((event) => isMeaningfulCoordinatorEvent(event.eventType))
      .slice(0, 20);
    const relevantEvidence = recentMessages.flatMap((message) =>
      message.attachments.map((attachment) => ({
        analysisStatus: attachment.photoAnalysis?.analysisStatus ?? null,
        claimSupport: attachment.photoAnalysis?.claimSupport ?? null,
        evidenceId: attachment.id,
        filename: attachment.filename,
        limitations: attachment.photoAnalysis?.limitations ?? null,
        messageId: message.id,
        mimeType: attachment.mimeType,
        summary: attachment.photoAnalysis?.summary ?? null,
        transcript: attachment.transcript
      }))
    );

    return {
      activeMilestones: milestones
        .filter((milestone) => ["PLANNED", "IN_PROGRESS", "DELAYED"].includes(milestone.status))
        .slice(0, 10),
      classificationDecisions,
      expectations,
      milestones,
      openActionItems,
      operatingContext: buildCoordinatorOperatingContext(this.now(), project.timezone),
      pendingRecommendations,
      project,
      projectState,
      recentReports,
      recentMessages,
      recentTimelineEvents: meaningfulTimelineEvents,
      relevantEvidence
    };
  }

  async rebuildProjectState(projectId: string): Promise<ProjectState> {
    const project = await this.requireProject(projectId);
    const context = await this.loadProjectContext(project);
    const healthAssessment = assessProjectHealth({
      hasAttentionSignal: context.hasAttentionSignal,
      hasSafetyIssue: context.hasSafetyIssue,
      highPriorityActionItemCount: context.highPriorityActionItemCount,
      lastActivityAt: context.lastActivityAt,
      now: this.now(),
      openActionItemCount: context.openActionItemCount,
      overdueMilestoneCount: context.overdueMilestoneCount,
      urgentActionItemCount: context.urgentActionItemCount
    });
    const completionPercent = determineCompletionPercent(context);
    const summaries = buildProjectStateSummaries(context);
    const milestoneState = buildMilestoneState(context.milestones, this.now());

    return this.prisma.projectState.upsert({
      create: {
        completionPercent,
        completedMilestonesCount: milestoneState.completedCount,
        delayedMilestonesCount: milestoneState.delayedCount,
        health: healthAssessment.status,
        highPriorityActionItemCount: context.highPriorityActionItemCount,
        lastActivityAt: context.lastActivityAt,
        lastEvidenceAt: context.lastEvidenceAt,
        lastReportAt: context.lastReportAt,
        lastWhatsAppUpdateAt: context.lastWhatsAppUpdateAt,
        metadata: {
          healthReason: healthAssessment.reason,
          lastComputedAt: this.now().toISOString(),
          source: "deterministic"
        },
        openActionItemCount: context.openActionItemCount,
        nextMilestone: milestoneState.next?.title ?? null,
        nextMilestoneDate: milestoneState.nextDate,
        organizationId: project.organizationId,
        pendingDecisionSummary: summaries.pendingDecisionSummary,
        projectId: project.id,
        recentBlockerSummary: summaries.recentBlockerSummary,
        recentEvidenceSummary: summaries.recentEvidenceSummary,
        recentProgressSummary: summaries.recentProgressSummary,
        recentRiskSummary: summaries.recentRiskSummary,
        upcomingMilestonesCount: milestoneState.upcomingCount,
        urgentActionItemCount: context.urgentActionItemCount
      },
      update: {
        completionPercent,
        completedMilestonesCount: milestoneState.completedCount,
        delayedMilestonesCount: milestoneState.delayedCount,
        health: healthAssessment.status,
        highPriorityActionItemCount: context.highPriorityActionItemCount,
        lastActivityAt: context.lastActivityAt,
        lastEvidenceAt: context.lastEvidenceAt,
        lastReportAt: context.lastReportAt,
        lastWhatsAppUpdateAt: context.lastWhatsAppUpdateAt,
        metadata: {
          healthReason: healthAssessment.reason,
          lastComputedAt: this.now().toISOString(),
          source: "deterministic"
        },
        openActionItemCount: context.openActionItemCount,
        nextMilestone: milestoneState.next?.title ?? null,
        nextMilestoneDate: milestoneState.nextDate,
        pendingDecisionSummary: summaries.pendingDecisionSummary,
        recentBlockerSummary: summaries.recentBlockerSummary,
        recentEvidenceSummary: summaries.recentEvidenceSummary,
        recentProgressSummary: summaries.recentProgressSummary,
        recentRiskSummary: summaries.recentRiskSummary,
        urgentActionItemCount: context.urgentActionItemCount,
        upcomingMilestonesCount: milestoneState.upcomingCount
      },
      where: {
        projectId: project.id
      }
    });
  }

  async getProjectState(projectId: string): Promise<ProjectState> {
    const projectState = await this.prisma.projectState.findUnique({ where: { projectId } });
    return projectState && getHealthReason(projectState.metadata)
      ? projectState
      : this.rebuildProjectState(projectId);
  }

  async listProjectCoordinatorRuns(projectId: string): Promise<CoordinatorRun[]> {
    return this.prisma.coordinatorRun.findMany({
      orderBy: {
        startedAt: "desc"
      },
      take: 50,
      where: {
        projectId
      }
    });
  }

  async listMilestones(projectId: string): Promise<Milestone[]> {
    return this.prisma.milestone.findMany({
      orderBy: [{ plannedStartDate: "asc" }, { plannedEndDate: "asc" }, { createdAt: "asc" }],
      where: { projectId }
    });
  }

  async getMilestone(milestoneId: string): Promise<Milestone | null> {
    return this.prisma.milestone.findUnique({ where: { id: milestoneId } });
  }

  async createMilestone(input: {
    createdByUserId: string;
    data: MilestoneWriteInput;
    organizationId: string;
    projectId: string;
  }): Promise<Milestone> {
    const milestone = await this.prisma.milestone.create({
      data: {
        ...input.data,
        createdByUserId: input.createdByUserId,
        organizationId: input.organizationId,
        projectId: input.projectId,
        source: "MANUAL"
      }
    });
    await this.rebuildProjectState(input.projectId);
    return milestone;
  }

  async updateMilestone(input: {
    data: Partial<MilestoneWriteInput>;
    milestoneId: string;
  }): Promise<Milestone> {
    const milestone = await this.prisma.milestone.update({
      data: input.data,
      where: { id: input.milestoneId }
    });
    await this.rebuildProjectState(milestone.projectId);
    return milestone;
  }

  async deleteMilestone(milestoneId: string): Promise<void> {
    const milestone = await this.prisma.milestone.delete({ where: { id: milestoneId } });
    await this.rebuildProjectState(milestone.projectId);
  }

  async listMilestoneRecommendations(projectId: string): Promise<MilestoneRecommendationView[]> {
    const recommendations = await this.prisma.recommendation.findMany({
      include: {
        project: { select: { code: true, id: true, name: true } },
        whatsAppDrafts: true
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      where: {
        projectId,
        sourceCoordinator: "MILESTONE",
        status: "PENDING"
      }
    });

    return Promise.all(
      recommendations.map(async (recommendation) => {
        const message = recommendation.sourceEntityId
          ? await this.prisma.message.findUnique({
              include: {
                attachments: {
                  select: { filename: true, id: true, mimeType: true, transcript: true }
                },
                senderParticipant: { select: { displayName: true } }
              },
              where: { id: recommendation.sourceEntityId }
            })
          : null;
        const timelineEvent = message
          ? await this.prisma.event.findFirst({
              orderBy: { occurredAt: "desc" },
              select: { description: true, id: true, occurredAt: true, title: true },
              where: {
                OR: [{ sourceId: message.id }, { sourceId: recommendation.id }],
                projectId
              }
            })
          : null;
        return {
          ...recommendation,
          evidence: message
            ? {
                attachments: message.attachments.map(({ filename, id, mimeType }) => ({
                  filename,
                  id,
                  mimeType
                })),
                conversationId: message.conversationId,
                messageBody: message.body,
                messageId: message.id,
                occurredAt: message.occurredAt,
                sender: message.senderParticipant.displayName,
                timelineEvent,
                voiceTranscript:
                  message.attachments.find((attachment) => attachment.transcript)?.transcript ??
                  null
              }
            : null
        };
      })
    );
  }

  async approveMilestoneRecommendation(input: {
    edits?: MilestoneRecommendationEdit;
    recommendationId: string;
    userId: string;
  }): Promise<MilestoneApprovalResult> {
    const recommendation = await this.prisma.recommendation.findUnique({
      where: { id: input.recommendationId }
    });
    if (!recommendation || recommendation.sourceCoordinator !== "MILESTONE") {
      throw new Error("Milestone recommendation not found.");
    }
    if (recommendation.status !== "PENDING") {
      const processedPayload = milestonePayload(recommendation.proposedActionPayload);
      const milestone = await this.prisma.milestone.findFirst({
        where: {
          OR: [
            { sourceRecommendationId: recommendation.id },
            ...(processedPayload.targetMilestoneId
              ? [{ id: processedPayload.targetMilestoneId }]
              : [])
          ]
        }
      });
      if (!milestone) throw new Error("Milestone recommendation has already been processed.");
      return { milestone, recommendation };
    }

    const payload = milestonePayload(recommendation.proposedActionPayload);
    const title = input.edits?.title?.trim() || payload.milestoneTitle;
    const sourceMessageId = payload.evidenceMessageId;
    const edits = input.edits;
    const proposed = {
      actualEndDate: hasOwn(edits, "actualEndDate")
        ? (edits?.actualEndDate ?? null)
        : parseDate(payload.actualEndDate),
      actualStartDate: hasOwn(edits, "actualStartDate")
        ? (edits?.actualStartDate ?? null)
        : parseDate(payload.actualStartDate),
      description: hasOwn(edits, "description")
        ? (edits?.description ?? null)
        : payload.description,
      plannedEndDate: hasOwn(edits, "plannedEndDate")
        ? (edits?.plannedEndDate ?? null)
        : parseDate(payload.plannedEndDate),
      plannedStartDate: hasOwn(edits, "plannedStartDate")
        ? (edits?.plannedStartDate ?? null)
        : parseDate(payload.plannedStartDate),
      priority: edits?.priority ?? "MEDIUM",
      status: edits?.status ?? payload.proposedStatus ?? "PLANNED",
      title
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const milestone =
        recommendation.proposedActionType === "CREATE_MILESTONE"
          ? await tx.milestone.create({
              data: {
                ...proposed,
                organizationId: recommendation.organizationId,
                projectId: recommendation.projectId,
                source: "AI_RECOMMENDATION",
                sourceMessageId,
                sourceRecommendationId: recommendation.id
              }
            })
          : await updateRecommendedMilestone(tx, {
              action: recommendation.proposedActionType,
              payload,
              proposed,
              editedFields: new Set(Object.keys(edits ?? {})),
              recommendationId: recommendation.id,
              sourceMessageId
            });
      const completedRecommendation = await tx.recommendation.update({
        data: {
          approvedAt: this.now(),
          approvedByUserId: input.userId,
          completedAt: this.now(),
          proposedActionPayload: {
            ...payload,
            ...datesToPayload(proposed),
            milestoneTitle: proposed.title,
            proposedStatus: proposed.status,
            targetMilestoneId: milestone.id
          },
          status: "COMPLETED"
        },
        where: { id: recommendation.id }
      });
      const event = await tx.event.create({
        data: {
          description: milestoneEventDescription(recommendation.proposedActionType, milestone),
          eventType: milestoneEventType(recommendation.proposedActionType, milestone),
          occurredAt: this.now(),
          organizationId: milestone.organizationId,
          projectId: milestone.projectId,
          sourceId: milestone.id,
          sourceType: "MILESTONE",
          title: milestoneEventTitle(recommendation.proposedActionType, milestone)
        }
      });
      await queueSearchIndexJob(tx, {
        organizationId: event.organizationId,
        projectId: event.projectId,
        sourceId: event.id,
        sourceType: "TIMELINE_EVENT"
      });
      return { milestone, recommendation: completedRecommendation };
    });
    await this.rebuildProjectState(recommendation.projectId);
    return result;
  }

  async listRecommendations(input: {
    organizationId: string;
    projectId?: string | null;
    status?: "PENDING" | "APPROVED" | "DISMISSED" | "COMPLETED" | "FAILED";
  }): Promise<RecommendationWithProject[]> {
    return this.prisma.recommendation.findMany({
      include: {
        project: {
          select: {
            code: true,
            id: true,
            name: true
          }
        },
        whatsAppDrafts: true
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      where: {
        organizationId: input.organizationId,
        projectId: input.projectId ?? undefined,
        status: input.status ?? undefined
      }
    });
  }

  async getRecommendation(recommendationId: string): Promise<RecommendationWithProject | null> {
    return this.prisma.recommendation.findUnique({
      include: {
        project: {
          select: {
            code: true,
            id: true,
            name: true
          }
        },
        whatsAppDrafts: true
      },
      where: {
        id: recommendationId
      }
    });
  }

  async approveRecommendation(input: {
    recommendationId: string;
    userId: string;
  }): Promise<RecommendationApprovalResult> {
    const recommendation = await this.prisma.recommendation.findUnique({
      where: {
        id: input.recommendationId
      }
    });

    if (!recommendation) {
      throw new Error("Recommendation not found.");
    }

    if (recommendation.status !== "PENDING") {
      return {
        recommendation
      };
    }

    const result = await (async (): Promise<RecommendationApprovalResult> => {
      switch (recommendation.proposedActionType) {
        case "CREATE_MILESTONE":
        case "UPDATE_MILESTONE":
        case "COMPLETE_MILESTONE":
        case "START_MILESTONE": {
          return this.approveMilestoneRecommendation(input);
        }
        case "SEND_WHATSAPP_MESSAGE_DRAFT":
        case "REQUEST_PROGRESS_UPDATE": {
          const draft = await this.createDraftForRecommendation(recommendation, input.userId);
          const updated = await this.markRecommendationApproved(recommendation.id, input.userId);
          return { draft, recommendation: updated };
        }
        case "CREATE_ACTION_ITEM":
        case "SCHEDULE_INSPECTION_REMINDER": {
          const actionItemId = await this.createActionItemForRecommendation(
            recommendation,
            input.userId
          );
          const updated = await this.markRecommendationApproved(recommendation.id, input.userId);
          return { actionItemId, recommendation: updated };
        }
        case "GENERATE_REPORT": {
          const report = await this.queueReportForRecommendation(recommendation);
          const updated = await this.markRecommendationApproved(recommendation.id, input.userId);
          return { recommendation: updated, reportId: report.id };
        }
        case "MARK_PROGRESS_REVIEWED": {
          const updated = await this.prisma.recommendation.update({
            data: {
              approvedAt: this.now(),
              approvedByUserId: input.userId,
              completedAt: this.now(),
              status: "COMPLETED"
            },
            where: {
              id: recommendation.id
            }
          });
          return { recommendation: updated };
        }
        case "REVIEW_EVIDENCE": {
          const updated = await this.markRecommendationApproved(recommendation.id, input.userId);
          return { recommendation: updated };
        }
      }
    })();

    await queueProjectCoordinatorJobs(this.prisma, {
      organizationId: recommendation.organizationId,
      projectId: recommendation.projectId,
      sourceId: recommendation.projectId
    });

    return result;
  }

  async dismissRecommendation(input: {
    dismissReason?: string | null;
    recommendationId: string;
    userId: string;
  }): Promise<Recommendation> {
    return this.prisma.recommendation.update({
      data: {
        dismissedAt: this.now(),
        dismissedByUserId: input.userId,
        dismissReason: input.dismissReason ?? null,
        status: "DISMISSED"
      },
      where: {
        id: input.recommendationId
      }
    });
  }

  async completeRecommendation(recommendationId: string): Promise<Recommendation> {
    return this.prisma.recommendation.update({
      data: {
        completedAt: this.now(),
        status: "COMPLETED"
      },
      where: {
        id: recommendationId
      }
    });
  }

  async listWhatsAppDrafts(input: {
    organizationId: string;
    projectId?: string | null;
  }): Promise<WhatsAppDraft[]> {
    return this.prisma.whatsAppDraft.findMany({
      orderBy: {
        createdAt: "desc"
      },
      where: {
        organizationId: input.organizationId,
        projectId: input.projectId ?? undefined
      }
    });
  }

  async getWhatsAppDraft(draftId: string): Promise<WhatsAppDraft | null> {
    return this.prisma.whatsAppDraft.findUnique({
      where: {
        id: draftId
      }
    });
  }

  async updateWhatsAppDraft(input: {
    draftId: string;
    messageBody: string;
  }): Promise<WhatsAppDraft> {
    return this.prisma.whatsAppDraft.update({
      data: {
        messageBody: input.messageBody,
        status: "DRAFT"
      },
      where: {
        id: input.draftId
      }
    });
  }

  async sendWhatsAppDraft(input: { draftId: string; userId: string }): Promise<DraftSendResult> {
    const draft = await this.prisma.whatsAppDraft.findUnique({
      where: {
        id: input.draftId
      }
    });

    if (!draft) {
      throw new Error("WhatsApp draft not found.");
    }

    if (!draft.conversationId) {
      const failedDraft = await this.prisma.whatsAppDraft.update({
        data: {
          approvedByUserId: input.userId,
          status: "FAILED"
        },
        where: {
          id: draft.id
        }
      });
      return {
        draft: failedDraft,
        error: "Draft is not linked to a WhatsApp conversation.",
        sent: false
      };
    }

    try {
      const sendResult = await this.draftSender.send({
        conversationId: draft.conversationId,
        draftId: draft.id,
        messageBody: draft.messageBody,
        organizationId: draft.organizationId,
        projectId: draft.projectId,
        whatsappAccountId: draft.whatsappAccountId
      });

      if (sendResult.queued) {
        const queuedDraft = await this.prisma.whatsAppDraft.update({
          data: {
            approvedByUserId: input.userId,
            status: "APPROVED"
          },
          where: {
            id: draft.id
          }
        });

        return { draft: queuedDraft, queued: true, sent: false };
      }

      const sentDraft = await this.prisma.whatsAppDraft.update({
        data: {
          approvedByUserId: input.userId,
          sentAt: this.now(),
          status: "SENT"
        },
        where: {
          id: draft.id
        }
      });

      if (draft.recommendationId) {
        await this.completeRecommendation(draft.recommendationId);
      }

      return { draft: sentDraft, sent: true };
    } catch (error) {
      const failedDraft = await this.prisma.whatsAppDraft.update({
        data: {
          approvedByUserId: input.userId,
          status: "FAILED"
        },
        where: {
          id: draft.id
        }
      });
      return {
        draft: failedDraft,
        error: error instanceof Error ? error.message : "WhatsApp draft send failed.",
        sent: false
      };
    }
  }

  async cancelWhatsAppDraft(draftId: string): Promise<WhatsAppDraft> {
    return this.prisma.whatsAppDraft.update({
      data: {
        status: "CANCELLED"
      },
      where: {
        id: draftId
      }
    });
  }

  async getOperationsMetrics(organizationId: string): Promise<CoordinatorOperationsMetrics> {
    const today = startOfDay(this.now());
    const [
      runsToday,
      failedRunsToday,
      recommendationsCreatedToday,
      pendingRecommendations,
      approvedCount,
      terminalCount,
      recentRuns,
      candidateGroups,
      candidateCoordinatorGroups,
      suppressionGroups
    ] = await Promise.all([
      this.prisma.coordinatorRun.count({
        where: {
          organizationId,
          startedAt: { gte: today }
        }
      }),
      this.prisma.coordinatorRun.count({
        where: {
          organizationId,
          startedAt: { gte: today },
          status: "FAILED"
        }
      }),
      this.prisma.recommendation.count({
        where: {
          createdAt: { gte: today },
          organizationId
        }
      }),
      this.prisma.recommendation.count({
        where: {
          organizationId,
          status: "PENDING"
        }
      }),
      this.prisma.recommendation.count({
        where: {
          organizationId,
          status: { in: ["APPROVED", "COMPLETED"] }
        }
      }),
      this.prisma.recommendation.count({
        where: {
          organizationId,
          status: { in: ["APPROVED", "COMPLETED", "DISMISSED"] }
        }
      }),
      this.prisma.coordinatorRun.findMany({
        include: {
          project: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          startedAt: "desc"
        },
        take: 100,
        where: {
          organizationId
        }
      }),
      this.prisma.recommendationCandidate.groupBy({
        _count: true,
        by: ["status"],
        where: { createdAt: { gte: today }, organizationId }
      }),
      this.prisma.recommendationCandidate.groupBy({
        _count: true,
        by: ["coordinatorType"],
        where: { createdAt: { gte: today }, organizationId }
      }),
      this.prisma.recommendationCandidate.groupBy({
        _count: true,
        by: ["suppressionReason"],
        where: {
          createdAt: { gte: today },
          organizationId,
          status: "SUPPRESSED",
          suppressionReason: { not: null }
        }
      })
    ]);

    const seenProjects = new Set<string>();
    const lastRunPerProject = recentRuns
      .filter((run) => {
        if (seenProjects.has(run.projectId)) {
          return false;
        }
        seenProjects.add(run.projectId);
        return true;
      })
      .slice(0, 10)
      .map((run) => ({
        coordinatorType: run.coordinatorType,
        projectId: run.projectId,
        projectName: run.project.name,
        startedAt: run.startedAt,
        status: run.status
      }));

    return {
      approvalRate: terminalCount > 0 ? Math.round((approvedCount / terminalCount) * 100) : 0,
      candidatesByCoordinator: candidateCoordinatorGroups.map((group) => ({
        coordinatorType: group.coordinatorType,
        count: group._count
      })),
      candidatesClarificationToday:
        candidateGroups.find((group) => group.status === "CLARIFICATION")?._count ?? 0,
      candidatesGeneratedToday: candidateGroups.reduce((total, group) => total + group._count, 0),
      candidatesShadowedToday:
        candidateGroups.find((group) => group.status === "SHADOW")?._count ?? 0,
      candidatesSuppressedToday:
        candidateGroups.find((group) => group.status === "SUPPRESSED")?._count ?? 0,
      failedRunsToday,
      lastRunPerProject,
      pendingRecommendations,
      recommendationsCreatedToday,
      runsToday,
      suppressionsByReason: suppressionGroups.map((group) => ({
        count: group._count,
        reason: group.suppressionReason ?? "UNKNOWN"
      }))
    };
  }

  private async runCoordinator(input: {
    coordinatorType: CoordinatorType;
    context: DecisionCoordinatorContext;
  }): Promise<number> {
    switch (input.coordinatorType) {
      case "PROGRESS":
        return this.runProgressCoordinator(input.context.project);
      case "FOLLOW_UP":
        return this.runFollowUpCoordinator(input.context.project);
      case "INSPECTION":
        return this.runInspectionCoordinator(input.context.project);
      case "REPORT":
        return this.runReportCoordinator(input.context.project);
      case "MILESTONE":
        return this.milestoneCoordinator.run(input.context.project);
      case "RUNTIME":
        return 0;
    }
  }

  private async runCoordinatorV2(
    coordinatorType: CoordinatorType,
    context: DecisionCoordinatorContext
  ): Promise<number> {
    switch (coordinatorType) {
      case "PROGRESS":
        return this.runProgressCoordinatorV2(context);
      case "FOLLOW_UP":
        return this.runFollowUpCoordinatorV2(context);
      case "INSPECTION":
        return this.runInspectionCoordinatorV2(context);
      case "REPORT":
        return this.runReportCoordinatorV2(context);
      case "MILESTONE":
        return this.milestoneCoordinatorV2.run(context.project, {
          classifications: context.classificationDecisions.map(
            (decision) => decision.classification
          ),
          milestones: context.milestones,
          projectState: {
            nextMilestone: context.projectState.nextMilestone,
            pendingDecisionSummary: context.projectState.pendingDecisionSummary,
            recentProgressSummary: context.projectState.recentProgressSummary
          },
          recentTimelineEvents: context.recentTimelineEvents.map((event) => ({
            description: event.description,
            occurredAt: event.occurredAt,
            title: event.title
          }))
        });
      case "RUNTIME":
        return 0;
    }
  }

  private async runProgressCoordinatorV2(context: DecisionCoordinatorContext): Promise<number> {
    const decision = context.classificationDecisions.find((candidate) => {
      const secondarySignals = jsonStringArray(candidate.secondarySignals);
      const expectation = jsonObject(candidate.responseExpectation);
      return (
        candidate.recommendationEligible &&
        !isRoutineProgress({
          completionClaim: candidate.completionClaim,
          operationalImpact: candidate.operationalImpact,
          primaryCategory: candidate.primaryCategory,
          recommendationEligible: candidate.recommendationEligible,
          responseExpectationStatus: jsonString(expectation.status) ?? "NONE",
          secondarySignals
        }) &&
        candidate.inspectionReadiness !== "REQUESTED"
      );
    });

    if (!decision) {
      return 0;
    }

    const meaningfulSignals = new Set([
      "CLIENT_APPROVAL",
      "DEFECT",
      "DELAY",
      "MANPOWER_ISSUE",
      "MATERIAL_ISSUE",
      "RFI",
      "SAFETY_ISSUE",
      "VARIATION_ORDER"
    ]);
    const signals = [decision.primaryCategory, ...jsonStringArray(decision.secondarySignals)];

    if (!signals.some((signal) => meaningfulSignals.has(signal))) {
      return 0;
    }
    const decisionScope = semanticScopeForDecision(decision);

    return this.evaluateV2Candidate(context, {
      confidence: confidenceFromNumber(decision.confidence),
      description: decision.summary,
      evidenceLimitations:
        decision.uncertainty ?? "The classification is based on the cited field message only.",
      evidenceIds: [decision.classification.messageId],
      evidenceSummary: `Message ${decision.classification.messageId}: ${decision.summary}`,
      expectedValue:
        "Resolving the specific operational signal can reduce project risk or unblock work.",
      materiality: materialityForCategory(decision.primaryCategory),
      priority: priorityFromImpact(decision.operationalImpact),
      projectId: context.project.id,
      proposedActionPayload: { messageId: decision.classification.messageId },
      proposedActionType: "CREATE_ACTION_ITEM",
      reason: decision.userFacingReason,
      scope: decisionScope,
      sourceCoordinator: "PROGRESS",
      sourceEntityId: decision.classification.messageId,
      sourceEntityType: "MESSAGE",
      title: actionTitleForDecision(decision.primaryCategory, decision.summary),
      type: recommendationTypeForCategory(decision.primaryCategory)
    });
  }

  private async runFollowUpCoordinatorV2(context: DecisionCoordinatorContext): Promise<number> {
    let created = 0;

    for (const expectation of context.expectations) {
      if (
        !isFollowUpEligible({
          confidence: expectation.confidence,
          conversationActive: expectation.conversation.whatsAppMapping?.status === "ACTIVE",
          dueAt: expectation.dueAt,
          expectedResponder: expectation.expectedResponder,
          now: this.now(),
          projectStatus: context.project.status,
          requestedItem: expectation.requestedItem,
          status: expectation.status
        })
      ) {
        continue;
      }

      const requestedOn = formatDateForDraft(
        expectation.sourceMessage.occurredAt,
        context.project.timezone
      );
      const recipient = expectation.expectedResponder?.trim() || "team";
      const result = await this.evaluateV2Candidate(context, {
        confidence: confidenceFromNumber(expectation.confidence),
        description: `${expectation.requestedItem} remains outstanding after its expected date.`,
        businessKey: expectation.conversationId,
        evidenceLimitations: "No linked later response has resolved this recorded expectation.",
        evidenceIds: [expectation.sourceMessageId],
        evidenceSummary: `Message ${expectation.sourceMessageId} requested ${expectation.requestedItem}.`,
        expectedValue: `Obtaining ${expectation.requestedItem} can close the overdue commitment and unblock the project team.`,
        materiality: ["OWNERSHIP", "APPROVAL"],
        priority:
          expectation.dueAt &&
          this.now().getTime() - expectation.dueAt.getTime() > 72 * 60 * 60 * 1000
            ? "HIGH"
            : "MEDIUM",
        projectId: context.project.id,
        proposedActionPayload: {
          conversationId: expectation.conversationId,
          draftMessage: `Hi ${recipient}, could you please provide ${expectation.requestedItem}, requested on ${requestedOn}?`,
          expectationId: expectation.id,
          whatsappAccountId: expectation.conversation.whatsAppMapping?.whatsappAccountId ?? null
        },
        proposedActionType: "SEND_WHATSAPP_MESSAGE_DRAFT",
        reason: `A specific request for ${expectation.requestedItem} is overdue and remains unresolved.`,
        scope: expectation.requestedItem,
        sourceCoordinator: "FOLLOW_UP",
        sourceEntityId: expectation.id,
        sourceEntityType: "OUTSTANDING_EXPECTATION",
        title: `Follow up on ${expectation.requestedItem}`,
        type: "FOLLOW_UP"
      });
      created += result;
    }

    return created;
  }

  private async runInspectionCoordinatorV2(context: DecisionCoordinatorContext): Promise<number> {
    const hasOpenInspection =
      context.openActionItems.some((item) => /\binspect/i.test(item.title)) ||
      context.pendingRecommendations.some(
        (item) => item.status === "PENDING" && item.type === "INSPECTION"
      );
    const hasUnresolvedPrerequisite = context.openActionItems.some((item) =>
      /\b(testing|cabling|defect|blocker|prerequisite|punch.?list)\b/i.test(
        [item.title, item.description].filter(Boolean).join(" ")
      )
    );
    const decision = context.classificationDecisions.find((candidate) => {
      const secondarySignals = jsonStringArray(candidate.secondarySignals);
      const scope = semanticScopeForDecision(candidate);
      return isInspectionEligible({
        completionClaim: candidate.completionClaim,
        confidence: candidate.confidence,
        explicitInspectionRequired:
          candidate.primaryCategory === "INSPECTION_REQUEST" ||
          candidate.inspectionReadiness === "REQUESTED" ||
          secondarySignals.includes("INSPECTION_REQUEST"),
        hasOpenInspection,
        hasUnresolvedPrerequisite,
        inspectionReadiness: candidate.inspectionReadiness,
        scope,
        sourceMessageId: candidate.classification.messageId
      });
    });

    if (!decision) {
      return 0;
    }
    const decisionScope = semanticScopeForDecision(decision);

    return this.evaluateV2Candidate(context, {
      confidence: confidenceFromNumber(decision.confidence),
      description: decision.summary,
      businessKey: decisionScope,
      evidenceLimitations:
        decision.uncertainty ??
        "Readiness is asserted by the cited source and is not independently certified.",
      evidenceIds: [decision.classification.messageId],
      evidenceSummary: `Message ${decision.classification.messageId} identifies an inspection-ready scope and requests inspection.`,
      expectedValue: "Arranging the required inspection can unblock acceptance and dependent work.",
      materiality: ["INSPECTION", "QUALITY", "SCHEDULE"],
      priority: "HIGH",
      projectId: context.project.id,
      proposedActionPayload: { messageId: decision.classification.messageId },
      proposedActionType: "SCHEDULE_INSPECTION_REMINDER",
      reason: decision.userFacingReason,
      scope: decisionScope,
      sourceCoordinator: "INSPECTION",
      sourceEntityId: decision.classification.messageId,
      sourceEntityType: "MESSAGE",
      title: `Arrange inspection: ${truncateTitle(decision.summary)}`,
      type: "INSPECTION"
    });
  }

  private async runReportCoordinatorV2(context: DecisionCoordinatorContext): Promise<number> {
    const weekStart = startOfWeek(this.now());
    const readiness = assessReportReadiness({
      actionItems: context.openActionItems.map((item) => ({
        id: item.id,
        priority: item.priority,
        updatedAt: item.updatedAt
      })),
      classifications: context.classificationDecisions.map((decision) => ({
        category: decision.primaryCategory,
        evidenceId: decision.classification.messageId,
        impact: decision.operationalImpact,
        processedAt: decision.processedAt
      })),
      events: context.recentTimelineEvents,
      milestones: context.milestones,
      periodStart: weekStart
    });
    const reportAlreadyExists = context.recentReports.some(
      (report) => report.type === "WEEKLY_PROGRESS" && report.createdAt >= weekStart
    );
    const reportDue = localWeekday(this.now(), context.project.timezone) === "Friday";
    const hasReportableState = Boolean(
      context.projectState.recentProgressSummary ||
      context.projectState.recentRiskSummary ||
      context.projectState.pendingDecisionSummary
    );

    if (!reportDue || reportAlreadyExists || !readiness.ready || !hasReportableState) {
      return 0;
    }

    return this.evaluateV2Candidate(context, {
      confidence: "HIGH",
      description:
        "A weekly report is due and the project has enough substantive activity to produce it.",
      businessKey: weekStart.toISOString().slice(0, 10),
      evidenceLimitations:
        "The report will summarize only the cited project records for this period.",
      evidenceIds: readiness.evidenceIds,
      evidenceSummary: `Substantive reporting signals: ${readiness.categories.join(", ")}.`,
      expectedValue:
        "The scheduled report consolidates material project changes for stakeholder review.",
      materiality: ["REPORTING"],
      priority: "MEDIUM",
      projectId: context.project.id,
      proposedActionPayload: { reportType: "WEEKLY_PROGRESS" },
      proposedActionType: "GENERATE_REPORT",
      reason: `The reporting period is ending with material signals in ${readiness.categories.join(", ")}.`,
      scope: `weekly progress ${weekStart.toISOString().slice(0, 10)}`,
      sourceCoordinator: "REPORT",
      sourceEntityId: context.project.id,
      sourceEntityType: "PROJECT",
      title: "Generate scheduled weekly progress report",
      type: "REPORT"
    });
  }

  private async evaluateV2Candidate(
    context: DecisionCoordinatorContext,
    candidate: RecommendationCandidateInput
  ): Promise<number> {
    const mode = this.decisionEngineMode.toUpperCase() as Exclude<AIDecisionEngineMode, "LEGACY">;
    const result = await this.recommendationGate.evaluate(
      context.project.organizationId,
      context.project.status,
      mode,
      candidate
    );
    return result.created ? 1 : 0;
  }

  private async runProgressCoordinator(project: Project): Promise<number> {
    const recentClassifications = await this.prisma.aIMessageClassification.findMany({
      include: {
        message: {
          select: {
            body: true,
            conversationId: true,
            id: true,
            occurredAt: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 5,
      where: {
        category: { in: ["PROGRESS_UPDATE", "CLIENT_APPROVAL"] },
        projectId: project.id,
        status: "COMPLETED"
      }
    });
    const source = recentClassifications[0];

    if (!source) {
      return 0;
    }

    const created = await this.upsertRecommendation(project.organizationId, {
      confidence: confidenceFromNumber(source.confidence),
      description:
        source.summary ??
        "Recent project updates indicate meaningful progress that should be reviewed.",
      priority: "MEDIUM",
      projectId: project.id,
      proposedActionPayload: {
        messageId: source.messageId
      },
      proposedActionType: "MARK_PROGRESS_REVIEWED",
      reason:
        source.reasoningSummary ??
        "Recent messages and classifications indicate progress that may need PM review.",
      sourceCoordinator: "PROGRESS",
      sourceEntityId: source.id,
      sourceEntityType: "AI_CLASSIFICATION",
      title: buildProgressTitle(source.summary, project.name),
      type: "PROGRESS_UPDATE"
    });

    return created ? 1 : 0;
  }

  private async runFollowUpCoordinator(project: Project): Promise<number> {
    const conversations = await this.prisma.conversation.findMany({
      include: {
        whatsAppMapping: {
          select: {
            whatsappAccountId: true
          }
        }
      },
      where: {
        channel: "WHATSAPP",
        projectId: project.id,
        whatsAppMapping: {
          status: "ACTIVE"
        }
      }
    });
    let created = 0;

    for (const conversation of conversations) {
      const lastUpdate = conversation.lastMessageAt ?? conversation.updatedAt;
      const ageMs = this.now().getTime() - lastUpdate.getTime();

      if (ageMs < followUpThresholdMs) {
        continue;
      }

      const priority = getStaleUpdatePriority(ageMs);
      const days = Math.max(2, Math.round(ageMs / (24 * 60 * 60 * 1000)));
      const wasCreated = await this.upsertRecommendation(project.organizationId, {
        confidence: "HIGH",
        description: `${conversation.title} has not posted a project update in ${days} days.`,
        priority,
        projectId: project.id,
        proposedActionPayload: {
          conversationId: conversation.id,
          draftMessage:
            "Hi team, could you please share the latest progress update for this project, including photos if available?",
          whatsappAccountId: conversation.whatsAppMapping?.whatsappAccountId ?? null
        },
        proposedActionType: "SEND_WHATSAPP_MESSAGE_DRAFT",
        reason: `${conversation.title} is stale and this project may need a field progress update.`,
        sourceCoordinator: "FOLLOW_UP",
        sourceEntityId: conversation.id,
        sourceEntityType: "CONVERSATION",
        title: `Request progress update from ${conversation.title}`,
        type: "MISSING_UPDATE"
      });

      if (wasCreated) {
        created += 1;
      }
    }

    return created;
  }

  private async runInspectionCoordinator(project: Project): Promise<number> {
    const event = await this.prisma.event.findFirst({
      orderBy: {
        occurredAt: "desc"
      },
      where: {
        OR: [
          { title: { contains: "inspection", mode: "insensitive" } },
          { title: { contains: "completed", mode: "insensitive" } },
          { description: { contains: "ready for inspection", mode: "insensitive" } },
          { description: { contains: "pending inspection", mode: "insensitive" } },
          { description: { contains: "installed", mode: "insensitive" } }
        ],
        projectId: project.id
      }
    });

    if (!event || !inspectionPattern.test(`${event.title} ${event.description ?? ""}`)) {
      return 0;
    }

    const created = await this.upsertRecommendation(project.organizationId, {
      confidence: "MEDIUM",
      description:
        event.description ??
        "Recent updates indicate work may be complete and ready for inspection.",
      priority: "HIGH",
      projectId: project.id,
      proposedActionPayload: {
        eventId: event.id
      },
      proposedActionType: "SCHEDULE_INSPECTION_REMINDER",
      reason:
        "Recent field evidence or timeline activity mentions completion or inspection readiness.",
      sourceCoordinator: "INSPECTION",
      sourceEntityId: event.id,
      sourceEntityType: "TIMELINE_EVENT",
      title: `Schedule inspection for ${project.name}`,
      type: "INSPECTION"
    });

    return created ? 1 : 0;
  }

  private async runReportCoordinator(project: Project): Promise<number> {
    const weekStart = startOfWeek(this.now());
    const [weeklyEvents, latestReport] = await Promise.all([
      this.prisma.event.count({
        where: {
          occurredAt: { gte: weekStart },
          projectId: project.id
        }
      }),
      this.prisma.projectReport.findFirst({
        orderBy: {
          createdAt: "desc"
        },
        where: {
          createdAt: { gte: weekStart },
          projectId: project.id,
          type: "WEEKLY_PROGRESS"
        }
      })
    ]);

    if (weeklyEvents < 3 || latestReport) {
      return 0;
    }

    const created = await this.upsertRecommendation(project.organizationId, {
      confidence: "HIGH",
      description: `This project has ${weeklyEvents} timeline events this week and is ready for a useful weekly report.`,
      priority: "MEDIUM",
      projectId: project.id,
      proposedActionPayload: {
        reportType: "WEEKLY_PROGRESS"
      },
      proposedActionType: "GENERATE_REPORT",
      reason: "Enough project activity has accumulated this week to generate a report for review.",
      sourceCoordinator: "REPORT",
      sourceEntityId: project.id,
      sourceEntityType: "PROJECT",
      title: "Generate weekly progress report",
      type: "REPORT"
    });

    return created ? 1 : 0;
  }

  private async upsertRecommendation(
    organizationId: string,
    input: RecommendationInput
  ): Promise<boolean> {
    const dedupSince = new Date(this.now().getTime() - recommendationDedupWindowMs);
    const existing = await this.prisma.recommendation.findFirst({
      orderBy: {
        createdAt: "desc"
      },
      where: {
        OR: [
          input.sourceEntityId
            ? {
                sourceEntityId: input.sourceEntityId
              }
            : {
                createdAt: {
                  gte: dedupSince
                },
                title: input.title
              }
        ],
        projectId: input.projectId,
        proposedActionType: input.proposedActionType,
        sourceCoordinator: input.sourceCoordinator,
        status: "PENDING",
        type: input.type
      }
    });

    if (existing) {
      await this.prisma.recommendation.update({
        data: {
          confidence: input.confidence,
          description: input.description,
          priority: input.priority,
          proposedActionPayload: input.proposedActionPayload ?? Prisma.JsonNull,
          reason: input.reason,
          title: input.title
        },
        where: {
          id: existing.id
        }
      });
      return false;
    }

    await this.prisma.recommendation.create({
      data: {
        confidence: input.confidence,
        description: input.description,
        organizationId,
        priority: input.priority,
        projectId: input.projectId,
        proposedActionPayload: input.proposedActionPayload ?? Prisma.JsonNull,
        proposedActionType: input.proposedActionType,
        reason: input.reason,
        sourceCoordinator: input.sourceCoordinator,
        sourceEntityId: input.sourceEntityId ?? null,
        sourceEntityType: input.sourceEntityType ?? null,
        title: input.title,
        type: input.type
      }
    });

    return true;
  }

  private async startRun(
    project: Project,
    coordinatorType: CoordinatorType
  ): Promise<CoordinatorRun> {
    return this.prisma.coordinatorRun.create({
      data: {
        coordinatorType,
        organizationId: project.organizationId,
        projectId: project.id,
        status: "STARTED"
      }
    });
  }

  private async finishRun(
    runId: string,
    status: CoordinatorRunStatus,
    recommendationsCreated: number,
    error?: string
  ): Promise<void> {
    await this.prisma.coordinatorRun.update({
      data: {
        error,
        finishedAt: this.now(),
        recommendationsCreated,
        status
      },
      where: {
        id: runId
      }
    });
  }

  private async markRecommendationApproved(
    recommendationId: string,
    userId: string
  ): Promise<Recommendation> {
    return this.prisma.recommendation.update({
      data: {
        approvedAt: this.now(),
        approvedByUserId: userId,
        status: "APPROVED"
      },
      where: {
        id: recommendationId
      }
    });
  }

  private async createDraftForRecommendation(
    recommendation: Recommendation,
    userId: string
  ): Promise<WhatsAppDraft> {
    const payload = getPayloadObject(recommendation.proposedActionPayload);
    const conversationId = getStringPayload(payload, "conversationId");
    const selectedConversation = conversationId
      ? await this.prisma.conversation.findUnique({ where: { id: conversationId } })
      : null;
    const fallbackConversation =
      selectedConversation ??
      (await this.prisma.conversation.findFirst({
        orderBy: {
          lastMessageAt: "desc"
        },
        where: {
          channel: "WHATSAPP",
          projectId: recommendation.projectId,
          whatsAppMapping: {
            status: "ACTIVE"
          }
        }
      }));
    const whatsappAccountId =
      getStringPayload(payload, "whatsappAccountId") ??
      (fallbackConversation
        ? ((
            await this.prisma.whatsAppChatMapping.findUnique({
              where: {
                conversationId: fallbackConversation.id
              }
            })
          )?.whatsappAccountId ?? null)
        : null);

    return this.prisma.whatsAppDraft.create({
      data: {
        approvedByUserId: userId,
        conversationId: fallbackConversation?.id ?? null,
        messageBody:
          getStringPayload(payload, "draftMessage") ??
          "Hi team, could you please share the latest progress update for this project?",
        organizationId: recommendation.organizationId,
        projectId: recommendation.projectId,
        recommendationId: recommendation.id,
        status: "DRAFT",
        whatsappAccountId
      }
    });
  }

  private async createActionItemForRecommendation(
    recommendation: Recommendation,
    userId: string
  ): Promise<string> {
    const message = await this.prisma.message.findFirst({
      orderBy: {
        occurredAt: "desc"
      },
      where: {
        conversation: {
          projectId: recommendation.projectId
        }
      }
    });

    if (!message) {
      throw new Error("Cannot create Action Item without a source message.");
    }

    const actionItem = await this.prisma.actionItem.create({
      data: {
        acceptedAt: this.now(),
        acceptedByUserId: userId,
        assignedToUserId: userId,
        confidence: confidenceToNumber(recommendation.confidence),
        description: recommendation.description,
        messageId: message.id,
        organizationId: recommendation.organizationId,
        priority: mapRecommendationPriority(recommendation.priority),
        projectId: recommendation.projectId,
        status: "ACCEPTED",
        title: recommendation.title,
        type: "FOLLOW_UP"
      }
    });

    return actionItem.id;
  }

  private async queueReportForRecommendation(recommendation: Recommendation) {
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.projectReport.create({
        data: {
          organizationId: recommendation.organizationId,
          projectId: recommendation.projectId,
          status: "PENDING",
          title: recommendation.title,
          type: "WEEKLY_PROGRESS"
        }
      });
      await queueReportGenerationJob(tx, {
        organizationId: recommendation.organizationId,
        projectId: recommendation.projectId,
        sourceId: report.id
      });
      return report;
    });
  }

  private async requireProject(projectId: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: {
        id: projectId
      }
    });

    if (!project) {
      throw new Error("Project not found.");
    }

    return project;
  }

  private async loadProjectContext(project: Project): Promise<ProjectCoordinatorContext> {
    const [
      events,
      messages,
      actionItems,
      photoAnalyses,
      reports,
      recommendations,
      milestones,
      classifications
    ] = await Promise.all([
      this.prisma.event.findMany({
        orderBy: { occurredAt: "desc" },
        take: 20,
        where: { projectId: project.id }
      }),
      this.prisma.message.findMany({
        include: {
          attachments: true,
          conversation: true
        },
        orderBy: { occurredAt: "desc" },
        take: 30,
        where: {
          conversation: {
            projectId: project.id
          }
        }
      }),
      this.prisma.actionItem.findMany({
        orderBy: { createdAt: "desc" },
        where: { projectId: project.id }
      }),
      this.prisma.photoAnalysis.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        where: { projectId: project.id }
      }),
      this.prisma.projectReport.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        where: { projectId: project.id }
      }),
      this.prisma.recommendation.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        where: { projectId: project.id }
      }),
      this.prisma.milestone.findMany({
        orderBy: [{ plannedStartDate: "asc" }, { plannedEndDate: "asc" }],
        where: { projectId: project.id }
      }),
      this.prisma.aIMessageClassification.findMany({
        select: { category: true },
        where: {
          projectId: project.id,
          status: { in: ["COMPLETED", "NEEDS_REVIEW"] }
        }
      })
    ]);
    const openActionItems = actionItems.filter((item) =>
      ["PENDING", "ACCEPTED"].includes(item.status)
    );
    const highPriorityActionItemCount = openActionItems.filter(
      (item) => item.priority === "HIGH"
    ).length;
    const urgentActionItemCount = openActionItems.filter(
      (item) => item.priority === "URGENT"
    ).length;
    const overdueMilestoneCount = milestones.filter(
      (milestone) =>
        milestone.status === "DELAYED" ||
        (milestone.status !== "COMPLETED" &&
          milestone.plannedEndDate &&
          milestone.plannedEndDate.getTime() < this.now().getTime())
    ).length;
    const lastActivityAt = latestDate([
      ...events.map((event) => event.occurredAt),
      ...messages.map((message) => message.occurredAt),
      ...photoAnalyses.map((analysis) => analysis.createdAt),
      ...reports.map((report) => report.generatedAt ?? report.createdAt)
    ]);
    const lastWhatsAppUpdateAt = latestDate(
      messages
        .filter((message) => message.conversation.channel === "WHATSAPP")
        .map((message) => message.occurredAt)
    );
    const lastEvidenceAt = latestDate(
      messages.flatMap((message) => message.attachments.map((attachment) => attachment.createdAt))
    );
    const lastReportAt = latestDate(
      reports.map((report) => report.generatedAt ?? report.createdAt)
    );

    return {
      actionItems,
      events,
      hasAttentionSignal: classifications.some((classification) =>
        ["DELAY", "DEFECT", "INSPECTION_REQUEST"].includes(classification.category ?? "")
      ),
      hasSafetyIssue: classifications.some(
        (classification) => classification.category === "SAFETY_ISSUE"
      ),
      highPriorityActionItemCount,
      lastActivityAt,
      lastEvidenceAt,
      lastReportAt,
      lastWhatsAppUpdateAt,
      milestones,
      openActionItemCount: openActionItems.length,
      overdueMilestoneCount,
      openActionItems,
      photoAnalyses,
      project,
      recommendations,
      reports,
      urgentActionItemCount
    };
  }
}

function getHealthReason(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const reason = (metadata as Record<string, unknown>).healthReason;
  return typeof reason === "string" && reason.trim() ? reason : null;
}

function determineCompletionPercent(context: ProjectCoordinatorContext): number {
  const milestoneCompletion =
    context.milestones.length > 0
      ? Math.round(
          (context.milestones.filter((milestone) => milestone.status === "COMPLETED").length /
            context.milestones.length) *
            100
        )
      : 0;
  const progressSignals =
    context.events.filter((event) => /complete|progress|installed|approved/i.test(event.title))
      .length +
    context.photoAnalyses.length +
    context.reports.filter((report) => report.status === "COMPLETED").length * 2;
  const blockerPenalty = context.openActionItemCount * 3 + context.urgentActionItemCount * 5;

  return Math.max(
    0,
    Math.min(100, Math.max(milestoneCompletion, 10 + progressSignals * 6 - blockerPenalty))
  );
}

function buildProjectStateSummaries(context: ProjectCoordinatorContext) {
  return {
    pendingDecisionSummary:
      firstNonEmpty(context.recommendations.find((item) => item.status === "PENDING")?.title) ??
      firstNonEmpty(context.openActionItems[0]?.title) ??
      "No pending decisions detected.",
    recentBlockerSummary:
      firstNonEmpty(context.openActionItems[0]?.description) ??
      firstNonEmpty(context.openActionItems[0]?.title) ??
      "No active blockers detected.",
    recentEvidenceSummary:
      firstNonEmpty(context.photoAnalyses[0]?.summary) ??
      (context.lastEvidenceAt
        ? "Recent evidence has been received."
        : "No recent evidence received."),
    recentProgressSummary:
      firstNonEmpty(context.events[0]?.description) ??
      firstNonEmpty(context.events[0]?.title) ??
      "No recent progress update detected.",
    recentRiskSummary:
      firstNonEmpty(
        context.actionItems.find((item) => item.priority === "URGENT" || item.priority === "HIGH")
          ?.title
      ) ?? "No high-priority risks detected."
  };
}

function latestDate(values: Array<Date | null | undefined>): Date | null {
  const timestamps = values
    .filter((value): value is Date => value instanceof Date)
    .map((value) => value.getTime());

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps));
}

function firstNonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function confidenceFromNumber(value: number | null): "HIGH" | "MEDIUM" | "LOW" {
  if (value === null) {
    return "MEDIUM";
  }

  if (value >= 0.8) {
    return "HIGH";
  }

  if (value >= 0.55) {
    return "MEDIUM";
  }

  return "LOW";
}

function materialityForCategory(category: string): RecommendationCandidateInput["materiality"] {
  const materiality: Record<string, RecommendationCandidateInput["materiality"]> = {
    CLIENT_APPROVAL: ["APPROVAL", "SCHEDULE"],
    DEFECT: ["QUALITY", "RISK"],
    DELAY: ["SCHEDULE", "RISK"],
    MANPOWER_ISSUE: ["OWNERSHIP", "SCHEDULE"],
    MATERIAL_ISSUE: ["DELIVERY", "SCHEDULE"],
    RFI: ["SCOPE", "APPROVAL"],
    SAFETY_ISSUE: ["SAFETY", "RISK"],
    VARIATION_ORDER: ["COST", "SCOPE", "APPROVAL"]
  };
  return materiality[category] ?? [];
}

function jsonObject(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : {};
}

function jsonString(value: Prisma.JsonValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function jsonStringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function priorityFromImpact(impact: string): "LOW" | "MEDIUM" | "HIGH" | "URGENT" {
  if (impact === "CRITICAL") return "URGENT";
  if (impact === "HIGH") return "HIGH";
  if (impact === "MEDIUM") return "MEDIUM";
  return "LOW";
}

function recommendationTypeForCategory(
  category: string
): "APPROVAL_REQUIRED" | "RISK" | "GENERAL" | "SUPPLIER_DELAY" {
  if (category === "CLIENT_APPROVAL") return "APPROVAL_REQUIRED";
  if (category === "DELAY") return "SUPPLIER_DELAY";
  if (["DEFECT", "SAFETY_ISSUE", "MATERIAL_ISSUE", "MANPOWER_ISSUE"].includes(category))
    return "RISK";
  return "GENERAL";
}

function actionTitleForDecision(category: string, summary: string): string {
  const prefix =
    category === "CLIENT_APPROVAL"
      ? "Act on approval"
      : category === "RFI"
        ? "Resolve request for information"
        : category === "SAFETY_ISSUE"
          ? "Verify safety concern"
          : category === "DELAY"
            ? "Address delay"
            : "Address field issue";
  return `${prefix}: ${truncateTitle(summary)}`;
}

function truncateTitle(value: string): string {
  const normalized = value.trim();
  return normalized.length > 90 ? `${normalized.slice(0, 87).trimEnd()}...` : normalized;
}

function formatDateForDraft(value: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      timeZone: timezone,
      year: "numeric"
    }).format(value);
  } catch {
    return value.toISOString().slice(0, 10);
  }
}

function localWeekday(value: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" }).format(value);
  } catch {
    return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" }).format(value);
  }
}

function confidenceToNumber(value: "HIGH" | "MEDIUM" | "LOW"): number {
  return value === "HIGH" ? 0.9 : value === "MEDIUM" ? 0.65 : 0.4;
}

function getStaleUpdatePriority(ageMs: number): RecommendationPriority {
  if (ageMs >= urgentFollowUpThresholdMs) {
    return "URGENT";
  }

  if (ageMs >= highFollowUpThresholdMs) {
    return "HIGH";
  }

  return "MEDIUM";
}

function mapRecommendationPriority(
  priority: RecommendationPriority
): "LOW" | "MEDIUM" | "HIGH" | "URGENT" {
  return priority;
}

function buildProgressTitle(summary: string | null, projectName: string): string {
  const normalized = summary?.trim();

  if (!normalized) {
    return `Review progress update for ${projectName}`;
  }

  return normalized.length > 70 ? `Review ${normalized.slice(0, 67)}...` : `Review ${normalized}`;
}

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek(value: Date): Date {
  const date = startOfDay(value);
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff);
  return date;
}

function buildMilestoneState(milestones: Milestone[], now: Date) {
  const active = milestones.filter(
    (milestone) => !["CANCELLED", "COMPLETED"].includes(milestone.status)
  );
  const sorted = [...active].sort(
    (left, right) =>
      ((left.plannedStartDate ?? left.plannedEndDate)?.getTime() ?? Number.MAX_SAFE_INTEGER) -
      ((right.plannedStartDate ?? right.plannedEndDate)?.getTime() ?? Number.MAX_SAFE_INTEGER)
  );
  const next =
    sorted.find((milestone) => {
      const date = milestone.plannedStartDate ?? milestone.plannedEndDate;
      return !date || date.getTime() >= startOfDay(now).getTime();
    }) ??
    sorted[0] ??
    null;

  return {
    completedCount: milestones.filter((milestone) => milestone.status === "COMPLETED").length,
    delayedCount: milestones.filter((milestone) => milestone.status === "DELAYED").length,
    next,
    nextDate: next ? (next.plannedStartDate ?? next.plannedEndDate) : null,
    upcomingCount: active.filter((milestone) => milestone.status === "PLANNED").length
  };
}

interface ParsedMilestonePayload {
  actualEndDate: string | null;
  actualStartDate: string | null;
  description: string | null;
  evidenceMessageId: string | null;
  evidenceSummary: string | null;
  milestoneTitle: string;
  originalDatePhrase: string | null;
  plannedEndDate: string | null;
  plannedStartDate: string | null;
  proposedStatus: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "DELAYED" | "CANCELLED" | null;
  targetMilestoneId: string | null;
}

function milestonePayload(value: Prisma.JsonValue): ParsedMilestonePayload {
  const payload = getPayloadObject(value);
  const milestoneTitle = getStringPayload(payload, "milestoneTitle");
  if (!milestoneTitle) throw new Error("Milestone recommendation payload is invalid.");
  const rawStatus = getStringPayload(payload, "proposedStatus");
  const statuses = new Set(["PLANNED", "IN_PROGRESS", "COMPLETED", "DELAYED", "CANCELLED"]);

  return {
    actualEndDate: getStringPayload(payload, "actualEndDate"),
    actualStartDate: getStringPayload(payload, "actualStartDate"),
    description: getStringPayload(payload, "description"),
    evidenceMessageId: getStringPayload(payload, "evidenceMessageId"),
    evidenceSummary: getStringPayload(payload, "evidenceSummary"),
    milestoneTitle,
    originalDatePhrase: getStringPayload(payload, "originalDatePhrase"),
    plannedEndDate: getStringPayload(payload, "plannedEndDate"),
    plannedStartDate: getStringPayload(payload, "plannedStartDate"),
    proposedStatus: statuses.has(rawStatus ?? "")
      ? (rawStatus as ParsedMilestonePayload["proposedStatus"])
      : null,
    targetMilestoneId: getStringPayload(payload, "targetMilestoneId")
  };
}

function parseDate(value: string | null): Date | null {
  return value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : null;
}

function datesToPayload(input: {
  actualEndDate: Date | null;
  actualStartDate: Date | null;
  plannedEndDate: Date | null;
  plannedStartDate: Date | null;
}) {
  const dateOnly = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;
  return {
    actualEndDate: dateOnly(input.actualEndDate),
    actualStartDate: dateOnly(input.actualStartDate),
    plannedEndDate: dateOnly(input.plannedEndDate),
    plannedStartDate: dateOnly(input.plannedStartDate)
  };
}

async function updateRecommendedMilestone(
  tx: Prisma.TransactionClient,
  input: {
    action: Recommendation["proposedActionType"];
    editedFields: Set<string>;
    payload: ParsedMilestonePayload;
    proposed: {
      actualEndDate: Date | null;
      actualStartDate: Date | null;
      description: string | null;
      plannedEndDate: Date | null;
      plannedStartDate: Date | null;
      priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "DELAYED" | "CANCELLED";
      title: string;
    };
    recommendationId: string;
    sourceMessageId: string | null;
  }
): Promise<Milestone> {
  if (!input.payload.targetMilestoneId) {
    throw new Error("Milestone recommendation does not identify an existing milestone.");
  }
  const data: Prisma.MilestoneUpdateInput = {
    sourceMessage: input.sourceMessageId ? { connect: { id: input.sourceMessageId } } : undefined,
    sourceRecommendation: { connect: { id: input.recommendationId } },
    title: input.proposed.title
  };
  if (input.payload.description || input.editedFields.has("description"))
    data.description = input.proposed.description;
  if (input.payload.plannedStartDate || input.editedFields.has("plannedStartDate"))
    data.plannedStartDate = input.proposed.plannedStartDate;
  if (input.payload.plannedEndDate || input.editedFields.has("plannedEndDate"))
    data.plannedEndDate = input.proposed.plannedEndDate;
  if (
    input.payload.actualStartDate ||
    input.action === "START_MILESTONE" ||
    input.editedFields.has("actualStartDate")
  )
    data.actualStartDate = input.proposed.actualStartDate;
  if (
    input.payload.actualEndDate ||
    input.action === "COMPLETE_MILESTONE" ||
    input.editedFields.has("actualEndDate")
  )
    data.actualEndDate = input.proposed.actualEndDate;
  if (input.payload.proposedStatus || input.editedFields.has("status"))
    data.status = input.proposed.status;
  if (input.editedFields.has("priority")) data.priority = input.proposed.priority;
  if (input.action === "COMPLETE_MILESTONE") data.status = "COMPLETED";
  if (input.action === "START_MILESTONE") data.status = "IN_PROGRESS";

  return tx.milestone.update({
    data,
    where: { id: input.payload.targetMilestoneId }
  });
}

function milestoneEventType(
  action: Recommendation["proposedActionType"],
  milestone: Milestone
): string {
  if (action === "COMPLETE_MILESTONE" || milestone.status === "COMPLETED")
    return "MILESTONE_COMPLETED";
  if (action === "START_MILESTONE" || milestone.status === "IN_PROGRESS")
    return "MILESTONE_STARTED";
  if (action === "CREATE_MILESTONE") return "MILESTONE_CREATED";
  return "MILESTONE_UPDATED";
}

function milestoneEventTitle(
  action: Recommendation["proposedActionType"],
  milestone: Milestone
): string {
  if (action === "COMPLETE_MILESTONE" || milestone.status === "COMPLETED")
    return `Milestone completed: ${milestone.title}`;
  if (action === "START_MILESTONE" || milestone.status === "IN_PROGRESS")
    return `Milestone started: ${milestone.title}`;
  if (action === "CREATE_MILESTONE") return `Milestone scheduled: ${milestone.title}`;
  if (milestone.status === "DELAYED") return `Milestone delayed: ${milestone.title}`;
  return `Milestone updated: ${milestone.title}`;
}

function milestoneEventDescription(
  action: Recommendation["proposedActionType"],
  milestone: Milestone
): string {
  const date =
    action === "COMPLETE_MILESTONE"
      ? milestone.actualEndDate
      : action === "START_MILESTONE"
        ? milestone.actualStartDate
        : (milestone.plannedStartDate ?? milestone.plannedEndDate);
  return date
    ? `${milestoneEventTitle(action, milestone)} on ${date.toISOString().slice(0, 10)}.`
    : `${milestoneEventTitle(action, milestone)}.`;
}

function hasOwn(value: object | null | undefined, key: string): boolean {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
}

function getPayloadObject(value: Prisma.JsonValue): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function getStringPayload(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : null;
}
