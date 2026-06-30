import type { FastifyInstance } from "fastify";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AppRepository,
  MembershipRecord,
  OrganizationRecord,
  ProjectRecord,
  Role,
  SafeUser,
  Status,
  StoredUser
} from "./repository.js";

vi.stubEnv("CORS_ORIGIN", "http://localhost:3000");
vi.stubEnv("DATABASE_URL", "postgresql://fieldos:fieldos@localhost:5432/fieldos?schema=public");
vi.stubEnv("JWT_SECRET", "test-secret-that-is-long-enough");
vi.stubEnv("NODE_ENV", "test");
vi.stubEnv("PORT", "3001");

let buildServer: typeof import("./server.js").buildServer;

beforeAll(async () => {
  buildServer = (await import("./server.js")).buildServer;
});

describe("FieldOS API auth and tenancy", () => {
  let repository: InMemoryRepository;
  let server: FastifyInstance;

  beforeEach(() => {
    repository = new InMemoryRepository();
    server = buildServer({ repository });
  });

  it("signs up a user", async () => {
    const response = await server.inject({
      method: "POST",
      payload: {
        email: "founder@example.com",
        name: "Founder",
        password: "password123"
      },
      url: "/auth/signup"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user.email).toBe("founder@example.com");
    expect(response.headers["set-cookie"]).toContain("fieldos_session=");
  });

  it("logs in a user", async () => {
    await signup(server);

    const response = await server.inject({
      method: "POST",
      payload: {
        email: "founder@example.com",
        password: "password123"
      },
      url: "/auth/login"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user.email).toBe("founder@example.com");
  });

  it("creates an organization for an authenticated user", async () => {
    const cookie = await signup(server);
    const response = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      payload: {
        name: "Acme Field Ops",
        slug: "acme-field-ops"
      },
      url: "/organizations"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().organization.role).toBe("OWNER");
  });

  it("rejects unauthenticated organization access", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/organizations"
    });

    expect(response.statusCode).toBe(401);
  });

  it("creates a project as OWNER", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    const response = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      payload: {
        code: "ACME-001",
        name: "Warehouse rollout",
        status: "ACTIVE"
      },
      url: `/organizations/${organization.id}/projects`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().project.code).toBe("ACME-001");
  });

  it("rejects project creation as VIEWER", async () => {
    const ownerCookie = await signup(server, "owner@example.com");
    const organization = await createOrganization(server, ownerCookie);
    const viewerCookie = await signup(server, "viewer@example.com");
    const viewer = repository.users.find((user) => user.email === "viewer@example.com");

    if (!viewer) {
      throw new Error("viewer user was not created");
    }

    repository.addMembership(viewer.id, organization.id, "VIEWER");

    const response = await server.inject({
      headers: {
        cookie: viewerCookie
      },
      method: "POST",
      payload: {
        code: "VIEW-001",
        name: "Viewer project",
        status: "ACTIVE"
      },
      url: `/organizations/${organization.id}/projects`
    });

    expect(response.statusCode).toBe(403);
  });
});

async function signup(
  server: FastifyInstance,
  email = "founder@example.com",
  password = "password123"
): Promise<string> {
  const response = await server.inject({
    method: "POST",
    payload: {
      email,
      name: "Founder",
      password
    },
    url: "/auth/signup"
  });
  const cookie = response.cookies[0];

  if (!cookie) {
    throw new Error("signup did not return an auth cookie");
  }

  return `${cookie.name}=${cookie.value}`;
}

async function createOrganization(
  server: FastifyInstance,
  cookie: string
): Promise<OrganizationRecord> {
  const response = await server.inject({
    headers: {
      cookie
    },
    method: "POST",
    payload: {
      name: "Acme Field Ops",
      slug: `acme-${Math.random().toString(36).slice(2, 8)}`
    },
    url: "/organizations"
  });

  return response.json().organization as OrganizationRecord;
}

class InMemoryRepository implements AppRepository {
  memberships: MembershipRecord[] = [];
  organizations: Omit<OrganizationRecord, "role">[] = [];
  projects: ProjectRecord[] = [];
  users: StoredUser[] = [];

  addMembership(userId: string, organizationId: string, role: Role): MembershipRecord {
    const membership = {
      id: nextId("membership"),
      organizationId,
      role,
      userId
    };
    this.memberships.push(membership);
    return membership;
  }

  async createOrganization(input: {
    name: string;
    ownerUserId: string;
    slug: string;
  }): Promise<OrganizationRecord> {
    const now = new Date();
    const organization = {
      createdAt: now,
      id: nextId("organization"),
      name: input.name,
      slug: input.slug,
      updatedAt: now
    };
    this.organizations.push(organization);
    this.addMembership(input.ownerUserId, organization.id, "OWNER");
    return { ...organization, role: "OWNER" };
  }

  async createProject(input: {
    code: string;
    name: string;
    organizationId: string;
    status: Status;
  }): Promise<ProjectRecord> {
    const now = new Date();
    const project = {
      ...input,
      createdAt: now,
      id: nextId("project"),
      updatedAt: now
    };
    this.projects.push(project);
    return project;
  }

  async createUser(input: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<SafeUser> {
    const now = new Date();
    const user = {
      ...input,
      createdAt: now,
      id: nextId("user"),
      updatedAt: now
    };
    this.users.push(user);
    return toSafeUser(user);
  }

  async disconnect(): Promise<void> {}

  async findMembership(userId: string, organizationId: string): Promise<MembershipRecord | null> {
    return (
      this.memberships.find(
        (membership) => membership.userId === userId && membership.organizationId === organizationId
      ) ?? null
    );
  }

  async findProjectForUser(userId: string, projectId: string): Promise<ProjectRecord | null> {
    const project = this.projects.find((candidate) => candidate.id === projectId);

    if (!project) {
      return null;
    }

    const membership = await this.findMembership(userId, project.organizationId);
    return membership ? project : null;
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    return this.users.find((user) => user.email === email.trim().toLowerCase()) ?? null;
  }

  async findUserById(id: string): Promise<SafeUser | null> {
    const user = this.users.find((candidate) => candidate.id === id);
    return user ? toSafeUser(user) : null;
  }

  async getOrganizationForUser(
    userId: string,
    organizationId: string
  ): Promise<OrganizationRecord | null> {
    const membership = await this.findMembership(userId, organizationId);
    const organization = this.organizations.find((candidate) => candidate.id === organizationId);
    return membership && organization ? { ...organization, role: membership.role } : null;
  }

  async listOrganizations(userId: string): Promise<OrganizationRecord[]> {
    return this.memberships
      .filter((membership) => membership.userId === userId)
      .flatMap((membership) => {
        const organization = this.organizations.find(
          (candidate) => candidate.id === membership.organizationId
        );
        return organization ? [{ ...organization, role: membership.role }] : [];
      });
  }

  async listProjects(userId: string, organizationId: string): Promise<ProjectRecord[]> {
    const membership = await this.findMembership(userId, organizationId);
    return membership
      ? this.projects.filter((project) => project.organizationId === organizationId)
      : [];
  }
}

let idCounter = 0;

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
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
