import type {
  AIClassificationStatus,
  AIMessageCategory,
  ActionItemPriority,
  ActionItemStatus,
  ActionItemType,
  EventSourceType,
  MembershipRole,
  MilestoneStatus,
  PrismaClient,
  ProjectStatus,
  WhatsAppChatMappingStatus
} from "@fieldos/db";
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
export type DashboardHealth = "HEALTHY" | "NEEDS_ATTENTION" | "CRITICAL";
export type DashboardBriefSource = "AI" | "FALLBACK";

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredUser extends SafeUser {
  passwordHash: string;
}

export interface OrganizationRecord {
  id: string;
  name: string;
  slug: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export interface MembershipRecord {
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
  createdAt: Date;
  updatedAt: Date;
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
  dueDate: Date;
  status: MilestoneStatus;
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
  lastActivityAt: Date | null;
  highestPriorityIssue: string | null;
  openActionItemCount: number;
  rankScore: number;
}

export interface DashboardActionItemGroupsRecord {
  urgent: ActionItemRecord[];
  high: ActionItemRecord[];
  medium: ActionItemRecord[];
  low: ActionItemRecord[];
}

export interface DashboardRecentActivityRecord {
  id: string;
  projectId: string;
  projectName: string;
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
  }): Promise<ProjectRecord>;
  createUser(input: { email: string; name: string; passwordHash: string }): Promise<SafeUser>;
  disconnect(): Promise<void>;
  findMembership(userId: string, organizationId: string): Promise<MembershipRecord | null>;
  findProjectForUser(userId: string, projectId: string): Promise<ProjectRecord | null>;
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<SafeUser | null>;
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
  completeActionItem(input: { actionItemId: string; userId: string }): Promise<ActionItemRecord>;
  enqueueMessageClassification(messageId: string): Promise<AIMessageClassificationRecord | null>;
  getMessageClassification(messageId: string): Promise<AIMessageClassificationRecord | null>;
  getActionItem(actionItemId: string): Promise<ActionItemRecord | null>;
  getOperationsDashboard(input: {
    organizationId: string;
    userId: string;
  }): Promise<OperationsDashboardRecord>;
  listProjectAIClassifications(projectId: string): Promise<AIMessageClassificationRecord[]>;
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
      return prisma.project.create({
        data: input
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
      return prisma.project.findFirst({
        where: {
          id: projectId,
          organization: {
            memberships: {
              some: {
                userId
              }
            }
          }
        }
      });
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

      return user ? toSafeUser(user) : null;
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
          organizationId
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

      return prisma.aIMessageClassification.upsert({
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
    },

    async getMessageClassification(messageId) {
      const prisma = await getPrisma();
      return prisma.aIMessageClassification.findUnique({
        where: {
          messageId
        }
      });
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

      const [projects, actionItems, classifications, events, milestones, pendingAIReviews] =
        await Promise.all([
          prisma.project.findMany({
            orderBy: {
              updatedAt: "desc"
            },
            where: {
              organizationId: input.organizationId
            }
          }),
          prisma.actionItem.findMany({
            include: actionItemInclude(),
            orderBy: {
              updatedAt: "desc"
            },
            take: 250,
            where: {
              organizationId: input.organizationId
            }
          }),
          prisma.aIMessageClassification.findMany({
            orderBy: {
              createdAt: "desc"
            },
            take: 250,
            where: {
              organizationId: input.organizationId
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
                not: null
              },
              sourceType: {
                in: ["MESSAGE", "ACTION_ITEM", "REPORT"]
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
            orderBy: {
              dueDate: "asc"
            },
            take: 12,
            where: {
              organizationId: input.organizationId,
              status: {
                not: "COMPLETED"
              }
            }
          }),
          prisma.aIMessageClassification.count({
            where: {
              organizationId: input.organizationId,
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
      const myActionItems = actionItems.filter(
        (actionItem) => actionItem.assignedToUserId === input.userId && isOpenActionItem(actionItem)
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

      const recentActivity = events
        .filter((event) => event.project)
        .map((event) => ({
          eventType: event.eventType,
          icon: getActivityIcon(event.sourceType),
          id: event.id,
          occurredAt: event.occurredAt,
          projectId: event.project?.id ?? "",
          projectName: event.project?.name ?? "Unknown project",
          sourceType: event.sourceType,
          title: event.title
        }));

      return {
        actionItems: groupActionItems(myActionItems),
        brief: buildFallbackBrief(summary, dashboardProjects, milestones),
        milestones,
        projects: dashboardProjects,
        recentActivity,
        summary
      };
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
          organizationId: true
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
              organizationId: true
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
            organizationId: message.conversation.organizationId
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
    attachments: true,
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

const openActionItemStatuses = new Set<ActionStatus>(["PENDING", "ACCEPTED"]);
const dashboardHealthThresholds = {
  overdueMilestonesForCritical: 2,
  urgentActionItemsForCritical: 3
};

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
    (milestone) => milestone.status === "OVERDUE" || isPastDue(milestone.dueDate)
  ).length;
  const hasSafetyIssue = projectClassifications.some(
    (classification) => classification.category === "SAFETY_ISSUE"
  );
  const hasAttentionClassification = projectClassifications.some((classification) =>
    ["DELAY", "DEFECT", "INSPECTION_REQUEST"].includes(classification.category ?? "")
  );
  const health = calculateProjectHealth({
    hasAttentionClassification,
    hasSafetyIssue,
    highActionItemCount,
    overdueMilestoneCount,
    urgentActionItemCount
  });
  const lastActivityAt = getLastActivityAt({
    actionItems: projectActionItems,
    events: input.events.filter((event) => event.projectId === input.project.id),
    project: input.project
  });

  return {
    code: input.project.code,
    health,
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

function calculateProjectHealth(input: {
  hasAttentionClassification: boolean;
  hasSafetyIssue: boolean;
  highActionItemCount: number;
  overdueMilestoneCount: number;
  urgentActionItemCount: number;
}): DashboardHealth {
  if (
    input.hasSafetyIssue ||
    input.urgentActionItemCount >= dashboardHealthThresholds.urgentActionItemsForCritical ||
    input.overdueMilestoneCount >= dashboardHealthThresholds.overdueMilestonesForCritical
  ) {
    return "CRITICAL";
  }

  if (
    input.highActionItemCount > 0 ||
    input.hasAttentionClassification ||
    input.overdueMilestoneCount > 0
  ) {
    return "NEEDS_ATTENTION";
  }

  return "HEALTHY";
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
    NEEDS_ATTENTION: 150
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
    (milestone) => milestone.status === "OVERDUE" || isPastDue(milestone.dueDate)
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

  return {
    high: sorted.filter((actionItem) => actionItem.priority === "HIGH"),
    low: sorted.filter((actionItem) => actionItem.priority === "LOW"),
    medium: sorted.filter((actionItem) => actionItem.priority === "MEDIUM"),
    urgent: sorted.filter((actionItem) => actionItem.priority === "URGENT")
  };
}

function getActivityIcon(sourceType: EventSourceType): string {
  const icons = {
    ACTION_ITEM: "check-circle",
    MESSAGE: "message-circle",
    REPORT: "file-text",
    SYSTEM: "settings"
  } satisfies Record<EventSourceType, string>;

  return icons[sourceType];
}

function buildFallbackBrief(
  summary: DashboardSummaryRecord,
  projects: DashboardProjectRecord[],
  milestones: MilestoneRecord[]
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

  return {
    bullets: bullets.slice(0, 5),
    generatedBy: "FALLBACK"
  };
}

function isPastDue(date: Date): boolean {
  return date.getTime() < Date.now();
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
    attachments: AttachmentRecord[];
    senderParticipant: ParticipantRecord;
  }
): MessageRecord {
  return {
    attachments: message.attachments,
    body: message.body,
    conversationId: message.conversationId,
    createdAt: message.createdAt,
    direction: message.direction,
    externalMessageId: message.externalMessageId,
    id: message.id,
    occurredAt: message.occurredAt,
    senderParticipant: message.senderParticipant,
    senderParticipantId: message.senderParticipantId,
    type: message.type
  };
}
