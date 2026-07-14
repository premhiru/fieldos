-- Milestone Intelligence: richer milestones, evidence links, recommendations, and project state.

ALTER TYPE "EventSourceType" ADD VALUE 'MILESTONE';
ALTER TYPE "RecommendationType" ADD VALUE 'CREATE_MILESTONE';
ALTER TYPE "RecommendationType" ADD VALUE 'UPDATE_MILESTONE';
ALTER TYPE "RecommendationType" ADD VALUE 'COMPLETE_MILESTONE';
ALTER TYPE "RecommendationType" ADD VALUE 'START_MILESTONE';
ALTER TYPE "RecommendationType" ADD VALUE 'DELAY_MILESTONE';
ALTER TYPE "RecommendationActionType" ADD VALUE 'CREATE_MILESTONE';
ALTER TYPE "RecommendationActionType" ADD VALUE 'UPDATE_MILESTONE';
ALTER TYPE "RecommendationActionType" ADD VALUE 'COMPLETE_MILESTONE';
ALTER TYPE "RecommendationActionType" ADD VALUE 'START_MILESTONE';
ALTER TYPE "CoordinatorType" ADD VALUE 'MILESTONE';

CREATE TYPE "MilestonePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "MilestoneSource" AS ENUM ('MANUAL', 'AI_RECOMMENDATION', 'IMPORTED');
CREATE TYPE "MilestoneStatus_new" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'CANCELLED');

ALTER TABLE "Project" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

ALTER TABLE "Milestone"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "plannedStartDate" TIMESTAMP(3),
  ADD COLUMN "plannedEndDate" TIMESTAMP(3),
  ADD COLUMN "actualStartDate" TIMESTAMP(3),
  ADD COLUMN "actualEndDate" TIMESTAMP(3),
  ADD COLUMN "priority" "MilestonePriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "source" "MilestoneSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "createdByUserId" TEXT,
  ADD COLUMN "sourceRecommendationId" TEXT,
  ADD COLUMN "sourceMessageId" TEXT;

UPDATE "Milestone" SET "plannedEndDate" = "dueDate";

ALTER TABLE "Milestone" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Milestone"
  ALTER COLUMN "status" TYPE "MilestoneStatus_new"
  USING (
    CASE
      WHEN "status"::text = 'COMPLETED' THEN 'COMPLETED'
      WHEN "status"::text = 'OVERDUE' THEN 'DELAYED'
      ELSE 'PLANNED'
    END
  )::"MilestoneStatus_new";
DROP TYPE "MilestoneStatus";
ALTER TYPE "MilestoneStatus_new" RENAME TO "MilestoneStatus";
ALTER TABLE "Milestone" ALTER COLUMN "status" SET DEFAULT 'PLANNED';
ALTER TABLE "Milestone" DROP COLUMN "dueDate";

ALTER TABLE "ProjectState"
  ADD COLUMN "nextMilestone" TEXT,
  ADD COLUMN "nextMilestoneDate" TIMESTAMP(3),
  ADD COLUMN "completedMilestonesCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "delayedMilestonesCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "upcomingMilestonesCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "Milestone_sourceRecommendationId_key" ON "Milestone"("sourceRecommendationId");
CREATE INDEX "Milestone_organizationId_status_plannedEndDate_idx" ON "Milestone"("organizationId", "status", "plannedEndDate");
CREATE INDEX "Milestone_projectId_status_plannedStartDate_idx" ON "Milestone"("projectId", "status", "plannedStartDate");
CREATE INDEX "Milestone_projectId_status_plannedEndDate_idx" ON "Milestone"("projectId", "status", "plannedEndDate");
CREATE INDEX "Milestone_createdByUserId_idx" ON "Milestone"("createdByUserId");
CREATE INDEX "Milestone_sourceMessageId_idx" ON "Milestone"("sourceMessageId");

DROP INDEX IF EXISTS "Milestone_organizationId_dueDate_idx";
DROP INDEX IF EXISTS "Milestone_projectId_dueDate_idx";
DROP INDEX IF EXISTS "Milestone_status_dueDate_idx";

ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_sourceRecommendationId_fkey" FOREIGN KEY ("sourceRecommendationId") REFERENCES "Recommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
