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
} from "./types.js";

export interface MessagingRepository {
  addParticipant(input: CreateParticipantInput): Promise<ParticipantRecord>;
  createAttachment(
    input: CreateAttachmentInput & { conversationId: string }
  ): Promise<AttachmentRecord>;
  createConversation(input: Required<CreateConversationInput>): Promise<ConversationRecord>;
  createMessage(input: CreateMessageInput): Promise<MessageRecord>;
  deleteMessage(messageId: string): Promise<boolean>;
  findConversationContext(conversationId: string): Promise<ConversationContext | null>;
  findMessageContext(messageId: string): Promise<MessageContext | null>;
  findParticipant(participantId: string): Promise<ParticipantRecord | null>;
  getConversation(conversationId: string): Promise<ConversationRecord | null>;
  listConversations(input: {
    organizationId: string;
    search?: string;
    userId: string;
  }): Promise<ConversationRecord[]>;
  listMessages(conversationId: string): Promise<MessageRecord[]>;
  projectBelongsToOrganization(projectId: string, organizationId: string): Promise<boolean>;
  userBelongsToOrganization(userId: string, organizationId: string): Promise<boolean>;
  userCanAccessProject(userId: string, projectId: string): Promise<boolean>;
}
