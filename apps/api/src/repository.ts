import type {
  AIClassificationStatus,
  AIMessageCategory,
  ActionItemPriority,
  ActionItemStatus,
  ActionItemType,
  EventSourceType,
  FeedbackType,
  MembershipRole,
  MilestonePriority,
  MilestoneSource,
  MilestoneStatus,
  ProcessingJobStatus,
  ProcessingJobType,
  PrismaClient,
  ProjectReportStatus,
  ProjectReportType,
  ProjectStatus,
  SearchDocumentSourceType,
  WorkerStatus,
  WhatsAppChatMappingStatus
} from "@fieldos/db";
import {
  getJobMetrics,
  getWorkerEffectiveStatus,
  buildProjectIntelligenceContext,
  buildUnifiedEvidenceContext,
  Prisma,
  retryFailedProcessingJobs,
  retryProcessingJob,
  queueAIClassificationJob,
  queueReportGenerationJob,
  queueSearchIndexJob,
  type EvidenceSummary,
  type UnifiedEvidenceContext
} from "@fieldos/db";
import {
  assessProjectHealth,
  type ProjectHealthStatus,
  type ProjectIntelligenceContext
} from "@fieldos/intelligence";
import type {
  AttachmentRecord,
  ConversationRecord,
  CreateAttachmentInput,
  CreateConversationInput,
  CreateMessageInput,
  CreateParticipantInput,
  MessageRecord,
  MessagingRepository,
  ParticipantRecord
} from "@fieldos/messaging";
import { randomUUID } from "node:crypto";

export type Role = MembershipRole;
export type Status = ProjectStatus;
export type ChatMappingStatus = WhatsAppChatMappingStatus;
export type AIStatus = AIClassificationStatus;
export type AICategory = AIMessageCategory;
export type ActionStatus = ActionItemStatus;
export type ActionType = ActionItemType;
export type ActionPriority = ActionItemPriority;
export type DashboardHealth = ProjectHealthStatus;
export type DashboardBriefSource = "AI" | "FALLBACK";
export type SearchSourceType = SearchDocumentSourceType;
export type JobType = ProcessingJobType;
export type JobStatus = ProcessingJobStatus;
export type WorkerHealthStatus = WorkerStatus;
export type ReportType = ProjectReportType;
export type ReportStatus = ProjectReportStatus;
export type PilotFeedbackType = FeedbackType;

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredUser extends SafeUser {
  passwordHash: string;
  sessionVersion: number;
}

export interface SessionUser extends SafeUser {
  sessionVersion: number;
}

export interface OrganizationRecord {
  id: string;
  isDemo: boolean;
  name: string;
  slug: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export interface MembershipRecord {
  allProjects: boolean;
  id: string;
  userId: string;
  organizationId: string;
  role: Role;
}

export interface ProjectRecord {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  status: Status;
  timezone?: string;
  createdAt: Date;
  updatedAt: Date;
  timelineEvents?: ProjectTimelineEventRecord[];
  whatsAppMessages?: ProjectWhatsAppMessageRecord[];
}

export interface ProjectTimelineEventRecord {
  id: string;
  organizationId: string;
  projectId: string | null;
  sourceType: EventSourceType;
  sourceId: string;
  eventType: string;
  title: string;
  description: string | null;
  occurredAt: Date;
  createdAt: Date;
}

export interface ProjectWhatsAppMessageRecord extends MessageRecord {
  conversation: {
    id: string;
    title: string;
  };
}

export interface WhatsAppAccountRecord {
  id: string;
  organizationId: string;
  displayName: string;
  phoneNumber: string | null;
  connectorType: "BAILEYS" | "META_CLOUD";
  status: "PENDING_QR" | "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR";
  sessionKey: string;
  lastConnectedAt: Date | null;
  lastDisconnectedAt: Date | null;
  disconnectedAt: Date | null;
  disconnectAlertSentAt: Date | null;
  recoveryAlertSentAt: Date | null;
  lastDisconnectReason: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhatsAppChatMappingRecord {
  id: string;
  organizationId: string;
  whatsappAccountId: string;
  conversationId: string | null;
  projectId: string | null;
  jid: string;
  chatName: string | null;
  isGroup: boolean;
  status: ChatMappingStatus;
  activatedAt: Date | null;
  activatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  project: {
    id: string;
    code: string;
    name: string;
  } | null;
  conversation: {
    id: string;
    title: string;
    projectId: string | null;
  } | null;
}

export interface AIMessageClassificationRecord {
  id: string;
  organizationId: string;
  projectId: string | null;
  messageId: string;
  category: AICategory | null;
  summary: string | null;
  location: string | null;
  actionRequired: boolean;
  confidence: number | null;
  reasoningSummary: string | null;
  status: AIStatus;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  message?: {
    id: string;
    body: string | null;
    occurredAt: Date;
    conversation: {
      id: string;
      title: string;
    };
  };
}

export interface ActionItemRecord {
  id: string;
  organizationId: string;
  projectId: string | null;
  messageId: string;
  classificationId: string | null;
  suggestedProjectId: string | null;
  type: ActionType;
  priority: ActionPriority;
  title: string;
  description: string | null;
  confidence: number | null;
  status: ActionStatus;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt: Date | null;
  acceptedByUserId: string | null;
  assignedToUserId: string | null;
  assignedToUser?: {
    id: string;
    name: string;
  } | null;
  completedAt: Date | null;
  ignoredAt: Date | null;
  ignoredByUserId: string | null;
  message?: {
    id: string;
    body: string | null;
    occurredAt: Date;
    conversation: {
      id: string;
      title: string;
    };
  };
  suggestedProject?: {
    code: string;
    id: string;
    name: string;
  } | null;
  project?: {
    code: string;
    id: string;
    name: string;
  } | null;
}

export interface MilestoneRecord {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  plannedStartDate: Date | null;
  plannedEndDate: Date | null;
  actualStartDate: Date | null;
  actualEndDate: Date | null;
  priority: MilestonePriority;
  source: MilestoneSource;
  createdByUserId: string | null;
  sourceRecommendationId: string | null;
  sourceMessageId: string | null;
  createdAt: Date;
  updatedAt: Date;
  project: {
    code: string;
    id: string;
    name: string;
  };
}

export interface DashboardSummaryRecord {
  activeProjects: number;
  healthyProjects: number;
  projectsNeedingAttention: number;
  criticalProjects: number;
  openActionItems: number;
  highPriorityActionItems: number;
  todaysActivityCount: number;
  pendingAIReviews: number;
}

export interface DashboardProjectRecord {
  id: string;
  code: string;
  name: string;
  status: Status;
  health: DashboardHealth;
  healthReason: string;
  lastActivityAt: Date | null;
  highestPriorityIssue: string | null;
  openActionItemCount: number;
  rankScore: number;
}

export interface DashboardActionItemGroupsRecord {
  completed: ActionItemRecord[];
  urgent: ActionItemRecord[];
  high: ActionItemRecord[];
  medium: ActionItemRecord[];
  low: ActionItemRecord[];
}

export interface DashboardRecentActivityRecord {
  conversationId: string | null;
  description: string | null;
  id: string;
  projectId: string;
  projectName: string;
  sourceId: string;
  sourceType: EventSourceType;
  eventType: string;
  icon: string;
  title: string;
  occurredAt: Date;
}

export interface DashboardBriefRecord {
  bullets: string[];
  generatedBy: DashboardBriefSource;
}

export interface OperationsDashboardRecord {
  summary: DashboardSummaryRecord;
  projects: DashboardProjectRecord[];
  actionItems: DashboardActionItemGroupsRecord;
  recentActivity: DashboardRecentActivityRecord[];
  milestones: MilestoneRecord[];
  brief: DashboardBriefRecord;
}

export interface SearchDocumentRecord {
  id: string;
  organizationId: string;
  projectId: string | null;
  sourceType: SearchSourceType;
  sourceId: string;
  title: string;
  snippet: string;
  metadata: unknown;
  occurredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project: {
    code: string;
    id: string;
    name: string;
  } | null;
}

export interface SearchDocumentsResult {
  results: SearchDocumentRecord[];
  nextCursor: string | null;
}

export interface PhotoAnalysisRecord {
  id: string;
  evidenceId: string;
  organizationId: string;
  projectId: string | null;
  conversationId: string;
  messageId: string;
  provider: string;
  summary: string;
  detectedObjects: string[];
  possibleIssues: string[];
  confidence: number;
  tags: string[];
  observations: string[];
  limitations: string[];
  senderClaim: string | null;
  claimAssessment: string;
  operationalConclusion: string;
  createdAt: Date;
  evidence: {
    filename: string;
    mimeType: string;
    storageKey: string;
  };
  message: {
    id: string;
    body: string | null;
    occurredAt: Date;
    conversation: {
      id: string;
      title: string;
    };
  };
  project: {
    code: string;
    id: string;
    name: string;
  } | null;
}

export interface PhotoAnalysisPageRecord {
  analyses: PhotoAnalysisRecord[];
  nextCursor: string | null;
}

export interface ProjectReportRecord {
  id: string;
  organizationId: string;
  projectId: string;
  type: ReportType;
  status: ReportStatus;
  title: string;
  content: unknown;
  markdown: string | null;
  pdfStorageKey: string | null;
  contentHash: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  generatedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecentProjectReportRecord extends ProjectReportRecord {
  project: {
    code: string;
    id: string;
    name: string;
  };
}

export interface EvidenceViewRecord {
  id: string;
  actionItems: ActionItemRecord[];
  conversation: {
    id: string;
    title: string;
  };
  createdAt: Date;
  filename: string;
  message: {
    body: string | null;
    id: string;
    occurredAt: Date;
  };
  mimeType: string;
  organizationId: string;
  photoAnalysis: PhotoAnalysisRecord | null;
  project: {
    code: string;
    id: string;
    name: string;
  } | null;
  signedUrl?: string;
  size: number;
  sourceWhatsAppMessage: {
    conversationTitle: string;
    messageId: string;
  };
  storageKey: string;
  timelineEvents: Array<{
    id: string;
    title: string;
    description: string | null;
    occurredAt: Date;
  }>;
  transcript: string | null;
  transcriptionStatus: string;
}

export interface ProcessingJobRecord {
  id: string;
  organizationId: string;
  projectId: string | null;
  type: JobType;
  status: JobStatus;
  sourceType: string;
  sourceId: string;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  correlationId: string;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkerHeartbeatRecord {
  id: string;
  workerName: string;
  version: string;
  status: WorkerHealthStatus;
  lastHeartbeatAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobMetricsRecord {
  completedToday: number;
  failed: number;
  pending: number;
  running: number;
  type: JobType;
}

export interface AdminOperationsRecord {
  ai: {
    averageProcessingTimeMs: number | null;
    failuresToday: number;
    jobsPending: number;
  };
  jobSummary: JobMetricsRecord[];
  media: {
    failedDownloads: number;
    pendingDownloads: number;
    pendingPhotoAnalyses: number;
    pendingTranscriptions: number;
  };
  search: {
    completedToday: number;
    pendingIndexJobs: number;
  };
  whatsApp: {
    connectedAccounts: number;
    disconnectedAccounts: number;
    failedConnections: number;
    qrPending: number;
  };
  workers: WorkerHeartbeatRecord[];
}

export interface OnboardingStepRecord {
  completed: boolean;
  href: string;
  key:
    | "CREATE_ORGANIZATION"
    | "CREATE_PROJECT"
    | "CONNECT_WHATSAPP"
    | "ACTIVATE_GROUP"
    | "SEND_UPDATE"
    | "OPEN_COMMAND_CENTER";
  label: string;
}

export interface OnboardingStateRecord {
  organizationId: string;
  isDemo: boolean;
  progress: number;
  steps: OnboardingStepRecord[];
}

export interface UserFeedbackRecord {
  id: string;
  organizationId: string;
  userId: string;
  type: PilotFeedbackType;
  message: string;
  page: string | null;
  status: string;
  createdAt: Date;
}

export interface UserNotificationRecord {
  id: string;
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface DemoWorkspaceRecord {
  organization: OrganizationRecord;
  projects: ProjectRecord[];
  conversations: ConversationRecord[];
}

export interface AppRepository extends MessagingRepository {
  createOrganization(input: {
    name: string;
    ownerUserId: string;
    slug: string;
  }): Promise<OrganizationRecord>;
  createProject(input: {
    code: string;
    name: string;
    organizationId: string;
    status: Status;
    timezone?: string;
  }): Promise<ProjectRecord>;
  createUser(input: { email: string; name: string; passwordHash: string }): Promise<SafeUser>;
  createPasswordResetToken(input: {
    expiresAt: Date;
    tokenHash: string;
    userId: string;
  }): Promise<void>;
  disconnect(): Promise<void>;
  findMembership(userId: string, organizationId: string): Promise<MembershipRecord | null>;
  findProjectForUser(userId: string, projectId: string): Promise<ProjectRecord | null>;
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<SessionUser | null>;
  resetPasswordWithToken(input: {
    now: Date;
    passwordHash: string;
    tokenHash: string;
  }): Promise<boolean>;
  updateUserPassword(input: { passwordHash: string; userId: string }): Promise<void>;
  getOrganizationForUser(
    userId: string,
    organizationId: string
  ): Promise<OrganizationRecord | null>;
  activateWhatsAppChatMapping(input: {
    activatedByUserId: string;
    mappingId: string;
    projectId: string | null;
  }): Promise<WhatsAppChatMappingRecord>;
  archiveWhatsAppChatMapping(mappingId: string): Promise<WhatsAppChatMappingRecord>;
  createWhatsAppAccount(input: {
    displayName: string;
    organizationId: string;
  }): Promise<WhatsAppAccountRecord>;
  getWhatsAppAccount(accountId: string): Promise<WhatsAppAccountRecord | null>;
  getWhatsAppChatMapping(mappingId: string): Promise<WhatsAppChatMappingRecord | null>;
  ignoreWhatsAppChatMapping(mappingId: string): Promise<WhatsAppChatMappingRecord>;
  listWhatsAppAccounts(organizationId: string): Promise<WhatsAppAccountRecord[]>;
  listWhatsAppChatMappings(accountId: string): Promise<WhatsAppChatMappingRecord[]>;
  listOrganizations(userId: string): Promise<OrganizationRecord[]>;
  listProjects(userId: string, organizationId: string): Promise<ProjectRecord[]>;
  acceptActionItem(input: { actionItemId: string; userId: string }): Promise<ActionItemRecord>;
  assignActionItem(input: {
    actionItemId: string;
    assignedToUserId: string | null;
  }): Promise<ActionItemRecord>;
  completeActionItem(input: { actionItemId: string; userId: string }): Promise<ActionItemRecord>;
  enqueueMessageClassification(messageId: string): Promise<AIMessageClassificationRecord | null>;
  getMessageClassification(messageId: string): Promise<AIMessageClassificationRecord | null>;
  listMessageActionItems(messageId: string): Promise<ActionItemRecord[]>;
  getMessageEvidenceContext(messageId: string): Promise<UnifiedEvidenceContext | null>;
  getMessageEvidenceSummary(messageId: string): Promise<EvidenceSummary | null>;
  getPhotoAnalysis(photoAnalysisId: string): Promise<PhotoAnalysisRecord | null>;
  getPhotoAnalysisByEvidenceId(evidenceId: string): Promise<PhotoAnalysisRecord | null>;
  getProjectIntelligenceContext(projectId: string): Promise<ProjectIntelligenceContext | null>;
  getLatestProjectReport(input: {
    projectId: string;
    type: ReportType;
  }): Promise<ProjectReportRecord | null>;
  listRecentProjectReports(input: {
    limit: number;
    organizationId: string;
  }): Promise<RecentProjectReportRecord[]>;
  getEvidenceView(evidenceId: string): Promise<EvidenceViewRecord | null>;
  queueProjectReport(input: { projectId: string; type: ReportType }): Promise<ProjectReportRecord>;
  getActionItem(actionItemId: string): Promise<ActionItemRecord | null>;
  getOperationsDashboard(input: {
    organizationId: string;
    userId: string;
  }): Promise<OperationsDashboardRecord>;
  getAdminOperations(organizationId: string): Promise<AdminOperationsRecord>;
  createFeedback(input: {
    message: string;
    organizationId: string;
    page?: string;
    type: PilotFeedbackType;
    userId: string;
  }): Promise<UserFeedbackRecord>;
  createNotification(input: {
    body?: string | null;
    href?: string | null;
    organizationId: string;
    title: string;
    type: string;
    userId: string;
  }): Promise<UserNotificationRecord>;
  getOnboardingState(organizationId: string): Promise<OnboardingStateRecord>;
  listNotifications(input: {
    organizationId: string;
    userId: string;
  }): Promise<UserNotificationRecord[]>;
  markNotificationRead(input: {
    notificationId: string;
    userId: string;
  }): Promise<UserNotificationRecord | null>;
  recordAnalyticsEvent(input: {
    eventName: string;
    metadata?: Prisma.InputJsonValue;
    organizationId?: string | null;
    userId?: string | null;
  }): Promise<void>;
  resetDemoWorkspace(userId: string): Promise<DemoWorkspaceRecord>;
  getProcessingJob(jobId: string): Promise<ProcessingJobRecord | null>;
  listProcessingJobs(organizationId: string): Promise<ProcessingJobRecord[]>;
  listWorkerHeartbeats(): Promise<WorkerHeartbeatRecord[]>;
  retryProcessingJob(jobId: string): Promise<ProcessingJobRecord>;
  retryFailedProcessingJobs(organizationId: string): Promise<number>;
  searchDocuments(input: {
    cursor?: string | null;
    dateFrom?: Date | null;
    dateTo?: Date | null;
    limit: number;
    organizationId: string;
    projectId?: string | null;
    query: string;
    sourceType?: SearchSourceType | null;
  }): Promise<SearchDocumentsResult>;
  listProjectAIClassifications(projectId: string): Promise<AIMessageClassificationRecord[]>;
  listProjectPhotoAnalyses(input: {
    cursor?: string | null;
    limit: number;
    projectId: string;
  }): Promise<PhotoAnalysisPageRecord>;
  listProjectActionItems(projectId: string): Promise<ActionItemRecord[]>;
  ignoreActionItem(input: { actionItemId: string; userId: string }): Promise<ActionItemRecord>;
  rotateWhatsAppAccountSession(accountId: string): Promise<WhatsAppAccountRecord>;
  updateWhatsAppAccountStatus(
    accountId: string,
    status: WhatsAppAccountRecord["status"]
  ): Promise<WhatsAppAccountRecord>;
  updateWhatsAppChatMapping(input: {
    mappingId: string;
    projectId: string | null;
  }): Promise<WhatsAppChatMappingRecord>;
}

export function createPrismaRepository(): AppRepository {
  let prismaPromise: Promise<PrismaClient> | null = null;

  function getPrisma(): Promise<PrismaClient> {
    prismaPromise ??= import("@fieldos/db").then((module) => module.prisma);
    return prismaPromise;
  }

  return {
    async createOrganization(input) {
      const prisma = await getPrisma();
      const result = await prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            name: input.name,
            slug: input.slug
          }
        });

        const membership = await tx.membership.create({
          data: {
            organizationId: organization.id,
            role: "OWNER",
            userId: input.ownerUserId
          }
        });

        return { membership, organization };
      });

