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
import type { EvidenceSummary, UnifiedEvidenceContext } from "@fieldos/db";
import type { ProjectIntelligenceContext } from "@fieldos/intelligence";
import type {
  SignedUrlInput,
  StorageObjectInput,
  StorageProvider,
  StoredObject
} from "@fieldos/shared";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AppRepository,
  AIMessageClassificationRecord,
  MembershipRecord,
  OrganizationRecord,
  ProjectRecord,
  Role,
  SafeUser,
  Status,
  StoredUser,
  ActionItemRecord,
  DashboardHealth,
  MilestoneRecord,
  OperationsDashboardRecord,
  PhotoAnalysisRecord,
  ProjectReportRecord,
  ProcessingJobRecord,
  SearchDocumentsResult,
  SearchSourceType,
  UserFeedbackRecord,
  UserNotificationRecord,
  WhatsAppAccountRecord,
  WhatsAppChatMappingRecord,
  WorkerHeartbeatRecord
} from "./repository.js";

vi.stubEnv("CORS_ORIGIN", "http://localhost:3000");
vi.stubEnv("DATABASE_URL", "postgresql://fieldos:fieldos@localhost:5432/fieldos?schema=public");
vi.stubEnv("JWT_SECRET", "test-secret-that-is-long-enough");
vi.stubEnv("MEDIA_SIGNING_SECRET", "test-media-signing-secret");
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
    server = buildServer({
      qrStore: new InMemoryQrStore(),
      repository,
      searchAnswerer: {
        answer: async (input) => ({
          answer: `Grounded answer for ${input.question}`,
          confidence: "HIGH",
          sourceIds: input.sources.map((source) => source.sourceId)
        })
      }
    });
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

  it("blocks unauthenticated organization access", async () => {
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

  it("blocks project creation as VIEWER", async () => {
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

  it("blocks conversation access for non-members", async () => {
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

  it("hides WhatsApp chats after the account is disconnected", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    const account = await repository.createWhatsAppAccount({
      displayName: "Dispatch line",
      organizationId: organization.id
    });
    await repository.updateWhatsAppAccountStatus(account.id, "CONNECTED");
    repository.addWhatsAppChatMapping({
      accountId: account.id,
      conversationId: null,
      jid: "site-team@g.us",
      organizationId: organization.id,
      status: "DISCOVERED"
    });

    const connectedChats = await server.inject({
      headers: {
        cookie
      },
      method: "GET",
      url: `/whatsapp/accounts/${account.id}/chats`
    });

    expect(connectedChats.statusCode).toBe(200);
    expect(connectedChats.json().chats).toHaveLength(1);

    const disconnectResponse = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      url: `/whatsapp/accounts/${account.id}/disconnect`
    });

    expect(disconnectResponse.statusCode).toBe(200);

    const disconnectedChats = await server.inject({
      headers: {
        cookie
      },
      method: "GET",
      url: `/whatsapp/accounts/${account.id}/chats`
    });

    expect(disconnectedChats.statusCode).toBe(200);
    expect(disconnectedChats.json().chats).toHaveLength(0);
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

  it("manually queues and returns a message classification", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    const project = await repository.createProject({
      code: "AI-001",
      name: "AI project",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const message = await createProjectMessage(repository, organization.id, project.id);
    expect(
      repository.processingJobs.some(
        (job) => job.sourceId === message.id && job.type === "SEARCH_INDEX"
      )
    ).toBe(true);

    const classifyResponse = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      url: `/messages/${message.id}/classify`
    });

    expect(classifyResponse.statusCode).toBe(200);
    expect(classifyResponse.json().classification.status).toBe("PENDING");
    expect(
      repository.messages.find((candidate) => candidate.id === message.id)?.processingStatus
    ).toBe("AI_PENDING");
    expect(
      repository.processingJobs.some(
        (job) =>
          job.sourceId === classifyResponse.json().classification.id &&
          job.type === "AI_CLASSIFICATION"
      )
    ).toBe(true);

    const getResponse = await server.inject({
      headers: {
        cookie
      },
      method: "GET",
      url: `/messages/${message.id}/classification`
    });

    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().classification.messageId).toBe(message.id);
  });

  it("returns unified evidence context and summary for a message", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    const project = await repository.createProject({
      code: "EV-001",
      name: "Evidence project",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const message = await createProjectMessage(repository, organization.id, project.id);
    const conversation = repository.conversations.find(
      (candidate) => candidate.id === message.conversationId
    );

    if (!conversation) {
      throw new Error("conversation missing");
    }

    await repository.createAttachment({
      conversationId: conversation.id,
      filename: "handover.pdf",
      messageId: message.id,
      mimeType: "application/pdf",
      size: 2048,
      storageKey: "attachments/handover.pdf"
    });
    await repository.createAttachment({
      conversationId: conversation.id,
      filename: "voice.ogg",
      messageId: message.id,
      mimeType: "audio/ogg",
      size: 1024,
      storageKey: "attachments/voice.ogg"
    });
    const voiceAttachment = repository.attachments.find(
      (attachment) => attachment.filename === "voice.ogg"
    );

    if (voiceAttachment) {
      voiceAttachment.transcript = "The handover PDF was reviewed on site.";
      voiceAttachment.transcriptionStatus = "COMPLETED";
    }

    const contextResponse = await server.inject({
      headers: {
        cookie
      },
      method: "GET",
      url: `/messages/${message.id}/context`
    });
    const summaryResponse = await server.inject({
      headers: {
        cookie
      },
      method: "GET",
      url: `/messages/${message.id}/evidence-summary`
    });

    expect(contextResponse.statusCode).toBe(200);
    expect(contextResponse.json().context.voiceTranscript).toBe(
      "The handover PDF was reviewed on site."
    );
    expect(contextResponse.json().context.attachedDocuments).toHaveLength(1);
    expect(summaryResponse.statusCode).toBe(200);
    expect(summaryResponse.json().evidenceSummary.labels).toEqual(["1 Voice Note", "1 PDF"]);
  });

  it("returns photo analysis by project, analysis id, and evidence id", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    const project = await repository.createProject({
      code: "PHOTO-001",
      name: "Photo project",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const message = await createProjectMessage(repository, organization.id, project.id);
    const conversation = repository.conversations.find(
      (candidate) => candidate.id === message.conversationId
    );

    if (!conversation) {
      throw new Error("conversation missing");
    }

    const attachment = await repository.createAttachment({
      conversationId: conversation.id,
      filename: "site-photo.jpg",
      messageId: message.id,
      mimeType: "image/jpeg",
      size: 4096,
      storageKey: "whatsapp-media/site-photo.jpg"
    });
    const analysis = repository.addPhotoAnalysis({
      attachment,
      confidence: 0.84,
      conversation,
      detectedObjects: ["Runway light", "Electrical cabinet"],
      message,
      organizationId: organization.id,
      possibleIssues: ["Possible loose cable near the cabinet."],
      project,
      summary: "Runway lighting work appears mostly complete.",
      tags: ["runway", "lighting", "needs review"]
    });

    const projectResponse = await server.inject({
      headers: {
        cookie
      },
      method: "GET",
      url: `/projects/${project.id}/photo-analysis`
    });
    const analysisResponse = await server.inject({
      headers: {
        cookie
      },
      method: "GET",
      url: `/photo-analysis/${analysis.id}`
    });
    const evidenceResponse = await server.inject({
      headers: {
        cookie
      },
      method: "GET",
      url: `/evidence/${attachment.id}/photo-analysis`
    });

    expect(projectResponse.statusCode).toBe(200);
    expect(projectResponse.json().analyses).toHaveLength(1);
    expect(analysisResponse.statusCode).toBe(200);
    expect(analysisResponse.json().analysis.summary).toContain("Runway lighting");
    expect(evidenceResponse.statusCode).toBe(200);
    expect(evidenceResponse.json().analysis.evidence.filename).toBe("site-photo.jpg");
  });

  it("prevents cross-organization photo analysis access", async () => {
    const ownerCookie = await signup(server, "owner@example.com");
    const organization = await createOrganization(server, ownerCookie);
    const project = await repository.createProject({
      code: "PHOTO-002",
      name: "Private photo project",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const message = await createProjectMessage(repository, organization.id, project.id);
    const conversation = repository.conversations.find(
      (candidate) => candidate.id === message.conversationId
    );

    if (!conversation) {
      throw new Error("conversation missing");
    }

    const attachment = await repository.createAttachment({
      conversationId: conversation.id,
      filename: "private-photo.jpg",
      messageId: message.id,
      mimeType: "image/jpeg",
      size: 1024,
      storageKey: "whatsapp-media/private-photo.jpg"
    });
    const analysis = repository.addPhotoAnalysis({
      attachment,
      conversation,
      message,
      organizationId: organization.id,
      project,
      summary: "Private site photo summary."
    });
    const outsiderCookie = await signup(server, "outsider@example.com");

    const analysisResponse = await server.inject({
      headers: {
        cookie: outsiderCookie
      },
      method: "GET",
      url: `/photo-analysis/${analysis.id}`
    });
    const projectResponse = await server.inject({
      headers: {
        cookie: outsiderCookie
      },
      method: "GET",
      url: `/projects/${project.id}/photo-analysis`
    });

    expect(analysisResponse.statusCode).toBe(404);
    expect(projectResponse.statusCode).toBe(404);
  });

  it("returns project intelligence, exports reports, and queues cached report generation", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    const project = await repository.createProject({
      code: "INT-001",
      name: "Intelligence project",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const message = await createProjectMessage(repository, organization.id, project.id);
    const conversation = repository.conversations.find(
      (candidate) => candidate.id === message.conversationId
    );

    if (!conversation) {
      throw new Error("conversation missing");
    }

    const attachment = await repository.createAttachment({
      conversationId: conversation.id,
      filename: "weekly-photo.jpg",
      messageId: message.id,
      mimeType: "image/jpeg",
      size: 2048,
      storageKey: "whatsapp-media/weekly-photo.jpg"
    });
    repository.addCompletedClassification({
      category: "DEFECT",
      messageId: message.id,
      organizationId: organization.id,
      projectId: project.id
    });
    repository.addActionItem({
      messageId: message.id,
      organizationId: organization.id,
      priority: "HIGH",
      projectId: project.id
    });
    repository.addPhotoAnalysis({
      attachment,
      conversation,
      message,
      organizationId: organization.id,
      project,
      summary: "Photo shows cable tray works needing review."
    });
    repository.addEvent({
      organizationId: organization.id,
      projectId: project.id,
      sourceType: "MESSAGE",
      title: "Site Update"
    });
    repository.addMilestone({
      dueDate: new Date("2026-07-12T00:00:00.000Z"),
      organizationId: organization.id,
      projectId: project.id,
      title: "Client inspection"
    });

    const intelligenceResponse = await server.inject({
      headers: {
        cookie
      },
      method: "GET",
      url: `/projects/${project.id}/intelligence`
    });
    const markdownResponse = await server.inject({
      headers: {
        cookie
      },
      method: "GET",
      url: `/projects/${project.id}/weekly-report?format=markdown`
    });
    const pdfResponse = await server.inject({
      headers: {
        cookie
      },
      method: "GET",
      url: `/projects/${project.id}/weekly-report?format=pdf`
    });
    const generateResponse = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      payload: {
        type: "WEEKLY_PROGRESS"
      },
      url: `/projects/${project.id}/reports/generate`
    });

    expect(intelligenceResponse.statusCode).toBe(200);
    expect(intelligenceResponse.json().intelligence.morningBrief.bullets.length).toBeGreaterThan(0);
    expect(markdownResponse.statusCode).toBe(200);
    expect(markdownResponse.body).toContain("Executive Summary");
    expect(pdfResponse.statusCode).toBe(200);
    expect(pdfResponse.body.slice(0, 5)).toBe("%PDF-");
    expect(generateResponse.statusCode).toBe(200);
    expect(generateResponse.json().report.status).toBe("PENDING");
    expect(
      repository.processingJobs.some(
        (job) =>
          job.type === "REPORT_GENERATION" && job.sourceId === generateResponse.json().report.id
      )
    ).toBe(true);
  });

  it("returns signed evidence views and blocks cross-organization evidence access", async () => {
    const ownerCookie = await signup(server, "owner-evidence@example.com");
    const organization = await createOrganization(server, ownerCookie);
    const project = await repository.createProject({
      code: "EVIEW",
      name: "Evidence view project",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const message = await createProjectMessage(repository, organization.id, project.id);
    const conversation = repository.conversations.find(
      (candidate) => candidate.id === message.conversationId
    );

    if (!conversation) {
      throw new Error("conversation missing");
    }

    const attachment = await repository.createAttachment({
      conversationId: conversation.id,
      filename: "evidence.jpg",
      messageId: message.id,
      mimeType: "image/jpeg",
      size: 1024,
      storageKey: "whatsapp-media/evidence.jpg"
    });
    repository.addActionItem({
      messageId: message.id,
      organizationId: organization.id,
      projectId: project.id
    });
    repository.addPhotoAnalysis({
      attachment,
      conversation,
      message,
      organizationId: organization.id,
      project,
      summary: "Evidence photo summary."
    });
    const outsiderCookie = await signup(server, "outsider-evidence@example.com");

    const ownerResponse = await server.inject({
      headers: {
        cookie: ownerCookie
      },
      method: "GET",
      url: `/evidence/${attachment.id}/view`
    });
    const outsiderResponse = await server.inject({
      headers: {
        cookie: outsiderCookie
      },
      method: "GET",
      url: `/evidence/${attachment.id}/view`
    });

    expect(ownerResponse.statusCode).toBe(200);
    expect(ownerResponse.json().evidence.signedUrl).toContain("/media/");
    expect(ownerResponse.json().evidence.storageKey).toBeUndefined();
    expect(ownerResponse.json().evidence.actionItems).toHaveLength(1);
    expect(outsiderResponse.statusCode).toBe(404);
  });

  it("uses authorized provider-signed evidence URLs without returning raw storage keys", async () => {
    const storageProvider = new InMemoryStorageProvider();
    const r2Server = buildServer({
      qrStore: new InMemoryQrStore(),
      repository,
      storageProvider
    });
    const ownerCookie = await signup(r2Server, "owner-r2-evidence@example.com");
    const organization = await createOrganization(r2Server, ownerCookie);
    const project = await repository.createProject({
      code: "R2EV",
      name: "R2 evidence project",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const message = await createProjectMessage(repository, organization.id, project.id);
    const conversation = repository.conversations.find(
      (candidate) => candidate.id === message.conversationId
    );

    if (!conversation) {
      throw new Error("conversation missing");
    }

    const attachment = await repository.createAttachment({
      conversationId: conversation.id,
      filename: "evidence.jpg",
      messageId: message.id,
      mimeType: "image/jpeg",
      size: 1024,
      storageKey: "organizations/org/projects/project/evidence/evidence/evidence.jpg"
    });
    const outsiderCookie = await signup(r2Server, "outsider-r2-evidence@example.com");

    const outsiderResponse = await r2Server.inject({
      headers: {
        cookie: outsiderCookie
      },
      method: "GET",
      url: `/evidence/${attachment.id}/view`
    });
    expect(outsiderResponse.statusCode).toBe(404);
    expect(storageProvider.signedUrlRequests).toHaveLength(0);

    const ownerResponse = await r2Server.inject({
      headers: {
        cookie: ownerCookie
      },
      method: "GET",
      url: `/evidence/${attachment.id}/view`
    });

    expect(ownerResponse.statusCode).toBe(200);
    expect(ownerResponse.json().evidence.signedUrl).toBe(
      "https://r2.example.test/organizations/org/projects/project/evidence/evidence/evidence.jpg?expires=900"
    );
    expect(ownerResponse.json().evidence.storageKey).toBeUndefined();
    expect(JSON.stringify(ownerResponse.json())).not.toContain("C:\\");
    expect(storageProvider.signedUrlRequests).toHaveLength(1);
  });

  it("returns provider-signed report PDF URLs", async () => {
    const storageProvider = new InMemoryStorageProvider();
    const r2Server = buildServer({
      qrStore: new InMemoryQrStore(),
      repository,
      storageProvider
    });
    const cookie = await signup(r2Server, "owner-r2-report@example.com");
    const organization = await createOrganization(r2Server, cookie);
    const project = await repository.createProject({
      code: "R2REP",
      name: "R2 report project",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const now = new Date();
    repository.projectReports.push({
      content: null,
      contentHash: "hash",
      createdAt: now,
      errorMessage: null,
      generatedAt: now,
      id: "report_r2",
      markdown: "# Report",
      organizationId: organization.id,
      pdfStorageKey: "organizations/org/projects/project/reports/report_r2.pdf",
      periodEnd: now,
      periodStart: now,
      projectId: project.id,
      status: "COMPLETED",
      title: "R2 Weekly Report",
      type: "WEEKLY_PROGRESS",
      updatedAt: now
    });

    const response = await r2Server.inject({
      headers: {
        cookie
      },
      method: "GET",
      url: `/projects/${project.id}/weekly-report`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().latestReport.pdfUrl).toBe(
      "https://r2.example.test/organizations/org/projects/project/reports/report_r2.pdf?expires=900"
    );
    expect(JSON.stringify(response.json())).not.toContain("C:\\");
  });

  it("lists project AI classifications and Action Items", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    const project = await repository.createProject({
      code: "AI-002",
      name: "AI project",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const message = await createProjectMessage(repository, organization.id, project.id);
    const classification = repository.addCompletedClassification({
      messageId: message.id,
      organizationId: organization.id,
      projectId: project.id
    });
    repository.addActionItem({
      classificationId: classification.id,
      messageId: message.id,
      organizationId: organization.id,
      projectId: project.id
    });

    const classificationsResponse = await server.inject({
      headers: {
        cookie
      },
      method: "GET",
      url: `/projects/${project.id}/ai-classifications`
    });
    const actionItemsResponse = await server.inject({
      headers: {
        cookie
      },
      method: "GET",
      url: `/projects/${project.id}/action-items`
    });

    expect(classificationsResponse.statusCode).toBe(200);
    expect(classificationsResponse.json().classifications).toHaveLength(1);
    expect(actionItemsResponse.statusCode).toBe(200);
    expect(actionItemsResponse.json().actionItems).toHaveLength(1);
  });

  it("accepts and ignores Action Items", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    const project = await repository.createProject({
      code: "AI-003",
      name: "AI project",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const message = await createProjectMessage(repository, organization.id, project.id);
    const classification = repository.addCompletedClassification({
      messageId: message.id,
      organizationId: organization.id,
      projectId: project.id
    });
    const task = repository.addActionItem({
      classificationId: classification.id,
      messageId: message.id,
      organizationId: organization.id,
      projectId: project.id
    });

    const acceptResponse = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      url: `/action-items/${task.id}/accept`
    });
    const ignoreResponse = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      url: `/action-items/${task.id}/ignore`
    });

    expect(acceptResponse.statusCode).toBe(200);
    expect(acceptResponse.json().actionItem.status).toBe("ACCEPTED");
    expect(ignoreResponse.statusCode).toBe(200);
    expect(ignoreResponse.json().actionItem.status).toBe("IGNORED");
  });

  it("completes Action Items", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    const user = repository.users.find((candidate) => candidate.email === "founder@example.com");
    const project = await repository.createProject({
      code: "AI-006",
      name: "Completion project",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const message = await createProjectMessage(repository, organization.id, project.id);
    const classification = repository.addCompletedClassification({
      messageId: message.id,
      organizationId: organization.id,
      projectId: project.id
    });
    const actionItem = repository.addActionItem({
      assignedToUserId: user?.id,
      classificationId: classification.id,
      messageId: message.id,
      organizationId: organization.id,
      projectId: project.id
    });

    const response = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      url: `/action-items/${actionItem.id}/complete`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().actionItem.status).toBe("COMPLETED");
  });

  it("returns dashboard summary, project ranking, grouped action items, activity, and fallback brief", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    const user = repository.users.find((candidate) => candidate.email === "founder@example.com");

    if (!user) {
      throw new Error("founder user was not created");
    }

    const healthyProject = await repository.createProject({
      code: "OPS-001",
      name: "Healthy project",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const criticalProject = await repository.createProject({
      code: "OPS-002",
      name: "Critical project",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const message = await createProjectMessage(repository, organization.id, criticalProject.id);
    const classification = repository.addCompletedClassification({
      category: "SAFETY_ISSUE",
      messageId: message.id,
      organizationId: organization.id,
      projectId: criticalProject.id
    });
    repository.addActionItem({
      assignedToUserId: user.id,
      classificationId: classification.id,
      messageId: message.id,
      organizationId: organization.id,
      priority: "URGENT",
      projectId: criticalProject.id
    });
    repository.addActionItem({
      assignedToUserId: user.id,
      classificationId: classification.id,
      messageId: message.id,
      organizationId: organization.id,
      priority: "HIGH",
      projectId: criticalProject.id,
      status: "ACCEPTED"
    });
    repository.addEvent({
      organizationId: organization.id,
      projectId: criticalProject.id,
      sourceType: "MESSAGE",
      title: "Safety issue reported"
    });
    repository.addEvent({
      organizationId: organization.id,
      projectId: healthyProject.id,
      sourceType: "SYSTEM",
      title: "Technical sync completed"
    });
    repository.addMilestone({
      dueDate: new Date("2026-07-10T00:00:00.000Z"),
      organizationId: organization.id,
      projectId: criticalProject.id,
      status: "UPCOMING",
      title: "Inspection"
    });

    const response = await server.inject({
      headers: {
        cookie
      },
      method: "GET",
      url: `/dashboard?organizationId=${organization.id}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().dashboard.summary.activeProjects).toBe(2);
    expect(response.json().dashboard.summary.criticalProjects).toBe(1);
    expect(response.json().dashboard.summary.openActionItems).toBe(1);
    expect(response.json().dashboard.summary.highPriorityActionItems).toBe(1);
    expect(response.json().dashboard.projects[0].name).toBe("Critical project");
    expect(response.json().dashboard.projects[0].openActionItemCount).toBe(1);
    expect(response.json().dashboard.actionItems.urgent).toHaveLength(1);
    expect(response.json().dashboard.actionItems.high).toHaveLength(0);
    expect(response.json().dashboard.recentActivity).toHaveLength(1);
    expect(response.json().dashboard.brief.generatedBy).toBe("FALLBACK");
    expect(response.json().dashboard.milestones).toHaveLength(1);
  });

  it("blocks cross-organization dashboard access", async () => {
    const ownerCookie = await signup(server, "owner-dashboard@example.com");
    const organization = await createOrganization(server, ownerCookie);
    const outsiderCookie = await signup(server, "dashboard-outsider@example.com");

    const response = await server.inject({
      headers: {
        cookie: outsiderCookie
      },
      method: "GET",
      url: `/dashboard/summary?organizationId=${organization.id}`
    });

    expect(response.statusCode).toBe(404);
  });

  it("returns operations health metrics for organization admins", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    repository.addWorkerHeartbeat();
    repository.addProcessingJob({
      organizationId: organization.id,
      status: "PENDING",
      type: "SEARCH_INDEX"
    });
    repository.addProcessingJob({
      organizationId: organization.id,
      status: "FAILED",
      type: "AI_CLASSIFICATION"
    });
    const account = await repository.createWhatsAppAccount({
      displayName: "Dispatch line",
      organizationId: organization.id
    });
    await repository.updateWhatsAppAccountStatus(account.id, "CONNECTED");

    const response = await server.inject({
      headers: {
        cookie
      },
      method: "GET",
      url: `/admin/operations?organizationId=${organization.id}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().operations.workers).toHaveLength(1);
    expect(response.json().operations.search.pendingIndexJobs).toBe(1);
    expect(response.json().operations.ai.failuresToday).toBe(1);
    expect(response.json().operations.whatsApp.connectedAccounts).toBe(1);

    const workersResponse = await server.inject({
      headers: {
        cookie
      },
      method: "GET",
      url: `/admin/workers?organizationId=${organization.id}`
    });

    expect(workersResponse.statusCode).toBe(200);
    expect(workersResponse.json().workers[0].workerName).toBe("fieldos-worker");
  });

  it("blocks non-admin operations access", async () => {
    const ownerCookie = await signup(server, "operations-owner@example.com");
    const organization = await createOrganization(server, ownerCookie);
    const memberCookie = await signup(server, "operations-member@example.com");
    repository.addMembership(repository.users[1]?.id ?? "", organization.id, "MEMBER");

    const response = await server.inject({
      headers: {
        cookie: memberCookie
      },
      method: "GET",
      url: `/admin/operations?organizationId=${organization.id}`
    });

    expect(response.statusCode).toBe(403);
  });

  it("retries individual and bulk failed jobs", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    const individualJob = repository.addProcessingJob({
      organizationId: organization.id,
      status: "FAILED",
      type: "SEARCH_INDEX"
    });
    repository.addProcessingJob({
      organizationId: organization.id,
      status: "FAILED",
      type: "AI_CLASSIFICATION"
    });

    const individualRetry = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      url: `/admin/jobs/${individualJob.id}/retry`
    });

    expect(individualRetry.statusCode).toBe(200);
    expect(individualRetry.json().job.status).toBe("PENDING");

    const bulkRetry = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      url: `/admin/jobs/retry-failed?organizationId=${organization.id}`
    });

    expect(bulkRetry.statusCode).toBe(200);
    expect(bulkRetry.json().retried).toBe(1);
    expect(repository.processingJobs.every((job) => job.status === "PENDING")).toBe(true);
  });

  it("searches messages, timeline events, Action Items, projects, and AI classifications", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    const project = await repository.createProject({
      code: "T2-RUNWAY",
      name: "Terminal 2 runway lighting",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const message = await createProjectMessage(
      repository,
      organization.id,
      project.id,
      "Terminal 2 runway lighting has a defect near gate B."
    );
    const classification = repository.addCompletedClassification({
      messageId: message.id,
      organizationId: organization.id,
      projectId: project.id
    });
    repository.addActionItem({
      classificationId: classification.id,
      messageId: message.id,
      organizationId: organization.id,
      projectId: project.id
    });
    repository.addEvent({
      organizationId: organization.id,
      projectId: project.id,
      sourceType: "MESSAGE",
      title: "Terminal 2 defect inspection completed"
    });

    const searches = [
      { query: "Terminal 2", sourceType: "PROJECT" },
      { query: "gate B", sourceType: "MESSAGE" },
      { query: "inspection completed", sourceType: "TIMELINE_EVENT" },
      { query: "reported defect", sourceType: "ACTION_ITEM" },
      { query: "defect", sourceType: "AI_CLASSIFICATION" }
    ];

    for (const search of searches) {
      const response = await server.inject({
        headers: {
          cookie
        },
        method: "GET",
        url: `/search?organizationId=${organization.id}&type=${
          search.sourceType
        }&q=${encodeURIComponent(search.query)}`
      });

      expect(response.statusCode).toBe(200);
      expect(
        response
          .json()
          .results.some((result: { sourceType: string }) => result.sourceType === search.sourceType)
      ).toBe(true);
    }
  });

  it("supports project-scoped search", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    const runwayProject = await repository.createProject({
      code: "RUNWAY",
      name: "Runway lighting",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const lobbyProject = await repository.createProject({
      code: "LOBBY",
      name: "Lobby works",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    await createProjectMessage(
      repository,
      organization.id,
      runwayProject.id,
      "Runway lighting cable tray needs review."
    );
    await createProjectMessage(
      repository,
      organization.id,
      lobbyProject.id,
      "Lobby lighting cable tray needs review."
    );

    const response = await server.inject({
      headers: {
        cookie
      },
      method: "GET",
      url: `/search?organizationId=${organization.id}&projectId=${
        runwayProject.id
      }&q=${encodeURIComponent("lighting cable tray")}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().results.length).toBeGreaterThan(0);
    expect(
      response
        .json()
        .results.every(
          (result: { projectId: string | null }) => result.projectId === runwayProject.id
        )
    ).toBe(true);
  });

  it("prevents cross-organization search", async () => {
    const ownerCookie = await signup(server, "search-owner@example.com");
    const organization = await createOrganization(server, ownerCookie);
    const outsiderCookie = await signup(server, "search-outsider@example.com");

    const response = await server.inject({
      headers: {
        cookie: outsiderCookie
      },
      method: "GET",
      url: `/search?organizationId=${organization.id}&q=runway`
    });

    expect(response.statusCode).toBe(404);
  });

  it("answers search questions with cited sources", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    const project = await repository.createProject({
      code: "ASK-001",
      name: "Search answer project",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    await createProjectMessage(
      repository,
      organization.id,
      project.id,
      "Gate 4 inspection found damaged lighting conduit."
    );

    const response = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      payload: {
        organizationId: organization.id,
        question: "Gate 4 inspection"
      },
      url: "/search/ask"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().answer).toBe("Grounded answer for Gate 4 inspection");
    expect(response.json().sources).toHaveLength(1);
    expect(response.json().sources[0].sourceType).toBe("MESSAGE");
  });

  it("returns a fallback answer when no search records are found", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);

    const response = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      payload: {
        organizationId: organization.id,
        question: "What happened at the solar farm?"
      },
      url: "/search/ask"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().answer).toBe(
      "I could not find enough information in FieldOS to answer that."
    );
    expect(response.json().sources).toHaveLength(0);
  });

  it("rejects empty search questions", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);

    const response = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      payload: {
        organizationId: organization.id,
        question: " "
      },
      url: "/search/ask"
    });

    expect(response.statusCode).toBe(400);
  });

  it("answers project-scoped search questions", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    const project = await repository.createProject({
      code: "ASK-002",
      name: "Project ask",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    await createProjectMessage(
      repository,
      organization.id,
      project.id,
      "Basement pump test passed with no defects."
    );

    const response = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      payload: {
        question: "Basement pump"
      },
      url: `/projects/${project.id}/search/ask`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().answer).toBe("Grounded answer for Basement pump");
    expect(
      response
        .json()
        .sources.every(
          (source: { projectName: string | null }) => source.projectName === project.name
        )
    ).toBe(true);
  });

  it("reassigns project suggestion Action Items only after acceptance", async () => {
    const cookie = await signup(server);
    const organization = await createOrganization(server, cookie);
    const currentProject = await repository.createProject({
      code: "AI-005",
      name: "Current project",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const suggestedProject = await repository.createProject({
      code: "T2",
      name: "Terminal 2",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const message = await createProjectMessage(repository, organization.id, currentProject.id);
    const classification = repository.addCompletedClassification({
      messageId: message.id,
      organizationId: organization.id,
      projectId: currentProject.id
    });
    const actionItem = repository.addActionItem({
      classificationId: classification.id,
      messageId: message.id,
      organizationId: organization.id,
      projectId: currentProject.id,
      suggestedProjectId: suggestedProject.id,
      type: "PROJECT_SUGGESTION"
    });

    expect(
      repository.conversations.find((conversation) => conversation.id === message.conversationId)
        ?.projectId
    ).toBe(currentProject.id);

    const response = await server.inject({
      headers: {
        cookie
      },
      method: "POST",
      url: `/action-items/${actionItem.id}/accept`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().actionItem.status).toBe("ACCEPTED");
    expect(
      repository.conversations.find((conversation) => conversation.id === message.conversationId)
        ?.projectId
    ).toBe(suggestedProject.id);
  });

  it("blocks cross-organization access to Action Items", async () => {
    const ownerCookie = await signup(server, "owner@example.com");
    const organization = await createOrganization(server, ownerCookie);
    const project = await repository.createProject({
      code: "AI-004",
      name: "AI project",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const message = await createProjectMessage(repository, organization.id, project.id);
    const classification = repository.addCompletedClassification({
      messageId: message.id,
      organizationId: organization.id,
      projectId: project.id
    });
    const task = repository.addActionItem({
      classificationId: classification.id,
      messageId: message.id,
      organizationId: organization.id,
      projectId: project.id
    });
    const outsiderCookie = await signup(server, "outsider@example.com");

    const response = await server.inject({
      headers: {
        cookie: outsiderCookie
      },
      method: "POST",
      url: `/action-items/${task.id}/accept`
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

async function createProjectMessage(
  repository: InMemoryRepository,
  organizationId: string,
  projectId: string,
  body = "Lobby light failed, please rectify."
): Promise<MessageRecord> {
  const conversation = await repository.createConversation({
    channel: "WHATSAPP",
    externalId: nextId("external"),
    isGroup: false,
    lastMessageAt: null,
    organizationId,
    projectId,
    title: "Site team"
  });
  const participant = await repository.addParticipant({
    conversationId: conversation.id,
    displayName: "Supervisor",
    externalIdentifier: nextId("participant"),
    role: "contact"
  });

  return repository.createMessage({
    body,
    conversationId: conversation.id,
    direction: "INBOUND",
    occurredAt: new Date("2026-07-03T00:00:00.000Z"),
    senderParticipantId: participant.id,
    type: "TEXT"
  });
}

class InMemoryRepository implements AppRepository {
  attachments: AttachmentRecord[] = [];
  conversations: ConversationRecord[] = [];
  events: Array<{
    id: string;
    organizationId: string;
    projectId: string | null;
    sourceType: "MESSAGE" | "ACTION_ITEM" | "REPORT" | "SYSTEM";
    sourceId: string;
    eventType: string;
    title: string;
    description: string | null;
    occurredAt: Date;
    createdAt: Date;
  }> = [];
  memberships: MembershipRecord[] = [];
  messages: MessageRecord[] = [];
  milestones: MilestoneRecord[] = [];
  organizations: Omit<OrganizationRecord, "role">[] = [];
  participants: ParticipantRecord[] = [];
  photoAnalyses: PhotoAnalysisRecord[] = [];
  projectReports: ProjectReportRecord[] = [];
  projects: ProjectRecord[] = [];
  analyticsEvents: Array<{
    id: string;
    eventName: string;
    metadata: unknown;
    organizationId: string | null;
    userId: string | null;
    createdAt: Date;
  }> = [];
  feedback: UserFeedbackRecord[] = [];
  notifications: UserNotificationRecord[] = [];
  classifications: AIMessageClassificationRecord[] = [];
  actionItems: ActionItemRecord[] = [];
  processingJobs: ProcessingJobRecord[] = [];
  workerHeartbeats: WorkerHeartbeatRecord[] = [];
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
      isDemo: false,
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
    this.addProcessingJob({
      organizationId: project.organizationId,
      projectId: project.id,
      sourceId: project.id,
      sourceType: "PROJECT",
      type: "SEARCH_INDEX"
    });
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
      processingStatus: "SEARCH_PENDING" as const,
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
      this.addProcessingJob({
        organizationId: conversation.organizationId,
        projectId: conversation.projectId,
        sourceId: message.id,
        sourceType: "MESSAGE",
        type: "SEARCH_INDEX"
      });
    }

    return message;
  }

  async createAttachment(
    input: CreateAttachmentInput & { conversationId: string }
  ): Promise<AttachmentRecord> {
    const attachment = {
      ...input,
      createdAt: new Date(),
      id: nextId("attachment"),
      transcript: null,
      transcriptionError: null,
      transcriptionStatus: input.mimeType.startsWith("audio/")
        ? ("PENDING" as const)
        : ("NOT_REQUIRED" as const)
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
    projectId: string | null;
  }): Promise<WhatsAppChatMappingRecord> {
    const mapping = this.requireWhatsAppChatMapping(input.mappingId);
    const project = input.projectId
      ? this.projects.find((candidate) => candidate.id === input.projectId)
      : null;

    if (input.projectId && !project) {
      throw new Error("project missing in test repository");
    }

    mapping.activatedAt = new Date();
    mapping.activatedByUserId = input.activatedByUserId;
    mapping.projectId = input.projectId;
    mapping.project = project
      ? {
          code: project.code,
          id: project.id,
          name: project.name
        }
      : null;
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

  async acceptActionItem(input: {
    actionItemId: string;
    userId: string;
  }): Promise<ActionItemRecord> {
    const task = this.requireActionItem(input.actionItemId);
    if (task.type === "PROJECT_SUGGESTION" && task.suggestedProjectId) {
      const message = this.messages.find((candidate) => candidate.id === task.messageId);
      const conversation = message
        ? this.conversations.find((candidate) => candidate.id === message.conversationId)
        : null;

      if (conversation) {
        conversation.projectId = task.suggestedProjectId;
      }

      task.projectId = task.suggestedProjectId;
    }

    task.acceptedAt = new Date();
    task.acceptedByUserId = input.userId;
    task.completedAt = null;
    task.ignoredAt = null;
    task.ignoredByUserId = null;
    task.status = "ACCEPTED";
    task.updatedAt = new Date();
    return task;
  }

  async enqueueMessageClassification(
    messageId: string
  ): Promise<AIMessageClassificationRecord | null> {
    const message = this.messages.find((candidate) => candidate.id === messageId);
    const conversation = message
      ? this.conversations.find((candidate) => candidate.id === message.conversationId)
      : null;

    if (!message || !conversation) {
      return null;
    }

    const existing = this.classifications.find(
      (classification) => classification.messageId === messageId
    );

    if (existing) {
      existing.errorMessage = null;
      existing.projectId = conversation.projectId;
      existing.status = "PENDING";
      existing.updatedAt = new Date();
      message.processingStatus = "AI_PENDING";
      this.addProcessingJob({
        organizationId: existing.organizationId,
        projectId: existing.projectId,
        sourceId: existing.id,
        sourceType: "AI_MESSAGE_CLASSIFICATION",
        type: "AI_CLASSIFICATION"
      });
      return existing;
    }

    const classification: AIMessageClassificationRecord = {
      category: null,
      confidence: null,
      createdAt: new Date(),
      errorMessage: null,
      id: nextId("classification"),
      location: null,
      messageId,
      organizationId: conversation.organizationId,
      projectId: conversation.projectId,
      reasoningSummary: null,
      actionRequired: false,
      status: "PENDING",
      summary: null,
      updatedAt: new Date()
    };
    this.classifications.push(classification);
    message.processingStatus = "AI_PENDING";
    this.addProcessingJob({
      organizationId: classification.organizationId,
      projectId: classification.projectId,
      sourceId: classification.id,
      sourceType: "AI_MESSAGE_CLASSIFICATION",
      type: "AI_CLASSIFICATION"
    });
    return classification;
  }

  async getMessageClassification(messageId: string): Promise<AIMessageClassificationRecord | null> {
    return (
      this.classifications.find((classification) => classification.messageId === messageId) ?? null
    );
  }

  async getMessageEvidenceContext(messageId: string): Promise<UnifiedEvidenceContext | null> {
    const message = this.messages.find((candidate) => candidate.id === messageId);
    const conversation = message
      ? this.conversations.find((candidate) => candidate.id === message.conversationId)
      : null;

    if (!message || !conversation) {
      return null;
    }

    const participant = message.senderParticipant;
    const project = conversation.projectId
      ? this.projects.find((candidate) => candidate.id === conversation.projectId)
      : null;
    const attachedPhotos = message.attachments.filter((attachment) =>
      attachment.mimeType.startsWith("image/")
    );
    const attachedDocuments = message.attachments.filter(
      (attachment) =>
        attachment.mimeType === "application/pdf" || attachment.mimeType.startsWith("application/")
    );
    const attachedVoiceNotes = message.attachments.filter((attachment) =>
      attachment.mimeType.startsWith("audio/")
    );
    const attachedVideos = message.attachments.filter((attachment) =>
      attachment.mimeType.startsWith("video/")
    );
    const evidenceSummary = buildTestEvidenceSummary({
      attachedDocuments,
      attachedPhotos,
      attachedVideos,
      attachedVoiceNotes
    });
    const transcripts = attachedVoiceNotes
      .map((attachment) => attachment.transcript?.trim())
      .filter((transcript): transcript is string => Boolean(transcript));

    return {
      attachedDocuments,
      attachedPhotos,
      attachedVideos,
      attachedVoiceNotes,
      conversation: {
        channel: conversation.channel,
        id: conversation.id,
        isGroup: conversation.isGroup,
        title: conversation.title
      },
      evidenceSummary,
      externalMessageId: message.externalMessageId,
      messageId: message.id,
      messageMetadata: {
        attachmentCount: message.attachments.length,
        hasTranscript: transcripts.length > 0,
        transcriptionFailed: attachedVoiceNotes.some(
          (attachment) => attachment.transcriptionStatus === "FAILED"
        ),
        transcriptionPending: attachedVoiceNotes.some(
          (attachment) => attachment.transcriptionStatus === "PENDING"
        )
      },
      messageText: message.body,
      messageType: message.type,
      organizationId: conversation.organizationId,
      processingStatus: message.processingStatus,
      project: project
        ? {
            code: project.code,
            id: project.id,
            name: project.name,
            status: project.status
          }
        : null,
      sender: {
        displayName: participant.displayName,
        externalIdentifier: participant.externalIdentifier,
        id: participant.id
      },
      timestamp: message.occurredAt,
      voiceTranscript: transcripts.length > 0 ? transcripts.join("\n\n") : null
    };
  }

  async getMessageEvidenceSummary(messageId: string): Promise<EvidenceSummary | null> {
    const context = await this.getMessageEvidenceContext(messageId);
    return context?.evidenceSummary ?? null;
  }

  async getActionItem(actionItemId: string): Promise<ActionItemRecord | null> {
    return this.actionItems.find((task) => task.id === actionItemId) ?? null;
  }

  async listProjectAIClassifications(projectId: string): Promise<AIMessageClassificationRecord[]> {
    return this.classifications.filter((classification) => classification.projectId === projectId);
  }

  async listProjectActionItems(projectId: string): Promise<ActionItemRecord[]> {
    return this.actionItems.filter(
      (task) => task.projectId === projectId || task.suggestedProjectId === projectId
    );
  }

  async getPhotoAnalysis(photoAnalysisId: string): Promise<PhotoAnalysisRecord | null> {
    return this.photoAnalyses.find((analysis) => analysis.id === photoAnalysisId) ?? null;
  }

  async getPhotoAnalysisByEvidenceId(evidenceId: string): Promise<PhotoAnalysisRecord | null> {
    return this.photoAnalyses.find((analysis) => analysis.evidenceId === evidenceId) ?? null;
  }

  async listProjectPhotoAnalyses(input: {
    projectId: string;
    cursor?: string | null;
    limit: number;
  }) {
    const cursorDate = input.cursor ? new Date(input.cursor) : null;
    const analyses = this.photoAnalyses
      .filter((analysis) => analysis.projectId === input.projectId)
      .filter((analysis) => !cursorDate || analysis.createdAt < cursorDate)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    const page = analyses.slice(0, input.limit);

    return {
      analyses: page,
      nextCursor:
        analyses.length > input.limit ? (page.at(-1)?.createdAt.toISOString() ?? null) : null
    };
  }

  async getProjectIntelligenceContext(
    projectId: string
  ): Promise<ProjectIntelligenceContext | null> {
    const project = this.projects.find((candidate) => candidate.id === projectId);

    if (!project) {
      return null;
    }

    const conversations = this.conversations.filter(
      (conversation) => conversation.projectId === projectId
    );
    const conversationIds = new Set(conversations.map((conversation) => conversation.id));
    const messages = this.messages.filter((message) => conversationIds.has(message.conversationId));
    const messageIds = new Set(messages.map((message) => message.id));

    return {
      actionItems: this.actionItems
        .filter((item) => item.projectId === projectId || item.suggestedProjectId === projectId)
        .map((item) => ({
          createdAt: item.createdAt,
          description: item.description,
          id: item.id,
          messageId: item.messageId,
          priority: item.priority,
          status: item.status,
          title: item.title,
          type: item.type,
          updatedAt: item.updatedAt
        })),
      classifications: this.classifications
        .filter((classification) => classification.projectId === projectId)
        .map((classification) => ({
          actionRequired: classification.actionRequired,
          category: classification.category,
          confidence: classification.confidence,
          createdAt: classification.createdAt,
          id: classification.id,
          location: classification.location,
          messageId: classification.messageId,
          reasoningSummary: classification.reasoningSummary,
          status: classification.status,
          summary: classification.summary,
          updatedAt: classification.updatedAt
        })),
      evidence: this.attachments
        .filter((attachment) => messageIds.has(attachment.messageId))
        .map((attachment) => ({
          createdAt: attachment.createdAt,
          filename: attachment.filename,
          id: attachment.id,
          messageId: attachment.messageId,
          mimeType: attachment.mimeType,
          transcript: attachment.transcript,
          transcriptionStatus: attachment.transcriptionStatus
        })),
      events: this.events
        .filter((event) => event.projectId === projectId)
        .map((event) => ({
          description: event.description,
          eventType: event.eventType,
          id: event.id,
          occurredAt: event.occurredAt,
          sourceId: event.sourceId,
          sourceType: event.sourceType,
          title: event.title
        })),
      generatedAt: new Date("2026-07-08T00:00:00.000Z"),
      milestones: this.milestones
        .filter((milestone) => milestone.projectId === projectId)
        .map((milestone) => ({
          dueDate: milestone.dueDate,
          id: milestone.id,
          status: milestone.status,
          title: milestone.title
        })),
      photoAnalyses: this.photoAnalyses
        .filter((analysis) => analysis.projectId === projectId)
        .map((analysis) => ({
          confidence: analysis.confidence,
          createdAt: analysis.createdAt,
          detectedObjects: analysis.detectedObjects,
          evidenceId: analysis.evidenceId,
          id: analysis.id,
          possibleIssues: analysis.possibleIssues,
          summary: analysis.summary,
          tags: analysis.tags
        })),
      project: {
        code: project.code,
        id: project.id,
        name: project.name,
        status: project.status
      }
    };
  }

  async getLatestProjectReport(input: {
    projectId: string;
    type: ProjectReportRecord["type"];
  }): Promise<ProjectReportRecord | null> {
    return (
      this.projectReports
        .filter((report) => report.projectId === input.projectId && report.type === input.type)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null
    );
  }

  async queueProjectReport(input: {
    projectId: string;
    type: ProjectReportRecord["type"];
  }): Promise<ProjectReportRecord> {
    const project = this.projects.find((candidate) => candidate.id === input.projectId);

    if (!project) {
      throw new Error("project missing in test repository");
    }

    const now = new Date();
    const report: ProjectReportRecord = {
      content: null,
      contentHash: null,
      createdAt: now,
      errorMessage: null,
      generatedAt: null,
      id: nextId("report"),
      markdown: null,
      organizationId: project.organizationId,
      pdfStorageKey: null,
      periodEnd: now,
      periodStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      projectId: project.id,
      status: "PENDING",
      title: `${project.name} Weekly Progress Report`,
      type: input.type,
      updatedAt: now
    };
    this.projectReports.push(report);
    this.addProcessingJob({
      organizationId: project.organizationId,
      projectId: project.id,
      sourceId: report.id,
      sourceType: "PROJECT_REPORT",
      type: "REPORT_GENERATION"
    });
    return report;
  }

  async getEvidenceView(evidenceId: string) {
    const attachment = this.attachments.find((candidate) => candidate.id === evidenceId);

    if (!attachment) {
      return null;
    }

    const message = this.messages.find((candidate) => candidate.id === attachment.messageId);
    const conversation = message
      ? this.conversations.find((candidate) => candidate.id === message.conversationId)
      : null;

    if (!message || !conversation) {
      return null;
    }

    return {
      actionItems: this.actionItems.filter((item) => item.messageId === message.id),
      conversation: {
        id: conversation.id,
        title: conversation.title
      },
      createdAt: attachment.createdAt,
      filename: attachment.filename,
      id: attachment.id,
      message: {
        body: message.body,
        id: message.id,
        occurredAt: message.occurredAt
      },
      mimeType: attachment.mimeType,
      organizationId: conversation.organizationId,
      photoAnalysis:
        this.photoAnalyses.find((analysis) => analysis.evidenceId === attachment.id) ?? null,
      project: conversation.project,
      size: attachment.size,
      sourceWhatsAppMessage: {
        conversationTitle: conversation.title,
        messageId: message.id
      },
      storageKey: attachment.storageKey,
      timelineEvents: this.events
        .filter((event) => event.sourceId === message.id || event.sourceId === attachment.id)
        .map((event) => ({
          description: event.description,
          id: event.id,
          occurredAt: event.occurredAt,
          title: event.title
        })),
      transcript: attachment.transcript,
      transcriptionStatus: attachment.transcriptionStatus
    };
  }

  async ignoreActionItem(input: {
    actionItemId: string;
    userId: string;
  }): Promise<ActionItemRecord> {
    const task = this.requireActionItem(input.actionItemId);
    task.acceptedAt = null;
    task.acceptedByUserId = null;
    task.completedAt = null;
    task.ignoredAt = new Date();
    task.ignoredByUserId = input.userId;
    task.status = "IGNORED";
    task.updatedAt = new Date();
    return task;
  }

  async completeActionItem(input: {
    actionItemId: string;
    userId: string;
  }): Promise<ActionItemRecord> {
    const task = this.requireActionItem(input.actionItemId);
    void input.userId;
    task.completedAt = new Date();
    task.status = "COMPLETED";
    task.updatedAt = new Date();
    return task;
  }

  async getOperationsDashboard(input: {
    organizationId: string;
    userId: string;
  }): Promise<OperationsDashboardRecord> {
    const projects = this.projects.filter(
      (project) => project.organizationId === input.organizationId && project.status === "ACTIVE"
    );
    const actionItems = this.actionItems.filter(
      (actionItem) => actionItem.organizationId === input.organizationId
    );
    const classifications = this.classifications.filter(
      (classification) => classification.organizationId === input.organizationId
    );
    const milestones = this.milestones
      .filter(
        (milestone) =>
          milestone.organizationId === input.organizationId && milestone.status !== "COMPLETED"
      )
      .sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime())
      .slice(0, 12);
    const events = this.events
      .filter(
        (event) =>
          event.organizationId === input.organizationId &&
          event.projectId &&
          event.sourceType !== "SYSTEM"
      )
      .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
      .slice(0, 12);
    const dashboardProjects = projects
      .map((project) => {
        const projectActionItems = actionItems.filter(
          (actionItem) => actionItem.projectId === project.id && actionItem.status === "PENDING"
        );
        const urgentCount = projectActionItems.filter(
          (actionItem) => actionItem.priority === "URGENT"
        ).length;
        const highCount = projectActionItems.filter((actionItem) =>
          ["HIGH", "URGENT"].includes(actionItem.priority)
        ).length;
        const overdueCount = milestones.filter(
          (milestone) => milestone.projectId === project.id && milestone.status === "OVERDUE"
        ).length;
        const hasSafetyIssue = classifications.some(
          (classification) =>
            classification.projectId === project.id && classification.category === "SAFETY_ISSUE"
        );
        const hasAttentionIssue = classifications.some(
          (classification) =>
            classification.projectId === project.id &&
            ["DELAY", "DEFECT", "INSPECTION_REQUEST"].includes(classification.category ?? "")
        );
        const health: DashboardHealth =
          hasSafetyIssue || urgentCount >= 3 || overdueCount >= 2
            ? "CRITICAL"
            : highCount > 0 || overdueCount > 0 || hasAttentionIssue
              ? "NEEDS_ATTENTION"
              : "HEALTHY";
        const rankScore =
          (health === "CRITICAL" ? 300 : health === "NEEDS_ATTENTION" ? 150 : 0) +
          urgentCount * 20 +
          highCount * 10 +
          overdueCount * 15;

        return {
          code: project.code,
          health,
          highestPriorityIssue: projectActionItems[0]?.title ?? null,
          id: project.id,
          lastActivityAt:
            events.find((event) => event.projectId === project.id)?.occurredAt ?? project.updatedAt,
          name: project.name,
          openActionItemCount: projectActionItems.length,
          rankScore,
          status: project.status
        };
      })
      .sort(
        (left, right) => right.rankScore - left.rankScore || left.name.localeCompare(right.name)
      );
    const openActionItems = actionItems.filter((actionItem) => actionItem.status === "PENDING");
    const myActionItems = openActionItems.filter(
      (actionItem) =>
        actionItem.assignedToUserId === input.userId || actionItem.assignedToUserId === null
    );
    const recentActivity = events.map((event) => {
      const project = this.projects.find((candidate) => candidate.id === event.projectId);
      return {
        description: event.description,
        eventType: event.eventType,
        icon: event.sourceType === "MESSAGE" ? "message-circle" : "check-circle",
        id: event.id,
        occurredAt: event.occurredAt,
        projectId: event.projectId ?? "",
        projectName: project?.name ?? "Unknown project",
        sourceType: event.sourceType,
        title: event.title
      };
    });
    const summary = {
      activeProjects: dashboardProjects.length,
      criticalProjects: dashboardProjects.filter((project) => project.health === "CRITICAL").length,
      healthyProjects: dashboardProjects.filter((project) => project.health === "HEALTHY").length,
      highPriorityActionItems: openActionItems.filter((actionItem) =>
        ["HIGH", "URGENT"].includes(actionItem.priority)
      ).length,
      openActionItems: openActionItems.length,
      pendingAIReviews: classifications.filter((classification) =>
        ["PENDING", "NEEDS_REVIEW"].includes(classification.status)
      ).length,
      projectsNeedingAttention: dashboardProjects.filter(
        (project) => project.health === "NEEDS_ATTENTION"
      ).length,
      todaysActivityCount: recentActivity.length
    };

    return {
      actionItems: {
        high: myActionItems.filter((actionItem) => actionItem.priority === "HIGH"),
        low: myActionItems.filter((actionItem) => actionItem.priority === "LOW"),
        medium: myActionItems.filter((actionItem) => actionItem.priority === "MEDIUM"),
        urgent: myActionItems.filter((actionItem) => actionItem.priority === "URGENT")
      },
      brief: {
        bullets: [
          `${summary.activeProjects} active projects are being tracked.`,
          `${summary.openActionItems} open Action Items remain.`
        ],
        generatedBy: "FALLBACK"
      },
      milestones,
      projects: dashboardProjects,
      recentActivity,
      summary
    };
  }

  async getAdminOperations(organizationId: string) {
    const jobSummary = this.buildJobMetrics(organizationId);
    const byType = new Map(jobSummary.map((row) => [row.type, row]));
    const whatsappCount = (status: WhatsAppAccountRecord["status"]) =>
      this.whatsAppAccounts.filter(
        (account) => account.organizationId === organizationId && account.status === status
      ).length;

    return {
      ai: {
        averageProcessingTimeMs: null,
        failuresToday: byType.get("AI_CLASSIFICATION")?.failed ?? 0,
        jobsPending: byType.get("AI_CLASSIFICATION")?.pending ?? 0
      },
      jobSummary,
      media: {
        failedDownloads: byType.get("MEDIA_DOWNLOAD")?.failed ?? 0,
        pendingDownloads: byType.get("MEDIA_DOWNLOAD")?.pending ?? 0,
        pendingPhotoAnalyses: byType.get("PHOTO_ANALYSIS")?.pending ?? 0,
        pendingTranscriptions: byType.get("VOICE_TRANSCRIPTION")?.pending ?? 0
      },
      search: {
        completedToday: byType.get("SEARCH_INDEX")?.completedToday ?? 0,
        pendingIndexJobs: byType.get("SEARCH_INDEX")?.pending ?? 0
      },
      whatsApp: {
        connectedAccounts: whatsappCount("CONNECTED"),
        disconnectedAccounts: whatsappCount("DISCONNECTED"),
        failedConnections: whatsappCount("ERROR"),
        qrPending: whatsappCount("PENDING_QR")
      },
      workers: this.workerHeartbeats
    };
  }

  async createFeedback(input: {
    message: string;
    organizationId: string;
    page?: string;
    type: UserFeedbackRecord["type"];
    userId: string;
  }): Promise<UserFeedbackRecord> {
    const feedback: UserFeedbackRecord = {
      createdAt: new Date(),
      id: nextId("feedback"),
      message: input.message,
      organizationId: input.organizationId,
      page: input.page ?? null,
      status: "OPEN",
      type: input.type,
      userId: input.userId
    };
    this.feedback.push(feedback);
    return feedback;
  }

  async createNotification(input: {
    body?: string | null;
    href?: string | null;
    organizationId: string;
    title: string;
    type: string;
    userId: string;
  }): Promise<UserNotificationRecord> {
    const notification: UserNotificationRecord = {
      body: input.body ?? null,
      createdAt: new Date(),
      href: input.href ?? null,
      id: nextId("notification"),
      organizationId: input.organizationId,
      readAt: null,
      title: input.title,
      type: input.type,
      userId: input.userId
    };
    this.notifications.push(notification);
    return notification;
  }

  async getOnboardingState(organizationId: string) {
    const organization = this.organizations.find((candidate) => candidate.id === organizationId);

    if (!organization) {
      throw new Error("Organization not found.");
    }

    const projectCount = this.projects.filter(
      (project) => project.organizationId === organizationId
    ).length;
    const connectedAccountCount = this.whatsAppAccounts.filter(
      (account) => account.organizationId === organizationId && account.status === "CONNECTED"
    ).length;
    const activeChatCount = this.whatsAppChatMappings.filter(
      (mapping) => mapping.organizationId === organizationId && mapping.status === "ACTIVE"
    ).length;
    const messageCount = this.messages.filter((message) =>
      this.conversations.some(
        (conversation) =>
          conversation.id === message.conversationId &&
          conversation.organizationId === organizationId
      )
    ).length;
    const steps = [
      {
        completed: true,
        href: "/",
        key: "CREATE_ORGANIZATION" as const,
        label: "Create organization"
      },
      {
        completed: projectCount > 0,
        href: "/projects",
        key: "CREATE_PROJECT" as const,
        label: "Create first project"
      },
      {
        completed: connectedAccountCount > 0,
        href: "/settings",
        key: "CONNECT_WHATSAPP" as const,
        label: "Connect WhatsApp"
      },
      {
        completed: activeChatCount > 0,
        href: "/settings",
        key: "ACTIVATE_GROUP" as const,
        label: "Activate a chat or group"
      },
      {
        completed: messageCount > 0,
        href: "/inbox",
        key: "SEND_UPDATE" as const,
        label: "Send a field update"
      },
      {
        completed: projectCount > 0 && messageCount > 0,
        href: "/",
        key: "OPEN_COMMAND_CENTER" as const,
        label: "Open Project Command Center"
      }
    ];

    return {
      isDemo: organization.isDemo,
      organizationId,
      progress: Math.round((steps.filter((step) => step.completed).length / steps.length) * 100),
      steps
    };
  }

  async listNotifications(input: {
    organizationId: string;
    userId: string;
  }): Promise<UserNotificationRecord[]> {
    return this.notifications
      .filter(
        (notification) =>
          notification.organizationId === input.organizationId &&
          notification.userId === input.userId
      )
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, 15);
  }

  async markNotificationRead(input: {
    notificationId: string;
    userId: string;
  }): Promise<UserNotificationRecord | null> {
    const notification =
      this.notifications.find(
        (candidate) => candidate.id === input.notificationId && candidate.userId === input.userId
      ) ?? null;

    if (notification) {
      notification.readAt = new Date();
    }

    return notification;
  }

  async recordAnalyticsEvent(input: {
    eventName: string;
    metadata?: unknown;
    organizationId?: string | null;
    userId?: string | null;
  }): Promise<void> {
    this.analyticsEvents.push({
      createdAt: new Date(),
      eventName: input.eventName,
      id: nextId("analytics"),
      metadata: input.metadata ?? null,
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null
    });
  }

  async resetDemoWorkspace(userId: string) {
    const existingDemoIds = new Set(
      this.memberships
        .filter(
          (membership) =>
            membership.userId === userId &&
            this.organizations.some(
              (organization) => organization.id === membership.organizationId && organization.isDemo
            )
        )
        .map((membership) => membership.organizationId)
    );
    this.organizations = this.organizations.filter(
      (organization) => !existingDemoIds.has(organization.id)
    );
    this.memberships = this.memberships.filter(
      (membership) => !existingDemoIds.has(membership.organizationId)
    );

    const organization = await this.createOrganization({
      name: "FieldOS Aviation Demo",
      ownerUserId: userId,
      slug: `fieldos-aviation-demo-${nextId("slug")}`
    });
    const storedOrganization = this.organizations.find(
      (candidate) => candidate.id === organization.id
    );

    if (storedOrganization) {
      storedOrganization.isDemo = true;
    }

    const project = await this.createProject({
      code: "SIN-TWY-A7",
      name: "Taxiway A7 Lighting Modernization",
      organizationId: organization.id,
      status: "ACTIVE"
    });
    const conversation = await this.createConversation({
      channel: "WHATSAPP",
      externalId: "demo:sin-twy-a7",
      isGroup: true,
      lastMessageAt: null,
      organizationId: organization.id,
      projectId: project.id,
      title: "SIN-TWY-A7 Airside Coordination"
    });

    return {
      conversations: [conversation],
      organization: {
        ...organization,
        isDemo: true
      },
      projects: [project]
    };
  }

  async listProcessingJobs(organizationId: string): Promise<ProcessingJobRecord[]> {
    return this.processingJobs.filter((job) => job.organizationId === organizationId);
  }

  async getProcessingJob(jobId: string): Promise<ProcessingJobRecord | null> {
    return this.processingJobs.find((job) => job.id === jobId) ?? null;
  }

  async listWorkerHeartbeats(): Promise<WorkerHeartbeatRecord[]> {
    return this.workerHeartbeats;
  }

  async retryProcessingJob(jobId: string): Promise<ProcessingJobRecord> {
    const job = this.processingJobs.find((candidate) => candidate.id === jobId);

    if (!job) {
      throw new Error("job missing");
    }

    job.status = "PENDING";
    job.errorMessage = null;
    job.failedAt = null;
    job.startedAt = null;
    job.completedAt = null;
    job.updatedAt = new Date();
    return job;
  }

  async retryFailedProcessingJobs(organizationId: string): Promise<number> {
    const failed = this.processingJobs.filter(
      (job) => job.organizationId === organizationId && job.status === "FAILED"
    );

    for (const job of failed) {
      await this.retryProcessingJob(job.id);
    }

    return failed.length;
  }

  async searchDocuments(input: {
    cursor?: string | null;
    dateFrom?: Date | null;
    dateTo?: Date | null;
    limit: number;
    organizationId: string;
    projectId?: string | null;
    query: string;
    sourceType?: SearchSourceType | null;
  }): Promise<SearchDocumentsResult> {
    const query = input.query.trim().toLowerCase();
    const documents = this.buildSearchDocuments()
      .filter((document) => document.organizationId === input.organizationId)
      .filter((document) => !input.projectId || document.projectId === input.projectId)
      .filter((document) => !input.sourceType || document.sourceType === input.sourceType)
      .filter((document) => {
        const date = document.occurredAt ?? document.createdAt;
        return (
          (!input.dateFrom || date >= input.dateFrom) && (!input.dateTo || date <= input.dateTo)
        );
      })
      .filter(
        (document) =>
          !query ||
          document.title.toLowerCase().includes(query) ||
          document.snippet.toLowerCase().includes(query)
      )
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    const page = documents.slice(0, input.limit);

    return {
      nextCursor:
        documents.length > input.limit ? (page.at(-1)?.createdAt.toISOString() ?? null) : null,
      results: page
    };
  }

  addCompletedClassification(input: {
    messageId: string;
    organizationId: string;
    projectId: string;
    actionRequired?: boolean;
    category?: AIMessageClassificationRecord["category"];
  }): AIMessageClassificationRecord {
    const classification: AIMessageClassificationRecord = {
      category: input.category ?? "DEFECT",
      confidence: 0.91,
      createdAt: new Date(),
      errorMessage: null,
      id: nextId("classification"),
      location: "Lobby",
      messageId: input.messageId,
      organizationId: input.organizationId,
      projectId: input.projectId,
      reasoningSummary: "The message requests rectification for a defect.",
      actionRequired: input.actionRequired ?? true,
      status: "COMPLETED",
      summary: "A defect was reported and needs follow-up.",
      updatedAt: new Date()
    };
    this.classifications.push(classification);
    return classification;
  }

  addProcessingJob(input: {
    organizationId: string;
    projectId?: string | null;
    sourceId?: string;
    sourceType?: string;
    status?: ProcessingJobRecord["status"];
    type?: ProcessingJobRecord["type"];
  }): ProcessingJobRecord {
    const now = new Date();
    const job: ProcessingJobRecord = {
      attempts: input.status === "FAILED" ? 3 : 0,
      completedAt: input.status === "COMPLETED" ? now : null,
      correlationId: nextId("correlation"),
      createdAt: now,
      errorMessage: input.status === "FAILED" ? "Job failed." : null,
      failedAt: input.status === "FAILED" ? now : null,
      id: nextId("job"),
      maxAttempts: 3,
      organizationId: input.organizationId,
      projectId: input.projectId ?? null,
      sourceId: input.sourceId ?? nextId("source"),
      sourceType: input.sourceType ?? "MESSAGE",
      startedAt: input.status === "RUNNING" || input.status === "COMPLETED" ? now : null,
      status: input.status ?? "PENDING",
      type: input.type ?? "SEARCH_INDEX",
      updatedAt: now
    };
    this.processingJobs.push(job);
    return job;
  }

  addWorkerHeartbeat(input: Partial<WorkerHeartbeatRecord> = {}): WorkerHeartbeatRecord {
    const now = new Date();
    const worker: WorkerHeartbeatRecord = {
      createdAt: now,
      id: nextId("worker"),
      lastHeartbeatAt: input.lastHeartbeatAt ?? now,
      status: input.status ?? "ONLINE",
      updatedAt: now,
      version: input.version ?? "test",
      workerName: input.workerName ?? "fieldos-worker"
    };
    this.workerHeartbeats.push(worker);
    return worker;
  }

  addActionItem(input: {
    classificationId: string;
    messageId: string;
    organizationId: string;
    projectId: string | null;
    assignedToUserId?: string | null;
    priority?: ActionItemRecord["priority"];
    status?: ActionItemRecord["status"];
    suggestedProjectId?: string | null;
    type?: "FOLLOW_UP" | "PROJECT_SUGGESTION";
  }): ActionItemRecord {
    const task: ActionItemRecord = {
      acceptedAt: null,
      acceptedByUserId: null,
      assignedToUserId: input.assignedToUserId ?? null,
      classificationId: input.classificationId,
      completedAt: null,
      confidence: 0.91,
      createdAt: new Date(),
      description: "Rectify the reported issue.",
      id: nextId("action_item"),
      messageId: input.messageId,
      organizationId: input.organizationId,
      priority: input.priority ?? "MEDIUM",
      project: input.projectId
        ? (this.projects.find((project) => project.id === input.projectId) ?? null)
        : null,
      projectId: input.projectId,
      ignoredAt: null,
      ignoredByUserId: null,
      suggestedProject: null,
      suggestedProjectId: input.suggestedProjectId ?? null,
      status: input.status ?? "PENDING",
      title: "Fix reported defect",
      type: input.type ?? "FOLLOW_UP",
      updatedAt: new Date()
    };
    this.actionItems.push(task);
    return task;
  }

  addPhotoAnalysis(input: {
    attachment: AttachmentRecord;
    conversation: ConversationRecord;
    message: MessageRecord;
    organizationId: string;
    project: ProjectRecord | null;
    confidence?: number;
    detectedObjects?: string[];
    possibleIssues?: string[];
    summary?: string;
    tags?: string[];
  }): PhotoAnalysisRecord {
    const now = new Date();
    const analysis: PhotoAnalysisRecord = {
      confidence: input.confidence ?? 0.77,
      conversationId: input.conversation.id,
      createdAt: now,
      detectedObjects: input.detectedObjects ?? ["Site photo"],
      evidence: {
        filename: input.attachment.filename,
        mimeType: input.attachment.mimeType,
        storageKey: input.attachment.storageKey
      },
      evidenceId: input.attachment.id,
      id: nextId("photo_analysis"),
      message: {
        body: input.message.body,
        conversation: {
          id: input.conversation.id,
          title: input.conversation.title
        },
        id: input.message.id,
        occurredAt: input.message.occurredAt
      },
      messageId: input.message.id,
      organizationId: input.organizationId,
      possibleIssues: input.possibleIssues ?? [],
      project: input.project
        ? {
            code: input.project.code,
            id: input.project.id,
            name: input.project.name
          }
        : null,
      projectId: input.project?.id ?? null,
      provider: "vision-test",
      summary: input.summary ?? "Photo analysis completed.",
      tags: input.tags ?? ["photo"]
    };

    input.attachment.photoAnalysis = {
      confidence: analysis.confidence,
      id: analysis.id,
      possibleIssues: analysis.possibleIssues,
      summary: analysis.summary,
      tags: analysis.tags
    };
    this.photoAnalyses.push(analysis);
    return analysis;
  }

  addEvent(input: {
    organizationId: string;
    projectId: string | null;
    sourceType: "MESSAGE" | "ACTION_ITEM" | "REPORT" | "SYSTEM";
    title: string;
    occurredAt?: Date;
  }) {
    const event = {
      createdAt: new Date(),
      description: null,
      eventType: "created",
      id: nextId("event"),
      occurredAt: input.occurredAt ?? new Date(),
      organizationId: input.organizationId,
      projectId: input.projectId,
      sourceId: nextId("source"),
      sourceType: input.sourceType,
      title: input.title
    };
    this.events.push(event);
    return event;
  }

  addMilestone(input: {
    organizationId: string;
    projectId: string;
    title: string;
    dueDate: Date;
    status?: MilestoneRecord["status"];
  }): MilestoneRecord {
    const project = this.projects.find((candidate) => candidate.id === input.projectId);

    if (!project) {
      throw new Error("project missing in test repository");
    }

    const milestone: MilestoneRecord = {
      createdAt: new Date(),
      dueDate: input.dueDate,
      id: nextId("milestone"),
      organizationId: input.organizationId,
      project: {
        code: project.code,
        id: project.id,
        name: project.name
      },
      projectId: input.projectId,
      status: input.status ?? "UPCOMING",
      title: input.title,
      updatedAt: new Date()
    };
    this.milestones.push(milestone);
    return milestone;
  }

  private buildSearchDocuments(): SearchDocumentsResult["results"] {
    const projectDocuments = this.projects.map((project) => ({
      createdAt: project.createdAt,
      id: `search_project_${project.id}`,
      metadata: {
        code: project.code,
        status: project.status
      },
      occurredAt: project.updatedAt,
      organizationId: project.organizationId,
      project: {
        code: project.code,
        id: project.id,
        name: project.name
      },
      projectId: project.id,
      snippet: `Project ${project.name} ${project.code} status ${project.status}`,
      sourceId: project.id,
      sourceType: "PROJECT" as const,
      title: `${project.code} ${project.name}`,
      updatedAt: project.updatedAt
    }));
    const messageDocuments = this.messages.flatMap((message) => {
      const conversation = this.conversations.find(
        (candidate) => candidate.id === message.conversationId
      );

      if (!conversation) {
        return [];
      }

      const project = conversation.projectId
        ? this.projects.find((candidate) => candidate.id === conversation.projectId)
        : null;

      return [
        {
          createdAt: message.createdAt,
          id: `search_message_${message.id}`,
          metadata: {
            conversationId: conversation.id
          },
          occurredAt: message.occurredAt,
          organizationId: conversation.organizationId,
          project: project
            ? {
                code: project.code,
                id: project.id,
                name: project.name
              }
            : null,
          projectId: conversation.projectId,
          snippet: `${message.senderParticipant.displayName}: ${message.body ?? ""}`,
          sourceId: message.id,
          sourceType: "MESSAGE" as const,
          title: conversation.title,
          updatedAt: message.createdAt
        }
      ];
    });
    const eventDocuments = this.events.map((event) => ({
      createdAt: event.createdAt,
      id: `search_event_${event.id}`,
      metadata: {
        eventType: event.eventType
      },
      occurredAt: event.occurredAt,
      organizationId: event.organizationId,
      project: this.projectReference(event.projectId),
      projectId: event.projectId,
      snippet: event.description ?? event.eventType,
      sourceId: event.id,
      sourceType: "TIMELINE_EVENT" as const,
      title: event.title,
      updatedAt: event.createdAt
    }));
    const actionItemDocuments = this.actionItems.map((actionItem) => ({
      createdAt: actionItem.createdAt,
      id: `search_action_${actionItem.id}`,
      metadata: {
        priority: actionItem.priority,
        status: actionItem.status
      },
      occurredAt: actionItem.updatedAt,
      organizationId: actionItem.organizationId,
      project: this.projectReference(actionItem.projectId),
      projectId: actionItem.projectId,
      snippet: `${actionItem.description ?? ""} ${actionItem.status} ${actionItem.priority}`,
      sourceId: actionItem.id,
      sourceType: "ACTION_ITEM" as const,
      title: actionItem.title,
      updatedAt: actionItem.updatedAt
    }));
    const classificationDocuments = this.classifications.map((classification) => ({
      createdAt: classification.createdAt,
      id: `search_classification_${classification.id}`,
      metadata: {
        category: classification.category,
        status: classification.status
      },
      occurredAt: classification.updatedAt,
      organizationId: classification.organizationId,
      project: this.projectReference(classification.projectId),
      projectId: classification.projectId,
      snippet: `${classification.summary ?? ""} ${classification.location ?? ""} ${
        classification.category ?? ""
      }`,
      sourceId: classification.id,
      sourceType: "AI_CLASSIFICATION" as const,
      title: classification.category
        ? `AI classification: ${classification.category}`
        : "AI classification",
      updatedAt: classification.updatedAt
    }));
    const photoAnalysisDocuments = this.photoAnalyses.map((analysis) => ({
      createdAt: analysis.createdAt,
      id: `search_photo_analysis_${analysis.id}`,
      metadata: {
        confidence: analysis.confidence,
        evidenceId: analysis.evidenceId
      },
      occurredAt: analysis.createdAt,
      organizationId: analysis.organizationId,
      project: this.projectReference(analysis.projectId),
      projectId: analysis.projectId,
      snippet: [
        analysis.summary,
        ...analysis.detectedObjects,
        ...analysis.possibleIssues,
        ...analysis.tags
      ].join(" "),
      sourceId: analysis.id,
      sourceType: "PHOTO_ANALYSIS" as const,
      title: `Photo analysis: ${analysis.evidence.filename}`,
      updatedAt: analysis.createdAt
    }));
    const projectReportDocuments = this.projectReports
      .filter((report) => report.status === "COMPLETED")
      .map((report) => ({
        createdAt: report.createdAt,
        id: `search_project_report_${report.id}`,
        metadata: {
          reportType: report.type,
          status: report.status
        },
        occurredAt: report.generatedAt ?? report.updatedAt,
        organizationId: report.organizationId,
        project: this.projectReference(report.projectId),
        projectId: report.projectId,
        snippet: report.markdown ?? report.title,
        sourceId: report.id,
        sourceType: "PROJECT_REPORT" as const,
        title: report.title,
        updatedAt: report.updatedAt
      }));

    return [
      ...projectDocuments,
      ...messageDocuments,
      ...eventDocuments,
      ...actionItemDocuments,
      ...classificationDocuments,
      ...photoAnalysisDocuments,
      ...projectReportDocuments
    ];
  }

  private buildJobMetrics(organizationId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (
      [
        "SEARCH_INDEX",
        "AI_CLASSIFICATION",
        "VOICE_TRANSCRIPTION",
        "MEDIA_DOWNLOAD",
        "PHOTO_ANALYSIS",
        "REPORT_GENERATION"
      ] as const
    ).map((type) => {
      const jobs = this.processingJobs.filter(
        (job) => job.organizationId === organizationId && job.type === type
      );

      return {
        completedToday: jobs.filter(
          (job) =>
            job.status === "COMPLETED" &&
            job.completedAt &&
            job.completedAt.getTime() >= today.getTime()
        ).length,
        failed: jobs.filter((job) => job.status === "FAILED").length,
        pending: jobs.filter((job) => job.status === "PENDING").length,
        running: jobs.filter((job) => job.status === "RUNNING").length,
        type
      };
    });
  }

  private projectReference(projectId: string | null) {
    const project = projectId
      ? this.projects.find((candidate) => candidate.id === projectId)
      : null;

    return project
      ? {
          code: project.code,
          id: project.id,
          name: project.name
        }
      : null;
  }

  private requireActionItem(actionItemId: string): ActionItemRecord {
    const task = this.actionItems.find((candidate) => candidate.id === actionItemId);

    if (!task) {
      throw new Error("action item missing in test repository");
    }

    return task;
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

class InMemoryStorageProvider implements StorageProvider {
  readonly signedUrlRequests: SignedUrlInput[] = [];
  private readonly objects = new Map<string, Buffer>();

  async upload(input: StorageObjectInput): Promise<StoredObject> {
    const data = Buffer.isBuffer(input.data) ? input.data : Buffer.from(input.data);
    this.objects.set(input.key, data);

    return {
      contentType: input.contentType ?? null,
      key: input.key,
      size: data.byteLength
    };
  }

  async download(key: string): Promise<Buffer> {
    const object = this.objects.get(key);

    if (!object) {
      throw new Error("object not found");
    }

    return object;
  }

  async getSignedUrl(input: SignedUrlInput): Promise<string> {
    this.signedUrlRequests.push(input);

    return `https://r2.example.test/${input.key}?expires=${input.expiresInSeconds}`;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }
}

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

function buildTestEvidenceSummary(input: {
  attachedDocuments: AttachmentRecord[];
  attachedPhotos: AttachmentRecord[];
  attachedVideos: AttachmentRecord[];
  attachedVoiceNotes: AttachmentRecord[];
}): EvidenceSummary {
  const pdfCount = input.attachedDocuments.filter(
    (attachment) =>
      attachment.mimeType === "application/pdf" || attachment.filename.endsWith(".pdf")
  ).length;
  const labels = [
    formatTestEvidenceCount(input.attachedPhotos.length, "Photo", "Photos"),
    formatTestEvidenceCount(input.attachedVoiceNotes.length, "Voice Note", "Voice Notes"),
    formatTestEvidenceCount(pdfCount, "PDF", "PDFs"),
    formatTestEvidenceCount(input.attachedDocuments.length - pdfCount, "Document", "Documents"),
    formatTestEvidenceCount(input.attachedVideos.length, "Video", "Videos")
  ].filter((label): label is string => Boolean(label));

  return {
    attachmentCount:
      input.attachedDocuments.length +
      input.attachedPhotos.length +
      input.attachedVideos.length +
      input.attachedVoiceNotes.length,
    documentCount: input.attachedDocuments.length,
    labels,
    pdfCount,
    photoCount: input.attachedPhotos.length,
    videoCount: input.attachedVideos.length,
    voiceNoteCount: input.attachedVoiceNotes.length
  };
}

function formatTestEvidenceCount(count: number, singular: string, plural: string): string | null {
  if (count <= 0) {
    return null;
  }

  return `${count} ${count === 1 ? singular : plural}`;
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
