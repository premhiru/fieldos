ALTER TYPE "ProcessingJobType" ADD VALUE 'WHATSAPP_CONNECTION_ALERT';

ALTER TABLE "WhatsAppAccount"
ADD COLUMN "disconnectedAt" TIMESTAMP(3),
ADD COLUMN "disconnectAlertSentAt" TIMESTAMP(3),
ADD COLUMN "recoveryAlertSentAt" TIMESTAMP(3),
ADD COLUMN "lastDisconnectReason" TEXT;
