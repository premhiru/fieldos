import { createHash, randomBytes } from "node:crypto";

import {
  isSensitiveRecommendation,
  isWithinQuietHours,
  parseWhatsAppRecommendationCommand,
  recommendationExpiresAt,
  recommendationImpact,
  recommendationReference,
  settingAllowsRecommendation,
  type WhatsAppControlMessageHandler,
  type WhatsAppControlMessageInput,
  type WhatsAppRecommendationCommand
} from "@fieldos/baileys-whatsapp";
import type { ProjectCoordinatorRuntime } from "@fieldos/coordinators";
import {
  type Prisma,
  type PrismaClient,
  type Recommendation,
  type RecommendationDelivery,
  type RecommendationResponseCommand
} from "@fieldos/db";
import { createLogger } from "@fieldos/shared";

interface WhatsAppNativeOperationsOptions {
  appUrl: string;
  deliveryEnabled: boolean;
  invitationsEnabled: boolean;
  replyEnabled: boolean;
  sendText(input: {
    destinationJid: string;
    organizationId: string;
    text: string;
    whatsappAccountId: string;
  }): Promise<{ externalMessageId: string }>;
}

export class WhatsAppOperationDeferredError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs: number
  ) {
    super(message);
    this.name = "WhatsAppOperationDeferredError";
  }
}

type DeliveryWithContext = Prisma.RecommendationDeliveryGetPayload<{
  include: {
    project: true;
    recommendation: { include: { decisionCandidate: true } };
    recipientIdentity: { include: { person: true } };
  };
}>;

export class WhatsAppNativeOperationsService implements WhatsAppControlMessageHandler {
  private readonly logger = createLogger("whatsapp-native-operations");

  constructor(
    private readonly prisma: PrismaClient,
    private readonly coordinatorRuntime: ProjectCoordinatorRuntime,
    private readonly options: WhatsAppNativeOperationsOptions,
    private readonly now: () => Date = () => new Date()
  ) {}

