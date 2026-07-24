import { createHash } from "node:crypto";

import {
  prisma,
  queueWhatsAppGroupParticipantSyncJob,
  queueWhatsAppInvitationDeliveryJob,
  queueWhatsAppRecommendationDeliveryJob,
  type MembershipRole,
  type PersonStatus,
  type PersonType,
  type PrismaClient,
  type RecommendationType,
  type WhatsAppRecommendationRoutingMode
} from "@fieldos/db";

export class WhatsAppNativeServiceError extends Error {
  constructor(
    readonly code: "CONFLICT" | "EXPIRED" | "INVALID_STATE" | "NOT_FOUND",
    message: string
  ) {
    super(message);
    this.name = "WhatsAppNativeServiceError";
  }
}

export interface WhatsAppNativeService {
  acceptInvitation(input: {
    token: string;
    userId: string;
  }): Promise<{ organizationId: string; projectId: string }>;
  cancelDelivery(deliveryId: string, organizationId: string): Promise<void>;
  createInvitation(input: {
    invitedByUserId: string;
    organizationId: string;
    personId: string;
    projectId: string;
    role: MembershipRole;
  }): Promise<{ id: string; status: string }>;
  getInvitation(token: string): Promise<{
    expiresAt: Date;
    organizationName: string;
    personName: string;
    projectName: string;
    status: string;
  } | null>;
  getMetrics(organizationId: string): Promise<unknown>;
  getSetting(projectId: string, organizationId: string): Promise<unknown>;
  ignoreIdentity(reviewId: string, organizationId: string, userId: string): Promise<void>;
  listAudits(recommendationId: string, organizationId: string): Promise<unknown[]>;
  listDeliveries(recommendationId: string, organizationId: string): Promise<unknown[]>;
  listPeople(input: {
    filter?: string;
    organizationId: string;
    projectId: string;
  }): Promise<unknown[]>;
  mergeIdentity(input: {
    organizationId: string;
    reviewId: string;
    targetPersonId: string;
    userId: string;
  }): Promise<void>;
  retryDelivery(deliveryId: string, organizationId: string): Promise<void>;
  syncParticipants(mappingId: string, organizationId: string): Promise<void>;
  testDelivery(projectId: string, organizationId: string): Promise<{ recommendationId: string }>;
  updateParticipant(input: {
    organizationId: string;
    participantId: string;
    role?: string | null;
    status?: "ACTIVE" | "INACTIVE";
  }): Promise<void>;
  updatePerson(input: {
    company?: string | null;
    displayName?: string;
    organizationId: string;
    personId: string;
    roleTitle?: string | null;
    status?: PersonStatus;
    type?: PersonType;
  }): Promise<void>;
  upsertSetting(input: {
    allowedRecommendationTypes: RecommendationType[];
    dailyProjectLimit: number;
    dailyRecipientLimit: number;
    deliveryCooldownMinutes: number;
    enabled: boolean;
    groupApprovalsEnabled: boolean;
    namedApproverPersonIds: string[];
    organizationId: string;
    projectId: string;
    quietHoursEnd: string | null;
    quietHoursStart: string | null;
    requireSecondConfirmationForHighImpact: boolean;
    routingMode: WhatsAppRecommendationRoutingMode;
    sendUrgentOnly: boolean;
    timezone: string;
  }): Promise<unknown>;
}

