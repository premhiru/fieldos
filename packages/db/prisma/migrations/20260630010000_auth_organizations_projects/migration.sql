CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '';

ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP DEFAULT;

CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Project" ADD COLUMN "code" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Project" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Project" ALTER COLUMN "status" TYPE "ProjectStatus" USING "status"::"ProjectStatus";

ALTER TABLE "Project" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

ALTER TABLE "Project" ALTER COLUMN "code" DROP DEFAULT;

CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");

CREATE INDEX "Membership_organizationId_idx" ON "Membership"("organizationId");

CREATE UNIQUE INDEX "Project_organizationId_code_key" ON "Project"("organizationId", "code");

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