  async deliverRecommendation(recommendationId: string): Promise<number> {
    if (!this.options.deliveryEnabled) return 0;

    const recommendation = await this.prisma.recommendation.findUnique({
      include: {
        decisionCandidate: true,
        project: { include: { recommendationSetting: { include: { namedApprovers: true } } } }
      },
      where: { id: recommendationId }
    });
    const setting = recommendation?.project.recommendationSetting;
    if (
      !recommendation ||
      recommendation.status !== "PENDING" ||
      recommendation.decisionCandidate?.status !== "CREATED" ||
      !setting ||
      !settingAllowsRecommendation(setting, recommendation) ||
      (recommendation.snoozedUntil && recommendation.snoozedUntil > this.now()) ||
      (setting.routingMode === "PROJECT_GROUP" && isSensitiveRecommendation(recommendation))
    ) {
      return 0;
    }

    if (isWithinQuietHours(setting, this.now()) && recommendation.priority !== "URGENT") {
      throw new WhatsAppOperationDeferredError(
        "Recommendation delivery deferred by project quiet hours.",
        30 * 60 * 1000
      );
    }

    const recipients = await this.resolveRecipients(recommendation, setting);
    let sentCount = 0;
    let deferredRetryMs = 0;
    for (const recipient of recipients) {
      const dailyStart = new Date(this.now());
      dailyStart.setUTCHours(0, 0, 0, 0);
      const cooldownStart = new Date(
        this.now().getTime() - setting.deliveryCooldownMinutes * 60 * 1000
      );
      const [recipientCount, projectCount, recentDelivery] = await Promise.all([
        this.prisma.recommendationDelivery.count({
          where: {
            createdAt: { gte: dailyStart },
            recipientKey: recipient.recipientKey,
            deliveryStatus: { in: ["SENT", "DELIVERED", "READ", "RESPONDED"] }
          }
        }),
        this.prisma.recommendationDelivery.count({
          where: {
            createdAt: { gte: dailyStart },
            projectId: recommendation.projectId,
            deliveryStatus: { in: ["SENT", "DELIVERED", "READ", "RESPONDED"] }
          }
        }),
        this.prisma.recommendationDelivery.findFirst({
          select: { id: true },
          where: {
            createdAt: { gte: cooldownStart },
            projectId: recommendation.projectId,
            recipientKey: recipient.recipientKey,
            recommendationId: { not: recommendation.id },
            deliveryStatus: { in: ["SENT", "DELIVERED", "READ"] }
          }
        })
      ]);
      if (
        recipientCount >= setting.dailyRecipientLimit ||
        projectCount >= setting.dailyProjectLimit
      ) {
        deferredRetryMs = Math.max(deferredRetryMs, 60 * 60 * 1000);
        continue;
      }
      if (recentDelivery) {
        deferredRetryMs = Math.max(
          deferredRetryMs,
          Math.max(setting.deliveryCooldownMinutes * 60 * 1000, 60_000)
        );
        continue;
      }

      const expiresAt = recommendationExpiresAt(recommendation.priority, this.now());
      const delivery = await this.prisma.recommendationDelivery.upsert({
        create: {
          deliveryStatus: "QUEUED",
          destinationJid: recipient.destinationJid,
          expiresAt,
          impact: recommendationImpact(recommendation.proposedActionType),
          organizationId: recommendation.organizationId,
          projectId: recommendation.projectId,
          recommendationId: recommendation.id,
          recipientIdentityId: recipient.recipientIdentityId,
          recipientKey: recipient.recipientKey,
          recipientPersonId: recipient.recipientPersonId,
          whatsappAccountId: recipient.whatsappAccountId,
          whatsappChatMappingId: recipient.whatsappChatMappingId
        },
        update: {},
        where: {
          recommendationId_recipientKey: {
            recommendationId: recommendation.id,
            recipientKey: recipient.recipientKey
          }
        }
      });
      if (delivery.outboundMessageId || delivery.deliveryStatus === "RESPONDED") continue;

      try {
        const result = await this.options.sendText({
          destinationJid: recipient.destinationJid,
          organizationId: recommendation.organizationId,
          text: formatRecommendation(recommendation, recommendation.project, expiresAt),
          whatsappAccountId: recipient.whatsappAccountId
        });
        await this.prisma.$transaction([
          this.prisma.recommendationDelivery.update({
            data: {
              attemptCount: { increment: 1 },
              deliveredAt: this.now(),
              deliveryStatus: "SENT",
              failureReason: null,
              lastAttemptAt: this.now(),
              outboundMessageId: result.externalMessageId,
              quotedMessageKey: result.externalMessageId
            },
            where: { id: delivery.id }
          }),
          this.audit({
            deliveryId: delivery.id,
            eventType: "RECOMMENDATION_SENT",
            organizationId: recommendation.organizationId,
            projectId: recommendation.projectId,
            providerMessageId: result.externalMessageId,
            recommendationId: recommendation.id
          })
        ]);
        sentCount += 1;
      } catch (error) {
        const failureReason = error instanceof Error ? error.message.slice(0, 500) : "Send failed";
        await this.prisma.$transaction([
          this.prisma.recommendationDelivery.update({
            data: {
              attemptCount: { increment: 1 },
              deliveryStatus: "FAILED",
              failureReason,
              lastAttemptAt: this.now()
            },
            where: { id: delivery.id }
          }),
          this.audit({
            deliveryId: delivery.id,
            eventType: "RECOMMENDATION_DELIVERY_FAILED",
            organizationId: recommendation.organizationId,
            projectId: recommendation.projectId,
            reasonCode: "BAILEYS_SEND_FAILED",
            recommendationId: recommendation.id
          })
        ]);
        throw error;
      }
    }
    if (deferredRetryMs > 0) {
      throw new WhatsAppOperationDeferredError(
        "Recommendation delivery deferred by notification controls.",
        deferredRetryMs
      );
    }
    return sentCount;
  }

