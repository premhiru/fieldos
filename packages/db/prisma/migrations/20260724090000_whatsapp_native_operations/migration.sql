-- CreateEnum
CREATE TYPE "PersonType" AS ENUM ('INTERNAL', 'EXTERNAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MERGED', 'IGNORED');

-- CreateEnum
CREATE TYPE "PersonIdentityProvider" AS ENUM ('WHATSAPP');

-- CreateEnum
CREATE TYPE "IdentityVerificationStatus" AS ENUM ('OBSERVED', 'CONFIRMED', 'NEEDS_REVIEW', 'REVOKED');

-- CreateEnum
CREATE TYPE "ProjectParticipantSource" AS ENUM ('WHATSAPP_GROUP', 'MANUAL', 'EMAIL_INVITE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ProjectParticipantStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "IdentityReviewReason" AS ENUM ('AMBIGUOUS_MATCH', 'JID_LID_CONFLICT', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "IdentityReviewStatus" AS ENUM ('PENDING', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "WhatsAppRecommendationRoutingMode" AS ENUM ('PRIVATE_PROJECT_MANAGER', 'PRIVATE_NAMED_APPROVERS', 'PRIVATE_CONNECTED_ACCOUNT_OWNER', 'PROJECT_GROUP', 'PLATFORM_ONLY');

-- CreateEnum
CREATE TYPE "RecommendationImpact" AS ENUM ('LOW_IMPACT', 'STANDARD', 'HIGH_IMPACT');

-- CreateEnum
CREATE TYPE "RecommendationDeliveryStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'AWAITING_CONFIRMATION', 'RESPONDED', 'FAILED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "RecommendationResponseCommand" AS ENUM ('APPROVE', 'REJECT', 'DETAILS', 'SNOOZE_1_DAY', 'SNOOZE_3_DAYS', 'SNOOZE_1_WEEK', 'CONFIRM', 'CANCEL', 'REASON', 'JOIN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RecommendationResponseOutcome" AS ENUM ('AUTHORIZED', 'DENIED', 'APPLIED', 'NOOP', 'DETAILS_SENT', 'SNOOZED', 'AWAITING_CONFIRMATION', 'EXPIRED', 'AMBIGUOUS', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "WhatsAppInvitationStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'JOINED', 'ACTIVATED', 'EXPIRED', 'REVOKED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProcessingJobType" ADD VALUE 'WHATSAPP_RECOMMENDATION_DELIVERY';
ALTER TYPE "ProcessingJobType" ADD VALUE 'WHATSAPP_GROUP_PARTICIPANT_SYNC';
ALTER TYPE "ProcessingJobType" ADD VALUE 'WHATSAPP_INVITATION_DELIVERY';

-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN     "snoozedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WhatsAppAccount" ADD COLUMN     "connectedByUserId" TEXT;

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "phoneNumber" TEXT,
    "company" TEXT,
    "roleTitle" TEXT,
    "type" "PersonType" NOT NULL DEFAULT 'UNKNOWN',
    "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "mergedIntoPersonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonIdentity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "provider" "PersonIdentityProvider" NOT NULL DEFAULT 'WHATSAPP',
    "whatsappAccountId" TEXT NOT NULL,
    "jid" TEXT,
    "lid" TEXT,
    "phoneNumber" TEXT,
    "displayName" TEXT,
    "pushName" TEXT,
    "verificationStatus" "IdentityVerificationStatus" NOT NULL DEFAULT 'OBSERVED',
    "isConnectedAccountOwner" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectParticipant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "source" "ProjectParticipantSource" NOT NULL,
    "role" TEXT,
    "participantStatus" "ProjectParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppGroupParticipant" (
    "id" TEXT NOT NULL,
    "whatsappChatMappingId" TEXT NOT NULL,
    "personIdentityId" TEXT NOT NULL,
    "participantStatus" "ProjectParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
    "isGroupAdmin" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppGroupParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityReview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "personIdentityId" TEXT NOT NULL,
    "suggestedPersonId" TEXT,
    "reason" "IdentityReviewReason" NOT NULL,
    "status" "IdentityReviewStatus" NOT NULL DEFAULT 'PENDING',
    "resolution" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentityReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppRecommendationSetting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "routingMode" "WhatsAppRecommendationRoutingMode" NOT NULL DEFAULT 'PLATFORM_ONLY',
    "allowedRecommendationTypes" JSONB NOT NULL DEFAULT '[]',
    "sendUrgentOnly" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "timezone" TEXT NOT NULL,
    "requireSecondConfirmationForHighImpact" BOOLEAN NOT NULL DEFAULT true,
    "groupApprovalsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dailyRecipientLimit" INTEGER NOT NULL DEFAULT 5,
    "dailyProjectLimit" INTEGER NOT NULL DEFAULT 10,
    "deliveryCooldownMinutes" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppRecommendationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppRecommendationApprover" (
    "settingId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppRecommendationApprover_pkey" PRIMARY KEY ("settingId","personId")
);

-- CreateTable
CREATE TABLE "RecommendationDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "recipientKey" TEXT NOT NULL,
    "recipientPersonId" TEXT,
    "recipientIdentityId" TEXT,
    "whatsappAccountId" TEXT NOT NULL,
    "whatsappChatMappingId" TEXT,
    "destinationJid" TEXT NOT NULL,
    "outboundMessageId" TEXT,
    "quotedMessageKey" TEXT,
    "deliveryStatus" "RecommendationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "impact" "RecommendationImpact" NOT NULL DEFAULT 'STANDARD',
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmationExpiresAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationResponse" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "actorIdentityId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "inboundMessageId" TEXT NOT NULL,
    "command" "RecommendationResponseCommand" NOT NULL,
    "outcome" "RecommendationResponseOutcome" NOT NULL,
    "reasonCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "personIdentityId" TEXT NOT NULL,
    "whatsappAccountId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "status" "WhatsAppInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "outboundMessageId" TEXT,
    "activationTokenHash" TEXT,
    "joinConfirmedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppOperationAudit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "actorPersonId" TEXT,
    "actorUserId" TEXT,
    "personIdentityId" TEXT,
    "recommendationId" TEXT,
    "deliveryId" TEXT,
    "providerMessageId" TEXT,
    "eventType" TEXT NOT NULL,
    "command" TEXT,
    "authorizationResult" TEXT,
    "reasonCode" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppOperationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Person_organizationId_status_displayName_idx" ON "Person"("organizationId", "status", "displayName");

-- CreateIndex
CREATE INDEX "Person_organizationId_email_idx" ON "Person"("organizationId", "email");

-- CreateIndex
CREATE INDEX "Person_organizationId_phoneNumber_idx" ON "Person"("organizationId", "phoneNumber");

-- CreateIndex
CREATE INDEX "Person_mergedIntoPersonId_idx" ON "Person"("mergedIntoPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "Person_organizationId_userId_key" ON "Person"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "PersonIdentity_organizationId_phoneNumber_idx" ON "PersonIdentity"("organizationId", "phoneNumber");

-- CreateIndex
CREATE INDEX "PersonIdentity_organizationId_verificationStatus_lastSeenAt_idx" ON "PersonIdentity"("organizationId", "verificationStatus", "lastSeenAt");

-- CreateIndex
CREATE INDEX "PersonIdentity_personId_lastSeenAt_idx" ON "PersonIdentity"("personId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "PersonIdentity_whatsappAccountId_jid_key" ON "PersonIdentity"("whatsappAccountId", "jid");

-- CreateIndex
CREATE UNIQUE INDEX "PersonIdentity_whatsappAccountId_lid_key" ON "PersonIdentity"("whatsappAccountId", "lid");

-- CreateIndex
CREATE INDEX "ProjectParticipant_organizationId_participantStatus_lastSee_idx" ON "ProjectParticipant"("organizationId", "participantStatus", "lastSeenAt");

-- CreateIndex
CREATE INDEX "ProjectParticipant_personId_participantStatus_idx" ON "ProjectParticipant"("personId", "participantStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectParticipant_projectId_personId_key" ON "ProjectParticipant"("projectId", "personId");

-- CreateIndex
CREATE INDEX "WhatsAppGroupParticipant_whatsappChatMappingId_participantS_idx" ON "WhatsAppGroupParticipant"("whatsappChatMappingId", "participantStatus");

-- CreateIndex
CREATE INDEX "WhatsAppGroupParticipant_personIdentityId_participantStatus_idx" ON "WhatsAppGroupParticipant"("personIdentityId", "participantStatus");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppGroupParticipant_whatsappChatMappingId_personIdenti_key" ON "WhatsAppGroupParticipant"("whatsappChatMappingId", "personIdentityId");

-- CreateIndex
CREATE INDEX "IdentityReview_organizationId_status_createdAt_idx" ON "IdentityReview"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "IdentityReview_suggestedPersonId_idx" ON "IdentityReview"("suggestedPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityReview_personIdentityId_status_key" ON "IdentityReview"("personIdentityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppRecommendationSetting_projectId_key" ON "WhatsAppRecommendationSetting"("projectId");

-- CreateIndex
CREATE INDEX "WhatsAppRecommendationSetting_organizationId_enabled_idx" ON "WhatsAppRecommendationSetting"("organizationId", "enabled");

-- CreateIndex
CREATE INDEX "WhatsAppRecommendationApprover_personId_idx" ON "WhatsAppRecommendationApprover"("personId");

-- CreateIndex
CREATE INDEX "RecommendationDelivery_organizationId_deliveryStatus_create_idx" ON "RecommendationDelivery"("organizationId", "deliveryStatus", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationDelivery_projectId_deliveryStatus_createdAt_idx" ON "RecommendationDelivery"("projectId", "deliveryStatus", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationDelivery_outboundMessageId_idx" ON "RecommendationDelivery"("outboundMessageId");

-- CreateIndex
CREATE INDEX "RecommendationDelivery_quotedMessageKey_idx" ON "RecommendationDelivery"("quotedMessageKey");

-- CreateIndex
CREATE INDEX "RecommendationDelivery_recipientIdentityId_deliveryStatus_e_idx" ON "RecommendationDelivery"("recipientIdentityId", "deliveryStatus", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationDelivery_recommendationId_recipientKey_key" ON "RecommendationDelivery"("recommendationId", "recipientKey");

-- CreateIndex
CREATE INDEX "RecommendationResponse_organizationId_createdAt_idx" ON "RecommendationResponse"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationResponse_recommendationId_createdAt_idx" ON "RecommendationResponse"("recommendationId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationResponse_actorIdentityId_createdAt_idx" ON "RecommendationResponse"("actorIdentityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationResponse_deliveryId_inboundMessageId_key" ON "RecommendationResponse"("deliveryId", "inboundMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppInvitation_activationTokenHash_key" ON "WhatsAppInvitation"("activationTokenHash");

-- CreateIndex
CREATE INDEX "WhatsAppInvitation_organizationId_status_createdAt_idx" ON "WhatsAppInvitation"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppInvitation_projectId_status_createdAt_idx" ON "WhatsAppInvitation"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppInvitation_personIdentityId_status_idx" ON "WhatsAppInvitation"("personIdentityId", "status");

-- CreateIndex
CREATE INDEX "WhatsAppInvitation_outboundMessageId_idx" ON "WhatsAppInvitation"("outboundMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppOperationAudit_organizationId_eventType_createdAt_idx" ON "WhatsAppOperationAudit"("organizationId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppOperationAudit_projectId_createdAt_idx" ON "WhatsAppOperationAudit"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppOperationAudit_recommendationId_createdAt_idx" ON "WhatsAppOperationAudit"("recommendationId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppOperationAudit_personIdentityId_createdAt_idx" ON "WhatsAppOperationAudit"("personIdentityId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppAccount_connectedByUserId_idx" ON "WhatsAppAccount"("connectedByUserId");

-- AddForeignKey
ALTER TABLE "WhatsAppAccount" ADD CONSTRAINT "WhatsAppAccount_connectedByUserId_fkey" FOREIGN KEY ("connectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_mergedIntoPersonId_fkey" FOREIGN KEY ("mergedIntoPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonIdentity" ADD CONSTRAINT "PersonIdentity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonIdentity" ADD CONSTRAINT "PersonIdentity_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonIdentity" ADD CONSTRAINT "PersonIdentity_whatsappAccountId_fkey" FOREIGN KEY ("whatsappAccountId") REFERENCES "WhatsAppAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectParticipant" ADD CONSTRAINT "ProjectParticipant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectParticipant" ADD CONSTRAINT "ProjectParticipant_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectParticipant" ADD CONSTRAINT "ProjectParticipant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppGroupParticipant" ADD CONSTRAINT "WhatsAppGroupParticipant_whatsappChatMappingId_fkey" FOREIGN KEY ("whatsappChatMappingId") REFERENCES "WhatsAppChatMapping"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppGroupParticipant" ADD CONSTRAINT "WhatsAppGroupParticipant_personIdentityId_fkey" FOREIGN KEY ("personIdentityId") REFERENCES "PersonIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityReview" ADD CONSTRAINT "IdentityReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityReview" ADD CONSTRAINT "IdentityReview_personIdentityId_fkey" FOREIGN KEY ("personIdentityId") REFERENCES "PersonIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityReview" ADD CONSTRAINT "IdentityReview_suggestedPersonId_fkey" FOREIGN KEY ("suggestedPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppRecommendationSetting" ADD CONSTRAINT "WhatsAppRecommendationSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppRecommendationSetting" ADD CONSTRAINT "WhatsAppRecommendationSetting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppRecommendationApprover" ADD CONSTRAINT "WhatsAppRecommendationApprover_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "WhatsAppRecommendationSetting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppRecommendationApprover" ADD CONSTRAINT "WhatsAppRecommendationApprover_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationDelivery" ADD CONSTRAINT "RecommendationDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationDelivery" ADD CONSTRAINT "RecommendationDelivery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationDelivery" ADD CONSTRAINT "RecommendationDelivery_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationDelivery" ADD CONSTRAINT "RecommendationDelivery_recipientPersonId_fkey" FOREIGN KEY ("recipientPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationDelivery" ADD CONSTRAINT "RecommendationDelivery_recipientIdentityId_fkey" FOREIGN KEY ("recipientIdentityId") REFERENCES "PersonIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationDelivery" ADD CONSTRAINT "RecommendationDelivery_whatsappAccountId_fkey" FOREIGN KEY ("whatsappAccountId") REFERENCES "WhatsAppAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationDelivery" ADD CONSTRAINT "RecommendationDelivery_whatsappChatMappingId_fkey" FOREIGN KEY ("whatsappChatMappingId") REFERENCES "WhatsAppChatMapping"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationResponse" ADD CONSTRAINT "RecommendationResponse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationResponse" ADD CONSTRAINT "RecommendationResponse_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationResponse" ADD CONSTRAINT "RecommendationResponse_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "RecommendationDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationResponse" ADD CONSTRAINT "RecommendationResponse_actorIdentityId_fkey" FOREIGN KEY ("actorIdentityId") REFERENCES "PersonIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationResponse" ADD CONSTRAINT "RecommendationResponse_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppInvitation" ADD CONSTRAINT "WhatsAppInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppInvitation" ADD CONSTRAINT "WhatsAppInvitation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppInvitation" ADD CONSTRAINT "WhatsAppInvitation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppInvitation" ADD CONSTRAINT "WhatsAppInvitation_personIdentityId_fkey" FOREIGN KEY ("personIdentityId") REFERENCES "PersonIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppInvitation" ADD CONSTRAINT "WhatsAppInvitation_whatsappAccountId_fkey" FOREIGN KEY ("whatsappAccountId") REFERENCES "WhatsAppAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppInvitation" ADD CONSTRAINT "WhatsAppInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppOperationAudit" ADD CONSTRAINT "WhatsAppOperationAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppOperationAudit" ADD CONSTRAINT "WhatsAppOperationAudit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppOperationAudit" ADD CONSTRAINT "WhatsAppOperationAudit_actorPersonId_fkey" FOREIGN KEY ("actorPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppOperationAudit" ADD CONSTRAINT "WhatsAppOperationAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppOperationAudit" ADD CONSTRAINT "WhatsAppOperationAudit_personIdentityId_fkey" FOREIGN KEY ("personIdentityId") REFERENCES "PersonIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppOperationAudit" ADD CONSTRAINT "WhatsAppOperationAudit_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppOperationAudit" ADD CONSTRAINT "WhatsAppOperationAudit_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "RecommendationDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Recommendation_sourceCoordinator_proposedActionType_sourceEntit" RENAME TO "Recommendation_sourceCoordinator_proposedActionType_sourceE_idx";
