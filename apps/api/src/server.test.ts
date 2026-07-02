import type { FastifyInstance } from "fastify";
import type {
  AttachmentRecord,
  ConversationContext,
  ConversationRecord,
  CreateAttachmentInput,
  CreateConversationInput,
  CreateMessageInput,
  CreateParticipantInput,
  MessageContext,
  MessageRecord,
  ParticipantRecord
} from "@fieldos/messaging";
import type { WhatsAppQrStore } from "@fieldos/baileys-whatsapp/qr-store";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AppRepository,
  MembershipRecord,
  OrganizationRecord,
  ProjectRecord,
  Role,
  SafeUser,
  Status,
  StoredUser,
  WhatsAppAccountRecord,
  WhatsAppChatMappingRecord
} from "./repository.js";

vi.stubEnv("CORS_ORIGIN", "http://localhost:3000");
vi.stubEnv("DATABASE_URL", "postgresql://fieldos:fieldos@localhost:5432/fieldos?schema=public");
vi.stubEnv("JWT_SECRET", "test-secret-that-is-long-enough");
vi.stubEnv("NODE_ENV", "production");
vi.stubEnv("PORT", "3001");

let buildServer: typeof import("./server.js").buildServer;

beforeAll(async () => {
  buildServer = (await import("./server.js")).buildServer;
}, 30_000);

