CREATE TYPE "AIDecisionEngineMode" AS ENUM ('LEGACY', 'SHADOW', 'V2');
CREATE TYPE "AIMessageRelevance" AS ENUM ('OPERATIONAL', 'NON_OPERATIONAL', 'AMBIGUOUS');
CREATE TYPE "AIOperationalImpact" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "AICompletionClaim" AS ENUM ('NONE', 'PARTIAL', 'CLAIMED', 'AMBIGUOUS');
CREATE TYPE "AIInspectionReadiness" AS ENUM ('NONE', 'NOT_READY', 'READY_CLAIMED', 'REQUESTED', 'AMBIGUOUS');
CREATE TYPE "RecommendationCandidateStatus" AS ENUM ('CREATED', 'SUPPRESSED', 'SHADOW');
CREATE TYPE "RecommendationSuppressionReason" AS ENUM ('INSUFFICIENT_EVIDENCE', 'LOW_CONFIDENCE', 'NON_OPERATIONAL', 'AMBIGUOUS', 'ROUTINE_PROGRESS', 'NO_UNRESOLVED_EXPECTATION', 'PREREQUISITE_OPEN', 'DUPLICATE_PENDING', 'RECENTLY_DISMISSED', 'RECENTLY_ACTIONED', 'SUPERSEDED', 'PROJECT_INACTIVE', 'REPORT_NOT_DUE', 'SHADOW_MODE');
CREATE TYPE "OutstandingExpectationType" AS ENUM ('QUESTION', 'COMMITMENT', 'DOCUMENT', 'PHOTO', 'APPROVAL', 'DECISION', 'DELIVERY_UPDATE', 'INSPECTION_RESULT');
CREATE TYPE "OutstandingExpectationStatus" AS ENUM ('OPEN', 'RESOLVED', 'CANCELLED', 'EXPIRED');

ALTER TABLE "PhotoAnalysis"
  ADD COLUMN "observations" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "limitations" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "senderClaim" TEXT,
  ADD COLUMN "claimAssessment" TEXT NOT NULL DEFAULT 'NOT_ASSESSED',
  ADD COLUMN "operationalConclusion" TEXT NOT NULL DEFAULT 'NO_OPERATIONAL_CONCLUSION',
  ADD COLUMN "analysisVersion" TEXT NOT NULL DEFAULT '1.0',
  ADD COLUMN "promptVersion" TEXT NOT NULL DEFAULT 'photo-analysis.v1';

CREATE TABLE "AIClassificationDecision" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "classificationId" TEXT NOT NULL,
  "mode" "AIDecisionEngineMode" NOT NULL,
  "relevance" "AIMessageRelevance" NOT NULL,
  "primaryCategory" "AIMessageCategory" NOT NULL,
  "secondarySignals" JSONB NOT NULL,
  "operationalImpact" "AIOperationalImpact" NOT NULL,
  "responseExpectation" JSONB NOT NULL,
  "completionClaim" "AICompletionClaim" NOT NULL,
  "inspectionReadiness" "AIInspectionReadiness" NOT NULL,
  "recommendationEligible" BOOLEAN NOT NULL,
  "abstentionReason" TEXT,
  "summary" TEXT NOT NULL,
  "location" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL,
  "uncertainty" TEXT,
  "userFacingReason" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AIClassificationDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecommendationCandidate" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "recommendationId" TEXT,
  "mode" "AIDecisionEngineMode" NOT NULL,
  "coordinatorType" "CoordinatorType" NOT NULL,
  "type" "RecommendationType" NOT NULL,
  "proposedActionType" "RecommendationActionType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "confidence" "RecommendationConfidence" NOT NULL,
  "priority" "RecommendationPriority" NOT NULL,
  "sourceEntityType" TEXT,
  "sourceEntityId" TEXT,
  "evidenceIds" JSONB NOT NULL,
  "proposedActionPayload" JSONB,
  "fingerprint" TEXT NOT NULL,
  "status" "RecommendationCandidateStatus" NOT NULL,
  "suppressionReason" "RecommendationSuppressionReason",
  "engineVersion" TEXT NOT NULL,
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecommendationCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutstandingExpectation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "sourceMessageId" TEXT NOT NULL,
  "resolvedByMessageId" TEXT,
  "type" "OutstandingExpectationType" NOT NULL,
  "expectedResponder" TEXT,
  "requestedItem" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3),
  "status" "OutstandingExpectationStatus" NOT NULL DEFAULT 'OPEN',
  "evidence" JSONB NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "resolutionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutstandingExpectation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AIClassificationDecision_classificationId_key" ON "AIClassificationDecision"("classificationId");
