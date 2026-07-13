import { prisma } from "@fieldos/db";
import { createHash, randomBytes } from "node:crypto";

export type TeamRole = "ADMIN" | "MEMBER" | "VIEWER";

export interface TeamInvitationDelivery {
  deliveryKey: string;
  email: string;
  invitationId: string;
  organizationName: string;
  role: TeamRole;
  token: string;
}

export class TeamServiceError extends Error {
  constructor(
    readonly code:
      | "EMAIL_MISMATCH"
      | "EXPIRED"
      | "FORBIDDEN"
      | "INVALID_PROJECT"
      | "MEMBER_EXISTS"
      | "NOT_FOUND"
      | "OWNER_PROTECTED"
      | "USED",
    message: string
  ) {
    super(message);
    this.name = "TeamServiceError";
  }
}

export interface TeamService {
  acceptInvitation(input: { token: string; userEmail: string; userId: string }): Promise<void>;
  createInvitation(input: {
    email: string;
    invitedByUserId: string;
    organizationId: string;
    projectIds: string[];
    role: TeamRole;
  }): Promise<TeamInvitationDelivery>;
  getInvitation(token: string): Promise<ReturnType<typeof toPublicInvitation>>;
  listTeam(organizationId: string): Promise<{
    invitations: Array<ReturnType<typeof toInvitationRecord>>;
    members: Array<ReturnType<typeof toMemberRecord>>;
  }>;
  removeMember(input: {
    actorRole: "OWNER" | "ADMIN";
    actorUserId: string;
    membershipId: string;
    organizationId: string;
  }): Promise<void>;
  resendInvitation(input: {
    invitationId: string;
    organizationId: string;
  }): Promise<TeamInvitationDelivery>;
  revokeInvitation(input: { invitationId: string; organizationId: string }): Promise<void>;
  updateMember(input: {
    actorRole: "OWNER" | "ADMIN";
    membershipId: string;
    organizationId: string;
    projectIds: string[];
    role: TeamRole;
  }): Promise<void>;
}

type DatabaseClient = typeof prisma;

const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;