  async deliverInvitation(invitationId: string): Promise<void> {
    if (!this.options.invitationsEnabled) return;
    const invitation = await this.prisma.whatsAppInvitation.findUnique({
      include: { person: true, personIdentity: true, project: true },
      where: { id: invitationId }
    });
    if (!invitation || !["PENDING", "QUEUED", "FAILED"].includes(invitation.status)) return;
    const destinationJid = invitation.personIdentity.jid ?? invitation.personIdentity.lid;
    if (!destinationJid || invitation.expiresAt <= this.now()) {
      await this.prisma.whatsAppInvitation.update({
        data: { status: invitation.expiresAt <= this.now() ? "EXPIRED" : "FAILED" },
        where: { id: invitation.id }
      });
      return;
    }
    const result = await this.options.sendText({
      destinationJid,
      organizationId: invitation.organizationId,
      text: `${invitation.person.displayName}, you have been invited to join ${invitation.project.name} in FieldOS.\n\nReply JOIN to continue.\n\nThis invitation expires ${formatDate(invitation.expiresAt, invitation.project.timezone)}.`,
      whatsappAccountId: invitation.whatsappAccountId
    });
    await this.prisma.$transaction([
      this.prisma.whatsAppInvitation.update({
        data: { failureReason: null, outboundMessageId: result.externalMessageId, status: "SENT" },
        where: { id: invitation.id }
      }),
      this.audit({
        actorPersonId: invitation.personId,
        eventType: "INVITATION_SENT",
        organizationId: invitation.organizationId,
        personIdentityId: invitation.personIdentityId,
        projectId: invitation.projectId,
        providerMessageId: result.externalMessageId
      })
    ]);
  }

  async handle(
    input: WhatsAppControlMessageInput
  ): Promise<{ handled: boolean; replyText?: string }> {
    const command = parseWhatsAppRecommendationCommand(input.body);
    if (!command) return { handled: false };
    if (!this.options.replyEnabled) return { handled: true };
    if (command.type === "JOIN") return this.handleJoin(input);

    const identity = await this.resolveSenderIdentity(input);
    if (!identity) {
      await this.audit({
        authorizationResult: "DENIED",
        command: command.type,
        eventType: "RECOMMENDATION_RESPONSE_DENIED",
        organizationId: input.organizationId,
        providerMessageId: input.inboundMessageId,
        reasonCode: "UNVERIFIED_IDENTITY"
      });
      return {
        handled: true,
        replyText: "This WhatsApp identity is not authorized to review FieldOS recommendations."
      };
    }

    if (command.type === "REASON") return this.handleReason(input, identity.id, command.reason);
    const delivery = await this.resolveDelivery(input, identity.id, command);
    if (!delivery) {
      await this.audit({
        actorPersonId: identity.personId,
        actorUserId: identity.person.userId,
        authorizationResult: "DENIED",
        command: command.type,
        eventType: "RECOMMENDATION_RESPONSE_AMBIGUOUS",
        organizationId: input.organizationId,
        personIdentityId: identity.id,
        providerMessageId: input.inboundMessageId,
        reasonCode: "DELIVERY_NOT_RESOLVED"
      });
      return {
        handled: true,
        replyText:
          "I could not identify which FieldOS recommendation you are responding to.\n\nPlease reply directly to the original recommendation message."
      };
    }

    const duplicate = await this.prisma.recommendationResponse.findUnique({
      where: {
        deliveryId_inboundMessageId: {
          deliveryId: delivery.id,
          inboundMessageId: input.inboundMessageId
        }
      }
    });
    if (duplicate) {
      await this.audit({
        actorPersonId: identity.personId,
        actorUserId: identity.person.userId,
        authorizationResult: "AUTHORIZED",
        command: command.type,
        deliveryId: delivery.id,
        eventType: "RECOMMENDATION_RESPONSE_DUPLICATE",
        organizationId: input.organizationId,
        personIdentityId: identity.id,
        projectId: delivery.projectId,
        providerMessageId: input.inboundMessageId,
        reasonCode: "IDEMPOTENT_REPLAY",
        recommendationId: delivery.recommendationId
      });
      return { handled: true, replyText: "This response was already processed." };
    }

    const authorization = await this.authorize(identity, delivery, input.isGroup);
    if (!authorization.allowed) {
      await this.recordResponse(
        delivery,
        identity.id,
        input.inboundMessageId,
        command,
        "DENIED",
        authorization.reason,
        identity.person.userId
      );
      return { handled: true, replyText: "You are not authorized to act on this recommendation." };
    }
    if (delivery.expiresAt <= this.now()) {
      await this.expireDelivery(delivery);
      await this.recordResponse(
        delivery,
        identity.id,
        input.inboundMessageId,
        command,
        "EXPIRED",
        "DELIVERY_EXPIRED",
        identity.person.userId
      );
      return {
        handled: true,
        replyText: "This recommendation has expired and can no longer be actioned."
      };
    }
    if (
      !["SENT", "DELIVERED", "READ", "AWAITING_CONFIRMATION"].includes(delivery.deliveryStatus) ||
      delivery.recommendation.decisionCandidate?.status !== "CREATED"
    ) {
      await this.recordResponse(
        delivery,
        identity.id,
        input.inboundMessageId,
        command,
        "NOOP",
        "DELIVERY_NOT_ACTIONABLE",
        identity.person.userId
      );
      return {
        handled: true,
        replyText: "This recommendation delivery is no longer current. No action was taken."
      };
    }
    if (delivery.recommendation.snoozedUntil && delivery.recommendation.snoozedUntil > this.now()) {
      await this.recordResponse(
        delivery,
        identity.id,
        input.inboundMessageId,
        command,
        "NOOP",
        "RECOMMENDATION_SNOOZED",
        identity.person.userId
      );
      return {
        handled: true,
        replyText: `This recommendation is snoozed until ${formatDate(delivery.recommendation.snoozedUntil, delivery.project.timezone)}.`
      };
    }
    if (delivery.recommendation.status !== "PENDING") {
      await this.recordResponse(
        delivery,
        identity.id,
        input.inboundMessageId,
        command,
        "NOOP",
        "NOT_PENDING",
        identity.person.userId
      );
      return {
        handled: true,
        replyText: `This recommendation is no longer pending. Its current status is ${delivery.recommendation.status.toLowerCase()}.`
      };
    }

    return this.applyCommand(input, identity, delivery, command);
  }