      return {
        ...result.organization,
        role: result.membership.role
      };
    },

    async createProject(input) {
      const prisma = await getPrisma();
      return prisma.$transaction(async (tx) => {
        const project = await tx.project.create({
          data: input
        });

        await queueSearchIndexJob(tx, {
          organizationId: project.organizationId,
          projectId: project.id,
          sourceId: project.id,
          sourceType: "PROJECT"
        });

        return project;
      });
    },

    async createUser(input) {
      const prisma = await getPrisma();
      const user = await prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash: input.passwordHash
        }
      });

      return toSafeUser(user);
    },

    async createPasswordResetToken(input) {
      const prisma = await getPrisma();
      await prisma.$transaction([
        prisma.passwordResetToken.deleteMany({
          where: {
            userId: input.userId
          }
        }),
        prisma.passwordResetToken.create({
          data: input
        })
      ]);
    },

    async disconnect() {
      const prisma = await getPrisma();
      await prisma.$disconnect();
    },

    async findMembership(userId, organizationId) {
      const prisma = await getPrisma();
      return prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            organizationId,
            userId
          }
        }
      });
    },

    async findProjectForUser(userId, projectId) {
      const prisma = await getPrisma();
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          organization: {
            memberships: {
              some: {
                OR: [{ allProjects: true }, { projectAccess: { some: { projectId } } }],
                userId
              }
            }
          }
        }
      });

      if (!project) {
        return null;
      }

      const [timelineEvents, whatsAppMessages] = await Promise.all([
        prisma.event.findMany({
          orderBy: {
            occurredAt: "desc"
          },
          take: 8,
          where: {
            projectId: project.id
          }
        }),
        prisma.message.findMany({
          include: {
            ...messageInclude(),
            conversation: {
              select: {
                id: true,
                title: true
              }
            }
          },
          orderBy: {
            occurredAt: "desc"
          },
          take: 8,
          where: {
            conversation: {
              channel: "WHATSAPP",
              projectId: project.id
            }
          }
        })
      ]);

      return {
        ...project,
        timelineEvents,
        whatsAppMessages: whatsAppMessages.map((message) => ({
          ...toMessageRecord(message),
          conversation: message.conversation
        }))
      };
    },

    async findUserByEmail(email) {
      const prisma = await getPrisma();
      return prisma.user.findUnique({
        where: {
          email: normalizeEmail(email)
        }
      });
    },

    async findUserById(id) {
      const prisma = await getPrisma();
      const user = await prisma.user.findUnique({
        where: {
          id
        }
      });

      return user
        ? {
            ...toSafeUser(user),
            sessionVersion: user.sessionVersion
          }
        : null;
    },

    async resetPasswordWithToken(input) {
      const prisma = await getPrisma();
      return prisma.$transaction(async (tx) => {
        const token = await tx.passwordResetToken.findUnique({
          where: {
            tokenHash: input.tokenHash
          }
        });

        if (!token || token.consumedAt || token.expiresAt <= input.now) {
          return false;
        }

        const consumed = await tx.passwordResetToken.updateMany({
          data: {
            consumedAt: input.now
          },
          where: {
            consumedAt: null,
            id: token.id
          }
        });

        if (consumed.count !== 1) {
          return false;
        }

        await tx.user.update({
          data: {
            passwordHash: input.passwordHash,
            sessionVersion: {
              increment: 1
            }
          },
          where: {
            id: token.userId
          }
        });
        await tx.passwordResetToken.updateMany({
          data: {
            consumedAt: input.now
          },
          where: {
            consumedAt: null,
            userId: token.userId
          }
        });

        return true;
      });
    },

    async updateUserPassword(input) {
      const prisma = await getPrisma();
      await prisma.user.update({
        data: {
          passwordHash: input.passwordHash,
          sessionVersion: {
            increment: 1
          }
        },
        where: {
          id: input.userId
        }
      });
      await prisma.passwordResetToken.updateMany({
        data: {
          consumedAt: new Date()
        },
        where: {
          consumedAt: null,
          userId: input.userId
        }
      });
    },

    async getOrganizationForUser(userId, organizationId) {
      const prisma = await getPrisma();
      const membership = await prisma.membership.findUnique({
        include: {
          organization: true
        },
        where: {
          userId_organizationId: {
            organizationId,
            userId
          }
        }
      });

      return membership
        ? {
            ...membership.organization,
            role: membership.role
          }
        : null;
    },

    async listOrganizations(userId) {
      const prisma = await getPrisma();
      const memberships = await prisma.membership.findMany({
        include: {
          organization: true
        },
        orderBy: {
          createdAt: "asc"
        },
        where: {
          userId
        }
      });

      return memberships.map((membership) => ({
        ...membership.organization,
        role: membership.role
      }));
    },

    async listProjects(userId, organizationId) {
      const prisma = await getPrisma();
      const membership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            organizationId,
            userId
          }
        }
      });

      if (!membership) {
        return [];
      }

      return prisma.project.findMany({
        orderBy: {
          createdAt: "desc"
        },
        where: {
          organizationId,
          ...(membership.allProjects
            ? {}
            : { projectAccess: { some: { membershipId: membership.id } } })
        }
      });
    },

    async acceptActionItem(input) {
      const prisma = await getPrisma();
      return prisma.$transaction(async (tx) => {
        const existing = await tx.actionItem.findUnique({
          include: {
            message: {
              select: {
                conversationId: true
              }
            }
          },
          where: {
            id: input.actionItemId
          }
        });

        if (!existing) {
          throw new Error("Action item not found.");
        }

        if (existing.type === "PROJECT_SUGGESTION" && existing.suggestedProjectId) {
          await tx.conversation.update({
            data: {
              projectId: existing.suggestedProjectId
            },
            where: {
              id: existing.message.conversationId
            }
          });

          await tx.whatsAppChatMapping.updateMany({
            data: {
              projectId: existing.suggestedProjectId
            },
            where: {
              conversationId: existing.message.conversationId
            }
          });
        }

        return tx.actionItem.update({
          data: {
            acceptedAt: new Date(),
            acceptedByUserId: input.userId,
            assignedToUserId: existing.assignedToUserId ?? input.userId,
            completedAt: null,
            ignoredAt: null,
            ignoredByUserId: null,
            projectId: existing.suggestedProjectId ?? existing.projectId,
            status: "ACCEPTED"
          },
          include: actionItemInclude(),
          where: {
            id: input.actionItemId
          }
        });
      });
    },

    async assignActionItem(input) {
      const prisma = await getPrisma();
      return prisma.actionItem.update({
        data: {
          assignedToUserId: input.assignedToUserId
        },
        include: actionItemInclude(),
        where: {
          id: input.actionItemId
        }
      });
    },

    async completeActionItem(input) {
      const prisma = await getPrisma();
      void input.userId;
      return prisma.actionItem.update({
        data: {
          completedAt: new Date(),
          status: "COMPLETED"
        },
        include: actionItemInclude(),
        where: {
          id: input.actionItemId
        }
      });
    },

    async enqueueMessageClassification(messageId) {
      const prisma = await getPrisma();
      const message = await prisma.message.findUnique({
        select: {
          conversation: {
            select: {
              organizationId: true,
              projectId: true
            }
          },
          id: true
        },
        where: {
          id: messageId
        }
      });

      if (!message) {
        return null;
      }

      return prisma.$transaction(async (tx) => {
        const classification = await tx.aIMessageClassification.upsert({
          create: {
            messageId,
            organizationId: message.conversation.organizationId,
            projectId: message.conversation.projectId,
            status: "PENDING"
          },
          update: {
            errorMessage: null,
            projectId: message.conversation.projectId,
            status: "PENDING"
          },
          where: {
            messageId
          }
        });

        await tx.message.update({
          data: {
            processingStatus: "AI_PENDING"
          },
          where: {
            id: messageId
          }
        });

        await queueAIClassificationJob(tx, {
          organizationId: classification.organizationId,
          projectId: classification.projectId,
          sourceId: classification.id
        });

        return classification;
      });
    },

    async getMessageClassification(messageId) {
      const prisma = await getPrisma();
      return prisma.aIMessageClassification.findUnique({
        where: {
          messageId
        }
      });
    },

    async listMessageActionItems(messageId) {
      const prisma = await getPrisma();
      return prisma.actionItem.findMany({
        include: actionItemInclude(),
        orderBy: {
          createdAt: "desc"
        },
        where: {
          messageId
        }
      });
    },

    async getMessageEvidenceContext(messageId) {
      const prisma = await getPrisma();
      return buildUnifiedEvidenceContext(prisma, messageId);
    },

    async getMessageEvidenceSummary(messageId) {
      const context = await this.getMessageEvidenceContext(messageId);
      return context?.evidenceSummary ?? null;
    },

    async getPhotoAnalysis(photoAnalysisId) {
      const prisma = await getPrisma();
      const analysis = await prisma.photoAnalysis.findUnique({
        include: photoAnalysisInclude(),
        where: {
          id: photoAnalysisId
        }
      });

      return analysis ? toPhotoAnalysisRecord(analysis) : null;
    },

    async getPhotoAnalysisByEvidenceId(evidenceId) {
      const prisma = await getPrisma();
      const analysis = await prisma.photoAnalysis.findUnique({
        include: photoAnalysisInclude(),
        where: {
          evidenceId
        }
      });

      return analysis ? toPhotoAnalysisRecord(analysis) : null;
    },

    async getProjectIntelligenceContext(projectId) {
      const prisma = await getPrisma();
      return buildProjectIntelligenceContext(prisma, projectId);
    },

    async getLatestProjectReport(input) {
      const prisma = await getPrisma();
      const report = await prisma.projectReport.findFirst({
        orderBy: {
          createdAt: "desc"
        },
        where: {
          projectId: input.projectId,
          type: input.type
        }
      });

      return report ? toProjectReportRecord(report) : null;
    },

    async listRecentProjectReports(input) {
      const prisma = await getPrisma();
      const reports = await prisma.projectReport.findMany({
        include: {
          project: {
            select: {
              code: true,
              id: true,
              name: true
            }
          }
        },
        orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
        take: input.limit,
        where: {
          organizationId: input.organizationId,
          status: "COMPLETED"
        }
      });

      return reports.map(toRecentProjectReportRecord);
    },

    async queueProjectReport(input) {
      const prisma = await getPrisma();
      const existing = await prisma.projectReport.findFirst({
        orderBy: {
          createdAt: "desc"
        },
        where: {
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000)
          },
          projectId: input.projectId,
          status: {
            in: ["COMPLETED", "PENDING", "RUNNING"]
          },
          type: input.type
        }
      });

      if (existing) {
        return toProjectReportRecord(existing);
      }

      const project = await prisma.project.findUniqueOrThrow({
        select: {
          code: true,
          name: true,
          organizationId: true
        },
        where: {
          id: input.projectId
        }
      });
      const periodEnd = new Date();
      const periodStart = new Date(
        periodEnd.getTime() - reportLookbackDays(input.type) * 24 * 60 * 60 * 1000
      );

      return prisma.$transaction(async (tx) => {
        const report = await tx.projectReport.create({
          data: {
            organizationId: project.organizationId,
            periodEnd,
            periodStart,
            projectId: input.projectId,
            status: "PENDING",
            title: reportTitle(project.name, input.type),
            type: input.type
          }
        });

        await queueReportGenerationJob(tx, {
          organizationId: project.organizationId,
          projectId: input.projectId,
          sourceId: report.id
        });

        return toProjectReportRecord(report);
      });
    },

    async getEvidenceView(evidenceId) {
      const prisma = await getPrisma();
      const attachment = await prisma.attachment.findUnique({
        include: {
          message: {
            include: {
              actionItems: {
                include: actionItemInclude()
              },
              conversation: {
                include: {
                  project: {
                    select: {
                      code: true,
                      id: true,
                      name: true
                    }
                  }
                }
              }
            }
          },
          photoAnalysis: {
            include: photoAnalysisInclude()
          }
        },
        where: {
          id: evidenceId
        }
      });

      if (!attachment) {
        return null;
      }

      const timelineEvents = await prisma.event.findMany({
        orderBy: {
          occurredAt: "desc"
        },
        take: 20,
        where: {
          OR: [
            {
              sourceId: attachment.messageId,
              sourceType: "MESSAGE"
            },
            {
              sourceId: attachment.id
            }
          ]
        }
      });

      return {
        actionItems: attachment.message.actionItems,
        conversation: {
          id: attachment.message.conversation.id,
          title: attachment.message.conversation.title
        },
        createdAt: attachment.createdAt,
        filename: attachment.filename,
        id: attachment.id,
        message: {
          body: attachment.message.body,
          id: attachment.message.id,
          occurredAt: attachment.message.occurredAt
        },
        mimeType: attachment.mimeType,
        organizationId: attachment.message.conversation.organizationId,
        photoAnalysis: attachment.photoAnalysis
          ? toPhotoAnalysisRecord(attachment.photoAnalysis)
          : null,
        project: attachment.message.conversation.project,
        size: attachment.size,
        sourceWhatsAppMessage: {
          conversationTitle: attachment.message.conversation.title,
          messageId: attachment.message.id
        },
        storageKey: attachment.storageKey,
        timelineEvents: timelineEvents.map((event) => ({
          description: event.description,
          id: event.id,
          occurredAt: event.occurredAt,
          title: event.title
        })),
        transcript: attachment.transcript,
        transcriptionStatus: attachment.transcriptionStatus
      };
    },

    async getActionItem(actionItemId) {
      const prisma = await getPrisma();
      return prisma.actionItem.findUnique({
        include: actionItemInclude(),
        where: {
          id: actionItemId
        }
      });
    },

    async getOperationsDashboard(input) {
      const prisma = await getPrisma();
      const todayStart = getUtcDayStart(new Date());
      const membership = await prisma.membership.findUnique({
        include: { projectAccess: { select: { projectId: true } } },
        where: {
          userId_organizationId: {
            organizationId: input.organizationId,
            userId: input.userId
          }
        }
      });
      const allowedProjectIds = membership?.allProjects
        ? null
        : (membership?.projectAccess.map(({ projectId }) => projectId) ?? []);
      const projectIdFilter = allowedProjectIds ? { in: allowedProjectIds } : undefined;

      const [projects, actionItems, classifications, events, milestones, pendingAIReviews] =
        await Promise.all([
          prisma.project.findMany({
            orderBy: {
              updatedAt: "desc"
            },
            where: {
              organizationId: input.organizationId,
              ...(projectIdFilter ? { id: projectIdFilter } : {})
            }
          }),
          prisma.actionItem.findMany({
            include: actionItemInclude(),
            orderBy: {
              updatedAt: "desc"
            },
            take: 250,
            where: {
              organizationId: input.organizationId,
              ...(projectIdFilter ? { projectId: projectIdFilter } : {})
            }
          }),
          prisma.aIMessageClassification.findMany({
            orderBy: {
              createdAt: "desc"
            },
            take: 250,
            where: {
              organizationId: input.organizationId,
              ...(projectIdFilter ? { projectId: projectIdFilter } : {})
            }
          }),
          prisma.event.findMany({
            include: {
              project: {
                select: {
                  code: true,
                  id: true,
                  name: true
                }
              }
            },
            orderBy: {
              occurredAt: "desc"
            },
            take: 12,
            where: {
              organizationId: input.organizationId,
              projectId: {
                ...(projectIdFilter ?? { not: null })
              },
              sourceType: {
                in: ["MESSAGE", "ACTION_ITEM", "MILESTONE", "REPORT"]
              }
            }
          }),
          prisma.milestone.findMany({
            include: {
              project: {
                select: {
                  code: true,
                  id: true,
                  name: true
                }
              }
            },
            orderBy: [{ plannedEndDate: "asc" }, { plannedStartDate: "asc" }],
            take: 12,
            where: {
              organizationId: input.organizationId,
              ...(projectIdFilter ? { projectId: projectIdFilter } : {}),
              status: { notIn: ["CANCELLED", "COMPLETED"] }
            }
          }),
          prisma.aIMessageClassification.count({
            where: {
              organizationId: input.organizationId,
              ...(projectIdFilter ? { projectId: projectIdFilter } : {}),
              status: {
                in: ["PENDING", "NEEDS_REVIEW"]
              }
            }
          })
        ]);

      const dashboardProjects = projects
        .filter((project) => project.status === "ACTIVE")
        .map((project) =>
          buildDashboardProject({
            actionItems,
            classifications,
            events,
            milestones,
            project
          })
        )
        .sort(
          (left, right) => right.rankScore - left.rankScore || left.name.localeCompare(right.name)
        );

      const openActionItems = actionItems.filter(isOpenActionItem);
      const highPriorityActionItems = openActionItems.filter((actionItem) =>
        ["HIGH", "URGENT"].includes(actionItem.priority)
      );
      const todaysActivityCount = events.filter(
        (event) => event.occurredAt.getTime() >= todayStart.getTime()
      ).length;
      const visibleActionItems = actionItems.filter(
        (actionItem) => isOpenActionItem(actionItem) || actionItem.status === "COMPLETED"
      );

      const summary: DashboardSummaryRecord = {
        activeProjects: dashboardProjects.length,
        criticalProjects: dashboardProjects.filter((project) => project.health === "CRITICAL")
          .length,
        healthyProjects: dashboardProjects.filter((project) => project.health === "HEALTHY").length,
        highPriorityActionItems: highPriorityActionItems.length,
        openActionItems: openActionItems.length,
        pendingAIReviews,
        projectsNeedingAttention: dashboardProjects.filter(
          (project) => project.health === "NEEDS_ATTENTION"
        ).length,
        todaysActivityCount
      };

      const messageSourceIds = events
        .filter((event) => event.sourceType === "MESSAGE")
        .map((event) => event.sourceId);
      const messageContexts =
        messageSourceIds.length > 0
          ? await prisma.message.findMany({
              select: {
                conversationId: true,
                id: true
              },
              where: {
                id: {
                  in: messageSourceIds
                }
              }
            })
          : [];
      const conversationByMessageId = new Map(
        messageContexts.map((message) => [message.id, message.conversationId])
      );
      const recentActivity = events
        .filter((event) => event.project)
        .map((event) => ({
          conversationId:
            event.sourceType === "MESSAGE"
              ? (conversationByMessageId.get(event.sourceId) ?? null)
              : null,
          description: event.description,
          eventType: event.eventType,
          icon: getActivityIcon(event.sourceType),
          id: event.id,
          occurredAt: event.occurredAt,
          projectId: event.project?.id ?? "",
          projectName: event.project?.name ?? "Unknown project",
          sourceId: event.sourceId,
          sourceType: event.sourceType,
          title: event.title
        }));

      return {
        actionItems: groupActionItems(visibleActionItems),
        brief: buildFallbackBrief(summary, dashboardProjects, milestones, events),
        milestones,
        projects: dashboardProjects,
        recentActivity,
        summary
      };
    },

    async getAdminOperations(organizationId) {
      const prisma = await getPrisma();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [jobSummary, workers, whatsappCounts, aiPending, aiFailuresToday, aiCompletedToday] =
        await Promise.all([
          getJobMetrics(prisma, organizationId),
          prisma.workerHeartbeat.findMany({
            orderBy: {
              workerName: "asc"
            }
          }),
          prisma.whatsAppAccount.groupBy({
            by: ["status"],
            _count: true,
            where: {
              organizationId
            }
          }),
          prisma.processingJob.count({
            where: {
              organizationId,
              status: "PENDING",
              type: "AI_CLASSIFICATION"
            }
          }),
          prisma.processingJob.count({
            where: {
              failedAt: {
                gte: today
              },
              organizationId,
              status: "FAILED",
              type: "AI_CLASSIFICATION"
            }
          }),
          prisma.processingJob.findMany({
            select: {
              completedAt: true,
              startedAt: true
            },
            where: {
              completedAt: {
                gte: today
              },
              organizationId,
              status: "COMPLETED",
              type: "AI_CLASSIFICATION"
            }
          })
        ]);

      const byJobType = new Map(jobSummary.map((row) => [row.type, row]));
      const countWhatsApp = (status: WhatsAppAccountRecord["status"]) =>
        whatsappCounts.find((row) => row.status === status)?._count ?? 0;
      const completedAIWithDurations = aiCompletedToday.filter(
        (job) => job.startedAt && job.completedAt
      );
      const averageProcessingTimeMs =
        completedAIWithDurations.length > 0
          ? Math.round(
              completedAIWithDurations.reduce(
                (total, job) =>
                  total + (job.completedAt?.getTime() ?? 0) - (job.startedAt?.getTime() ?? 0),
                0
              ) / completedAIWithDurations.length
            )
          : null;

      return {
        ai: {
          averageProcessingTimeMs,
          failuresToday: aiFailuresToday,
          jobsPending: aiPending
        },
        jobSummary,
        media: {
          failedDownloads: byJobType.get("MEDIA_DOWNLOAD")?.failed ?? 0,
          pendingDownloads: byJobType.get("MEDIA_DOWNLOAD")?.pending ?? 0,
          pendingPhotoAnalyses: byJobType.get("PHOTO_ANALYSIS")?.pending ?? 0,
          pendingTranscriptions: byJobType.get("VOICE_TRANSCRIPTION")?.pending ?? 0
        },
        search: {
          completedToday: byJobType.get("SEARCH_INDEX")?.completedToday ?? 0,
          pendingIndexJobs: byJobType.get("SEARCH_INDEX")?.pending ?? 0
        },
        whatsApp: {
          connectedAccounts: countWhatsApp("CONNECTED"),
          disconnectedAccounts: countWhatsApp("DISCONNECTED"),
          failedConnections: countWhatsApp("ERROR"),
          qrPending: countWhatsApp("PENDING_QR")
        },
        workers: workers.map((worker) => ({
          ...worker,
          status: getWorkerEffectiveStatus(worker)
        }))
      };
    },

    async createFeedback(input) {
      const prisma = await getPrisma();
      return prisma.userFeedback.create({
        data: {
          message: input.message,
          organizationId: input.organizationId,
          page: input.page ?? null,
          type: input.type,
          userId: input.userId
        }
      });
    },

    async createNotification(input) {
      const prisma = await getPrisma();
      return prisma.userNotification.create({
        data: {
          body: input.body ?? null,
          href: input.href ?? null,
          organizationId: input.organizationId,
          title: input.title,
          type: input.type,
          userId: input.userId
        }
      });
    },

    async getOnboardingState(organizationId) {
      const prisma = await getPrisma();
      const [organization, projectCount, connectedAccountCount, activeChatCount, messageCount] =
        await Promise.all([
          prisma.organization.findUnique({
            select: {
              id: true,
              isDemo: true
            },
            where: {
              id: organizationId
            }
          }),
          prisma.project.count({
            where: {
              organizationId
            }
          }),
          prisma.whatsAppAccount.count({
            where: {
              organizationId,
              status: "CONNECTED"
            }
          }),
          prisma.whatsAppChatMapping.count({
            where: {
              organizationId,
              status: "ACTIVE"
            }
          }),
          prisma.message.count({
            where: {
              conversation: {
                organizationId
              }
            }
          })
        ]);

      if (!organization) {
        throw new Error("Organization not found.");
      }

      const steps: OnboardingStepRecord[] = [
        {
          completed: true,
          href: "/",
          key: "CREATE_ORGANIZATION",
          label: "Create organization"
        },
        {
          completed: projectCount > 0,
          href: "/projects",
          key: "CREATE_PROJECT",
          label: "Create first project"
        },
        {
          completed: connectedAccountCount > 0,
          href: "/settings",
          key: "CONNECT_WHATSAPP",
          label: "Connect WhatsApp"
        },
        {
          completed: activeChatCount > 0,
          href: "/settings",
          key: "ACTIVATE_GROUP",
          label: "Activate a chat or group"
        },
        {
          completed: messageCount > 0,
          href: "/inbox",
          key: "SEND_UPDATE",
          label: "Send a field update"
        },
        {
          completed: projectCount > 0 && messageCount > 0,
          href: "/",
          key: "OPEN_COMMAND_CENTER",
          label: "Open Project Command Center"
        }
      ];
      const completedCount = steps.filter((step) => step.completed).length;

      return {
        isDemo: organization.isDemo,
        organizationId,
        progress: Math.round((completedCount / steps.length) * 100),
        steps
      };
    },

    async listNotifications(input) {
      const prisma = await getPrisma();
      return prisma.userNotification.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: 15,
        where: {
          organizationId: input.organizationId,
          userId: input.userId
        }
      });
    },

    async markNotificationRead(input) {
      const prisma = await getPrisma();
      const notification = await prisma.userNotification.findFirst({
        where: {
          id: input.notificationId,
          userId: input.userId
        }
      });

      if (!notification) {
        return null;
      }

      return prisma.userNotification.update({
        data: {
          readAt: new Date()
        },
        where: {
          id: notification.id
        }
      });
    },

    async recordAnalyticsEvent(input) {
      const prisma = await getPrisma();
      await prisma.productAnalyticsEvent.create({
        data: {
          eventName: input.eventName,
          metadata: input.metadata ?? Prisma.JsonNull,
          organizationId: input.organizationId ?? null,
          userId: input.userId ?? null
        }
      });
    },

    async resetDemoWorkspace(userId) {
      const prisma = await getPrisma();
      return resetDemoWorkspace(prisma, userId);
    },

    async listProcessingJobs(organizationId) {
      const prisma = await getPrisma();
      return prisma.processingJob.findMany({
        orderBy: {
          updatedAt: "desc"
        },
        take: 100,
        where: {
          organizationId
        }
      });
    },

    async getProcessingJob(jobId) {
      const prisma = await getPrisma();
      return prisma.processingJob.findUnique({
        where: {
          id: jobId
        }
      });
    },

    async listWorkerHeartbeats() {
      const prisma = await getPrisma();
      const workers = await prisma.workerHeartbeat.findMany({
        orderBy: {
          workerName: "asc"
        }
      });

      return workers.map((worker) => ({
        ...worker,
        status: getWorkerEffectiveStatus(worker)
      }));
    },

    async retryProcessingJob(jobId) {
      const prisma = await getPrisma();
      return retryProcessingJob(prisma, jobId);
    },

    async retryFailedProcessingJobs(organizationId) {
      const prisma = await getPrisma();
      return retryFailedProcessingJobs(prisma, organizationId);
    },

    async searchDocuments(input) {
      const prisma = await getPrisma();

      const limit = Math.min(Math.max(input.limit, 1), 25);
      const take = limit + 1;
      const cursorDate = input.cursor ? new Date(input.cursor) : null;
      const projectFilter = input.projectId ?? null;
      const typeFilter = input.sourceType ?? null;
      const query = input.query.trim();

      if (query) {
        const filters = [
          Prisma.sql`"organizationId" = ${input.organizationId}`,
          projectFilter ? Prisma.sql`"projectId" = ${projectFilter}` : null,
          typeFilter ? Prisma.sql`"sourceType" = ${typeFilter}::"SearchDocumentSourceType"` : null,
          input.dateFrom
            ? Prisma.sql`coalesce("occurredAt", "createdAt") >= ${input.dateFrom}`
            : null,
          input.dateTo ? Prisma.sql`coalesce("occurredAt", "createdAt") <= ${input.dateTo}` : null,
          cursorDate && !Number.isNaN(cursorDate.getTime())
            ? Prisma.sql`"createdAt" < ${cursorDate}`
            : null
        ].filter((filter): filter is Prisma.Sql => Boolean(filter));

        const rows = await prisma.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`
            SELECT "id"
            FROM "SearchDocument"
            WHERE ${Prisma.join(filters, " AND ")}
              AND to_tsvector('english', coalesce("title", '') || ' ' || coalesce("content", '')) @@ plainto_tsquery('english', ${query})
            ORDER BY ts_rank(to_tsvector('english', coalesce("title", '') || ' ' || coalesce("content", '')), plainto_tsquery('english', ${query})) DESC,
              "createdAt" DESC
            LIMIT ${take}
          `
        );
        const ids = rows.map((row) => row.id);
        const documents = ids.length
          ? await prisma.searchDocument.findMany({
              include: searchDocumentInclude(),
              where: {
                id: {
                  in: ids
                }
              }
            })
          : [];
        const byId = new Map(documents.map((document) => [document.id, document]));
        const ordered = ids.flatMap((id) => {
          const document = byId.get(id);
          return document ? [document] : [];
        });

        return toSearchDocumentsResult(ordered, limit);
      }

      const documents = await prisma.searchDocument.findMany({
        include: searchDocumentInclude(),
        orderBy: {
          createdAt: "desc"
        },
        take,
        where: {
          organizationId: input.organizationId,
          ...(projectFilter ? { projectId: projectFilter } : {}),
          ...(typeFilter ? { sourceType: typeFilter } : {}),
          ...(input.dateFrom || input.dateTo
            ? {
                OR: [
                  {
                    occurredAt: {
                      ...(input.dateFrom ? { gte: input.dateFrom } : {}),
                      ...(input.dateTo ? { lte: input.dateTo } : {})
                    }
                  },
                  {
                    occurredAt: null,
                    createdAt: {
                      ...(input.dateFrom ? { gte: input.dateFrom } : {}),
                      ...(input.dateTo ? { lte: input.dateTo } : {})
                    }
                  }
                ]
              }
            : {}),
          ...(cursorDate && !Number.isNaN(cursorDate.getTime())
            ? {
                createdAt: {
                  lt: cursorDate
                }
              }
            : {})
        }
      });

      return toSearchDocumentsResult(documents, limit);
    },

    async listProjectAIClassifications(projectId) {
      const prisma = await getPrisma();
      return prisma.aIMessageClassification.findMany({
        include: aiClassificationInclude(),
        orderBy: {
          createdAt: "desc"
        },
        take: 25,
        where: {
          projectId
        }
      });
    },

    async listProjectPhotoAnalyses(input) {
      const prisma = await getPrisma();
      const cursorDate = input.cursor ? new Date(input.cursor) : null;
      const rows = await prisma.photoAnalysis.findMany({
        include: photoAnalysisInclude(),
        orderBy: {
          createdAt: "desc"
        },
        take: input.limit + 1,
        where: {
          projectId: input.projectId,
          ...(cursorDate && !Number.isNaN(cursorDate.getTime())
            ? {
                createdAt: {
                  lt: cursorDate
                }
              }
            : {})
        }
      });
      const page = rows.slice(0, input.limit);

      return {
        analyses: page.map(toPhotoAnalysisRecord),
        nextCursor:
          rows.length > input.limit ? (page.at(-1)?.createdAt.toISOString() ?? null) : null
      };
    },

    async listProjectActionItems(projectId) {
      const prisma = await getPrisma();
      return prisma.actionItem.findMany({
        include: actionItemInclude(),
        orderBy: {
          createdAt: "desc"
        },
        take: 25,
        where: {
          OR: [
            {
              projectId
            },
            {
              suggestedProjectId: projectId
            }
          ]
        }
      });
    },

    async ignoreActionItem(input) {
      const prisma = await getPrisma();
      return prisma.actionItem.update({
        data: {
          acceptedAt: null,
          acceptedByUserId: null,
          completedAt: null,
          ignoredAt: new Date(),
          ignoredByUserId: input.userId,
          status: "IGNORED"
        },
        include: actionItemInclude(),
        where: {
          id: input.actionItemId
        }
      });
    },

    async activateWhatsAppChatMapping(input) {
      const prisma = await getPrisma();

      return prisma.$transaction(async (tx) => {
        const mapping = await tx.whatsAppChatMapping.update({
          data: {
            activatedAt: new Date(),
            activatedByUserId: input.activatedByUserId,
            projectId: input.projectId,
            status: "ACTIVE"
          },
          include: whatsappChatMappingInclude(),
          where: {
            id: input.mappingId
          }
        });

        if (mapping.conversationId) {
          await tx.conversation.update({
            data: {
              projectId: input.projectId
            },
            where: {
              id: mapping.conversationId
            }
          });
        }

        return mapping;
      });
    },

    async archiveWhatsAppChatMapping(mappingId) {
      const prisma = await getPrisma();
      return prisma.whatsAppChatMapping.update({
        data: {
          status: "ARCHIVED"
        },
        include: whatsappChatMappingInclude(),
        where: {
          id: mappingId
        }
      });
    },

    async createWhatsAppAccount(input) {
      const prisma = await getPrisma();
      return prisma.whatsAppAccount.create({
        data: {
          connectorType: "BAILEYS",
          displayName: input.displayName,
          organizationId: input.organizationId,
          sessionKey: `baileys/${input.organizationId}/${randomUUID()}`,
          status: "PENDING_QR"
        }
      });
    },

    async getWhatsAppAccount(accountId) {
      const prisma = await getPrisma();
      return prisma.whatsAppAccount.findUnique({
        where: {
          id: accountId
        }
      });
    },

    async getWhatsAppChatMapping(mappingId) {
      const prisma = await getPrisma();
      return prisma.whatsAppChatMapping.findUnique({
        include: whatsappChatMappingInclude(),
        where: {
          id: mappingId
        }
      });
    },

    async ignoreWhatsAppChatMapping(mappingId) {
      const prisma = await getPrisma();
      return prisma.whatsAppChatMapping.update({
        data: {
          status: "IGNORED"
        },
        include: whatsappChatMappingInclude(),
        where: {
          id: mappingId
        }
      });
    },

    async listWhatsAppAccounts(organizationId) {
      const prisma = await getPrisma();
      return prisma.whatsAppAccount.findMany({
        orderBy: {
          createdAt: "desc"
        },
        where: {
          organizationId
        }
      });
    },

    async updateWhatsAppAccountStatus(accountId, status) {
      const prisma = await getPrisma();
      const now = new Date();
      return prisma.whatsAppAccount.update({
        data: {
          ...(status === "CONNECTED" ? { lastConnectedAt: now } : {}),
          ...(status === "DISCONNECTED" ? { lastDisconnectedAt: now } : {}),
          ...(status === "DISCONNECTED"
            ? {
                disconnectedAt: null,
                disconnectAlertSentAt: null,
                lastDisconnectReason: null,
                recoveryAlertSentAt: null
              }
            : {}),
          status
        },
        where: {
          id: accountId
        }
      });
    },

    async rotateWhatsAppAccountSession(accountId) {
      const prisma = await getPrisma();
      const account = await prisma.whatsAppAccount.findUniqueOrThrow({
        select: {
          organizationId: true
        },
        where: {
          id: accountId
        }
      });

      return prisma.whatsAppAccount.update({
        data: {
          disconnectedAt: null,
          disconnectAlertSentAt: null,
          lastDisconnectReason: null,
          recoveryAlertSentAt: null,
          sessionKey: `baileys/${account.organizationId}/${randomUUID()}`,
          status: "PENDING_QR"
        },
        where: {
          id: accountId
        }
      });
    },

    async listWhatsAppChatMappings(accountId) {
      const prisma = await getPrisma();
      return prisma.whatsAppChatMapping.findMany({
        include: whatsappChatMappingInclude(),
        orderBy: {
          updatedAt: "desc"
        },
        where: {
          whatsappAccountId: accountId
        }
      });
    },

    async updateWhatsAppChatMapping(input) {
      const prisma = await getPrisma();

      return prisma.$transaction(async (tx) => {
        const mapping = await tx.whatsAppChatMapping.update({
          data: {
            projectId: input.projectId
          },
          include: whatsappChatMappingInclude(),
          where: {
            id: input.mappingId
          }
        });

        if (mapping.conversationId) {
          await tx.conversation.update({
            data: {
              projectId: input.projectId
            },
            where: {
              id: mapping.conversationId
            }
          });
        }

        return mapping;
      });
    },

    async userBelongsToOrganization(userId, organizationId) {
      const prisma = await getPrisma();
      const membership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            organizationId,
            userId
          }
        }
      });

      return Boolean(membership);
    },

    async userCanAccessProject(userId, projectId) {
      const prisma = await getPrisma();
      const membership = await prisma.membership.findFirst({
        where: {
          organization: { projects: { some: { id: projectId } } },
          OR: [{ allProjects: true }, { projectAccess: { some: { projectId } } }],
          userId
        }
      });
      return Boolean(membership);
    },

    async projectBelongsToOrganization(projectId, organizationId) {
      const prisma = await getPrisma();
      const project = await prisma.project.findFirst({
        select: {
          id: true
        },
        where: {
          id: projectId,
          organizationId
        }
      });

      return Boolean(project);
    },

    async createConversation(input: Required<CreateConversationInput>) {
      const prisma = await getPrisma();
      const conversation = await prisma.conversation.create({
        data: input,
        include: conversationInclude()
      });

      return toConversationRecord(conversation);
    },

    async listConversations(input) {
      const prisma = await getPrisma();
      const search = input.search?.trim();
      const membership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            organizationId: input.organizationId,
            userId: input.userId
          }
        }
      });
      if (!membership) return [];
      const conversations = await prisma.conversation.findMany({
        include: conversationInclude(),
        orderBy: [
          {
            lastMessageAt: "desc"
          },
          {
            updatedAt: "desc"
          }
        ],
        where: {
          AND: [
            {
              OR: [
                {
                  channel: {
                    not: "WHATSAPP"
                  }
                },
                {
                  whatsAppMapping: {
                    is: {
                      projectId: {
                        not: null
                      },
                      status: "ACTIVE"
                    }
                  }
                }
              ]
            }
          ],
          organizationId: input.organizationId,
          ...(membership.allProjects
            ? {}
            : {
                project: {
                  is: { projectAccess: { some: { membershipId: membership.id } } }
                }
              }),
          ...(search
            ? {
                OR: [
                  {
                    title: {
                      contains: search,
                      mode: "insensitive"
                    }
                  },
                  {
                    messages: {
                      some: {
                        body: {
                          contains: search,
                          mode: "insensitive"
                        }
                      }
                    }
                  }
                ]
              }
            : {})
        }
      });

      return conversations.map(toConversationRecord);
    },

    async getConversation(conversationId) {
      const prisma = await getPrisma();
      const conversation = await prisma.conversation.findUnique({
        include: conversationInclude(),
        where: {
          id: conversationId
        }
      });

      return conversation ? toConversationRecord(conversation) : null;
    },

    async findConversationContext(conversationId) {
      const prisma = await getPrisma();
      return prisma.conversation.findUnique({
        select: {
          id: true,
          organizationId: true,
          projectId: true
        },
        where: {
          id: conversationId
        }
      });
    },

    async addParticipant(input: CreateParticipantInput) {
      const prisma = await getPrisma();
      return prisma.participant.create({
        data: input
      });
    },

    async findParticipant(participantId) {
      const prisma = await getPrisma();
      return prisma.participant.findUnique({
        where: {
          id: participantId
        }
      });
    },

    async createMessage(input: CreateMessageInput) {
      const prisma = await getPrisma();
      const message = await prisma.$transaction(async (tx) => {
        const conversation = await tx.conversation.findUniqueOrThrow({
          select: {
            organizationId: true,
            projectId: true
          },
          where: {
            id: input.conversationId
          }
        });
        const created = await tx.message.create({
          data: input,
          include: messageInclude()
        });

        await tx.conversation.update({
          data: {
            lastMessageAt: input.occurredAt
          },
          where: {
            id: input.conversationId
          }
        });

        await queueSearchIndexJob(tx, {
          organizationId: conversation.organizationId,
          projectId: conversation.projectId,
          sourceId: created.id,
          sourceType: "MESSAGE"
        });

        await tx.message.update({
          data: {
            processingStatus: "SEARCH_PENDING"
          },
          where: {
            id: created.id
          }
        });

        return created;
      });

      return toMessageRecord(message);
    },

    async listMessages(conversationId) {
      const prisma = await getPrisma();
      const messages = await prisma.message.findMany({
        include: messageInclude(),
        orderBy: {
          occurredAt: "asc"
        },
        where: {
          conversationId
        }
      });

      return messages.map(toMessageRecord);
    },

    async findMessageContext(messageId) {
      const prisma = await getPrisma();
      const message = await prisma.message.findUnique({
        select: {
          conversation: {
            select: {
              id: true,
              organizationId: true,
              projectId: true
            }
          },
          id: true
        },
        where: {
          id: messageId
        }
      });

      return message
        ? {
            conversationId: message.conversation.id,
            id: message.id,
            organizationId: message.conversation.organizationId,
            projectId: message.conversation.projectId
          }
        : null;
    },

    async createAttachment(input: CreateAttachmentInput & { conversationId: string }) {
      const prisma = await getPrisma();
      return prisma.attachment.create({
        data: input
      });
    },

    async deleteMessage(messageId) {
      const prisma = await getPrisma();

      return prisma.$transaction(async (tx) => {
        const message = await tx.message.findUnique({
          select: {
            conversationId: true,
            id: true
          },
          where: {
            id: messageId
          }
        });

        if (!message) {
          return false;
        }

        await tx.message.delete({
          where: {
            id: messageId
          }
        });

        const latestMessage = await tx.message.findFirst({
          orderBy: {
            occurredAt: "desc"
          },
          select: {
            occurredAt: true
          },
          where: {
            conversationId: message.conversationId
          }
        });

        await tx.conversation.update({
          data: {
            lastMessageAt: latestMessage?.occurredAt ?? null
          },
          where: {
            id: message.conversationId
          }
        });

        return true;
      });
    }
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toSafeUser(user: StoredUser): SafeUser {
  return {
    createdAt: user.createdAt,
    email: user.email,
    id: user.id,
    name: user.name,
    updatedAt: user.updatedAt
  };
}