export function createPrismaTeamService(db: DatabaseClient = prisma): TeamService {
  return {
    async acceptInvitation(input) {
      const tokenHash = hashToken(input.token);
      await db.$transaction(async (tx) => {
        const invitation = await tx.teamInvitation.findUnique({
          include: { projects: true },
          where: { tokenHash }
        });

        if (!invitation || invitation.revokedAt) {
          throw new TeamServiceError("NOT_FOUND", "Invitation not found.");
        }
        if (invitation.acceptedAt) {
          throw new TeamServiceError("USED", "This invitation has already been accepted.");
        }
        if (invitation.expiresAt <= new Date()) {
          throw new TeamServiceError("EXPIRED", "This invitation has expired.");
        }
        if (normalizeEmail(input.userEmail) !== invitation.email) {
          throw new TeamServiceError(
            "EMAIL_MISMATCH",
            `Sign in with ${invitation.email} to accept this invitation.`
          );
        }

        const allProjects = invitation.role === "ADMIN";
        const membership = await tx.membership.upsert({
          create: {
            allProjects,
            organizationId: invitation.organizationId,
            role: invitation.role,
            userId: input.userId
          },
          update: {
            allProjects,
            role: invitation.role
          },
          where: {
            userId_organizationId: {
              organizationId: invitation.organizationId,
              userId: input.userId
            }
          }
        });

        await tx.projectAccess.deleteMany({ where: { membershipId: membership.id } });
        if (!allProjects && invitation.projects.length > 0) {
          await tx.projectAccess.createMany({
            data: invitation.projects.map(({ projectId }) => ({
              membershipId: membership.id,
              projectId
            }))
          });
        }
        await tx.teamInvitation.update({
          data: { acceptedAt: new Date(), acceptedByUserId: input.userId },
          where: { id: invitation.id }
        });
      });
    },

    async createInvitation(input) {
      const email = normalizeEmail(input.email);
      await assertProjectsBelongToOrganization(db, input.organizationId, input.projectIds);
      const existingMember = await db.membership.findFirst({
        where: { organizationId: input.organizationId, user: { email } }
      });
      if (existingMember) {
        throw new TeamServiceError("MEMBER_EXISTS", "This user is already a team member.");
      }

      const token = createToken();
      const invitation = await db.$transaction(async (tx) => {
        await tx.teamInvitation.updateMany({
          data: { revokedAt: new Date() },
          where: {
            acceptedAt: null,
            email,
            organizationId: input.organizationId,
            revokedAt: null
          }
        });
        return tx.teamInvitation.create({
          data: {
            email,
            expiresAt: new Date(Date.now() + invitationLifetimeMs),
            invitedByUserId: input.invitedByUserId,
            organizationId: input.organizationId,
            projects:
              input.role === "ADMIN"
                ? undefined
                : { create: unique(input.projectIds).map((projectId) => ({ projectId })) },
            role: input.role,
            tokenHash: hashToken(token)
          },
          include: { organization: true }
        });
      });

      return {
        deliveryKey: hashToken(token).slice(0, 16),
        email,
        invitationId: invitation.id,
        organizationName: invitation.organization.name,
        role: input.role,
        token
      };
    },

    async getInvitation(token) {
      const invitation = await db.teamInvitation.findUnique({
        include: { organization: true, projects: { include: { project: true } } },
        where: { tokenHash: hashToken(token) }
      });
      if (!invitation || invitation.revokedAt) {
        throw new TeamServiceError("NOT_FOUND", "Invitation not found.");
      }
      return toPublicInvitation(invitation);
    },

    async listTeam(organizationId) {
      const [members, invitations] = await Promise.all([
        db.membership.findMany({
          include: { projectAccess: { include: { project: true } }, user: true },
          orderBy: { createdAt: "asc" },
          where: { organizationId }
        }),
        db.teamInvitation.findMany({
          include: { projects: { include: { project: true } } },
          orderBy: { createdAt: "desc" },
          take: 100,
          where: { organizationId }
        })
      ]);
      return {
        invitations: invitations.map(toInvitationRecord),
        members: members.map(toMemberRecord)
      };
    },

    async removeMember(input) {
      const membership = await db.membership.findFirst({
        where: { id: input.membershipId, organizationId: input.organizationId }
      });
      if (!membership) {
        throw new TeamServiceError("NOT_FOUND", "Team member not found.");
      }
      assertCanManageMembership(input.actorRole, membership.role);
      if (membership.userId === input.actorUserId) {
        throw new TeamServiceError("FORBIDDEN", "You cannot remove your own membership.");
      }
      await db.membership.delete({ where: { id: membership.id } });
    },

    async resendInvitation(input) {
      const token = createToken();
      const invitation = await db.teamInvitation.findFirst({
        include: { organization: true },
        where: { id: input.invitationId, organizationId: input.organizationId }
      });
      if (!invitation || invitation.revokedAt) {
        throw new TeamServiceError("NOT_FOUND", "Invitation not found.");
      }
      if (invitation.acceptedAt) {
        throw new TeamServiceError("USED", "This invitation has already been accepted.");
      }
      if (invitation.role === "OWNER") {
        throw new TeamServiceError("OWNER_PROTECTED", "Owner invitations cannot be resent.");
      }
      await db.teamInvitation.update({
        data: {
          expiresAt: new Date(Date.now() + invitationLifetimeMs),
          tokenHash: hashToken(token)
        },
        where: { id: invitation.id }
      });
      return {
        deliveryKey: hashToken(token).slice(0, 16),
        email: invitation.email,
        invitationId: invitation.id,
        organizationName: invitation.organization.name,
        role: invitation.role,
        token
      };
    },

    async revokeInvitation(input) {
      const result = await db.teamInvitation.updateMany({
        data: { revokedAt: new Date() },
        where: {
          acceptedAt: null,
          id: input.invitationId,
          organizationId: input.organizationId,
          revokedAt: null
        }
      });
      if (result.count !== 1) {
        throw new TeamServiceError("NOT_FOUND", "Pending invitation not found.");
      }
    },

    async updateMember(input) {
      await assertProjectsBelongToOrganization(db, input.organizationId, input.projectIds);
      await db.$transaction(async (tx) => {
        const membership = await tx.membership.findFirst({
          where: { id: input.membershipId, organizationId: input.organizationId }
        });
        if (!membership) {
          throw new TeamServiceError("NOT_FOUND", "Team member not found.");
        }
        assertCanManageMembership(input.actorRole, membership.role, input.role);
        const allProjects = input.role === "ADMIN";
        await tx.membership.update({
          data: { allProjects, role: input.role },
          where: { id: membership.id }
        });
        await tx.projectAccess.deleteMany({ where: { membershipId: membership.id } });
        if (!allProjects && input.projectIds.length > 0) {
          await tx.projectAccess.createMany({
            data: unique(input.projectIds).map((projectId) => ({
              membershipId: membership.id,
              projectId
            }))
          });
        }
      });
    }
  };
}

