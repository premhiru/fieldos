-- CreateEnum
CREATE TYPE "WhatsAppConnectorType" AS ENUM ('BAILEYS', 'META_CLOUD');

-- CreateEnum
CREATE TYPE "WhatsAppAccountStatus" AS ENUM ('PENDING_QR', 'CONNECTING', 'CONNECTED', 'DISCONNECTED', 'ERROR');

-- CreateTable
CREATE TABLE "WhatsAppAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "connectorType" "WhatsAppConnectorType" NOT NULL DEFAULT 'BAILEYS',
    "status" "WhatsAppAccountStatus" NOT NULL DEFAULT 'PENDING_QR',
    "sessionKey" TEXT NOT NULL,
    "lastConnectedAt" TIMESTAMP(3),
    "lastDisconnectedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppChatMapping" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "whatsappAccountId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "projectId" TEXT,
    "jid" TEXT NOT NULL,
    "chatName" TEXT,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppChatMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppAccount_organizationId_idx" ON "WhatsAppAccount"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppAccount_sessionKey_key" ON "WhatsAppAccount"("sessionKey");

-- CreateIndex
CREATE INDEX "WhatsAppChatMapping_organizationId_idx" ON "WhatsAppChatMapping"("organizationId");

-- CreateIndex
CREATE INDEX "WhatsAppChatMapping_projectId_idx" ON "WhatsAppChatMapping"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppChatMapping_whatsappAccountId_jid_key" ON "WhatsAppChatMapping"("whatsappAccountId", "jid");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppChatMapping_conversationId_key" ON "WhatsAppChatMapping"("conversationId");

-- AddForeignKey
ALTER TABLE "WhatsAppAccount" ADD CONSTRAINT "WhatsAppAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppChatMapping" ADD CONSTRAINT "WhatsAppChatMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppChatMapping" ADD CONSTRAINT "WhatsAppChatMapping_whatsappAccountId_fkey" FOREIGN KEY ("whatsappAccountId") REFERENCES "WhatsAppAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppChatMapping" ADD CONSTRAINT "WhatsAppChatMapping_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppChatMapping" ADD CONSTRAINT "WhatsAppChatMapping_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
