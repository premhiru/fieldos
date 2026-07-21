ALTER TYPE "AIMessageCategory" ADD VALUE IF NOT EXISTS 'DECISION';
ALTER TYPE "AIMessageCategory" ADD VALUE IF NOT EXISTS 'COMMITMENT';
ALTER TYPE "AIMessageCategory" ADD VALUE IF NOT EXISTS 'QUESTION';
ALTER TYPE "AIMessageCategory" ADD VALUE IF NOT EXISTS 'ACKNOWLEDGEMENT';

ALTER TYPE "RecommendationCandidateStatus" ADD VALUE IF NOT EXISTS 'CLARIFICATION';
ALTER TYPE "RecommendationSuppressionReason" ADD VALUE IF NOT EXISTS 'NO_MATERIALITY';
ALTER TYPE "RecommendationSuppressionReason" ADD VALUE IF NOT EXISTS 'NON_ACTIONABLE';
ALTER TYPE "RecommendationSuppressionReason" ADD VALUE IF NOT EXISTS 'NO_EXPECTED_VALUE';
ALTER TYPE "RecommendationSuppressionReason" ADD VALUE IF NOT EXISTS 'OWNERSHIP_EXISTS';

ALTER TABLE "AIClassificationDecision"
  ADD COLUMN "factualClaims" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "locations" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "referencedDates" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "ambiguity" JSONB NOT NULL DEFAULT '{"isAmbiguous":false,"missingContext":[]}',
  ADD COLUMN "recommendationEligibilityReason" TEXT NOT NULL DEFAULT '';

ALTER TABLE "RecommendationCandidate"
  ADD COLUMN "evidenceSummary" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "evidenceLimitations" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "materiality" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "expectedValue" TEXT NOT NULL DEFAULT '';

ALTER TABLE "PhotoAnalysis"
  ADD COLUMN "analysisStatus" TEXT NOT NULL DEFAULT 'NO_OPERATIONAL_CONCLUSION',
  ADD COLUMN "visibleObservations" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "claimedContext" TEXT,
  ADD COLUMN "claimSupport" TEXT NOT NULL DEFAULT 'UNABLE_TO_DETERMINE',
  ADD COLUMN "issueAssessments" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "progressEvidence" JSONB NOT NULL DEFAULT '{"usable":false,"scope":null,"reason":"Not assessed."}',
  ADD COLUMN "safetySignal" JSONB NOT NULL DEFAULT '{"present":false,"severity":null,"reason":null}',
  ADD COLUMN "overallConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5;
