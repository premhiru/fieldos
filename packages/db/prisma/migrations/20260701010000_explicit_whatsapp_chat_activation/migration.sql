-- CreateEnum
CREATE TYPE "WhatsAppChatMappingStatus" AS ENUM ('DISCOVERED', 'ACTIVE', 'IGNORED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "WhatsAppChatMapping"
  ADD COLUMN "status" "WhatsAppChatMappingStatus" NOT NULL DEFAULT 'DISCOVERED',
  ADD COLUMN "activatedAt" TIMESTAMP(3),
  ADD COLUMN "activatedByUserId" TEXT;

-- Allow metadata-only discovery mappings before a chat is activated.
ALTER TABLE "WhatsAppChatMapping" ALTER COLUMN "conversationId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "WhatsAppChatMapping_activatedByUserId_idx" ON "WhatsAppChatMapping"("activatedByUserId");

-- CreateIndex
CREATE INDEX "WhatsAppChatMapping_status_idx" ON "WhatsAppChatMapping"("status");

-- AddForeignKey
ALTER TABLE "WhatsAppChatMapping" ADD CONSTRAINT "WhatsAppChatMapping_activatedByUserId_fkey" FOREIGN KEY ("activatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