function conversationInclude() {
  return {
    messages: {
      orderBy: {
        occurredAt: "desc" as const
      },
      select: {
        body: true
      },
      take: 1
    },
    project: {
      select: {
        code: true,
        id: true,
        name: true
      }
    }
  };
}

function messageInclude() {
  return {
    attachments: {
      include: {
        photoAnalysis: {
          select: {
            confidence: true,
            createdAt: true,
            detectedObjects: true,
            id: true,
            possibleIssues: true,
            summary: true,
            tags: true
          }
        }
      }
    },
    senderParticipant: true
  };
}

function whatsappChatMappingInclude() {
  return {
    conversation: {
      select: {
        id: true,
        projectId: true,
        title: true
      }
    },
    project: {
      select: {
        code: true,
        id: true,
        name: true
      }
    }
  };
}

function aiClassificationInclude() {
  return {
    message: {
      select: {
        body: true,
        conversation: {
          select: {
            id: true,
            title: true
          }
        },
        id: true,
        occurredAt: true
      }
    }
  };
}

function actionItemInclude() {
  return {
    assignedToUser: {
      select: {
        id: true,
        name: true
      }
    },
    message: {
      select: {
        body: true,
        conversation: {
          select: {
            id: true,
            title: true
          }
        },
        id: true,
        occurredAt: true
      }
    },
    project: {
      select: {
        code: true,
        id: true,
        name: true
      }
    },
    suggestedProject: {
      select: {
        code: true,
        id: true,
        name: true
      }
    }
  };
}

