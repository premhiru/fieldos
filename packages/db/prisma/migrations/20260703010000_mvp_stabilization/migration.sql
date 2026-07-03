-- Rename suggested-task terminology to action-item terminology.
ALTER TYPE "SuggestedTaskStatus" RENAME TO "ActionItemStatus";
ALTER TYPE "ActionItemStatus" RENAME VALUE 'REJECTED' TO 'IGNORED';

CREATE TYPE "ActionItemType" AS ENUM ('FOLLOW_UP', 'PROJECT_SUGGESTION');
CREATE TYPE "EventSourceType" AS ENUM ('MESSAGE', 'ACTION_ITEM', 'REPORT', 'SYSTEM');

ALTER TABLE "AIMessageClassification" RENAME COLUMN "shouldCreateTask" TO "actionRequired";
ALTER TABLE "AIMessageClassification" DROP COLUMN "priority";
ALTER TABLE "AIMessageClassification" DROP COLUMN "suggestedTaskTitle";
ALTER TABLE "AIMessageClassification" DROP COLUMN "suggestedTaskDescription";
ALTER TABLE "AIMessageClassification" DROP COLUMN "rawModelOutput";

ALTER TABLE "SuggestedTask" RENAME TO "ActionItem";
ALTER TABLE "ActionItem" RENAME COLUMN "rejectedAt" TO "ignoredAt";
ALTER TABLE "ActionItem" RENAME COLUMN "rejectedByUserId" TO "ignoredByUserId";
ALTER TABLE "ActionItem" DROP COLUMN "priority";
ALTER TABLE "ActionItem" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "ActionItem" ALTER COLUMN "classificationId" DROP NOT NULL;
ALTER TABLE "ActionItem" ADD COLUMN "type" "ActionItemType" NOT NULL DEFAULT 'FOLLOW_UP';
ALTER TABLE "ActionItem" ADD COLUMN "confidence" DOUBLE PRECISION;
ALTER TABLE "ActionItem" ADD COLUMN "suggestedProjectId" TEXT;

ALTER TABLE "ActionItem" RENAME CONSTRAINT "SuggestedTask_pkey" TO "ActionItem_pkey";
ALTER TABLE "ActionItem" RENAME CONSTRAINT "SuggestedTask_acceptedByUserId_fkey" TO "ActionItem_acceptedByUserId_fkey";
ALTER TABLE "ActionItem" RENAME CONSTRAINT "SuggestedTask_classificationId_fkey" TO "ActionItem_classificationId_fkey";
ALTER TABLE "ActionItem" RENAME CONSTRAINT "SuggestedTask_messageId_fkey" TO "ActionItem_messageId_fkey";
ALTER TABLE "ActionItem" RENAME CONSTRAINT "SuggestedTask_organizationId_fkey" TO "ActionItem_organizationId_fkey";
ALTER TABLE "ActionItem" RENAME CONSTRAINT "SuggestedTask_projectId_fkey" TO "ActionItem_projectId_fkey";
ALTER TABLE "ActionItem" RENAME CONSTRAINT "SuggestedTask_rejectedByUserId_fkey" TO "ActionItem_ignoredByUserId_fkey";

ALTER INDEX "SuggestedTask_organizationId_status_createdAt_idx" RENAME TO "ActionItem_organizationId_status_createdAt_idx";
ALTER INDEX "SuggestedTask_projectId_status_createdAt_idx" RENAME TO "ActionItem_projectId_status_createdAt_idx";
ALTER INDEX "SuggestedTask_messageId_idx" RENAME TO "ActionItem_messageId_idx";
ALTER INDEX "SuggestedTask_classificationId_idx" RENAME TO "ActionItem_classificationId_idx";
ALTER INDEX "SuggestedTask_acceptedByUserId_idx" RENAME TO "ActionItem_acceptedByUserId_idx";
ALTER INDEX "SuggestedTask_rejectedByUserId_idx" RENAME TO "ActionItem_ignoredByUserId_idx";

CREATE INDEX "ActionItem_organizationId_type_status_idx" ON "ActionItem"("organizationId", "type", "status");
CREATE INDEX "ActionItem_suggestedProjectId_status_createdAt_idx" ON "ActionItem"("suggestedProjectId", "status", "createdAt");
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_suggestedProjectId_fkey" FOREIGN KEY ("suggestedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP TYPE "AIPriority";

CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "sourceType" "EventSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Event_organizationId_occurredAt_idx" ON "Event"("organizationId", "occurredAt");
CREATE INDEX "Event_projectId_occurredAt_idx" ON "Event"("projectId", "occurredAt");
CREATE INDEX "Event_sourceType_sourceId_idx" ON "Event"("sourceType", "sourceId");

ALTER TABLE "Event" ADD CONSTRAINT "Event_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
