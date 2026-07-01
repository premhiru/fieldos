import { forbidden, notFound } from "./errors.js";
import type { MessagingRepository } from "./repository.js";
import {
  createAttachmentSchema,
  createConversationSchema,
  createMessageSchema,
  createParticipantSchema,
  listConversationsSchema
} from "./validation.js";
import type {
  CreateAttachmentInput,
  CreateConversationInput,
  CreateMessageInput,
  CreateParticipantInput
} from "./types.js";

export class ConversationService {
  constructor(private readonly repository: MessagingRepository) {}

  async listConversations(userId: string, input: { organizationId: string; search?: string }) {
    const parsed = listConversationsSchema.parse(input);
    await this.requireOrganizationAccess(userId, parsed.organizationId);

    return this.repository.listConversations({
      organizationId: parsed.organizationId,
      search: parsed.search
    });
  }

  async createConversation(userId: string, input: CreateConversationInput) {
    const parsed = createConversationSchema.parse(input);
    await this.requireOrganizationAccess(userId, parsed.organizationId);

    if (
      parsed.projectId &&
      !(await this.repository.projectBelongsToOrganization(parsed.projectId, parsed.organizationId))
    ) {
      throw notFound("Project not found.");
    }

    return this.repository.createConversation(parsed);
  }

  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.repository.getConversation(conversationId);

    if (!conversation) {
      throw notFound("Conversation not found.");
    }

    await this.requireOrganizationAccess(userId, conversation.organizationId);
    return conversation;
  }

  async addParticipant(userId: string, input: CreateParticipantInput) {
    const parsed = createParticipantSchema.parse(input);
    await this.getConversation(userId, parsed.conversationId);

    return this.repository.addParticipant(parsed);
  }

  private async requireOrganizationAccess(userId: string, organizationId: string) {
    if (!(await this.repository.userBelongsToOrganization(userId, organizationId))) {
      throw forbidden();
    }
  }
}

export class MessageService {
  constructor(private readonly repository: MessagingRepository) {}

  async listMessages(userId: string, conversationId: string) {
    const context = await this.requireConversationAccess(userId, conversationId);
    return this.repository.listMessages(context.id);
  }

  async sendMessage(userId: string, input: CreateMessageInput) {
    const parsed = createMessageSchema.parse(input);
    await this.requireConversationAccess(userId, parsed.conversationId);

    const participant = await this.repository.findParticipant(parsed.senderParticipantId);

    if (!participant || participant.conversationId !== parsed.conversationId) {
      throw notFound("Participant not found.");
    }

    return this.repository.createMessage(parsed);
  }

  async deleteMessage(userId: string, messageId: string) {
    const context = await this.repository.findMessageContext(messageId);

    if (!context) {
      throw notFound("Message not found.");
    }

    await this.requireOrganizationAccess(userId, context.organizationId);

    if (!(await this.repository.deleteMessage(messageId))) {
      throw notFound("Message not found.");
    }

    return { ok: true };
  }

  private async requireConversationAccess(userId: string, conversationId: string) {
    const context = await this.repository.findConversationContext(conversationId);

    if (!context) {
      throw notFound("Conversation not found.");
    }

    await this.requireOrganizationAccess(userId, context.organizationId);
    return context;
  }

  private async requireOrganizationAccess(userId: string, organizationId: string) {
    if (!(await this.repository.userBelongsToOrganization(userId, organizationId))) {
      throw forbidden();
    }
  }
}

export class AttachmentService {
  constructor(private readonly repository: MessagingRepository) {}

  async addAttachment(userId: string, input: CreateAttachmentInput) {
    const parsed = createAttachmentSchema.parse(input);
    const context = await this.repository.findMessageContext(parsed.messageId);

    if (!context) {
      throw notFound("Message not found.");
    }

    if (!(await this.repository.userBelongsToOrganization(userId, context.organizationId))) {
      throw forbidden();
    }

    return this.repository.createAttachment({
      ...parsed,
      conversationId: context.conversationId
    });
  }
}
