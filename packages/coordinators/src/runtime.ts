import {
  Prisma,
  queueProjectCoordinatorJob,
  queueReportGenerationJob,
  type CoordinatorRun,
  type CoordinatorRunStatus,
  type CoordinatorType,
  type PrismaClient,
  type Project,
  type ProjectState,
  type ProjectStateHealth,
  type Recommendation,
  type RecommendationPriority,
  type WhatsAppDraft
} from "@fieldos/db";
import { createLogger } from "@fieldos/shared";

import type {
  CoordinatorOperationsMetrics,
  DraftSendResult,
  ProjectCoordinatorRunResult,
  ProjectCoordinatorRuntimeOptions,
  RecommendationApprovalResult,
  RecommendationInput,
  RecommendationWithProject,
  WhatsAppDraftSender
} from "./types.js";

const logger = createLogger("fieldos-coordinators");
const followUpThresholdMs = 48 * 60 * 60 * 1000;
const highFollowUpThresholdMs = 72 * 60 * 60 * 1000;
const urgentFollowUpThresholdMs = 5 * 24 * 60 * 60 * 1000;
const recommendationDedupWindowMs = 7 * 24 * 60 * 60 * 1000;
const inspectionPattern =
  /\b(ready for inspection|pending inspection|completed|complete|installed|testing required|ready to inspect)\b/i;

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
  lastActivityAt: Date | null;
  lastEvidenceAt: Date | null;
  lastReportAt: Date | null;
  lastWhatsAppUpdateAt: Date | null;
  openActionItemCount: number;
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

export class NoopWhatsAppDraftSender implements WhatsAppDraftSender {
  async send(): Promise<{ externalMessageId?: string | null }> {
    throw new Error("WhatsApp draft sending is not configured for this deployment.");
  }
}

export class ProjectCoordinatorRuntime {
  private readonly draftSender: WhatsAppDraftSender;
  private readonly now: () => Date;

  constructor(
    private readonly prisma: PrismaClient,
    options: ProjectCoordinatorRuntimeOptions = {}
  ) {
    this.draftSender = options.draftSender ?? new NoopWhatsAppDraftSender();
    this.now = options.now ?? (() => new Date());
  }

  async queueScheduledScan(): Promise<number> {
    const projects = await this.prisma.project.findMany({
      select: {
        id: true,
        organizationId: true
      },
      where: {
        status: "ACTIVE"
      }
    });

    for (const project of projects) {
      await queueProjectCoordinatorJob(this.prisma, {
        organizationId: project.organizationId,
        projectId: project.id,
        sourceId: project.id
      });
    }

    return projects.length;
  }