export function createPrismaWhatsAppNativeService(
  client: PrismaClient = prisma
): WhatsAppNativeService {
  return {
    async getMetrics(organizationId) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [deliveryStatuses, auditEvents, pendingIdentityReviews, activeParticipants] =
        await Promise.all([
          client.recommendationDelivery.groupBy({
            _count: true,
            by: ["deliveryStatus"],
            where: { createdAt: { gte: since }, organizationId }
          }),
          client.whatsAppOperationAudit.groupBy({
            _count: true,
            by: ["eventType"],
            where: { createdAt: { gte: since }, organizationId }
          }),
          client.identityReview.count({ where: { organizationId, status: "PENDING" } }),
          client.projectParticipant.count({
            where: { organizationId, participantStatus: "ACTIVE", source: "WHATSAPP_GROUP" }
          })
        ]);
      return {
        activeParticipants,
        auditEvents: Object.fromEntries(auditEvents.map((row) => [row.eventType, row._count])),
        deliveryStatuses: Object.fromEntries(
          deliveryStatuses.map((row) => [row.deliveryStatus, row._count])
        ),
        pendingIdentityReviews,
        windowHours: 24
      };
    },

    async getSetting(projectId, organizationId) {
      await requireProject(client, projectId, organizationId);
      return client.whatsAppRecommendationSetting.findUnique({
        include: { namedApprovers: { include: { person: true } } },
        where: { projectId }
      });
    },

    async upsertSetting(input) {
      await requireProject(client, input.projectId, input.organizationId);
      const people = await client.person.count({
        where: { id: { in: input.namedApproverPersonIds }, organizationId: input.organizationId }
      });
      if (people !== new Set(input.namedApproverPersonIds).size)
        throw new WhatsAppNativeServiceError("NOT_FOUND", "Approver not found.");
      return client.whatsAppRecommendationSetting.upsert({
        create: {
          allowedRecommendationTypes: input.allowedRecommendationTypes,
          dailyProjectLimit: input.dailyProjectLimit,
          dailyRecipientLimit: input.dailyRecipientLimit,
          deliveryCooldownMinutes: input.deliveryCooldownMinutes,
          enabled: input.enabled,
          groupApprovalsEnabled: input.groupApprovalsEnabled,
          namedApprovers: {
            create: input.namedApproverPersonIds.map((personId) => ({ personId }))
          },
          organizationId: input.organizationId,
          projectId: input.projectId,
          quietHoursEnd: input.quietHoursEnd,
          quietHoursStart: input.quietHoursStart,
          requireSecondConfirmationForHighImpact: input.requireSecondConfirmationForHighImpact,
          routingMode: input.routingMode,
          sendUrgentOnly: input.sendUrgentOnly,
          timezone: input.timezone
        },
        include: { namedApprovers: { include: { person: true } } },
        update: {
          allowedRecommendationTypes: input.allowedRecommendationTypes,
          dailyProjectLimit: input.dailyProjectLimit,
          dailyRecipientLimit: input.dailyRecipientLimit,
          deliveryCooldownMinutes: input.deliveryCooldownMinutes,
          enabled: input.enabled,
          groupApprovalsEnabled: input.groupApprovalsEnabled,
          namedApprovers: {
            deleteMany: {},
            create: input.namedApproverPersonIds.map((personId) => ({ personId }))
          },
          quietHoursEnd: input.quietHoursEnd,
          quietHoursStart: input.quietHoursStart,
          requireSecondConfirmationForHighImpact: input.requireSecondConfirmationForHighImpact,
          routingMode: input.routingMode,
          sendUrgentOnly: input.sendUrgentOnly,
          timezone: input.timezone
        },
        where: { projectId: input.projectId }
      });
    },

    async listDeliveries(recommendationId, organizationId) {
      return client.recommendationDelivery.findMany({
        include: { recipientPerson: { select: { displayName: true, id: true } }, responses: true },
        orderBy: { createdAt: "desc" },
        where: { organizationId, recommendationId }
      });
    },

    async retryDelivery(deliveryId, organizationId) {
      const delivery = await client.recommendationDelivery.findFirst({
        where: { id: deliveryId, organizationId }
      });
      if (!delivery) throw new WhatsAppNativeServiceError("NOT_FOUND", "Delivery not found.");
      await client.recommendationDelivery.update({
        data: { deliveryStatus: "QUEUED", failureReason: null },
        where: { id: delivery.id }
      });
      await queueWhatsAppRecommendationDeliveryJob(client, {
        organizationId,
        projectId: delivery.projectId,
        sourceId: delivery.recommendationId
      });
      await client.whatsAppOperationAudit.create({
        data: {
          deliveryId: delivery.id,
          eventType: "RECOMMENDATION_DELIVERY_RETRY_QUEUED",
          organizationId,
          projectId: delivery.projectId,
          recommendationId: delivery.recommendationId
        }
      });
    },

    async cancelDelivery(deliveryId, organizationId) {
      const delivery = await client.recommendationDelivery.findFirst({
        where: { id: deliveryId, organizationId }
      });
      if (!delivery) throw new WhatsAppNativeServiceError("NOT_FOUND", "Delivery not found.");
      const result = await client.recommendationDelivery.updateMany({
        data: { deliveryStatus: "CANCELLED" },
        where: {
          deliveryStatus: { in: ["PENDING", "QUEUED", "FAILED", "SENT", "AWAITING_CONFIRMATION"] },
          id: deliveryId,
          organizationId
        }
      });
      if (result.count === 0)
        throw new WhatsAppNativeServiceError("INVALID_STATE", "Delivery cannot be cancelled.");
      await client.whatsAppOperationAudit.create({
        data: {
          deliveryId: delivery.id,
          eventType: "RECOMMENDATION_DELIVERY_CANCELLED",
          organizationId,
          projectId: delivery.projectId,
          recommendationId: delivery.recommendationId
        }
      });
    },

    async syncParticipants(mappingId, organizationId) {
      const mapping = await client.whatsAppChatMapping.findFirst({
        where: {
          id: mappingId,
          isGroup: true,
          organizationId,
          projectId: { not: null },
          status: "ACTIVE"
        }
      });
      if (!mapping?.projectId)
        throw new WhatsAppNativeServiceError("NOT_FOUND", "Active project group not found.");
      await queueWhatsAppGroupParticipantSyncJob(client, {
        organizationId,
        projectId: mapping.projectId,
        sourceId: mapping.id
      });
    },

    async testDelivery(projectId, organizationId) {
      await requireProject(client, projectId, organizationId);
      const recommendation = await client.recommendation.findFirst({
        orderBy: { createdAt: "desc" },
        where: {
          decisionCandidate: { status: "CREATED" },
          organizationId,
          projectId,
          status: "PENDING"
        }
      });
      if (!recommendation)
        throw new WhatsAppNativeServiceError(
          "NOT_FOUND",
          "No eligible pending recommendation is available."
        );
      await queueWhatsAppRecommendationDeliveryJob(client, {
        organizationId,
        projectId,
        sourceId: recommendation.id
      });
      return { recommendationId: recommendation.id };
    },

    async listPeople(input) {
      await requireProject(client, input.projectId, input.organizationId);
      const filter = input.filter;
      return client.projectParticipant.findMany({
        include: {
          person: {
            include: {
              identities: {
                include: {
                  groupParticipants: {
                    where: { whatsappChatMapping: { projectId: input.projectId } }
                  }
                }
              },
              identityReviews: { where: { status: "PENDING" } },
              user: {
                include: { memberships: { where: { organizationId: input.organizationId } } }
              },
              whatsAppInvitations: {
                orderBy: { createdAt: "desc" },
                take: 1,
                where: { projectId: input.projectId }
              }
            }
          }
        },
        orderBy: { person: { displayName: "asc" } },
        where: {
          organizationId: input.organizationId,
          projectId: input.projectId,
          ...(filter === "platform" ? { person: { userId: { not: null } } } : {}),
          ...(filter === "external" ? { person: { type: "EXTERNAL" } } : {}),
          ...(filter === "review"
            ? { person: { identityReviews: { some: { status: "PENDING" } } } }
            : {}),
          ...(filter === "invited"
            ? {
                person: {
                  whatsAppInvitations: {
                    some: {
                      projectId: input.projectId,
                      status: { in: ["PENDING", "QUEUED", "SENT", "JOINED"] }
                    }
                  }
                }
              }
            : {}),
          ...(filter === "inactive" ? { participantStatus: "INACTIVE" } : {}),
          ...(filter === "whatsapp"
            ? { person: { identities: { some: { provider: "WHATSAPP" } } } }
            : {})
        }
      });
    },

    async mergeIdentity(input) {
      const review = await client.identityReview.findFirst({
        include: { personIdentity: { include: { person: true } } },
        where: { id: input.reviewId, organizationId: input.organizationId, status: "PENDING" }
      });
      const target = await client.person.findFirst({
        where: { id: input.targetPersonId, organizationId: input.organizationId }
      });
      if (!review || !target)
        throw new WhatsAppNativeServiceError("NOT_FOUND", "Identity review not found.");
      const sourceParticipants = await client.projectParticipant.findMany({
        where: { personId: review.personIdentity.personId }
      });
      await client.$transaction(async (tx) => {
        await tx.personIdentity.update({
          data: { personId: target.id, verificationStatus: "CONFIRMED" },
          where: { id: review.personIdentityId }
        });
        for (const participant of sourceParticipants) {
          await tx.projectParticipant.upsert({
            create: {
              firstSeenAt: participant.firstSeenAt,
              lastSeenAt: participant.lastSeenAt,
              organizationId: participant.organizationId,
              participantStatus: participant.participantStatus,
              personId: target.id,
              projectId: participant.projectId,
              removedAt: participant.removedAt,
              role: participant.role,
              source: participant.source
            },
            update: {
              lastSeenAt: participant.lastSeenAt,
              participantStatus: participant.participantStatus,
              removedAt: participant.removedAt,
              role: participant.role
            },
            where: { projectId_personId: { personId: target.id, projectId: participant.projectId } }
          });
        }
        await tx.projectParticipant.deleteMany({
          where: { personId: review.personIdentity.personId }
        });
        await tx.person.update({
          data: { mergedIntoPersonId: target.id, status: "MERGED" },
          where: { id: review.personIdentity.personId }
        });
        await tx.identityReview.update({
          data: {
            resolution: "MERGED",
            resolvedAt: new Date(),
            resolvedByUserId: input.userId,
            status: "RESOLVED"
          },
          where: { id: review.id }
        });
        await tx.whatsAppOperationAudit.create({
          data: {
            actorUserId: input.userId,
            eventType: "IDENTITY_MERGED",
            organizationId: input.organizationId,
            personIdentityId: review.personIdentityId,
            reasonCode: "ADMIN_CONFIRMED",
            actorPersonId: target.id
          }
        });
      });
    },

    async ignoreIdentity(reviewId, organizationId, userId) {
      const review = await client.identityReview.findFirst({
        where: { id: reviewId, organizationId, status: "PENDING" }
      });
      if (!review) throw new WhatsAppNativeServiceError("NOT_FOUND", "Identity review not found.");
      await client.$transaction([
        client.identityReview.update({
          data: {
            resolution: "IGNORED",
            resolvedAt: new Date(),
            resolvedByUserId: userId,
            status: "IGNORED"
          },
          where: { id: review.id }
        }),
        client.personIdentity.update({
          data: { verificationStatus: "REVOKED" },
          where: { id: review.personIdentityId }
        }),
        client.whatsAppOperationAudit.create({
          data: {
            actorUserId: userId,
            eventType: "IDENTITY_IGNORED",
            organizationId,
            personIdentityId: review.personIdentityId,
            reasonCode: "ADMIN_IGNORED"
          }
        })
      ]);
    },

    async updatePerson(input) {
      const result = await client.person.updateMany({
        data: {
          company: input.company,
          displayName: input.displayName,
          roleTitle: input.roleTitle,
          status: input.status,
          type: input.type
        },
        where: { id: input.personId, organizationId: input.organizationId }
      });
      if (!result.count) throw new WhatsAppNativeServiceError("NOT_FOUND", "Person not found.");
    },

    async updateParticipant(input) {
      const result = await client.projectParticipant.updateMany({
        data: { participantStatus: input.status, role: input.role },
        where: { id: input.participantId, organizationId: input.organizationId }
      });
      if (!result.count)
        throw new WhatsAppNativeServiceError("NOT_FOUND", "Project participant not found.");
    },

    async createInvitation(input) {
      await requireProject(client, input.projectId, input.organizationId);
      const existingInvitation = await client.whatsAppInvitation.findFirst({
        orderBy: { createdAt: "desc" },
        where: {
          expiresAt: { gt: new Date() },
          organizationId: input.organizationId,
          personId: input.personId,
          projectId: input.projectId,
          status: { in: ["PENDING", "QUEUED", "SENT", "JOINED"] }
        }
      });
      if (existingInvitation) {
        return { id: existingInvitation.id, status: existingInvitation.status };
      }
      const identity =
        (await client.personIdentity.findFirst({
          orderBy: { lastSeenAt: "desc" },
          where: {
            personId: input.personId,
            organizationId: input.organizationId,
            verificationStatus: "CONFIRMED",
            whatsappAccount: { status: "CONNECTED" }
          }
        })) ??
        (await client.personIdentity.findFirst({
          orderBy: { lastSeenAt: "desc" },
          where: {
            personId: input.personId,
            organizationId: input.organizationId,
            verificationStatus: "OBSERVED",
            whatsappAccount: { status: "CONNECTED" }
          }
        }));
      if (!identity)
        throw new WhatsAppNativeServiceError("NOT_FOUND", "WhatsApp identity not found.");
      const invitation = await client.whatsAppInvitation.create({
        data: {
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          invitedByUserId: input.invitedByUserId,
          organizationId: input.organizationId,
          personId: input.personId,
          personIdentityId: identity.id,
          projectId: input.projectId,
          role: input.role,
          status: "QUEUED",
          whatsappAccountId: identity.whatsappAccountId
        }
      });
      await queueWhatsAppInvitationDeliveryJob(client, {
        organizationId: input.organizationId,
        projectId: input.projectId,
        sourceId: invitation.id
      });
      await client.whatsAppOperationAudit.create({
        data: {
          actorPersonId: input.personId,
          actorUserId: input.invitedByUserId,
          eventType: "INVITATION_QUEUED",
          organizationId: input.organizationId,
          personIdentityId: identity.id,
          projectId: input.projectId
        }
      });
      return { id: invitation.id, status: invitation.status };
    },

    async getInvitation(token) {
      const invitation = await client.whatsAppInvitation.findUnique({
        include: { organization: true, person: true, project: true },
        where: { activationTokenHash: hashToken(token) }
      });
      return invitation
        ? {
            expiresAt: invitation.expiresAt,
            organizationName: invitation.organization.name,
            personName: invitation.person.displayName,
            projectName: invitation.project.name,
            status: invitation.status
          }
        : null;
    },

    async acceptInvitation(input) {
      const invitation = await client.whatsAppInvitation.findUnique({
        include: { person: true },
        where: { activationTokenHash: hashToken(input.token) }
      });
      if (!invitation || invitation.status !== "JOINED" || invitation.expiresAt <= new Date())
        throw new WhatsAppNativeServiceError("EXPIRED", "Invitation is invalid or expired.");
      const existingPerson = await client.person.findFirst({
        where: { organizationId: invitation.organizationId, userId: input.userId }
      });
      if (existingPerson && existingPerson.id !== invitation.personId)
        throw new WhatsAppNativeServiceError(
          "CONFLICT",
          "This account is already linked to another person."
        );
      await client.$transaction(async (tx) => {
        const membership = await tx.membership.upsert({
          create: {
            allProjects: false,
            organizationId: invitation.organizationId,
            role: invitation.role,
            userId: input.userId
          },
          update: {},
          where: {
            userId_organizationId: {
              organizationId: invitation.organizationId,
              userId: input.userId
            }
          }
        });
        await tx.projectAccess.upsert({
          create: { membershipId: membership.id, projectId: invitation.projectId },
          update: {},
          where: {
            membershipId_projectId: { membershipId: membership.id, projectId: invitation.projectId }
          }
        });
        await tx.person.update({
          data: { userId: input.userId },
          where: { id: invitation.personId }
        });
        await tx.personIdentity.update({
          data: { verificationStatus: "CONFIRMED" },
          where: { id: invitation.personIdentityId }
        });
        await tx.whatsAppInvitation.update({
          data: { acceptedAt: new Date(), activationTokenHash: null, status: "ACTIVATED" },
          where: { id: invitation.id }
        });
        await tx.whatsAppOperationAudit.create({
          data: {
            actorPersonId: invitation.personId,
            actorUserId: input.userId,
            eventType: "INVITATION_ACCEPTED",
            organizationId: invitation.organizationId,
            personIdentityId: invitation.personIdentityId,
            projectId: invitation.projectId
          }
        });
        await tx.whatsAppOperationAudit.create({
          data: {
            actorPersonId: invitation.personId,
            actorUserId: input.userId,
            eventType: "ORGANIZATION_MEMBERSHIP_CREATED",
            organizationId: invitation.organizationId,
            personIdentityId: invitation.personIdentityId,
            projectId: invitation.projectId
          }
        });
      });
      return { organizationId: invitation.organizationId, projectId: invitation.projectId };
    },

    async listAudits(recommendationId, organizationId) {
      return client.whatsAppOperationAudit.findMany({
        orderBy: { createdAt: "desc" },
        where: { organizationId, recommendationId }
      });
    }
  };
}

async function requireProject(client: PrismaClient, projectId: string, organizationId: string) {
  const project = await client.project.findFirst({ where: { id: projectId, organizationId } });
  if (!project) throw new WhatsAppNativeServiceError("NOT_FOUND", "Project not found.");
  return project;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
