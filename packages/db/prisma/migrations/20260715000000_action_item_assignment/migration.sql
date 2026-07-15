UPDATE "ActionItem"
SET "assignedToUserId" = "acceptedByUserId"
WHERE "assignedToUserId" IS NULL
  AND "acceptedByUserId" IS NOT NULL;
