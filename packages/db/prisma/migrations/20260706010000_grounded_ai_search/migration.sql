CREATE TYPE "SearchDocumentSourceType" AS ENUM (
  'PROJECT',
  'MESSAGE',
  'TIMELINE_EVENT',
  'ACTION_ITEM',
  'AI_CLASSIFICATION'
);

CREATE TABLE "SearchDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "sourceType" "SearchDocumentSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SearchDocument_sourceType_sourceId_key" ON "SearchDocument"("sourceType", "sourceId");
CREATE INDEX "SearchDocument_organizationId_createdAt_idx" ON "SearchDocument"("organizationId", "createdAt");
CREATE INDEX "SearchDocument_organizationId_projectId_createdAt_idx" ON "SearchDocument"("organizationId", "projectId", "createdAt");
CREATE INDEX "SearchDocument_organizationId_sourceType_createdAt_idx" ON "SearchDocument"("organizationId", "sourceType", "createdAt");
CREATE INDEX "SearchDocument_projectId_createdAt_idx" ON "SearchDocument"("projectId", "createdAt");
CREATE INDEX "SearchDocument_text_search_idx" ON "SearchDocument" USING GIN (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("content", '')));

ALTER TABLE "SearchDocument" ADD CONSTRAINT "SearchDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SearchDocument" ADD CONSTRAINT "SearchDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
