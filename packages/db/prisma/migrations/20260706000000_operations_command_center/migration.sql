CREATE TYPE "ActionItemPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "MilestoneStatus" AS ENUM ('UPCOMING', 'DUE_SOON', 'OVERDUE', 'COMPLETED');

ALTER TYPE "ActionItemStatus" ADD VALUE 'COMPLETED';

ALTER TABLE "ActionItem"
  ADD COLUMN "priority" "ActionItemPriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "assignedToUserId" TEXT,
  ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE INDEX "ActionItem_organizationId_priority_status_idx" ON "ActionItem"("organizationId", "priority", "status");
CREATE INDEX "ActionItem_assignedToUserId_status_priority_idx" ON "ActionItem"("assignedToUserId", "status", "priority");

ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Milestone_organizationId_dueDate_idx" ON "Milestone"("organizationId", "dueDate");
CREATE INDEX "Milestone_projectId_dueDate_idx" ON "Milestone"("projectId", "dueDate");
CREATE INDEX "Milestone_status_dueDate_idx" ON "Milestone"("status", "dueDate");

ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
