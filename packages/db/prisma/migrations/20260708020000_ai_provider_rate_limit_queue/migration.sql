ALTER TABLE "ProcessingJob" ADD COLUMN "nextRunAt" TIMESTAMP(3);

CREATE INDEX "ProcessingJob_status_nextRunAt_createdAt_idx"
  ON "ProcessingJob"("status", "nextRunAt", "createdAt");
