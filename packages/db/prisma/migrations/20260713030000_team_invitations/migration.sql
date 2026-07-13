ALTER TABLE "Membership"
ADD COLUMN "allProjects" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "TeamInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "invitedByUserId" TEXT NOT NULL,
    "acceptedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeamInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamInvitationProject" (
    "invitationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "TeamInvitationProject_pkey" PRIMARY KEY ("invitationId", "projectId")
);

CREATE TABLE "ProjectAccess" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamInvitation_tokenHash_key" ON "TeamInvitation"("tokenHash");
CREATE INDEX "TeamInvitation_organizationId_createdAt_idx" ON "TeamInvitation"("organizationId", "createdAt");
CREATE INDEX "TeamInvitation_email_organizationId_idx" ON "TeamInvitation"("email", "organizationId");
CREATE INDEX "TeamInvitation_expiresAt_idx" ON "TeamInvitation"("expiresAt");
CREATE INDEX "TeamInvitationProject_projectId_idx" ON "TeamInvitationProject"("projectId");
CREATE UNIQUE INDEX "ProjectAccess_membershipId_projectId_key" ON "ProjectAccess"("membershipId", "projectId");
CREATE INDEX "ProjectAccess_projectId_idx" ON "ProjectAccess"("projectId");

ALTER TABLE "TeamInvitation"
ADD CONSTRAINT "TeamInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamInvitation"
ADD CONSTRAINT "TeamInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamInvitation"
ADD CONSTRAINT "TeamInvitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeamInvitationProject"
ADD CONSTRAINT "TeamInvitationProject_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "TeamInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamInvitationProject"
ADD CONSTRAINT "TeamInvitationProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAccess"
ADD CONSTRAINT "ProjectAccess_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAccess"
ADD CONSTRAINT "ProjectAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
