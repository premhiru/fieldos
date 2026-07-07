import { beforeEach, describe, expect, it } from "vitest";

import { MessagingServiceError } from "./errors.js";
import type { MessagingRepository } from "./repository.js";
import { AttachmentService, ConversationService, MessageService } from "./services.js";
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
  ParticipantRecord,
  ProjectReference
} from "./types.js";

describe("messaging services", () => {
  let repository: InMemoryMessagingRepository;
  let conversationService: ConversationService;
  let messageService: MessageService;
  let attachmentService: AttachmentService;

  beforeEach(() => {
    repository = new InMemoryMessagingRepository();
    conversationService = new ConversationService(repository);
    messageService = new MessageService(repository);
    attachmentService = new AttachmentService(repository);
  });

  it("creates a conversation", async () => {
    const conversation = await conversationService.createConversation("user_1", {
      channel: "EMAIL",
      externalId: "external-conversation-1",
      organizationId: "organization_1",
      title: "Gate access"
    });

    expect(conversation.title).toBe("Gate access");
    expect(conversation.channel).toBe("EMAIL");
  });

  it("adds a participant", async () => {
    const conversation = await createConversation(conversationService);
    const participant = await conversationService.addParticipant("user_1", {
      conversationId: conversation.id,
      displayName: "Site Supervisor",
      externalIdentifier: "site-supervisor@example.com",
      role: "customer"
    });

    expect(participant.displayName).toBe("Site Supervisor");
  });

  it("sends a message", async () => {
    const conversation = await createConversation(conversationService);
    const participant = await createParticipant(conversationService, conversation.id);
    const message = await messageService.sendMessage("user_1", {
      body: "Crew is on site.",
      conversationId: conversation.id,
      direction: "INBOUND",
      occurredAt: new Date("2026-06-30T00:00:00.000Z"),
      senderParticipantId: participant.id,
      type: "TEXT"
    });

    expect(message.body).toBe("Crew is on site.");
    expect(repository.conversations[0]?.lastMessageBody).toBe("Crew is on site.");
  });

  it("adds an attachment", async () => {
    const message = await createMessage(conversationService, messageService);
    const attachment = await attachmentService.addAttachment("user_1", {
      filename: "delivery-note.pdf",
      messageId: message.id,
      mimeType: "application/pdf",
      size: 120_000,
      storageKey: "attachments/delivery-note.pdf"
    });

    expect(attachment.conversationId).toBe(message.conversationId);
    expect(attachment.filename).toBe("delivery-note.pdf");
  });

  it("lists conversations", async () => {
    await createConversation(conversationService, "Access request");
    await createConversation(conversationService, "Delivery update");

    const conversations = await conversationService.listConversations("user_1", {
      organizationId: "organization_1",
      search: "delivery"
    });

    expect(conversations).toHaveLength(1);
    expect(conversations[0]?.title).toBe("Delivery update");
  });

  it("enforces organization authorization", async () => {
    await expect(
      conversationService.listConversations("outsider", {
        organizationId: "organization_1"
      })
    ).rejects.toBeInstanceOf(MessagingServiceError);
  });

  it("deletes a message", async () => {
    const message = await createMessage(conversationService, messageService);

    await expect(messageService.deleteMessage("user_1", message.id)).resolves.toEqual({ ok: true });
    await expect(messageService.listMessages("user_1", message.conversationId)).resolves.toEqual(
      []
    );
  });
});

async function createConversation(
  service: ConversationService,
  title = "Crew check-in"
): Promise<ConversationRecord> {
  return service.createConversation("user_1", {
    channel: "SMS",
    externalId: nextId("external"),
    organizationId: "organization_1",
    projectId: "project_1",
    title
  });
}

async function createParticipant(
  service: ConversationService,
  conversationId: string
): Promise<ParticipantRecord> {
  return service.addParticipant("user_1", {
    conversationId,
    displayName: "Dispatcher",
    externalIdentifier: nextId("participant"),
    role: "dispatcher"
  });
}

async function createMessage(
  conversationService: ConversationService,
  messageService: MessageService
): Promise<MessageRecord> {
  const conversation = await createConversation(conversationService);
  const participant = await createParticipant(conversationService, conversation.id);

  return messageService.sendMessage("user_1", {
    body: "Arrived at loading dock.",
    conversationId: conversation.id,
    direction: "INBOUND",
    occurredAt: new Date("2026-06-30T00:00:00.000Z"),
    senderParticipantId: participant.id,
    type: "TEXT"
  });
}

class InMemoryMessagingRepository implements MessagingRepository {
  attachments: AttachmentRecord[] = [];
  conversations: ConversationRecord[] = [];
  messages: MessageRecord[] = [];
  participants: ParticipantRecord[] = [];
  project: ProjectReference = {
    code: "SEED-001",
    id: "project_1",
    name: "Seed Project"
  };

  async addParticipant(input: CreateParticipantInput): Promise<ParticipantRecord> {
    const participant = {
      ...input,
      createdAt: new Date(),
      id: nextId("participant")
    };
    this.participants.push(participant);
    return participant;
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
      transcriptionStatus: "NOT_REQUIRED" as const
    };
    this.attachments.push(attachment);
    const message = this.messages.find((candidate) => candidate.id === input.messageId);
    message?.attachments.push(attachment);
    return attachment;
  }

  async createConversation(input: Required<CreateConversationInput>): Promise<ConversationRecord> {
    const now = new Date();
    const conversation = {
      ...input,
      createdAt: now,
      id: nextId("conversation"),
      lastMessageBody: null,
      project: input.projectId ? this.project : null,
      updatedAt: now
    };
    this.conversations.push(conversation);
    return conversation;
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
      processingStatus: "RECEIVED" as const,
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

  async deleteMessage(messageId: string): Promise<boolean> {
    const index = this.messages.findIndex((message) => message.id === messageId);

    if (index === -1) {
      return false;
    }

    this.messages.splice(index, 1);
    this.attachments = this.attachments.filter((attachment) => attachment.messageId !== messageId);
    return true;
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

  async listConversations(input: {
    organizationId: string;
    search?: string;
  }): Promise<ConversationRecord[]> {
    const search = input.search?.toLowerCase() ?? "";

    return this.conversations.filter((conversation) => {
      const messages = this.messages.filter(
        (message) => message.conversationId === conversation.id
      );
      return (
        conversation.organizationId === input.organizationId &&
        (!search ||
          conversation.title.toLowerCase().includes(search) ||
          messages.some((message) => message.body?.toLowerCase().includes(search)))
      );
    });
  }

  async listMessages(conversationId: string): Promise<MessageRecord[]> {
    return this.messages.filter((message) => message.conversationId === conversationId);
  }

  async projectBelongsToOrganization(projectId: string, organizationId: string): Promise<boolean> {
    return projectId === this.project.id && organizationId === "organization_1";
  }

  async userBelongsToOrganization(userId: string, organizationId: string): Promise<boolean> {
    return userId === "user_1" && organizationId === "organization_1";
  }
}

let idCounter = 0;

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}
