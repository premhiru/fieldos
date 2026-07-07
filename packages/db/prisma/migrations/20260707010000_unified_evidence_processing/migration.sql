CREATE TYPE "VoiceTranscriptionStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'COMPLETED', 'FAILED');

ALTER TABLE "Attachment"
ADD COLUMN "transcript" TEXT,
ADD COLUMN "transcriptionStatus" "VoiceTranscriptionStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN "transcriptionError" TEXT;

CREATE INDEX "Attachment_transcriptionStatus_createdAt_idx" ON "Attachment"("transcriptionStatus", "createdAt");