  private async applyCommand(
    input: WhatsAppControlMessageInput,
    identity: Awaited<ReturnType<WhatsAppNativeOperationsService["resolveSenderIdentity"]>> & {},
    delivery: DeliveryWithContext,
    command: WhatsAppRecommendationCommand
  ): Promise<{ handled: true; replyText: string }> {
    const userId = identity.person.userId!;
    if (command.type === "DETAILS") {
      await this.recordResponse(
        delivery,
        identity.id,
        input.inboundMessageId,
        command,
        "DETAILS_SENT",
        null,
        userId
      );
      const evidence =
        delivery.recommendation.decisionCandidate?.evidenceSummary ||
        "Evidence is available in FieldOS.";
      return {
        handled: true,
        replyText: `${delivery.recommendation.title}\n\n${delivery.recommendation.description}\n\nEvidence: ${evidence.slice(0, 800)}\n\nReview securely in FieldOS: ${this.options.appUrl}/recommendations/${delivery.recommendationId}`
      };
    }
    if (command.type === "SNOOZE") {
      const snoozedUntil = new Date(this.now().getTime() + command.days * 24 * 60 * 60 * 1000);
      await this.recordResponse(
        delivery,
        identity.id,
        input.inboundMessageId,
        command,
        "SNOOZED",
        null,
        userId,
        [
          this.prisma.recommendation.update({
            data: { snoozedUntil },
            where: { id: delivery.recommendationId }
          })
        ]
      );
      return {
        handled: true,
        replyText: `Snoozed until ${formatDate(snoozedUntil, delivery.project.timezone)}.`
      };
    }
    if (command.type === "REJECT") {
      await this.coordinatorRuntime.dismissRecommendation({
        dismissReason: "Rejected via WhatsApp",
        recommendationId: delivery.recommendationId,
        userId
      });
      await this.finishDeliveries(delivery.recommendationId, delivery.id, "RESPONDED");
      await this.recordResponse(
        delivery,
        identity.id,
        input.inboundMessageId,
        command,
        "APPLIED",
        null,
        userId
      );
      return {
        handled: true,
        replyText: "Recommendation rejected.\n\nYou may reply with:\nREASON: <your reason>"
      };
    }
    if (command.type === "APPROVE") {
      const setting = await this.prisma.whatsAppRecommendationSetting.findUnique({
        where: { projectId: delivery.projectId }
      });
      if (
        delivery.impact === "HIGH_IMPACT" &&
        setting?.requireSecondConfirmationForHighImpact !== false &&
        delivery.confirmationExpiresAt === null
      ) {
        const confirmationExpiresAt = new Date(
          Math.min(delivery.expiresAt.getTime(), this.now().getTime() + 15 * 60 * 1000)
        );
        await this.recordResponse(
          delivery,
          identity.id,
          input.inboundMessageId,
          command,
          "AWAITING_CONFIRMATION",
          null,
          userId,
          [
            this.prisma.recommendationDelivery.update({
              data: { confirmationExpiresAt, deliveryStatus: "AWAITING_CONFIRMATION" },
              where: { id: delivery.id }
            })
          ]
        );
        return {
          handled: true,
          replyText: `You are approving: ${delivery.recommendation.title}\n\nReply CONFIRM ${recommendationReference(delivery.recommendationId)} or CANCEL ${recommendationReference(delivery.recommendationId)}.`
        };
      }
      return this.approve(input, identity.id, userId, delivery, command);
    }
    if (command.type === "CONFIRM") {
      if (
        command.reference !== recommendationReference(delivery.recommendationId) ||
        delivery.deliveryStatus !== "AWAITING_CONFIRMATION" ||
        !delivery.confirmationExpiresAt ||
        delivery.confirmationExpiresAt <= this.now()
      ) {
        await this.recordResponse(
          delivery,
          identity.id,
          input.inboundMessageId,
          command,
          "DENIED",
          "INVALID_CONFIRMATION",
          userId
        );
        return {
          handled: true,
          replyText: "That confirmation is invalid or has expired. No action was taken."
        };
      }
      return this.approve(input, identity.id, userId, delivery, command);
    }
    if (command.type === "CANCEL") {
      await this.recordResponse(
        delivery,
        identity.id,
        input.inboundMessageId,
        command,
        "NOOP",
        "CONFIRMATION_CANCELLED",
        userId,
        [
          this.prisma.recommendationDelivery.update({
            data: { confirmationExpiresAt: null, deliveryStatus: "SENT" },
            where: { id: delivery.id }
          })
        ]
      );
      return { handled: true, replyText: "Approval cancelled. No action was taken." };
    }
    return { handled: true, replyText: "This command is not valid for a recommendation." };
  }

