import { Prisma, type PersonIdentity, type PrismaClient } from "@fieldos/db";

import { getPhoneNumberFromWhatsAppJid, isLidJid, isPhoneJid } from "./jid.js";

export interface WhatsAppGroupParticipantSnapshot {
  displayName?: string | null;
  isAdmin: boolean;
  jid?: string | null;
  lid?: string | null;
  metadata?: Record<string, boolean | number | string | null>;
  pushName?: string | null;
}

export interface ParticipantSyncSummary {
  createdPeople: number;
  found: number;
  ignored: number;
  matchedPeople: number;
  needsReview: number;
  removed: number;
}

export class WhatsAppParticipantSyncService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date()
  ) {}

  async syncGroup(
    mappingId: string,
    participants: WhatsAppGroupParticipantSnapshot[]
  ): Promise<ParticipantSyncSummary> {
    const mapping = await this.prisma.whatsAppChatMapping.findUnique({
      include: { whatsappAccount: true },
      where: { id: mappingId }
    });

    if (!mapping?.isGroup || mapping.status !== "ACTIVE" || !mapping.projectId) {
      throw new Error("An active project WhatsApp group is required for participant sync.");
    }

    const summary: ParticipantSyncSummary = {
      createdPeople: 0,
      found: participants.length,
      ignored: 0,
      matchedPeople: 0,
      needsReview: 0,
      removed: 0
    };
    const seenIdentityIds = new Set<string>();

    for (const participant of participants) {
      const identifiers = normalizeParticipantIdentifiers(participant);
      if (!identifiers.jid && !identifiers.lid) {
        summary.ignored += 1;
        continue;
      }

      const resolution = await this.resolveIdentity({
        ...identifiers,
        displayName: participant.displayName ?? participant.pushName ?? null,
        metadata: participant.metadata,
        organizationId: mapping.organizationId,
        pushName: participant.pushName ?? null,
        whatsappAccountId: mapping.whatsappAccountId
      });
      seenIdentityIds.add(resolution.identity.id);
      summary.createdPeople += resolution.createdPerson ? 1 : 0;
      summary.matchedPeople += resolution.matchedPerson ? 1 : 0;
      summary.needsReview += resolution.needsReview ? 1 : 0;

      await this.prisma.$transaction(async (tx) => {
        await tx.whatsAppGroupParticipant.upsert({
          create: {
            firstSeenAt: this.now(),
            isGroupAdmin: participant.isAdmin,
            lastSeenAt: this.now(),
            metadata: participant.metadata as Prisma.InputJsonValue | undefined,
            participantStatus: "ACTIVE",
            personIdentityId: resolution.identity.id,
            whatsappChatMappingId: mapping.id
          },
          update: {
            isGroupAdmin: participant.isAdmin,
            lastSeenAt: this.now(),
            metadata: participant.metadata as Prisma.InputJsonValue | undefined,
            participantStatus: "ACTIVE",
            removedAt: null
          },
          where: {
            whatsappChatMappingId_personIdentityId: {
              personIdentityId: resolution.identity.id,
              whatsappChatMappingId: mapping.id
            }
          }
        });
        await tx.projectParticipant.upsert({
          create: {
            firstSeenAt: this.now(),
            lastSeenAt: this.now(),
            organizationId: mapping.organizationId,
            participantStatus: "ACTIVE",
            personId: resolution.identity.personId,
            projectId: mapping.projectId!,
            source: "WHATSAPP_GROUP"
          },
          update: {
            lastSeenAt: this.now(),
            participantStatus: "ACTIVE",
            removedAt: null
          },
          where: {
            projectId_personId: {
              personId: resolution.identity.personId,
              projectId: mapping.projectId!
            }
          }
        });
        await tx.whatsAppOperationAudit.create({
          data: {
            eventType: "PARTICIPANT_DISCOVERED",
            metadata: { isGroupAdmin: participant.isAdmin },
            organizationId: mapping.organizationId,
            personIdentityId: resolution.identity.id,
            projectId: mapping.projectId,
            reasonCode: resolution.createdPerson
              ? "NEW_CONTACT"
              : resolution.matchedPerson
                ? "DETERMINISTIC_MATCH"
                : "KNOWN_IDENTITY"
          }
        });
      });
    }

    const removed = await this.prisma.whatsAppGroupParticipant.findMany({
      include: { personIdentity: true },
      where: {
        participantStatus: "ACTIVE",
        personIdentityId: seenIdentityIds.size ? { notIn: [...seenIdentityIds] } : undefined,
        whatsappChatMappingId: mapping.id
      }
    });

    for (const participant of removed) {
      await this.prisma.$transaction(async (tx) => {
        await tx.whatsAppGroupParticipant.update({
          data: {
            participantStatus: "INACTIVE",
            removedAt: this.now()
          },
          where: { id: participant.id }
        });
        const otherActiveGroup = await tx.whatsAppGroupParticipant.findFirst({
          where: {
            id: { not: participant.id },
            participantStatus: "ACTIVE",
            personIdentity: { personId: participant.personIdentity.personId },
            whatsappChatMapping: { projectId: mapping.projectId }
          }
        });
        if (!otherActiveGroup) {
          await tx.projectParticipant.updateMany({
            data: { participantStatus: "INACTIVE", removedAt: this.now() },
            where: {
              personId: participant.personIdentity.personId,
              projectId: mapping.projectId!,
              source: "WHATSAPP_GROUP"
            }
          });
        }
        await tx.whatsAppOperationAudit.create({
          data: {
            eventType: "PARTICIPANT_REMOVED",
            organizationId: mapping.organizationId,
            personIdentityId: participant.personIdentityId,
            projectId: mapping.projectId,
            reasonCode: "GROUP_MEMBERSHIP_REMOVED"
          }
        });
      });
      summary.removed += 1;
    }

    return summary;
  }

  private async resolveIdentity(input: {
    displayName: string | null;
    jid: string | null;
    lid: string | null;
    metadata?: Record<string, boolean | number | string | null>;
    organizationId: string;
    phoneNumber: string | null;
    pushName: string | null;
    whatsappAccountId: string;
  }): Promise<{
    createdPerson: boolean;
    identity: PersonIdentity;
    matchedPerson: boolean;
    needsReview: boolean;
  }> {
    const identifiers = [
      input.jid ? { jid: input.jid } : null,
      input.lid ? { lid: input.lid } : null
    ].filter((value): value is { jid: string } | { lid: string } => Boolean(value));
    const existing = await this.prisma.personIdentity.findMany({
      orderBy: { createdAt: "asc" },
      where: {
        OR: identifiers,
        whatsappAccountId: input.whatsappAccountId
      }
    });

    if (existing[0]) {
      const selectedIdentity =
        existing.find((identity) => identity.jid === input.jid) ??
        existing.find((identity) => identity.lid === input.lid) ??
        existing[0];
      const conflicting = existing.find(
        (identity) => identity.personId !== selectedIdentity.personId
      );
      const hasConflict = Boolean(conflicting);
      const needsReview = hasConflict || selectedIdentity.verificationStatus !== "CONFIRMED";
      const identity = await this.prisma.personIdentity.update({
        data: hasConflict
          ? {
              displayName: input.displayName ?? undefined,
              lastSeenAt: this.now(),
              metadata: input.metadata as Prisma.InputJsonValue | undefined,
              pushName: input.pushName ?? undefined,
              verificationStatus: "NEEDS_REVIEW"
            }
          : {
              displayName: input.displayName ?? undefined,
              lastSeenAt: this.now(),
              metadata: input.metadata as Prisma.InputJsonValue | undefined,
              phoneNumber: input.phoneNumber ?? undefined,
              pushName: input.pushName ?? undefined
            },
        where: { id: selectedIdentity.id }
      });
      if (hasConflict) {
        await this.ensureIdentityReview(identity.id, input.organizationId, "JID_LID_CONFLICT");
        await this.prisma.personIdentity.update({
          data: { verificationStatus: "NEEDS_REVIEW" },
          where: { id: conflicting!.id }
        });
        await this.ensureIdentityReview(conflicting!.id, input.organizationId, "JID_LID_CONFLICT");
      }
      return { createdPerson: false, identity, matchedPerson: false, needsReview };
    }

    const confirmedPhoneMatch = input.phoneNumber
      ? await this.prisma.personIdentity.findFirst({
          where: {
            organizationId: input.organizationId,
            phoneNumber: input.phoneNumber,
            verificationStatus: "CONFIRMED"
          }
        })
      : null;
    const createdPerson = !confirmedPhoneMatch;
    const person = confirmedPhoneMatch
      ? await this.prisma.person.findUniqueOrThrow({ where: { id: confirmedPhoneMatch.personId } })
      : await this.prisma.person.create({
          data: {
            displayName: input.displayName ?? input.phoneNumber ?? "WhatsApp contact",
            organizationId: input.organizationId,
            phoneNumber: input.phoneNumber,
            type: "UNKNOWN"
          }
        });
    const identity = await this.prisma.personIdentity.create({
      data: {
        displayName: input.displayName,
        jid: input.jid,
        lastSeenAt: this.now(),
        lid: input.lid,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        organizationId: input.organizationId,
        personId: person.id,
        phoneNumber: input.phoneNumber,
        pushName: input.pushName,
        verificationStatus: confirmedPhoneMatch ? "CONFIRMED" : "OBSERVED",
        whatsappAccountId: input.whatsappAccountId
      }
    });
    if (createdPerson) {
      await this.ensureIdentityReview(identity.id, input.organizationId, "MANUAL_REVIEW");
    }
    return {
      createdPerson,
      identity,
      matchedPerson: Boolean(confirmedPhoneMatch),
      needsReview: createdPerson
    };
  }

  private async ensureIdentityReview(
    personIdentityId: string,
    organizationId: string,
    reason: "JID_LID_CONFLICT" | "MANUAL_REVIEW"
  ): Promise<void> {
    await this.prisma.identityReview.upsert({
      create: { organizationId, personIdentityId, reason, status: "PENDING" },
      update: { reason },
      where: { personIdentityId_status: { personIdentityId, status: "PENDING" } }
    });
  }
}

export function normalizeParticipantIdentifiers(input: WhatsAppGroupParticipantSnapshot): {
  jid: string | null;
  lid: string | null;
  phoneNumber: string | null;
} {
  const jid = input.jid && isPhoneJid(input.jid) ? input.jid : null;
  const lid =
    input.lid && isLidJid(input.lid)
      ? input.lid
      : input.jid && isLidJid(input.jid)
        ? input.jid
        : null;
  return {
    jid,
    lid,
    phoneNumber: getPhoneNumberFromWhatsAppJid(jid)
  };
}