function searchDocumentInclude() {
  return {
    project: {
      select: {
        code: true,
        id: true,
        name: true
      }
    }
  };
}

function photoAnalysisInclude() {
  return {
    evidence: {
      select: {
        filename: true,
        mimeType: true,
        storageKey: true
      }
    },
    message: {
      select: {
        body: true,
        conversation: {
          select: {
            id: true,
            title: true
          }
        },
        id: true,
        occurredAt: true
      }
    },
    project: {
      select: {
        code: true,
        id: true,
        name: true
      }
    }
  };
}

function toSearchDocumentsResult(
  documents: Array<{
    content: string;
    createdAt: Date;
    id: string;
    metadata: unknown;
    occurredAt: Date | null;
    organizationId: string;
    project: SearchDocumentRecord["project"];
    projectId: string | null;
    sourceId: string;
    sourceType: SearchSourceType;
    title: string;
    updatedAt: Date;
  }>,
  limit: number
): SearchDocumentsResult {
  const page = documents.slice(0, limit);
  const hasMore = documents.length > limit;

  return {
    nextCursor: hasMore ? (page.at(-1)?.createdAt.toISOString() ?? null) : null,
    results: page.map((document) => ({
      createdAt: document.createdAt,
      id: document.id,
      metadata: document.metadata,
      occurredAt: document.occurredAt,
      organizationId: document.organizationId,
      project: document.project,
      projectId: document.projectId,
      snippet: createSnippet(document.content),
      sourceId: document.sourceId,
      sourceType: document.sourceType,
      title: document.title,
      updatedAt: document.updatedAt
    }))
  };
}

