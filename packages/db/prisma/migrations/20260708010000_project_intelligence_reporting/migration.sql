ALTER TYPE "ProcessingJobType" ADD VALUE IF NOT EXISTS 'REPORT_GENERATION';

ALTER TYPE "SearchDocumentSourceType" ADD VALUE IF NOT EXISTS 'PROJECT_REPORT';

CREATE TYPE "ProjectReportType" AS ENUM ('WEEKLY_PROGRESS');

CREATE TYPE "ProjectReportStatus" AS ENUM ('PENDING', 'RUNNING', 'FAILED', 'COMPLETED');

CREATE TABLE "ProjectReport" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "type" "ProjectReportType" NOT NULL,
  "status" "ProjectReportStatus" NOT NULL DEFAULT 'PENDING',
  "title" TEXT NOT NULL,
  "content" JSONB,
  "markdown" TEXT,
  "pdfStorageKey" TEXT,
  "contentHash" TEXT,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "generatedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectReport_organizationId_createdAt_idx" ON "ProjectReport"("organizationId", "createdAt");
CREATE INDEX "ProjectReport_projectId_type_status_createdAt_idx" ON "ProjectReport"("projectId", "type", "status", "createdAt");
CREATE INDEX "ProjectReport_status_createdAt_idx" ON "ProjectReport"("status", "createdAt");

ALTER TABLE "ProjectReport"
  ADD CONSTRAINT "ProjectReport_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectReport"
  ADD CONSTRAINT "ProjectReport_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

