ALTER TYPE "ProcessingJobType" ADD VALUE IF NOT EXISTS 'PHOTO_ANALYSIS';

ALTER TYPE "SearchDocumentSourceType" ADD VALUE IF NOT EXISTS 'PHOTO_ANALYSIS';

CREATE TABLE "PhotoAnalysis" (
  "id" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "conversationId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "detectedObjects" JSONB NOT NULL,
  "possibleIssues" JSONB NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "tags" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhotoAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhotoAnalysis_evidenceId_key" ON "PhotoAnalysis"("evidenceId");
CREATE INDEX "PhotoAnalysis_organizationId_createdAt_idx" ON "PhotoAnalysis"("organizationId", "createdAt");
CREATE INDEX "PhotoAnalysis_projectId_createdAt_idx" ON "PhotoAnalysis"("projectId", "createdAt");
CREATE INDEX "PhotoAnalysis_messageId_idx" ON "PhotoAnalysis"("messageId");
CREATE INDEX "PhotoAnalysis_conversationId_idx" ON "PhotoAnalysis"("conversationId");

ALTER TABLE "PhotoAnalysis"
  ADD CONSTRAINT "PhotoAnalysis_evidenceId_fkey"
  FOREIGN KEY ("evidenceId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PhotoAnalysis"
  ADD CONSTRAINT "PhotoAnalysis_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PhotoAnalysis"
  ADD CONSTRAINT "PhotoAnalysis_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PhotoAnalysis"
  ADD CONSTRAINT "PhotoAnalysis_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PhotoAnalysis"
  ADD CONSTRAINT "PhotoAnalysis_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
