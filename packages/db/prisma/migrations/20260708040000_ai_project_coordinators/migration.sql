-- AI Project Coordinators: project state snapshots, recommendations, run logs, and WhatsApp drafts.

ALTER TYPE "ProcessingJobType" ADD VALUE 'PROJECT_COORDINATOR';
ALTER TYPE "EventSourceType" ADD VALUE 'RECOMMENDATION';

CREATE TYPE "ProjectStateHealth" AS ENUM ('HEALTHY', 'NEEDS_ATTENTION', 'CRITICAL', 'UNKNOWN');
CREATE TYPE "RecommendationType" AS ENUM ('PROGRESS_UPDATE', 'FOLLOW_UP', 'INSPECTION', 'REPORT', 'RISK', 'MISSING_UPDATE', 'APPROVAL_REQUIRED', 'CLIENT_UPDATE', 'SUPPLIER_DELAY', 'GENERAL');
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'APPROVED', 'DISMISSED', 'COMPLETED', 'FAILED');
CREATE TYPE "RecommendationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "RecommendationConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "RecommendationActionType" AS ENUM ('CREATE_ACTION_ITEM', 'SEND_WHATSAPP_MESSAGE_DRAFT', 'GENERATE_REPORT', 'SCHEDULE_INSPECTION_REMINDER', 'MARK_PROGRESS_REVIEWED', 'REQUEST_PROGRESS_UPDATE', 'REVIEW_EVIDENCE');
CREATE TYPE "CoordinatorType" AS ENUM ('PROGRESS', 'FOLLOW_UP', 'INSPECTION', 'REPORT', 'RUNTIME');
CREATE TYPE "CoordinatorRunStatus" AS ENUM ('STARTED', 'COMPLETED', 'FAILED', 'SKIPPED');
CREATE TYPE "WhatsAppDraftStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT', 'CANCELLED', 'FAILED');

CREATE TABLE "ProjectState" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "health" "ProjectStateHealth" NOT NULL DEFAULT 'UNKNOWN',
    "completionPercent" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3),
    "lastWhatsAppUpdateAt" TIMESTAMP(3),
    "lastEvidenceAt" TIMESTAMP(3),
    "lastReportAt" TIMESTAMP(3),
    "openActionItemCount" INTEGER NOT NULL DEFAULT 0,
    "urgentActionItemCount" INTEGER NOT NULL DEFAULT 0,
    "highPriorityActionItemCount" INTEGER NOT NULL DEFAULT 0,
    "recentProgressSummary" TEXT,
    "recentRiskSummary" TEXT,
    "recentEvidenceSummary" TEXT,
    "recentBlockerSummary" TEXT,
    "pendingDecisionSummary" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "RecommendationType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "confidence" "RecommendationConfidence" NOT NULL,
    "priority" "RecommendationPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "sourceCoordinator" "CoordinatorType" NOT NULL,
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "proposedActionType" "RecommendationActionType" NOT NULL,
    "proposedActionPayload" JSONB,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "dismissedByUserId" TEXT,
    "dismissReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoordinatorRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "coordinatorType" "CoordinatorType" NOT NULL,
    "status" "CoordinatorRunStatus" NOT NULL DEFAULT 'STARTED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "recommendationsCreated" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "metadata" JSONB,

    CONSTRAINT "CoordinatorRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsAppDraft" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "whatsappAccountId" TEXT,
    "conversationId" TEXT,
    "recommendationId" TEXT,
    "messageBody" TEXT NOT NULL,
    "status" "WhatsAppDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectState_projectId_key" ON "ProjectState"("projectId");
CREATE INDEX "ProjectState_organizationId_health_updatedAt_idx" ON "ProjectState"("organizationId", "health", "updatedAt");
CREATE INDEX "ProjectState_organizationId_lastActivityAt_idx" ON "ProjectState"("organizationId", "lastActivityAt");

CREATE INDEX "Recommendation_organizationId_status_priority_createdAt_idx" ON "Recommendation"("organizationId", "status", "priority", "createdAt");
CREATE INDEX "Recommendation_projectId_status_priority_createdAt_idx" ON "Recommendation"("projectId", "status", "priority", "createdAt");
CREATE INDEX "Recommendation_sourceCoordinator_proposedActionType_sourceEntityId_idx" ON "Recommendation"("sourceCoordinator", "proposedActionType", "sourceEntityId");
CREATE INDEX "Recommendation_approvedByUserId_idx" ON "Recommendation"("approvedByUserId");
CREATE INDEX "Recommendation_dismissedByUserId_idx" ON "Recommendation"("dismissedByUserId");

CREATE INDEX "CoordinatorRun_organizationId_startedAt_idx" ON "CoordinatorRun"("organizationId", "startedAt");
CREATE INDEX "CoordinatorRun_projectId_startedAt_idx" ON "CoordinatorRun"("projectId", "startedAt");
CREATE INDEX "CoordinatorRun_coordinatorType_status_startedAt_idx" ON "CoordinatorRun"("coordinatorType", "status", "startedAt");

CREATE INDEX "WhatsAppDraft_organizationId_status_createdAt_idx" ON "WhatsAppDraft"("organizationId", "status", "createdAt");
CREATE INDEX "WhatsAppDraft_projectId_status_createdAt_idx" ON "WhatsAppDraft"("projectId", "status", "createdAt");
CREATE INDEX "WhatsAppDraft_recommendationId_idx" ON "WhatsAppDraft"("recommendationId");
CREATE INDEX "WhatsAppDraft_conversationId_idx" ON "WhatsAppDraft"("conversationId");
CREATE INDEX "WhatsAppDraft_whatsappAccountId_idx" ON "WhatsAppDraft"("whatsappAccountId");
CREATE INDEX "WhatsAppDraft_createdByUserId_idx" ON "WhatsAppDraft"("createdByUserId");
CREATE INDEX "WhatsAppDraft_approvedByUserId_idx" ON "WhatsAppDraft"("approvedByUserId");

ALTER TABLE "ProjectState" ADD CONSTRAINT "ProjectState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectState" ADD CONSTRAINT "ProjectState_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_dismissedByUserId_fkey" FOREIGN KEY ("dismissedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CoordinatorRun" ADD CONSTRAINT "CoordinatorRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoordinatorRun" ADD CONSTRAINT "CoordinatorRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WhatsAppDraft" ADD CONSTRAINT "WhatsAppDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsAppDraft" ADD CONSTRAINT "WhatsAppDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsAppDraft" ADD CONSTRAINT "WhatsAppDraft_whatsappAccountId_fkey" FOREIGN KEY ("whatsappAccountId") REFERENCES "WhatsAppAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsAppDraft" ADD CONSTRAINT "WhatsAppDraft_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsAppDraft" ADD CONSTRAINT "WhatsAppDraft_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsAppDraft" ADD CONSTRAINT "WhatsAppDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsAppDraft" ADD CONSTRAINT "WhatsAppDraft_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
