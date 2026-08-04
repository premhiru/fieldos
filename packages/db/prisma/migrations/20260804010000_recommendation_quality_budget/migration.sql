ALTER TYPE "RecommendationSuppressionReason" ADD VALUE IF NOT EXISTS 'LOW_VALUE';
ALTER TYPE "RecommendationSuppressionReason" ADD VALUE IF NOT EXISTS 'QUEUE_SATURATED';

-- Keep the strongest, freshest pending recommendation for each underlying decision.
WITH ranked_duplicates AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY
        "projectId",
        "sourceCoordinator",
        COALESCE("sourceEntityId", ''),
        "proposedActionType"
      ORDER BY
        CASE "priority"
          WHEN 'URGENT' THEN 0
          WHEN 'HIGH' THEN 1
          WHEN 'MEDIUM' THEN 2
          ELSE 3
        END,
        CASE "confidence"
          WHEN 'HIGH' THEN 0
          WHEN 'MEDIUM' THEN 1
          ELSE 2
        END,
        "createdAt" DESC
    ) AS duplicate_rank
  FROM "Recommendation"
  WHERE "status" = 'PENDING'
)
UPDATE "Recommendation"
SET
  "status" = 'DISMISSED',
  "dismissedAt" = NOW(),
  "dismissReason" = 'Automatically consolidated by the recommendation quality policy.',
  "updatedAt" = NOW()
WHERE "id" IN (
  SELECT "id"
  FROM ranked_duplicates
  WHERE duplicate_rank > 1
);

-- Bound each coordinator's non-urgent contribution to a PM-sized review queue.
WITH ranked_by_coordinator AS (
  SELECT
    "id",
    "sourceCoordinator",
    ROW_NUMBER() OVER (
      PARTITION BY "projectId", "sourceCoordinator"
      ORDER BY
        CASE "priority" WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
        CASE "confidence" WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
        "createdAt" DESC
    ) AS coordinator_rank
  FROM "Recommendation"
  WHERE "status" = 'PENDING' AND "priority" <> 'URGENT'
), over_coordinator_budget AS (
  SELECT "id"
  FROM ranked_by_coordinator
  WHERE coordinator_rank > CASE "sourceCoordinator"
    WHEN 'FOLLOW_UP' THEN 3
    WHEN 'PROGRESS' THEN 4
    WHEN 'MILESTONE' THEN 4
    WHEN 'INSPECTION' THEN 2
    WHEN 'REPORT' THEN 1
    ELSE 1
  END
)
UPDATE "Recommendation"
SET
  "status" = 'DISMISSED',
  "dismissedAt" = NOW(),
  "dismissReason" = 'Automatically consolidated by the recommendation quality policy.',
  "updatedAt" = NOW()
WHERE "id" IN (SELECT "id" FROM over_coordinator_budget);

-- Retain a maximum of twelve non-urgent recommendations per project.
WITH ranked_project_queue AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "projectId"
      ORDER BY
        CASE "priority" WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
        CASE "confidence" WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
        "createdAt" DESC
    ) AS project_rank
  FROM "Recommendation"
  WHERE "status" = 'PENDING' AND "priority" <> 'URGENT'
)
UPDATE "Recommendation"
SET
  "status" = 'DISMISSED',
  "dismissedAt" = NOW(),
  "dismissReason" = 'Automatically consolidated by the recommendation quality policy.',
  "updatedAt" = NOW()
WHERE "id" IN (
  SELECT "id"
  FROM ranked_project_queue
  WHERE project_rank > 12
);
