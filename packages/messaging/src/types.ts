export type Channel = "WHATSAPP" | "EMAIL" | "SLACK" | "TEAMS" | "SMS";

export type MessageDirection = "INBOUND" | "OUTBOUND";

export type MessageType = "TEXT" | "IMAGE" | "DOCUMENT" | "VOICE" | "VIDEO" | "SYSTEM";

export type MessageProcessingStatus =
  | "RECEIVED"
  | "MEDIA_PENDING"
  | "MEDIA_COMPLETE"
  | "TRANSCRIPTION_PENDING"
  | "TRANSCRIPTION_COMPLETE"
  | "SEARCH_PENDING"
  | "SEARCH_COMPLETE"
  | "AI_PENDING"
  | "AI_COMPLETE"
  | "FAILED";

export type VoiceTranscriptionStatus = "NOT_REQUIRED" | "PENDING" | "COMPLETED" | "FAILED";

export interface PhotoAnalysisSummaryRecord {
  id: string;
  summary: string;
  detectedObjects: string[];
  possibleIssues: string[];
  confidence: number;
  tags: string[];
  createdAt: Date;
}

export interface ProjectReference {
  id: string;
  code: string;
  name: string;
}

export interface ConversationRecord {
  id: string;
  organizationId: string;
  projectId: string | null;
  externalId: string;
  channel: Channel;
  title: string;
  isGroup: boolean;
  lastMessageAt: Date | null;
  lastMessageBody: string | null;
  project: ProjectReference | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParticipantRecord {
  id: string;
  conversationId: string;
  displayName: string;
  externalIdentifier: string;
  role: string;
  createdAt: Date;
}

export interface AttachmentRecord {
  id: string;
  messageId: string;
  conversationId: string;
  filename: string;
  mimeType: string;
  storageKey: string;
  size: number;
  transcript: string | null;
  transcriptionStatus: VoiceTranscriptionStatus;
  transcriptionError: string | null;
  photoAnalysis?: PhotoAnalysisSummaryRecord | null;
  createdAt: Date;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderParticipantId: string;
  senderParticipant: ParticipantRecord;
  direction: MessageDirection;
  type: MessageType;
  body: string | null;
  externalMessageId: string | null;
  processingStatus: MessageProcessingStatus;
  occurredAt: Date;
  createdAt: Date;
  attachments: AttachmentRecord[];
}

export interface ConversationContext {
  id: string;
  organizationId: string;
}

export interface MessageContext {
  id: string;
  conversationId: string;
  organizationId: string;
}

export interface CreateConversationInput {
  organizationId: string;
  projectId?: string | null;
  externalId: string;
  channel: Channel;
  title: string;
  isGroup?: boolean;
  lastMessageAt?: Date | null;
}

export interface CreateParticipantInput {
  conversationId: string;
  displayName: string;
  externalIdentifier: string;
  role: string;
}

export interface CreateMessageInput {
  conversationId: string;
  senderParticipantId: string;
  direction: MessageDirection;
  type: MessageType;
  body?: string | null;
  externalMessageId?: string | null;
  occurredAt: Date;
}

export interface CreateAttachmentInput {
  messageId: string;
  filename: string;
  mimeType: string;
  storageKey: string;
  size: number;
}