function createSnippet(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
}

async function resetDemoWorkspace(
  prisma: PrismaClient,
  userId: string
): Promise<DemoWorkspaceRecord> {
  const now = new Date();
  const demoSlug = `fieldos-aviation-demo-${Date.now().toString(36)}`;
  const demoProjects = [
    {
      code: "SIN-TWY-A7",
      name: "Taxiway A7 Lighting Modernization",
      status: "ACTIVE" as const
    },
    {
      code: "SIN-RWY-09R",
      name: "Runway 09R/27L Rehabilitation",
      status: "ACTIVE" as const
    },
    {
      code: "SIN-CCR-02",
      name: "CCR Replacement and Commissioning",
      status: "PAUSED" as const
    }
  ];

  return prisma.$transaction(async (tx) => {
    const demoMemberships = await tx.membership.findMany({
      select: {
        organizationId: true
      },
      where: {
        organization: {
          isDemo: true
        },
        userId
      }
    });
    const demoOrganizationIds = demoMemberships.map((membership) => membership.organizationId);

    if (demoOrganizationIds.length > 0) {
      await tx.organization.deleteMany({
        where: {
          id: {
            in: demoOrganizationIds
          },
          isDemo: true
        }
      });
    }

    const organization = await tx.organization.create({
      data: {
        isDemo: true,
        name: "FieldOS Aviation Demo",
        slug: demoSlug
      }
    });
    const membership = await tx.membership.create({
      data: {
        organizationId: organization.id,
        role: "OWNER",
        userId
      }
    });

    const whatsAppAccount = await tx.whatsAppAccount.create({
      data: {
        connectorType: "BAILEYS",
        displayName: "Demo airport operations line",
        lastConnectedAt: now,
        organizationId: organization.id,
        sessionKey: `demo/${organization.id}/${randomUUID()}`,
        status: "CONNECTED"
      }
    });

    const projects = [];
    const conversations = [];

    for (const [projectIndex, projectInput] of demoProjects.entries()) {
      const project = await tx.project.create({
        data: {
          ...projectInput,
          organizationId: organization.id
        }
      });
      projects.push(project);

      await tx.milestone.createMany({
        data: [
          {
            plannedEndDate: addDays(now, 3 + projectIndex),
            organizationId: organization.id,
            projectId: project.id,
            status: "PLANNED",
            title:
              projectIndex === 0
                ? "Night works inspection"
                : projectIndex === 1
                  ? "Asphalt coring review"
                  : "Factory acceptance pack"
          },
          {
            plannedEndDate: addDays(now, 9 + projectIndex),
            organizationId: organization.id,
            projectId: project.id,
            status: "PLANNED",
            title:
              projectIndex === 0
                ? "Cable continuity sign-off"
                : projectIndex === 1
                  ? "Runway marking handback"
                  : "CCR commissioning window"
          }
        ]
      });

      const conversation = await tx.conversation.create({
        data: {
          channel: "WHATSAPP",
          externalId: `demo:${project.code}:airside`,
          isGroup: true,
          lastMessageAt: addMinutes(now, -20 - projectIndex * 7),
          organizationId: organization.id,
          projectId: project.id,
          title: `${project.code} Airside Coordination`
        }
      });
      conversations.push(conversation);

      await tx.whatsAppChatMapping.create({
        data: {
          activatedAt: now,
          activatedByUserId: userId,
          chatName: conversation.title,
          conversationId: conversation.id,
          isGroup: true,
          jid: `${project.code.toLowerCase()}-airside@g.us`,
          organizationId: organization.id,
          projectId: project.id,
          status: "ACTIVE",
          whatsappAccountId: whatsAppAccount.id
        }
      });

      const supervisor = await tx.participant.create({
        data: {
          conversationId: conversation.id,
          displayName:
            projectIndex === 0 ? "Aisha Tan" : projectIndex === 1 ? "Ravi Menon" : "Lina Koh",
          externalIdentifier: `demo-supervisor-${project.code.toLowerCase()}`,
          role: "site-supervisor"
        }
      });
      const inspector = await tx.participant.create({
        data: {
          conversationId: conversation.id,
          displayName: "Airport PMO",
          externalIdentifier: `demo-pmo-${project.code.toLowerCase()}`,
          role: "client"
        }
      });

      const updates = buildDemoMessages(project.name, project.code, projectIndex);
      for (const [messageIndex, update] of updates.entries()) {
        const message = await tx.message.create({
          data: {
            body: update.body,
            conversationId: conversation.id,
            direction: "INBOUND",
            externalMessageId: `demo:${project.code}:msg:${messageIndex}`,
            occurredAt: addMinutes(now, -180 + projectIndex * 12 + messageIndex * 28),
            processingStatus: "AI_COMPLETE",
            senderParticipantId: messageIndex % 2 === 0 ? supervisor.id : inspector.id,
            type: update.type
          }
        });

        await tx.event.create({
          data: {
            description: update.body,
            eventType: messageIndex === 1 ? "PHOTO_ANALYSIS_COMPLETE" : "MESSAGE_RECEIVED",
            occurredAt: message.occurredAt,
            organizationId: organization.id,
            projectId: project.id,
            sourceId: message.id,
            sourceType: "MESSAGE",
            title: update.title
          }
        });

        await tx.searchDocument.create({
          data: {
            content: update.body ?? update.title,
            metadata: {
              demo: true
            },
            occurredAt: message.occurredAt,
            organizationId: organization.id,
            projectId: project.id,
            sourceId: message.id,
            sourceType: "MESSAGE",
            title: update.title
          }
        });

        if (update.attachment) {
          const attachment = await tx.attachment.create({
            data: {
              conversationId: conversation.id,
              filename: update.attachment.filename,
              messageId: message.id,
              mimeType: update.attachment.mimeType,
              size: update.attachment.size,
              storageKey: `demo/${organization.id}/${project.code}/${update.attachment.filename}`,
              transcript: update.attachment.transcript ?? null,
              transcriptionStatus: update.attachment.transcript ? "COMPLETED" : "NOT_REQUIRED",
              transcriptionError: null
            }
          });

          if (update.attachment.mimeType.startsWith("image/")) {
            await tx.photoAnalysis.create({
              data: {
                confidence: 0.84,
                conversationId: conversation.id,
                detectedObjects: ["airfield lighting", "work crew", "temporary barrier"],
                evidenceId: attachment.id,
                messageId: message.id,
                organizationId: organization.id,
                possibleIssues:
                  projectIndex === 1 ? ["standing water near work zone edge"] : ["none visible"],
                projectId: project.id,
                provider: "demo",
                summary: `Demo photo shows ${project.name.toLowerCase()} progress with clear site context.`,
                tags: ["demo", "aviation", "evidence"]
              }
            });
          }
        }
      }

      const anchorMessage = await tx.message.findFirstOrThrow({
        orderBy: {
          occurredAt: "desc"
        },
        where: {
          conversationId: conversation.id
        }
      });

      const actionItem = await tx.actionItem.create({
        data: {
          confidence: 0.82,
          description:
            projectIndex === 0
              ? "Confirm night closure access before cable pull starts."
              : projectIndex === 1
                ? "Review inspection photos and confirm surface prep is acceptable."
                : "Upload CCR commissioning certificates before approval meeting.",
          messageId: anchorMessage.id,
          organizationId: organization.id,
          priority: projectIndex === 1 ? "HIGH" : "MEDIUM",
          projectId: project.id,
          status: "PENDING",
          title:
            projectIndex === 0
              ? "Confirm night closure access"
              : projectIndex === 1
                ? "Review runway prep evidence"
                : "Upload CCR commissioning certificates",
          type: "FOLLOW_UP"
        }
      });

      await tx.event.create({
        data: {
          description: actionItem.description,
          eventType: "ACTION_ITEM_CREATED",
          occurredAt: addMinutes(now, -15 - projectIndex),
          organizationId: organization.id,
          projectId: project.id,
          sourceId: actionItem.id,
          sourceType: "ACTION_ITEM",
          title: actionItem.title
        }
      });

      const report = await tx.projectReport.create({
        data: {
          content: {
            demo: true,
            highlights: [
              "Evidence captured from field updates.",
              "Open risks summarized for PM review.",
              "Pilot data is safe to reset."
            ]
          },
          generatedAt: now,
          markdown: `# ${project.name} Weekly Progress\n\n- Field updates received\n- Evidence reviewed\n- Open action item created`,
          organizationId: organization.id,
          periodEnd: now,
          periodStart: addDays(now, -7),
          projectId: project.id,
          status: "COMPLETED",
          title: `${project.name} Weekly Progress Report`,
          type: "WEEKLY_PROGRESS"
        }
      });

      await tx.searchDocument.create({
        data: {
          content: report.markdown ?? report.title,
          metadata: {
            demo: true
          },
          occurredAt: report.generatedAt,
          organizationId: organization.id,
          projectId: project.id,
          sourceId: report.id,
          sourceType: "PROJECT_REPORT",
          title: report.title
        }
      });
    }

    await tx.userNotification.create({
      data: {
        body: "A resettable aviation pilot workspace is ready to explore.",
        href: "/",
        organizationId: organization.id,
        title: "Demo workspace created",
        type: "DEMO_READY",
        userId
      }
    });

    await tx.productAnalyticsEvent.create({
      data: {
        eventName: "demo_workspace_reset",
        metadata: {
          projectCount: projects.length
        },
        organizationId: organization.id,
        userId
      }
    });

    const hydratedConversations = await tx.conversation.findMany({
      include: conversationInclude(),
      orderBy: {
        updatedAt: "desc"
      },
      where: {
        organizationId: organization.id
      }
    });

    return {
      conversations: hydratedConversations.map(toConversationRecord),
      organization: {
        ...organization,
        role: membership.role
      },
      projects
    };
  });
}