  private async approve(
    input: WhatsAppControlMessageInput,
    identityId: string,
    userId: string,
    delivery: DeliveryWithContext,
    command: WhatsAppRecommendationCommand
  ): Promise<{ handled: true; replyText: string }> {
    const result = await this.coordinatorRuntime.approveRecommendation({
      recommendationId: delivery.recommendationId,
      userId
    });
    await this.finishDeliveries(delivery.recommendationId, delivery.id, "RESPONDED");
    await this.recordResponse(
      delivery,
      identityId,
      input.inboundMessageId,
      command,
      "APPLIED",
      null,
      userId
    );
    const detail = result.actionItemId
      ? "An Action Item was created."
      : result.draft
        ? "A WhatsApp draft was prepared for review in FieldOS. No external message was sent."
        : "The approved action was recorded in FieldOS.";
    return {
      handled: true,
      replyText: `Approved.\n\n${detail}\n\nProject: ${delivery.project.name}`
    };
  }

  private async handleJoin(
    input: WhatsAppControlMessageInput
  ): Promise<{ handled: true; replyText: string }> {
    if (!this.options.invitationsEnabled || !input.quotedMessageId) {
      return { handled: true, replyText: "Please reply JOIN directly to your FieldOS invitation." };
    }
    const identity = await this.resolveSenderIdentity(input, false);
    const invitation = identity
      ? await this.prisma.whatsAppInvitation.findFirst({
          include: { project: true },
          where: {
            expiresAt: { gt: this.now() },
            outboundMessageId: input.quotedMessageId,
            personIdentityId: identity.id,
            status: "SENT"
          }
        })
      : null;
    if (!invitation)
      return { handled: true, replyText: "This invitation is invalid or has expired." };
    const token = randomBytes(32).toString("base64url");
    await this.prisma.$transaction([
      this.prisma.whatsAppInvitation.update({
        data: {
          activationTokenHash: createHash("sha256").update(token).digest("hex"),
          joinConfirmedAt: this.now(),
          status: "JOINED"
        },
        where: { id: invitation.id }
      }),
      this.audit({
        actorPersonId: invitation.personId,
        command: "JOIN",
        eventType: "INVITATION_JOIN_CONFIRMED",
        organizationId: invitation.organizationId,
        personIdentityId: invitation.personIdentityId,
        projectId: invitation.projectId,
        providerMessageId: input.inboundMessageId
      })
    ]);
    return {
      handled: true,
      replyText: `Continue securely in FieldOS:\n${this.options.appUrl}/whatsapp-invite#token=${token}\n\nThis single-use link expires ${formatDate(invitation.expiresAt, invitation.project.timezone)}.`
    };
  }