  async runProjectCoordinators(projectId: string): Promise<ProjectCoordinatorRunResult> {
    const project = await this.requireProject(projectId);
    const projectState = await this.rebuildProjectState(projectId);
    const coordinators: CoordinatorType[] = ["PROGRESS", "FOLLOW_UP", "INSPECTION", "REPORT"];
    const results = [];

    for (const coordinatorType of coordinators) {
      const run = await this.startRun(project, coordinatorType);

      try {
        const recommendationsCreated = await this.runCoordinator({
          coordinatorType,
          project,
          projectState
        });
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

  async rebuildProjectState(projectId: string): Promise<ProjectState> {
    const project = await this.requireProject(projectId);
    const context = await this.loadProjectContext(project);
    const health = determineHealth(context);
    const completionPercent = determineCompletionPercent(context);
    const summaries = buildProjectStateSummaries(context);

    return this.prisma.projectState.upsert({
      create: {
        completionPercent,
        health,
        highPriorityActionItemCount: context.highPriorityActionItemCount,
        lastActivityAt: context.lastActivityAt,
        lastEvidenceAt: context.lastEvidenceAt,
        lastReportAt: context.lastReportAt,
        lastWhatsAppUpdateAt: context.lastWhatsAppUpdateAt,
        metadata: {
          lastComputedAt: this.now().toISOString(),
          source: "deterministic"
        },
        openActionItemCount: context.openActionItemCount,
        organizationId: project.organizationId,
        pendingDecisionSummary: summaries.pendingDecisionSummary,
        projectId: project.id,
        recentBlockerSummary: summaries.recentBlockerSummary,
        recentEvidenceSummary: summaries.recentEvidenceSummary,
        recentProgressSummary: summaries.recentProgressSummary,
        recentRiskSummary: summaries.recentRiskSummary,
        urgentActionItemCount: context.urgentActionItemCount
      },
      update: {
        completionPercent,
        health,
        highPriorityActionItemCount: context.highPriorityActionItemCount,
        lastActivityAt: context.lastActivityAt,
        lastEvidenceAt: context.lastEvidenceAt,
        lastReportAt: context.lastReportAt,
        lastWhatsAppUpdateAt: context.lastWhatsAppUpdateAt,
        metadata: {
          lastComputedAt: this.now().toISOString(),
          source: "deterministic"
        },
        openActionItemCount: context.openActionItemCount,
        pendingDecisionSummary: summaries.pendingDecisionSummary,
        recentBlockerSummary: summaries.recentBlockerSummary,
        recentEvidenceSummary: summaries.recentEvidenceSummary,
        recentProgressSummary: summaries.recentProgressSummary,
        recentRiskSummary: summaries.recentRiskSummary,
        urgentActionItemCount: context.urgentActionItemCount
      },
      where: {
        projectId: project.id
      }
    });
  }

  async getProjectState(projectId: string): Promise<ProjectState> {
    const projectState = await this.prisma.projectState.findUnique({ where: { projectId } });
    return projectState ?? this.rebuildProjectState(projectId);
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

    switch (recommendation.proposedActionType) {
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
      await this.draftSender.send({
        conversationId: draft.conversationId,
        draftId: draft.id,
        messageBody: draft.messageBody,
        organizationId: draft.organizationId,
        projectId: draft.projectId,
        whatsappAccountId: draft.whatsappAccountId
      });
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
      recentRuns
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
      failedRunsToday,
      lastRunPerProject,
      pendingRecommendations,
      recommendationsCreatedToday,
      runsToday
    };
  }

  private async runCoordinator(input: {
    coordinatorType: CoordinatorType;
    project: Project;
    projectState: ProjectState;
  }): Promise<number> {
    switch (input.coordinatorType) {
      case "PROGRESS":
        return this.runProgressCoordinator(input.project);
      case "FOLLOW_UP":
        return this.runFollowUpCoordinator(input.project);
      case "INSPECTION":
        return this.runInspectionCoordinator(input.project);
      case "REPORT":
        return this.runReportCoordinator(input.project);
      case "RUNTIME":
        return 0;
    }
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
    const [events, messages, actionItems, photoAnalyses, reports, recommendations] =
      await Promise.all([
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
        })
      ]);
    const openActionItems = actionItems.filter((item) => item.status === "PENDING");
    const highPriorityActionItemCount = openActionItems.filter(
      (item) => item.priority === "HIGH"
    ).length;
    const urgentActionItemCount = openActionItems.filter(
      (item) => item.priority === "URGENT"
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
      highPriorityActionItemCount,
      lastActivityAt,
      lastEvidenceAt,
      lastReportAt,
      lastWhatsAppUpdateAt,
      openActionItemCount: openActionItems.length,
      openActionItems,
      photoAnalyses,
      project,
      recommendations,
      reports,
      urgentActionItemCount
    };
  }
}

function determineHealth(context: ProjectCoordinatorContext): ProjectStateHealth {
  if (!context.lastActivityAt) {
    return "UNKNOWN";
  }

  const lastActivityAgeMs = Date.now() - context.lastActivityAt.getTime();

  if (context.urgentActionItemCount > 0 || lastActivityAgeMs >= urgentFollowUpThresholdMs) {
    return "CRITICAL";
  }

  if (
    context.highPriorityActionItemCount > 0 ||
    context.openActionItemCount > 0 ||
    lastActivityAgeMs >= followUpThresholdMs
  ) {
    return "NEEDS_ATTENTION";
  }

  return "HEALTHY";
}

function determineCompletionPercent(context: ProjectCoordinatorContext): number {
  const progressSignals =
    context.events.filter((event) => /complete|progress|installed|approved/i.test(event.title))
      .length +
    context.photoAnalyses.length +
    context.reports.filter((report) => report.status === "COMPLETED").length * 2;
  const blockerPenalty = context.openActionItemCount * 3 + context.urgentActionItemCount * 5;

  return Math.max(0, Math.min(95, 10 + progressSignals * 6 - blockerPenalty));
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
