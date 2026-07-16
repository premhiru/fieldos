ALTER TYPE "ProcessingJobType" ADD VALUE 'PROJECT_COORDINATOR_MILESTONE';

CREATE INDEX "ProcessingJob_projectId_type_status_createdAt_idx"
ON "ProcessingJob"("projectId", "type", "status", "createdAt");

CREATE INDEX "ProcessingJob_projectId_type_status_updatedAt_idx"
ON "ProcessingJob"("projectId", "type", "status", "updatedAt");