function assertCanManageMembership(
  actorRole: "OWNER" | "ADMIN",
  currentRole: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER",
  nextRole?: TeamRole
): void {
  if (currentRole === "OWNER") {
    throw new TeamServiceError("OWNER_PROTECTED", "The organization owner cannot be changed.");
  }
  if (actorRole !== "OWNER" && (currentRole === "ADMIN" || nextRole === "ADMIN")) {
    throw new TeamServiceError("FORBIDDEN", "Only the owner can manage administrators.");
  }
}

async function assertProjectsBelongToOrganization(
  db: DatabaseClient,
  organizationId: string,
  projectIds: string[]
): Promise<void> {
  const ids = unique(projectIds);
  if (ids.length === 0) return;
  const count = await db.project.count({ where: { id: { in: ids }, organizationId } });
  if (count !== ids.length) {
    throw new TeamServiceError("INVALID_PROJECT", "One or more projects are invalid.");
  }
}

function createToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function invitationStatus(invitation: {
  acceptedAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
}): "ACCEPTED" | "EXPIRED" | "PENDING" | "REVOKED" {
  if (invitation.acceptedAt) return "ACCEPTED";
  if (invitation.revokedAt) return "REVOKED";
  if (invitation.expiresAt <= new Date()) return "EXPIRED";
  return "PENDING";
}

function toInvitationRecord(invitation: {
  acceptedAt: Date | null;
  createdAt: Date;
  email: string;
  expiresAt: Date;
  id: string;
  projects: Array<{ project: { id: string; name: string } }>;
  revokedAt: Date | null;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
}) {
  return {
    acceptedAt: invitation.acceptedAt,
    createdAt: invitation.createdAt,
    email: invitation.email,
    expiresAt: invitation.expiresAt,
    id: invitation.id,
    projects: invitation.projects.map(({ project }) => project),
    role: invitation.role,
    status: invitationStatus(invitation)
  };
}

function toMemberRecord(membership: {
  allProjects: boolean;
  createdAt: Date;
  id: string;
  projectAccess: Array<{ project: { id: string; name: string } }>;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  user: { email: string; id: string; name: string };
}) {
  return {
    allProjects: membership.allProjects,
    createdAt: membership.createdAt,
    id: membership.id,
    projects: membership.projectAccess.map(({ project }) => project),
    role: membership.role,
    user: membership.user
  };
}

function toPublicInvitation(invitation: {
  acceptedAt: Date | null;
  email: string;
  expiresAt: Date;
  organization: { id: string; name: string };
  projects: Array<{ project: { id: string; name: string } }>;
  revokedAt: Date | null;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
}) {
  return {
    email: invitation.email,
    expiresAt: invitation.expiresAt,
    organization: invitation.organization,
    projects: invitation.projects.map(({ project }) => project),
    role: invitation.role,
    status: invitationStatus(invitation)
  };
}