  private async handleReason(
    input: WhatsAppControlMessageInput,
    identityId: string,
    reason: string
  ) {
    const response = await this.prisma.recommendationResponse.findFirst({
      include: { delivery: true },
      orderBy: { createdAt: "desc" },
      where: {
        actorIdentityId: identityId,
        command: "REJECT",
        createdAt: { gte: new Date(this.now().getTime() - 60 * 60 * 1000) }
      }
    });
    if (!response)
      return { handled: true, replyText: "I could not find a recent rejection for this reason." };
    await this.prisma.recommendation.update({
      data: { dismissReason: reason },
      where: { id: response.recommendationId }
    });
    await this.prisma.recommendationResponse.create({
      data: {
        actorIdentityId: identityId,
        actorUserId: response.actorUserId,
        command: "REASON",
        deliveryId: response.deliveryId,
        inboundMessageId: input.inboundMessageId,
        organizationId: response.organizationId,
        outcome: "APPLIED",
        projectId: response.projectId,
        recommendationId: response.recommendationId
      }
    });
    return { handled: true, replyText: "Reason recorded." };
  }

  private async resolveSenderIdentity(input: WhatsAppControlMessageInput, requireConfirmed = true) {
    return this.prisma.personIdentity.findFirst({
      include: { person: true },
      where: {
        OR: [{ jid: input.senderJid }, { lid: input.senderJid }],
        organizationId: input.organizationId,
        verificationStatus: requireConfirmed ? "CONFIRMED" : { in: ["OBSERVED", "CONFIRMED"] },
        whatsappAccountId: input.accountId
      }
    });
  }

  private async resolveDelivery(
    input: WhatsAppControlMessageInput,
    identityId: string,
    command: WhatsAppRecommendationCommand
  ): Promise<DeliveryWithContext | null> {
    const reference =
      command.type === "CONFIRM" || command.type === "CANCEL" ? command.reference : null;
    const query = {
      include: {
        project: true,
        recommendation: { include: { decisionCandidate: true } },
        recipientIdentity: { include: { person: true } }
      },
      orderBy: { createdAt: "desc" as const }
    };
    if (reference) {
      const matches = await this.prisma.recommendationDelivery.findMany({
        ...query,
        take: 2,
        where: {
          organizationId: input.organizationId,
          whatsappAccountId: input.accountId,
          OR: [
            { recipientIdentityId: identityId },
            { recipientIdentityId: null, whatsappChatMappingId: { not: null } }
          ],
          recommendation: {
            id: { endsWith: reference.slice(4).toLowerCase(), mode: "insensitive" }
          }
        }
      });
      return matches.length === 1 ? matches[0]! : null;
    }
    return this.prisma.recommendationDelivery.findFirst({
      ...query,
      where: input.quotedMessageId
        ? {
            organizationId: input.organizationId,
            outboundMessageId: input.quotedMessageId,
            whatsappAccountId: input.accountId
          }
        : { id: "__ambiguous_unquoted_command__" }
    });
  }