function buildDemoMessages(projectName: string, projectCode: string, projectIndex: number) {
  const projectFocus =
    projectIndex === 0
      ? "taxiway edge lights"
      : projectIndex === 1
        ? "runway pavement bay"
        : "constant current regulator room";

  return [
    {
      body: `${projectCode}: Day shift completed work on ${projectFocus}. Request PMO inspection before night closure.`,
      title: `${projectName} field update`,
      type: "TEXT" as const
    },
    {
      attachment: {
        filename: `${projectCode.toLowerCase()}-progress-photo.jpg`,
        mimeType: "image/jpeg",
        size: 184_200
      },
      body: `Photo uploaded for ${projectFocus}. Please review the marked area before handback.`,
      title: `${projectName} photo evidence`,
      type: "IMAGE" as const
    },
    {
      attachment: {
        filename: `${projectCode.toLowerCase()}-voice-note.ogg`,
        mimeType: "audio/ogg",
        size: 92_400,
        transcript: `Supervisor update for ${projectName}: work is tracking, one inspection decision remains open.`
      },
      body: "Voice note transcribed by demo mode.",
      title: `${projectName} voice transcript`,
      type: "VOICE" as const
    },
    {
      attachment: {
        filename: `${projectCode.toLowerCase()}-inspection-request.pdf`,
        mimeType: "application/pdf",
        size: 214_000
      },
      body: `Inspection request PDF uploaded for ${projectName}.`,
      title: `${projectName} inspection document`,
      type: "DOCUMENT" as const
    }
  ];
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

const openActionItemStatuses = new Set<ActionStatus>(["PENDING", "ACCEPTED"]);
function isOpenActionItem(actionItem: Pick<ActionItemRecord, "status">): boolean {
  return openActionItemStatuses.has(actionItem.status);
}

function getUtcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function buildDashboardProject(input: {
  actionItems: ActionItemRecord[];
  classifications: AIMessageClassificationRecord[];
  events: Array<{ occurredAt: Date; projectId: string | null }>;
  milestones: MilestoneRecord[];
  project: ProjectRecord;
}): DashboardProjectRecord {
  const projectActionItems = input.actionItems.filter(
    (actionItem) =>
      (actionItem.projectId === input.project.id ||
        actionItem.suggestedProjectId === input.project.id) &&
      isOpenActionItem(actionItem)
  );
  const projectClassifications = input.classifications.filter(
    (classification) => classification.projectId === input.project.id
  );
  const projectMilestones = input.milestones.filter(
    (milestone) => milestone.projectId === input.project.id
  );
  const urgentActionItemCount = projectActionItems.filter(
    (actionItem) => actionItem.priority === "URGENT"
  ).length;
  const highActionItemCount = projectActionItems.filter((actionItem) =>
    ["HIGH", "URGENT"].includes(actionItem.priority)
  ).length;
  const overdueMilestoneCount = projectMilestones.filter(
    (milestone) =>
      milestone.status === "DELAYED" ||
      (milestone.status !== "COMPLETED" && isPastDue(milestone.plannedEndDate))
  ).length;
  const hasSafetyIssue = projectClassifications.some(
    (classification) => classification.category === "SAFETY_ISSUE"
  );
  const hasAttentionClassification = projectClassifications.some((classification) =>
    ["DELAY", "DEFECT", "INSPECTION_REQUEST"].includes(classification.category ?? "")
  );
  const lastActivityAt = getLastActivityAt({
    actionItems: projectActionItems,
    events: input.events.filter((event) => event.projectId === input.project.id),
    project: input.project
  });
  const healthAssessment = assessProjectHealth({
    hasAttentionSignal: hasAttentionClassification,
    hasSafetyIssue,
    highPriorityActionItemCount: highActionItemCount,
    lastActivityAt,
    openActionItemCount: projectActionItems.length,
    overdueMilestoneCount,
    urgentActionItemCount
  });
  const health = healthAssessment.status;
  const healthReason = healthAssessment.reason;

  return {
    code: input.project.code,
    health,
    healthReason,
    highestPriorityIssue: getHighestPriorityIssue(projectActionItems, projectMilestones),
    id: input.project.id,
    lastActivityAt,
    name: input.project.name,
    openActionItemCount: projectActionItems.length,
    rankScore: getProjectRankScore({
      health,
      highActionItemCount,
      overdueMilestoneCount,
      urgentActionItemCount
    }),
    status: input.project.status
  };
}

function getProjectRankScore(input: {
  health: DashboardHealth;
  highActionItemCount: number;
  overdueMilestoneCount: number;
  urgentActionItemCount: number;
}): number {
  const healthScore = {
    CRITICAL: 300,
    HEALTHY: 0,
    NEEDS_ATTENTION: 150,
    UNKNOWN: 25
  } satisfies Record<DashboardHealth, number>;

  return (
    healthScore[input.health] +
    input.urgentActionItemCount * 20 +
    input.highActionItemCount * 10 +
    input.overdueMilestoneCount * 15
  );
}

function getHighestPriorityIssue(
  actionItems: ActionItemRecord[],
  milestones: MilestoneRecord[]
): string | null {
  const priorityOrder: ActionPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];
  const actionItem = [...actionItems].sort(
    (left, right) => priorityOrder.indexOf(left.priority) - priorityOrder.indexOf(right.priority)
  )[0];

  if (actionItem) {
    return actionItem.title;
  }

  const overdueMilestone = milestones.find(
    (milestone) =>
      milestone.status === "DELAYED" ||
      (milestone.status !== "COMPLETED" && isPastDue(milestone.plannedEndDate))
  );

  return overdueMilestone ? `Overdue milestone: ${overdueMilestone.title}` : null;
}