CREATE INDEX "AIClassificationDecision_organizationId_processedAt_idx" ON "AIClassificationDecision"("organizationId", "processedAt");
CREATE INDEX "AIClassificationDecision_projectId_processedAt_idx" ON "AIClassificationDecision"("projectId", "processedAt");
CREATE INDEX "AIClassificationDecision_mode_relevance_processedAt_idx" ON "AIClassificationDecision"("mode", "relevance", "processedAt");
CREATE INDEX "AIClassificationDecision_recommendationEligible_processedAt_idx" ON "AIClassificationDecision"("recommendationEligible", "processedAt");
CREATE UNIQUE INDEX "RecommendationCandidate_recommendationId_key" ON "RecommendationCandidate"("recommendationId");
CREATE INDEX "RecommendationCandidate_organizationId_status_createdAt_idx" ON "RecommendationCandidate"("organizationId", "status", "createdAt");
CREATE INDEX "RecommendationCandidate_projectId_coordinatorType_createdAt_idx" ON "RecommendationCandidate"("projectId", "coordinatorType", "createdAt");
CREATE INDEX "RecommendationCandidate_projectId_fingerprint_createdAt_idx" ON "RecommendationCandidate"("projectId", "fingerprint", "createdAt");
CREATE INDEX "RecommendationCandidate_suppressionReason_createdAt_idx" ON "RecommendationCandidate"("suppressionReason", "createdAt");
CREATE INDEX "OutstandingExpectation_organizationId_status_dueAt_idx" ON "OutstandingExpectation"("organizationId", "status", "dueAt");
CREATE INDEX "OutstandingExpectation_projectId_status_dueAt_idx" ON "OutstandingExpectation"("projectId", "status", "dueAt");
CREATE INDEX "OutstandingExpectation_conversationId_status_dueAt_idx" ON "OutstandingExpectation"("conversationId", "status", "dueAt");
CREATE INDEX "OutstandingExpectation_sourceMessageId_idx" ON "OutstandingExpectation"("sourceMessageId");
CREATE UNIQUE INDEX "OutstandingExpectation_sourceMessageId_type_requestedItem_key" ON "OutstandingExpectation"("sourceMessageId", "type", "requestedItem");

ALTER TABLE "AIClassificationDecision" ADD CONSTRAINT "AIClassificationDecision_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES "AIMessageClassification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIClassificationDecision" ADD CONSTRAINT "AIClassificationDecision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIClassificationDecision" ADD CONSTRAINT "AIClassificationDecision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecommendationCandidate" ADD CONSTRAINT "RecommendationCandidate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationCandidate" ADD CONSTRAINT "RecommendationCandidate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationCandidate" ADD CONSTRAINT "RecommendationCandidate_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutstandingExpectation" ADD CONSTRAINT "OutstandingExpectation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutstandingExpectation" ADD CONSTRAINT "OutstandingExpectation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutstandingExpectation" ADD CONSTRAINT "OutstandingExpectation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutstandingExpectation" ADD CONSTRAINT "OutstandingExpectation_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutstandingExpectation" ADD CONSTRAINT "OutstandingExpectation_resolvedByMessageId_fkey" FOREIGN KEY ("resolvedByMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