describe("FieldOS API auth and tenancy", () => {
  let repository: InMemoryRepository;
  let server: FastifyInstance;

  beforeEach(() => {
    repository = new InMemoryRepository();
    server = buildServer({ qrStore: new InMemoryQrStore(), repository });
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
    expect(response.headers["set-cookie"]).toContain("SameSite=None");
    expect(response.headers["set-cookie"]).toContain("Secure");
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

  it("creates and lists conversations for a member organization", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);

    const createResponse = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      payload: {
        channel: "EMAIL",
        externalId: "external-conversation-1",
        organizationId: organization.id,
        title: "Loading dock access"
      },
      url: "/conversations"
    });

    expect(createResponse.statusCode).toBe(200);

    const listResponse = await server.inject({
      headers: {
        cookie
      },
      method: "GET",
      url: `/conversations?organizationId=${organization.id}&search=dock`
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().conversations).toHaveLength(1);
  });

  it("adds a message and attachment, then deletes the message", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    const conversation = await repository.createConversation({
      channel: "SMS",
      externalId: "external-conversation-2",
      isGroup: false,
      lastMessageAt: null,
      organizationId: organization.id,
      projectId: null,
      title: "Crew check-in"
    });
    const participant = await repository.addParticipant({
      conversationId: conversation.id,
      displayName: "Crew Lead",
      externalIdentifier: "crew-lead",
      role: "operator"
    });

    const messageResponse = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      payload: {
        body: "Arrived on site.",
        conversationId: conversation.id,
        direction: "INBOUND",
        occurredAt: "2026-06-30T00:00:00.000Z",
        senderParticipantId: participant.id,
        type: "TEXT"
      },
      url: "/messages"
    });

    expect(messageResponse.statusCode).toBe(200);

    const attachmentResponse = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      payload: {
        filename: "site-photo.jpg",
        messageId: messageResponse.json().message.id,
        mimeType: "image/jpeg",
        size: 2048,
        storageKey: "attachments/site-photo.jpg"
      },
      url: "/attachments"
    });

    expect(attachmentResponse.statusCode).toBe(200);

    const deleteResponse = await server.inject({
      headers: {
        cookie
      },
      method: "DELETE",
      url: `/messages/${messageResponse.json().message.id}`
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json()).toEqual({ ok: true });
  });

  it("rejects conversation access for non-members", async () => {
    const ownerCookie = await signup(server, "owner@example.com");
    const organization = await createOrganization(server, ownerCookie);
    const outsiderCookie = await signup(server, "outsider@example.com");

    const response = await server.inject({
      headers: {
        cookie: outsiderCookie
      },
      method: "GET",
      url: `/conversations?organizationId=${organization.id}`
    });

    expect(response.statusCode).toBe(403);
  });

  it("creates a WhatsApp account as organization owner", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);

    const response = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      payload: {
        displayName: "Dispatch line",
        organizationId: organization.id
      },
      url: "/whatsapp/accounts"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().account.status).toBe("PENDING_QR");
  });

  it("enforces admin-only WhatsApp connect and disconnect", async () => {
    const ownerCookie = await signup(server, "owner@example.com");
    const organization = await createOrganization(server, ownerCookie);
    const account = await repository.createWhatsAppAccount({
      displayName: "Dispatch line",
      organizationId: organization.id
    });
    const memberCookie = await signup(server, "member@example.com");
    const member = repository.users.find((user) => user.email === "member@example.com");

    if (!member) {
      throw new Error("member user was not created");
    }

    repository.addMembership(member.id, organization.id, "MEMBER");
    const previousSessionKey = account.sessionKey;

    const memberConnect = await server.inject({
      headers: {
        cookie: memberCookie
      },
      method: "POST",
      url: `/whatsapp/accounts/${account.id}/connect`
    });

    expect(memberConnect.statusCode).toBe(403);

    const ownerConnect = await server.inject({
      headers: {
        cookie: ownerCookie
      },
      method: "POST",
      url: `/whatsapp/accounts/${account.id}/connect`
    });

    expect(ownerConnect.statusCode).toBe(200);
    expect(ownerConnect.json().account.sessionKey).not.toBe(previousSessionKey);
  });

  it("maps a WhatsApp chat to a project", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    const project = await repository.createProject({
      code: "MAP-001",
      name: "Mapping project",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const account = await repository.createWhatsAppAccount({
      displayName: "Dispatch line",
      organizationId: organization.id
    });
    const conversation = await repository.createConversation({
      channel: "WHATSAPP",
      externalId: "15551234567@s.whatsapp.net",
      isGroup: false,
      lastMessageAt: null,
      organizationId: organization.id,
      projectId: null,
      title: "Field contact"
    });
    const mapping = repository.addWhatsAppChatMapping({
      accountId: account.id,
      conversationId: conversation.id,
      jid: "15551234567@s.whatsapp.net",
      organizationId: organization.id
    });

    const response = await server.inject({
      headers: {
        cookie
      },
      method: "PATCH",
      payload: {
        projectId: project.id
      },
      url: `/whatsapp/chat-mappings/${mapping.id}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().chat.project.id).toBe(project.id);
    expect(repository.conversations.find((item) => item.id === conversation.id)?.projectId).toBe(
      project.id
    );
  });

  it("activates a discovered WhatsApp chat only when an admin maps a project", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    const project = await repository.createProject({
      code: "ACT-001",
      name: "Activation project",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const account = await repository.createWhatsAppAccount({
      displayName: "Dispatch line",
      organizationId: organization.id
    });
    const mapping = repository.addWhatsAppChatMapping({
      accountId: account.id,
      jid: "15551234567@s.whatsapp.net",
      organizationId: organization.id
    });

    expect(mapping.status).toBe("DISCOVERED");

    const missingProjectResponse = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      payload: {},
      url: `/whatsapp/chat-mappings/${mapping.id}/activate`
    });

    expect(missingProjectResponse.statusCode).toBe(400);

    const response = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      payload: {
        projectId: project.id
      },
      url: `/whatsapp/chat-mappings/${mapping.id}/activate`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().chat.status).toBe("ACTIVE");
    expect(response.json().chat.projectId).toBe(project.id);
    expect(response.json().chat.activatedByUserId).toBe(repository.users[0]?.id);
    expect(response.json().chat.activatedAt).toBeTruthy();
  });

  it("prevents MEMBER and VIEWER users from activating WhatsApp chats", async () => {
    const ownerCookie = await signup(server, "owner@example.com");
    const organization = await createOrganization(server, ownerCookie);
    const project = await repository.createProject({
      code: "ROLE-001",
      name: "Role project",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const account = await repository.createWhatsAppAccount({
      displayName: "Dispatch line",
      organizationId: organization.id
    });
    const mapping = repository.addWhatsAppChatMapping({
      accountId: account.id,
      jid: "15551234567@s.whatsapp.net",
      organizationId: organization.id
    });
    const memberCookie = await signup(server, "member@example.com");
    const viewerCookie = await signup(server, "viewer@example.com");
    const member = repository.users.find((user) => user.email === "member@example.com");
    const viewer = repository.users.find((user) => user.email === "viewer@example.com");

    if (!member || !viewer) {
      throw new Error("test users were not created");
    }

    repository.addMembership(member.id, organization.id, "MEMBER");
    repository.addMembership(viewer.id, organization.id, "VIEWER");

    for (const cookie of [memberCookie, viewerCookie]) {
      const response = await server.inject({
        headers: {
          cookie
        },
        method: "POST",
        payload: {
          projectId: project.id
        },
        url: `/whatsapp/chat-mappings/${mapping.id}/activate`
      });

      expect(response.statusCode).toBe(403);
    }
  });

  it("sets WhatsApp chats to ignored and archived", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    const account = await repository.createWhatsAppAccount({
      displayName: "Dispatch line",
      organizationId: organization.id
    });
    const mapping = repository.addWhatsAppChatMapping({
      accountId: account.id,
      jid: "15551234567@s.whatsapp.net",
      organizationId: organization.id
    });

    const ignoreResponse = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      url: `/whatsapp/chat-mappings/${mapping.id}/ignore`
    });

    expect(ignoreResponse.statusCode).toBe(200);
    expect(ignoreResponse.json().chat.status).toBe("IGNORED");

    const archiveResponse = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      url: `/whatsapp/chat-mappings/${mapping.id}/archive`
    });

    expect(archiveResponse.statusCode).toBe(200);
    expect(archiveResponse.json().chat.status).toBe("ARCHIVED");
  });

  it("only lists active mapped WhatsApp conversations in the inbox", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    const project = await repository.createProject({
      code: "INBOX-001",
      name: "Inbox project",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const account = await repository.createWhatsAppAccount({
      displayName: "Dispatch line",
      organizationId: organization.id
    });
    const discoveredConversation = await repository.createConversation({
      channel: "WHATSAPP",
      externalId: "discovered@s.whatsapp.net",
      isGroup: false,
      lastMessageAt: null,
      organizationId: organization.id,
      projectId: null,
      title: "Discovered chat"
    });
    repository.addWhatsAppChatMapping({
      accountId: account.id,
      conversationId: discoveredConversation.id,
      jid: "discovered@s.whatsapp.net",
      organizationId: organization.id,
      status: "DISCOVERED"
    });
    const activeConversation = await repository.createConversation({
      channel: "WHATSAPP",
      externalId: "active@s.whatsapp.net",
      isGroup: false,
      lastMessageAt: null,
      organizationId: organization.id,
      projectId: project.id,
      title: "Active chat"
    });
    repository.addWhatsAppChatMapping({
      accountId: account.id,
      conversationId: activeConversation.id,
      jid: "active@s.whatsapp.net",
      organizationId: organization.id,
      projectId: project.id,
      status: "ACTIVE"
    });

    const response = await server.inject({
      headers: {
        cookie
      },
      method: "GET",
      url: `/conversations?organizationId=${organization.id}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().conversations).toHaveLength(1);
    expect(response.json().conversations[0].title).toBe("Active chat");
  });

  it("prevents cross-organization WhatsApp account access", async () => {
    const ownerCookie = await signup(server, "owner@example.com");
    const organization = await createOrganization(server, ownerCookie);
    const account = await repository.createWhatsAppAccount({
      displayName: "Dispatch line",
      organizationId: organization.id
    });
    const outsiderCookie = await signup(server, "outsider@example.com");

    const response = await server.inject({
      headers: {
        cookie: outsiderCookie
      },
      method: "GET",
      url: `/whatsapp/accounts/${account.id}`
    });

    expect(response.statusCode).toBe(404);
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
  attachments: AttachmentRecord[] = [];
  conversations: ConversationRecord[] = [];
  memberships: MembershipRecord[] = [];
  messages: MessageRecord[] = [];
  organizations: Omit<OrganizationRecord, "role">[] = [];
  participants: ParticipantRecord[] = [];
  projects: ProjectRecord[] = [];
  users: StoredUser[] = [];
  whatsAppAccounts: WhatsAppAccountRecord[] = [];
  whatsAppChatMappings: WhatsAppChatMappingRecord[] = [];

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

  async createConversation(input: Required<CreateConversationInput>): Promise<ConversationRecord> {
    const now = new Date();
    const project = input.projectId
      ? this.projects.find((candidate) => candidate.id === input.projectId)
      : null;
    const conversation = {
      ...input,
      createdAt: now,
      id: nextId("conversation"),
      lastMessageBody: null,
      project: project
        ? {
            code: project.code,
            id: project.id,
            name: project.name
          }
        : null,
      updatedAt: now
    };
    this.conversations.push(conversation);
    return conversation;
  }

  async createWhatsAppAccount(input: {
    displayName: string;
    organizationId: string;
  }): Promise<WhatsAppAccountRecord> {
    const now = new Date();
    const account = {
      connectorType: "BAILEYS" as const,
      createdAt: now,
      displayName: input.displayName,
      id: nextId("whatsapp_account"),
      lastConnectedAt: null,
      lastDisconnectedAt: null,
      lastMessageAt: null,
      organizationId: input.organizationId,
      phoneNumber: null,
      sessionKey: `baileys/${input.organizationId}/${nextId("session")}`,
      status: "PENDING_QR" as const,
      updatedAt: now
    };
    this.whatsAppAccounts.push(account);
    return account;
  }

  addWhatsAppChatMapping(input: {
    accountId: string;
    conversationId?: string;
    jid: string;
    organizationId: string;
    projectId?: string | null;
    status?: WhatsAppChatMappingRecord["status"];
  }): WhatsAppChatMappingRecord {
    const now = new Date();
    const conversation = input.conversationId
      ? this.conversations.find((candidate) => candidate.id === input.conversationId)
      : null;

    if (input.conversationId && !conversation) {
      throw new Error("conversation missing in test repository");
    }

    const projectId = input.projectId ?? conversation?.projectId ?? null;
    const project = projectId
      ? this.projects.find((candidate) => candidate.id === projectId)
      : null;
    const mapping = {
      activatedAt: input.status === "ACTIVE" ? now : null,
      activatedByUserId: null,
      chatName: conversation?.title ?? input.jid,
      conversation: conversation
        ? {
            id: conversation.id,
            projectId: conversation.projectId,
            title: conversation.title
          }
        : null,
      conversationId: input.conversationId ?? null,
      createdAt: now,
      id: nextId("whatsapp_chat"),
      isGroup: false,
      jid: input.jid,
      organizationId: input.organizationId,
      project: project
        ? {
            code: project.code,
            id: project.id,
            name: project.name
          }
        : null,
      projectId,
      status: input.status ?? "DISCOVERED",
      updatedAt: now,
      whatsappAccountId: input.accountId
    };
    this.whatsAppChatMappings.push(mapping);
    return mapping;
  }

  async addParticipant(input: CreateParticipantInput): Promise<ParticipantRecord> {
    const participant = {
      ...input,
      createdAt: new Date(),
      id: nextId("participant")
    };
    this.participants.push(participant);
    return participant;
  }

  async createMessage(input: CreateMessageInput): Promise<MessageRecord> {
    const participant = await this.findParticipant(input.senderParticipantId);

    if (!participant) {
      throw new Error("participant missing in test repository");
    }

    const message = {
      ...input,
      attachments: [],
      body: input.body ?? null,
      createdAt: new Date(),
      externalMessageId: input.externalMessageId ?? null,
      id: nextId("message"),
      senderParticipant: participant
    };
    this.messages.push(message);

    const conversation = this.conversations.find(
      (candidate) => candidate.id === input.conversationId
    );
    if (conversation) {
      conversation.lastMessageAt = input.occurredAt;
      conversation.lastMessageBody = input.body ?? null;
      conversation.updatedAt = new Date();
    }

    return message;
  }

  async createAttachment(
    input: CreateAttachmentInput & { conversationId: string }
  ): Promise<AttachmentRecord> {
    const attachment = {
      ...input,
      createdAt: new Date(),
      id: nextId("attachment")
    };
    this.attachments.push(attachment);

    const message = this.messages.find((candidate) => candidate.id === input.messageId);
    message?.attachments.push(attachment);

    return attachment;
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

  async userBelongsToOrganization(userId: string, organizationId: string): Promise<boolean> {
    return Boolean(await this.findMembership(userId, organizationId));
  }

  async projectBelongsToOrganization(projectId: string, organizationId: string): Promise<boolean> {
    return this.projects.some(
      (project) => project.id === projectId && project.organizationId === organizationId
    );
  }

  async findConversationContext(conversationId: string): Promise<ConversationContext | null> {
    const conversation = this.conversations.find((candidate) => candidate.id === conversationId);
    return conversation
      ? {
          id: conversation.id,
          organizationId: conversation.organizationId
        }
      : null;
  }

  async findMessageContext(messageId: string): Promise<MessageContext | null> {
    const message = this.messages.find((candidate) => candidate.id === messageId);
    const conversation = message
      ? this.conversations.find((candidate) => candidate.id === message.conversationId)
      : null;

    return message && conversation
      ? {
          conversationId: conversation.id,
          id: message.id,
          organizationId: conversation.organizationId
        }
      : null;
  }

  async findParticipant(participantId: string): Promise<ParticipantRecord | null> {
    return this.participants.find((participant) => participant.id === participantId) ?? null;
  }

  async getConversation(conversationId: string): Promise<ConversationRecord | null> {
    return this.conversations.find((conversation) => conversation.id === conversationId) ?? null;
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

  async activateWhatsAppChatMapping(input: {
    activatedByUserId: string;
    mappingId: string;
    projectId: string;
  }): Promise<WhatsAppChatMappingRecord> {
    const mapping = this.requireWhatsAppChatMapping(input.mappingId);
    const project = this.projects.find((candidate) => candidate.id === input.projectId);

    if (!project) {
      throw new Error("project missing in test repository");
    }

    mapping.activatedAt = new Date();
    mapping.activatedByUserId = input.activatedByUserId;
    mapping.projectId = input.projectId;
    mapping.project = {
      code: project.code,
      id: project.id,
      name: project.name
    };
    mapping.status = "ACTIVE";
    mapping.updatedAt = new Date();

    if (mapping.conversationId) {
      const conversation = this.conversations.find(
        (candidate) => candidate.id === mapping.conversationId
      );

      if (conversation) {
        conversation.projectId = input.projectId;
        conversation.project = mapping.project;
      }
    }

    return mapping;
  }

  async archiveWhatsAppChatMapping(mappingId: string): Promise<WhatsAppChatMappingRecord> {
    const mapping = this.requireWhatsAppChatMapping(mappingId);
    mapping.status = "ARCHIVED";
    mapping.updatedAt = new Date();
    return mapping;
  }

  async getWhatsAppAccount(accountId: string): Promise<WhatsAppAccountRecord | null> {
    return this.whatsAppAccounts.find((account) => account.id === accountId) ?? null;
  }

  async getWhatsAppChatMapping(mappingId: string): Promise<WhatsAppChatMappingRecord | null> {
    return this.whatsAppChatMappings.find((mapping) => mapping.id === mappingId) ?? null;
  }

  async ignoreWhatsAppChatMapping(mappingId: string): Promise<WhatsAppChatMappingRecord> {
    const mapping = this.requireWhatsAppChatMapping(mappingId);
    mapping.status = "IGNORED";
    mapping.updatedAt = new Date();
    return mapping;
  }

  async listWhatsAppAccounts(organizationId: string): Promise<WhatsAppAccountRecord[]> {
    return this.whatsAppAccounts.filter((account) => account.organizationId === organizationId);
  }

  async updateWhatsAppAccountStatus(
    accountId: string,
    status: WhatsAppAccountRecord["status"]
  ): Promise<WhatsAppAccountRecord> {
    const account = this.whatsAppAccounts.find((candidate) => candidate.id === accountId);

    if (!account) {
      throw new Error("WhatsApp account missing in test repository");
    }

    account.status = status;
    account.updatedAt = new Date();
    return account;
  }

  async rotateWhatsAppAccountSession(accountId: string): Promise<WhatsAppAccountRecord> {
    const account = this.whatsAppAccounts.find((candidate) => candidate.id === accountId);

    if (!account) {
      throw new Error("WhatsApp account missing in test repository");
    }

    account.sessionKey = `baileys/${account.organizationId}/${nextId("session")}`;
    account.status = "PENDING_QR";
    account.updatedAt = new Date();
    return account;
  }

  async listWhatsAppChatMappings(accountId: string): Promise<WhatsAppChatMappingRecord[]> {
    return this.whatsAppChatMappings.filter((mapping) => mapping.whatsappAccountId === accountId);
  }

  async updateWhatsAppChatMapping(input: {
    mappingId: string;
    projectId: string | null;
  }): Promise<WhatsAppChatMappingRecord> {
    const mapping = this.requireWhatsAppChatMapping(input.mappingId);

    const project = input.projectId
      ? this.projects.find((candidate) => candidate.id === input.projectId)
      : null;
    mapping.projectId = input.projectId;
    mapping.project = project
      ? {
          code: project.code,
          id: project.id,
          name: project.name
        }
      : null;
    if (mapping.conversation) {
      mapping.conversation.projectId = input.projectId;
    }
    mapping.updatedAt = new Date();

    const conversation = mapping.conversationId
      ? this.conversations.find((candidate) => candidate.id === mapping.conversationId)
      : null;
    if (conversation) {
      conversation.projectId = input.projectId;
      conversation.project = mapping.project;
    }

    return mapping;
  }

  private requireWhatsAppChatMapping(mappingId: string): WhatsAppChatMappingRecord {
    const mapping = this.whatsAppChatMappings.find((candidate) => candidate.id === mappingId);

    if (!mapping) {
      throw new Error("WhatsApp chat mapping missing in test repository");
    }

    return mapping;
  }

  async listConversations(input: {
    organizationId: string;
    search?: string;
  }): Promise<ConversationRecord[]> {
    const search = input.search?.toLowerCase() ?? "";

    return this.conversations.filter((conversation) => {
      const messages = this.messages.filter(
        (message) => message.conversationId === conversation.id
      );
      const whatsappMapping =
        conversation.channel === "WHATSAPP"
          ? this.whatsAppChatMappings.find((mapping) => mapping.conversationId === conversation.id)
          : null;

      return (
        conversation.organizationId === input.organizationId &&
        (conversation.channel !== "WHATSAPP" ||
          (whatsappMapping?.status === "ACTIVE" && Boolean(whatsappMapping.projectId))) &&
        (!search ||
          conversation.title.toLowerCase().includes(search) ||
          messages.some((message) => message.body?.toLowerCase().includes(search)))
      );
    });
  }

  async listMessages(conversationId: string): Promise<MessageRecord[]> {
    return this.messages.filter((message) => message.conversationId === conversationId);
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    const index = this.messages.findIndex((message) => message.id === messageId);

    if (index === -1) {
      return false;
    }

    this.messages.splice(index, 1);
    this.attachments = this.attachments.filter((attachment) => attachment.messageId !== messageId);
    return true;
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

class InMemoryQrStore implements WhatsAppQrStore {
  private readonly codes = new Map<string, string>();

  async get(accountId: string): Promise<string | null> {
    return this.codes.get(accountId) ?? null;
  }

  async remove(accountId: string): Promise<void> {
    this.codes.delete(accountId);
  }

  async set(accountId: string, qrCode: string): Promise<void> {
    this.codes.set(accountId, qrCode);
  }
}
