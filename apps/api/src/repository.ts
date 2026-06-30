import type { MembershipRole, PrismaClient, ProjectStatus } from "@fieldos/db";

export type Role = MembershipRole;
export type Status = ProjectStatus;

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredUser extends SafeUser {
  passwordHash: string;
}

export interface OrganizationRecord {
  id: string;
  name: string;
  slug: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export interface MembershipRecord {
  id: string;
  userId: string;
  organizationId: string;
  role: Role;
}

export interface ProjectRecord {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppRepository {
  createOrganization(input: {
    name: string;
    ownerUserId: string;
    slug: string;
  }): Promise<OrganizationRecord>;
  createProject(input: {
    code: string;
    name: string;
    organizationId: string;
    status: Status;
  }): Promise<ProjectRecord>;
  createUser(input: { email: string; name: string; passwordHash: string }): Promise<SafeUser>;
  disconnect(): Promise<void>;
  findMembership(userId: string, organizationId: string): Promise<MembershipRecord | null>;
  findProjectForUser(userId: string, projectId: string): Promise<ProjectRecord | null>;
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<SafeUser | null>;
  getOrganizationForUser(
    userId: string,
    organizationId: string
  ): Promise<OrganizationRecord | null>;
  listOrganizations(userId: string): Promise<OrganizationRecord[]>;
  listProjects(userId: string, organizationId: string): Promise<ProjectRecord[]>;
}

export function createPrismaRepository(): AppRepository {
  let prismaPromise: Promise<PrismaClient> | null = null;

  function getPrisma(): Promise<PrismaClient> {
    prismaPromise ??= import("@fieldos/db").then((module) => module.prisma);
    return prismaPromise;
  }

  return {
    async createOrganization(input) {
      const prisma = await getPrisma();
      const result = await prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            name: input.name,
            slug: input.slug
          }
        });

        const membership = await tx.membership.create({
          data: {
            organizationId: organization.id,
            role: "OWNER",
            userId: input.ownerUserId
          }
        });

        return { membership, organization };
      });

      return {
        ...result.organization,
        role: result.membership.role
      };
    },

    async createProject(input) {
      const prisma = await getPrisma();
      return prisma.project.create({
        data: input
      });
    },

    async createUser(input) {
      const prisma = await getPrisma();
      const user = await prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash: input.passwordHash
        }
      });

      return toSafeUser(user);
    },

    async disconnect() {
      const prisma = await getPrisma();
      await prisma.$disconnect();
    },

    async findMembership(userId, organizationId) {
      const prisma = await getPrisma();
      return prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            organizationId,
            userId
          }
        }
      });
    },

    async findProjectForUser(userId, projectId) {
      const prisma = await getPrisma();
      return prisma.project.findFirst({
        where: {
          id: projectId,
          organization: {
            memberships: {
              some: {
                userId
              }
            }
          }
        }
      });
    },

    async findUserByEmail(email) {
      const prisma = await getPrisma();
      return prisma.user.findUnique({
        where: {
          email: normalizeEmail(email)
        }
      });
    },

    async findUserById(id) {
      const prisma = await getPrisma();
      const user = await prisma.user.findUnique({
        where: {
          id
        }
      });

      return user ? toSafeUser(user) : null;
    },

    async getOrganizationForUser(userId, organizationId) {
      const prisma = await getPrisma();
      const membership = await prisma.membership.findUnique({
        include: {
          organization: true
        },
        where: {
          userId_organizationId: {
            organizationId,
            userId
          }
        }
      });

      return membership
        ? {
            ...membership.organization,
            role: membership.role
          }
        : null;
    },

    async listOrganizations(userId) {
      const prisma = await getPrisma();
      const memberships = await prisma.membership.findMany({
        include: {
          organization: true
        },
        orderBy: {
          createdAt: "asc"
        },
        where: {
          userId
        }
      });

      return memberships.map((membership) => ({
        ...membership.organization,
        role: membership.role
      }));
    },

    async listProjects(userId, organizationId) {
      const prisma = await getPrisma();
      const membership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            organizationId,
            userId
          }
        }
      });

      if (!membership) {
        return [];
      }

      return prisma.project.findMany({
        orderBy: {
          createdAt: "desc"
        },
        where: {
          organizationId
        }
      });
    }
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toSafeUser(user: StoredUser): SafeUser {
  return {
    createdAt: user.createdAt,
    email: user.email,
    id: user.id,
    name: user.name,
    updatedAt: user.updatedAt
  };
}