function getLastActivityAt(input: {
  actionItems: ActionItemRecord[];
  events: Array<{ occurredAt: Date }>;
  project: ProjectRecord;
}): Date | null {
  const dates = [
    input.project.updatedAt,
    ...input.actionItems.map((actionItem) => actionItem.updatedAt),
    ...input.events.map((event) => event.occurredAt)
  ];

  return dates.sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
}

function groupActionItems(actionItems: ActionItemRecord[]): DashboardActionItemGroupsRecord {
  const sorted = [...actionItems].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
  );
  const open = sorted.filter(isOpenActionItem);

  return {
    completed: sorted.filter((actionItem) => actionItem.status === "COMPLETED"),
    high: open.filter((actionItem) => actionItem.priority === "HIGH"),
    low: open.filter((actionItem) => actionItem.priority === "LOW"),
    medium: open.filter((actionItem) => actionItem.priority === "MEDIUM"),
    urgent: open.filter((actionItem) => actionItem.priority === "URGENT")
  };
}

function getActivityIcon(sourceType: EventSourceType): string {
  const icons = {
    ACTION_ITEM: "check-circle",
    MESSAGE: "message-circle",
    MILESTONE: "flag",
    RECOMMENDATION: "sparkles",
    REPORT: "file-text",
    SYSTEM: "settings"
  } satisfies Record<EventSourceType, string>;

  return icons[sourceType];
}