  private async authorize(
    identity: NonNullable<
      Awaited<ReturnType<WhatsAppNativeOperationsService["resolveSenderIdentity"]>>
    >,
    delivery: DeliveryWithContext,
    isGroup: boolean
  ) {
    if (!identity.person.userId) return { allowed: false, reason: "NO_PLATFORM_USER" };
    if (!isGroup && delivery.recipientIdentityId !== identity.id) {
      return { allowed: false, reason: "WRONG_RECIPIENT" };
    }
    if (isGroup) {
      const setting = await this.prisma.whatsAppRecommendationSetting.findUnique({
        include: { namedApprovers: true },
        where: { projectId: delivery.projectId }
      });
      if (!setting?.groupApprovalsEnabled || !delivery.whatsappChatMappingId)
        return { allowed: false, reason: "GROUP_APPROVAL_DISABLED" };
      if (!setting.namedApprovers.some((approver) => approver.personId === identity.personId)) {
        return { allowed: false, reason: "GROUP_APPROVER_DENIED" };
      }
    }
    const membership = await this.prisma.membership.findUnique({
      include: { projectAccess: { where: { projectId: delivery.projectId } } },
      where: {
        userId_organizationId: {
          organizationId: delivery.organizationId,
          userId: identity.person.userId
        }
      }
    });
    return membership && (membership.allProjects || membership.projectAccess.length > 0)
      ? { allowed: true, reason: null }
      : { allowed: false, reason: "PROJECT_ACCESS_DENIED" };
  }

  private async resolveRecipients(
    recommendation: Recommendation,
    setting: Prisma.WhatsAppRecommendationSettingGetPayload<{ include: { namedApprovers: true } }>
  ) {
    const account = await this.prisma.whatsAppAccount.findFirst({
      where: { organizationId: recommendation.organizationId, status: "CONNECTED" }
    });
    if (!account || setting.routingMode === "PLATFORM_ONLY") return [];
    if (setting.routingMode === "PROJECT_GROUP") {
      const mapping = await this.prisma.whatsAppChatMapping.findFirst({
        where: {
          isGroup: true,
          projectId: recommendation.projectId,
          status: "ACTIVE",
          whatsappAccountId: account.id
        }
      });
      return mapping
        ? [
            {
              destinationJid: mapping.jid,
              recipientIdentityId: null,
              recipientKey: `group:${mapping.id}`,
              recipientPersonId: null,
              whatsappAccountId: account.id,
              whatsappChatMappingId: mapping.id
            }
          ]
        : [];
    }
    const peopleWhere: Prisma.PersonWhereInput =
      setting.routingMode === "PRIVATE_NAMED_APPROVERS"
        ? { id: { in: setting.namedApprovers.map((item) => item.personId) } }
        : setting.routingMode === "PRIVATE_PROJECT_MANAGER"
          ? {
              projectParticipants: {
                some: {
                  participantStatus: "ACTIVE",
                  projectId: recommendation.projectId,
                  role: "PROJECT_MANAGER"
                }
              }
            }
          : {
              identities: { some: { isConnectedAccountOwner: true, whatsappAccountId: account.id } }
            };
    const people = await this.prisma.person.findMany({
      include: {
        identities: { where: { verificationStatus: "CONFIRMED", whatsappAccountId: account.id } },
        user: {
          include: {
            memberships: {
              include: { projectAccess: true },
              where: { organizationId: recommendation.organizationId }
            }
          }
        }
      },
      where: {
        ...peopleWhere,
        organizationId: recommendation.organizationId,
        status: "ACTIVE",
        userId: { not: null }
      }
    });
    return people.flatMap((person) =>
      person.identities.flatMap((identity) => {
        const membership = person.user?.memberships[0];
        const hasAccess =
          membership &&
          (membership.allProjects ||
            membership.projectAccess.some(
              (access) => access.projectId === recommendation.projectId
            ));
        const destinationJid = identity.jid ?? identity.lid;
        return hasAccess && destinationJid
          ? [
              {
                destinationJid,
                recipientIdentityId: identity.id,
                recipientKey: `identity:${identity.id}`,
                recipientPersonId: person.id,
                whatsappAccountId: account.id,
                whatsappChatMappingId: null
              }
            ]
          : [];
      })
    );
  }

