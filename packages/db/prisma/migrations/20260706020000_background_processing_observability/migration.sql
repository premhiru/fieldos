CREATE TYPE "MessageProcessingStatus" AS ENUM (
  'RECEIVED',
  'MEDIA_PENDING',
  'MEDIA_COMPLETE',
  'TRANSCRIPTION_PENDING',
  'TRANSCRIPTION_COMPLETE',
  'SEARCH_PENDING',
  'SEARCH_COMPLETE',
  'AI_PENDING',
  'AI_COMPLETE',
  'FAILED'
);

CREATE TYPE "ProcessingJobType" AS ENUM (
  'SEARCH_INDEX',
  'AI_CLASSIFICATION',
  'VOICE_TRANSCRIPTION',
  'MEDIA_DOWNLOAD'
);

CREATE TYPE "ProcessingJobStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'FAILED',
  'COMPLETED'
);

CREATE TYPE "WorkerStatus" AS ENUM (
  'ONLINE',
  'OFFLINE',
  'STARTING',
  'STOPPING'
);

ALTER TABLE "Message"
  ADD COLUMN "processingStatus" "MessageProcessingStatus" NOT NULL DEFAULT 'RECEIVED';

CREATE TABLE "ProcessingJob" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "type" "ProcessingJobType" NOT NULL,
  "status" "ProcessingJobStatus" NOT NULL DEFAULT 'PENDING',
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "errorMessage" TEXT,
  "correlationId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProcessingJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkerHeartbeat" (
  "id" TEXT NOT NULL,
  "workerName" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "status" "WorkerStatus" NOT NULL DEFAULT 'STARTING',
  "lastHeartbeatAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcessingJob_type_sourceType_sourceId_key"
  ON "ProcessingJob"("type", "sourceType", "sourceId");

CREATE INDEX "Message_processingStatus_createdAt_idx"
  ON "Message"("processingStatus", "createdAt");

CREATE INDEX "ProcessingJob_organizationId_status_createdAt_idx"
  ON "ProcessingJob"("organizationId", "status", "createdAt");

CREATE INDEX "ProcessingJob_organizationId_type_status_idx"
  ON "ProcessingJob"("organizationId", "type", "status");

CREATE INDEX "ProcessingJob_projectId_status_createdAt_idx"
  ON "ProcessingJob"("projectId", "status", "createdAt");

CREATE INDEX "ProcessingJob_status_createdAt_idx"
  ON "ProcessingJob"("status", "createdAt");

CREATE UNIQUE INDEX "WorkerHeartbeat_workerName_key"
  ON "WorkerHeartbeat"("workerName");

CREATE INDEX "WorkerHeartbeat_status_lastHeartbeatAt_idx"
  ON "WorkerHeartbeat"("status", "lastHeartbeatAt");

ALTER TABLE "ProcessingJob"
  ADD CONSTRAINT "ProcessingJob_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