function buildFallbackBrief(
  summary: DashboardSummaryRecord,
  projects: DashboardProjectRecord[],
  milestones: MilestoneRecord[],
  events: Array<{ description: string | null; eventType: string }>
): DashboardBriefRecord {
  const bullets = [
    `${summary.activeProjects} active projects are being tracked.`,
    `${summary.criticalProjects} projects are critical and ${summary.projectsNeedingAttention} need attention.`,
    `${summary.openActionItems} open Action Items remain, including ${summary.highPriorityActionItems} high-priority items.`,
    `${summary.pendingAIReviews} AI reviews are pending.`,
    `${milestones.length} upcoming or overdue milestones are visible.`
  ];
  const attentionProject = projects.find((project) => project.health !== "HEALTHY");

  if (attentionProject) {
    bullets[1] = `${attentionProject.name} is the highest-ranked project needing review.`;
  }
  const photoEvent = events.find(
    (event) => event.eventType === "PHOTO_ANALYSIS_COMPLETE" && event.description
  );

  if (photoEvent?.description) {
    bullets[4] = createSnippet(photoEvent.description);
  }

  return {
    bullets: bullets.slice(0, 5),
    generatedBy: "FALLBACK"
  };
}

function isPastDue(date: Date | null): boolean {
  return Boolean(date && date.getTime() < Date.now());
}

function toConversationRecord(
  conversation: Omit<ConversationRecord, "lastMessageBody" | "project"> & {
    messages: Array<{ body: string | null }>;
    project: ConversationRecord["project"];
  }
): ConversationRecord {
  return {
    channel: conversation.channel,
    createdAt: conversation.createdAt,
    externalId: conversation.externalId,
    id: conversation.id,
    isGroup: conversation.isGroup,
    lastMessageAt: conversation.lastMessageAt,
    lastMessageBody: conversation.messages[0]?.body ?? null,
    organizationId: conversation.organizationId,
    project: conversation.project,
    projectId: conversation.projectId,
    title: conversation.title,
    updatedAt: conversation.updatedAt
  };
}

function toMessageRecord(
  message: Omit<MessageRecord, "attachments" | "senderParticipant"> & {
    attachments: Array<
      Omit<AttachmentRecord, "photoAnalysis"> & {
        photoAnalysis?: {
          confidence: number;
          createdAt: Date;
          detectedObjects: Prisma.JsonValue;
          id: string;
          possibleIssues: Prisma.JsonValue;
          summary: string;
          tags: Prisma.JsonValue;
        } | null;
      }
    >;
    senderParticipant: ParticipantRecord;
  }
): MessageRecord {
  return {
    attachments: message.attachments.map(toAttachmentRecord),
    body: message.body,
    conversationId: message.conversationId,
    createdAt: message.createdAt,
    direction: message.direction,
    externalMessageId: message.externalMessageId,
    id: message.id,
    occurredAt: message.occurredAt,
    processingStatus: message.processingStatus,
    senderParticipant: message.senderParticipant,
    senderParticipantId: message.senderParticipantId,
    type: message.type
  };
}

function toAttachmentRecord(
  attachment: Omit<AttachmentRecord, "photoAnalysis"> & {
    photoAnalysis?: {
      confidence: number;
      createdAt: Date;
      detectedObjects: Prisma.JsonValue;
      id: string;
      possibleIssues: Prisma.JsonValue;
      summary: string;
      tags: Prisma.JsonValue;
      observations?: Prisma.JsonValue;
      limitations?: Prisma.JsonValue;
      senderClaim?: string | null;
      claimAssessment?: string;
      operationalConclusion?: string;
    } | null;
  }
): AttachmentRecord {
  return {
    ...attachment,
    photoAnalysis: attachment.photoAnalysis
      ? {
          confidence: attachment.photoAnalysis.confidence,
          createdAt: attachment.photoAnalysis.createdAt,
          detectedObjects: jsonStringArray(attachment.photoAnalysis.detectedObjects),
          id: attachment.photoAnalysis.id,
          possibleIssues: jsonStringArray(attachment.photoAnalysis.possibleIssues),
          summary: attachment.photoAnalysis.summary,
          tags: jsonStringArray(attachment.photoAnalysis.tags),
          observations: jsonStringArray(attachment.photoAnalysis.observations ?? []),
          limitations: jsonStringArray(attachment.photoAnalysis.limitations ?? []),
          senderClaim: attachment.photoAnalysis.senderClaim ?? null,
          claimAssessment: attachment.photoAnalysis.claimAssessment ?? "NOT_ASSESSED",
          operationalConclusion:
            attachment.photoAnalysis.operationalConclusion ?? "NO_OPERATIONAL_CONCLUSION"
        }
      : null
  };
}

function toPhotoAnalysisRecord(analysis: {
  confidence: number;
  conversationId: string;
  createdAt: Date;
  detectedObjects: Prisma.JsonValue;
  evidence: PhotoAnalysisRecord["evidence"];
  evidenceId: string;
  id: string;
  message: PhotoAnalysisRecord["message"];
  messageId: string;
  organizationId: string;
  possibleIssues: Prisma.JsonValue;
  project: PhotoAnalysisRecord["project"];
  projectId: string | null;
  provider: string;
  summary: string;
  tags: Prisma.JsonValue;
  observations: Prisma.JsonValue;
  limitations: Prisma.JsonValue;
  senderClaim: string | null;
  claimAssessment: string;
  operationalConclusion: string;
}): PhotoAnalysisRecord {
  return {
    confidence: analysis.confidence,
    conversationId: analysis.conversationId,
    createdAt: analysis.createdAt,
    detectedObjects: jsonStringArray(analysis.detectedObjects),
    evidence: analysis.evidence,
    evidenceId: analysis.evidenceId,
    id: analysis.id,
    message: analysis.message,
    messageId: analysis.messageId,
    organizationId: analysis.organizationId,
    possibleIssues: jsonStringArray(analysis.possibleIssues),
    project: analysis.project,
    projectId: analysis.projectId,
    provider: analysis.provider,
    summary: analysis.summary,
    tags: jsonStringArray(analysis.tags),
    observations: jsonStringArray(analysis.observations),
    limitations: jsonStringArray(analysis.limitations),
    senderClaim: analysis.senderClaim,
    claimAssessment: analysis.claimAssessment,
    operationalConclusion: analysis.operationalConclusion
  };
}

function toProjectReportRecord(report: {
  content: Prisma.JsonValue | null;
  contentHash: string | null;
  createdAt: Date;
  errorMessage: string | null;
  generatedAt: Date | null;
  id: string;
  markdown: string | null;
  organizationId: string;
  pdfStorageKey: string | null;
  periodEnd: Date | null;
  periodStart: Date | null;
  projectId: string;
  status: ReportStatus;
  title: string;
  type: ReportType;
  updatedAt: Date;
}): ProjectReportRecord {
  return {
    content: report.content,
    contentHash: report.contentHash,
    createdAt: report.createdAt,
    errorMessage: report.errorMessage,
    generatedAt: report.generatedAt,
    id: report.id,
    markdown: report.markdown,
    organizationId: report.organizationId,
    pdfStorageKey: report.pdfStorageKey,
    periodEnd: report.periodEnd,
    periodStart: report.periodStart,
    projectId: report.projectId,
    status: report.status,
    title: report.title,
    type: report.type,
    updatedAt: report.updatedAt
  };
}

function toRecentProjectReportRecord(
  report: Parameters<typeof toProjectReportRecord>[0] & {
    project: RecentProjectReportRecord["project"];
  }
): RecentProjectReportRecord {
  return {
    ...toProjectReportRecord(report),
    project: report.project
  };
}

function reportLookbackDays(type: ReportType): number {
  return type === "WEEKLY_PROGRESS" ? 7 : 1;
}

function reportTitle(projectName: string, type: ReportType): string {
  const label =
    type === "MORNING_BRIEF"
      ? "Morning Brief"
      : type === "DAILY_SUMMARY"
        ? "Daily Summary"
        : type === "WEEKLY_PROGRESS"
          ? "Weekly Progress Report"
          : type === "RISK_SUMMARY"
            ? "Risk Summary"
            : "Pending Decisions";

  return `${projectName} ${label}`;
}

function jsonStringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}
