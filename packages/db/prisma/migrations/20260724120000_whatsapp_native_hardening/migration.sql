-- Add delivery claims and sender-bound confirmations.
ALTER TYPE "RecommendationDeliveryStatus" ADD VALUE IF NOT EXISTS 'SENDING' AFTER 'QUEUED';
ALTER TYPE "WhatsAppInvitationStatus" ADD VALUE IF NOT EXISTS 'SENDING' AFTER 'QUEUED';

ALTER TABLE "RecommendationDelivery"
ADD COLUMN "confirmationActorIdentityId" TEXT,
ADD COLUMN "sendClaimedAt" TIMESTAMP(3),
ADD COLUMN "sendClaimToken" TEXT;

ALTER TABLE "WhatsAppInvitation"
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastAttemptAt" TIMESTAMP(3);

CREATE INDEX "RecommendationDelivery_confirmationActorIdentityId_delivery_idx"
ON "RecommendationDelivery"("confirmationActorIdentityId", "deliveryStatus");

CREATE INDEX "RecommendationDelivery_deliveryStatus_sendClaimedAt_idx"
ON "RecommendationDelivery"("deliveryStatus", "sendClaimedAt");

ALTER TABLE "RecommendationDelivery"
ADD CONSTRAINT "RecommendationDelivery_confirmationActorIdentityId_fkey"
FOREIGN KEY ("confirmationActorIdentityId") REFERENCES "PersonIdentity"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "IdentityReview_personIdentityId_status_key";
CREATE UNIQUE INDEX "IdentityReview_pending_identity_key"
ON "IdentityReview"("personIdentityId") WHERE "status" = 'PENDING';

WITH ranked_active_invitations AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "projectId", "personId"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS rank
  FROM "WhatsAppInvitation"
  WHERE "status" NOT IN ('ACTIVATED', 'EXPIRED', 'REVOKED', 'FAILED')
)
UPDATE "WhatsAppInvitation" invitation
SET
  "status" = 'REVOKED',
  "failureReason" = COALESCE(invitation."failureReason", 'Superseded during invitation hardening.')
FROM ranked_active_invitations ranked
WHERE invitation."id" = ranked."id" AND ranked.rank > 1;

CREATE UNIQUE INDEX "WhatsAppInvitation_active_project_person_key"
ON "WhatsAppInvitation"("projectId", "personId")
WHERE "status" NOT IN ('ACTIVATED', 'EXPIRED', 'REVOKED', 'FAILED');

-- Backfill platform people and project participation for existing users.
INSERT INTO "Person" (
  "id", "organizationId", "userId", "displayName", "email", "type", "status", "createdAt", "updatedAt"
)
SELECT
  'person_backfill_' || md5(m."id"),
  m."organizationId",
  m."userId",
  COALESCE(NULLIF(u."name", ''), u."email"),
  u."email",
  'INTERNAL'::"PersonType",
  'ACTIVE'::"PersonStatus",
  NOW(),
  NOW()
FROM "Membership" m
JOIN "User" u ON u."id" = m."userId"
ON CONFLICT ("organizationId", "userId") DO NOTHING;

INSERT INTO "ProjectParticipant" (
  "id", "organizationId", "projectId", "personId", "source", "participantStatus",
  "firstSeenAt", "lastSeenAt", "createdAt", "updatedAt"
)
SELECT
  'participant_backfill_' || md5(m."id" || ':' || p."id"),
  m."organizationId",
  p."id",
  pe."id",
  'SYSTEM'::"ProjectParticipantSource",
  'ACTIVE'::"ProjectParticipantStatus",
  NOW(), NOW(), NOW(), NOW()
FROM "Membership" m
JOIN "Person" pe ON pe."organizationId" = m."organizationId" AND pe."userId" = m."userId"
JOIN "Project" p ON p."organizationId" = m."organizationId"
WHERE m."allProjects" = TRUE
ON CONFLICT ("projectId", "personId") DO NOTHING;

INSERT INTO "ProjectParticipant" (
  "id", "organizationId", "projectId", "personId", "source", "participantStatus",
  "firstSeenAt", "lastSeenAt", "createdAt", "updatedAt"
)
SELECT
  'participant_access_' || md5(pa."id"),
  m."organizationId",
  pa."projectId",
  pe."id",
  'SYSTEM'::"ProjectParticipantSource",
  'ACTIVE'::"ProjectParticipantStatus",
  NOW(), NOW(), NOW(), NOW()
FROM "ProjectAccess" pa
JOIN "Membership" m ON m."id" = pa."membershipId"
JOIN "Person" pe ON pe."organizationId" = m."organizationId" AND pe."userId" = m."userId"
ON CONFLICT ("projectId", "personId") DO NOTHING;

-- Existing accounts did not retain their connector. Infer only when the organization has one owner.
UPDATE "WhatsAppAccount" wa
SET "connectedByUserId" = owner_membership."userId"
FROM (
  SELECT "organizationId", MIN("userId") AS "userId"
  FROM "Membership"
  WHERE "role" = 'OWNER'
  GROUP BY "organizationId"
  HAVING COUNT(*) = 1
) owner_membership
WHERE wa."organizationId" = owner_membership."organizationId"
  AND wa."connectedByUserId" IS NULL;
