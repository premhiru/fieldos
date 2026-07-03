-- CreateEnum
CREATE TYPE "AIMessageCategory" AS ENUM (
  'PROGRESS_UPDATE',
  'DEFECT',
  'DELAY',
  'SAFETY_ISSUE',
  'DELIVERY',
  'INSPECTION_REQUEST',
  'CLIENT_APPROVAL',
  'VARIATION_ORDER',
  'RFI',
  'MATERIAL_ISSUE',
  'MANPOWER_ISSUE',
  'GENERAL_NOTE',
  'UNKNOWN'
);

-- CreateEnum
CREATE TYPE "AIPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "AIClassificationStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "SuggestedTaskStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CONVERTED');

-- CreateTable
CREATE TABLE "AIMessageClassification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "messageId" TEXT NOT NULL,
    "category" "AIMessageCategory",
    "summary" TEXT,
    "location" TEXT,
    "priority" "AIPriority" NOT NULL DEFAULT 'MEDIUM',
    "suggestedTaskTitle" TEXT,
    "suggestedTaskDescription" TEXT,
    "shouldCreateTask" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION,
    "reasoningSummary" TEXT,
    "rawModelOutput" JSONB,
    "status" "AIClassificationStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIMessageClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestedTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "classificationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "AIPriority" NOT NULL,
    "status" "SuggestedTaskStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,

    CONSTRAINT "SuggestedTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AIMessageClassification_messageId_key" ON "AIMessageClassification"("messageId");

-- CreateIndex
CREATE INDEX "AIMessageClassification_organizationId_createdAt_idx" ON "AIMessageClassification"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AIMessageClassification_projectId_createdAt_idx" ON "AIMessageClassification"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AIMessageClassification_status_createdAt_idx" ON "AIMessageClassification"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SuggestedTask_organizationId_status_createdAt_idx" ON "SuggestedTask"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SuggestedTask_projectId_status_createdAt_idx" ON "SuggestedTask"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SuggestedTask_messageId_idx" ON "SuggestedTask"("messageId");

-- CreateIndex
CREATE INDEX "SuggestedTask_classificationId_idx" ON "SuggestedTask"("classificationId");

-- CreateIndex
CREATE INDEX "SuggestedTask_acceptedByUserId_idx" ON "SuggestedTask"("acceptedByUserId");

-- CreateIndex
CREATE INDEX "SuggestedTask_rejectedByUserId_idx" ON "SuggestedTask"("rejectedByUserId");

-- AddForeignKey
ALTER TABLE "AIMessageClassification" ADD CONSTRAINT "AIMessageClassification_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessageClassification" ADD CONSTRAINT "AIMessageClassification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessageClassification" ADD CONSTRAINT "AIMessageClassification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedTask" ADD CONSTRAINT "SuggestedTask_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedTask" ADD CONSTRAINT "SuggestedTask_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES "AIMessageClassification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedTask" ADD CONSTRAINT "SuggestedTask_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedTask" ADD CONSTRAINT "SuggestedTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedTask" ADD CONSTRAINT "SuggestedTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedTask" ADD CONSTRAINT "SuggestedTask_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