  private async recordResponse(
    delivery: DeliveryWithContext,
    identityId: string,
    inboundMessageId: string,
    command: WhatsAppRecommendationCommand,
    outcome: Prisma.RecommendationResponseCreateInput["outcome"],
    reasonCode: string | null,
    userId: string | null,
    operations: Prisma.PrismaPromise<unknown>[] = []
  ) {
    const actorIdentity = await this.prisma.personIdentity.findUnique({
      select: { personId: true },
      where: { id: identityId }
    });
    await this.prisma.$transaction([
      ...operations,
      this.prisma.recommendationResponse.create({
        data: {
          actorIdentityId: identityId,
          actorUserId: userId,
          command: responseCommand(command),
          deliveryId: delivery.id,
          inboundMessageId,
          organizationId: delivery.organizationId,
          outcome,
          projectId: delivery.projectId,
          reasonCode,
          recommendationId: delivery.recommendationId
        }
      }),
      this.audit({
        actorPersonId: actorIdentity?.personId ?? null,
        actorUserId: userId,
        authorizationResult: outcome === "DENIED" ? "DENIED" : "AUTHORIZED",
        command: command.type,
        deliveryId: delivery.id,
        eventType: "RECOMMENDATION_RESPONSE_RECEIVED",
        organizationId: delivery.organizationId,
        personIdentityId: identityId,
        projectId: delivery.projectId,
        providerMessageId: inboundMessageId,
        reasonCode,
        recommendationId: delivery.recommendationId
      })
    ]);
  }

  private async finishDeliveries(
    recommendationId: string,
    activeDeliveryId: string,
    activeStatus: "RESPONDED"
  ) {
    await this.prisma.$transaction([
      this.prisma.recommendationDelivery.update({
        data: { deliveryStatus: activeStatus, respondedAt: this.now() },
        where: { id: activeDeliveryId }
      }),
      this.prisma.recommendationDelivery.updateMany({
        data: { deliveryStatus: "SUPERSEDED" },
        where: {
          id: { not: activeDeliveryId },
          recommendationId,
          deliveryStatus: {
            in: ["PENDING", "QUEUED", "SENT", "DELIVERED", "READ", "AWAITING_CONFIRMATION"]
          }
        }
      })
    ]);
  }

  private async expireDelivery(delivery: RecommendationDelivery) {
    await this.prisma.recommendationDelivery.update({
      data: { deliveryStatus: "EXPIRED" },
      where: { id: delivery.id }
    });
  }

  private audit(data: Prisma.WhatsAppOperationAuditUncheckedCreateInput) {
    return this.prisma.whatsAppOperationAudit.create({ data });
  }
}

function responseCommand(command: WhatsAppRecommendationCommand): RecommendationResponseCommand {
  if (command.type === "SNOOZE")
    return command.days === 1
      ? "SNOOZE_1_DAY"
      : command.days === 3
        ? "SNOOZE_3_DAYS"
        : "SNOOZE_1_WEEK";
  return command.type;
}

function formatRecommendation(
  recommendation: Recommendation & {
    decisionCandidate?: { evidenceSummary: string } | null;
  },
  project: { name: string; timezone: string },
  expiresAt: Date
): string {
  const evidence = recommendation.decisionCandidate?.evidenceSummary?.trim();
  return `FieldOS Recommendation - ${recommendationReference(recommendation.id)}\n\nProject: ${project.name}\n\nWhat happened:\n${recommendation.description}\n\nWhy it matters:\n${recommendation.reason}\n\nRecommended action:\n${recommendation.title}\n\nEvidence:\n${evidence ? evidence.slice(0, 700) : "Open FieldOS for the supporting project evidence."}\n\nReply to this message with:\nAPPROVE\nREJECT\nDETAILS\nSNOOZE 1 DAY\n\nExpires: ${formatDate(expiresAt, project.timezone)}`;
}

function formatDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone
  }).format(date);
}
