import type {
  Attachment,
  Channel,
  MessageProcessingStatus,
  MessageType,
  PrismaClient,
  ProjectStatus,
  VoiceTranscriptionStatus
} from "@prisma/client";

export interface EvidenceAttachmentMetadata {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  createdAt: Date;
}

export interface EvidenceVoiceNoteMetadata extends EvidenceAttachmentMetadata {
  transcript: string | null;
  transcriptionStatus: VoiceTranscriptionStatus;
  transcriptionError: string | null;
}

export interface EvidenceSummary {
  attachmentCount: number;
  documentCount: number;
  labels: string[];
  pdfCount: number;
  photoCount: number;
  videoCount: number;
  voiceNoteCount: number;
}

export interface UnifiedEvidenceContext {
  project: {
    code: string;
    id: string;
    name: string;
    status: ProjectStatus;
  } | null;
  conversation: {
    channel: Channel;
    id: string;
    isGroup: boolean;
    title: string;
  };
  sender: {
    displayName: string;
    externalIdentifier: string;
    id: string;
  };
  timestamp: Date;
  organizationId: string;
  messageId: string;
  messageText: string | null;
  messageType: MessageType;
  processingStatus: MessageProcessingStatus;
  externalMessageId: string | null;
  voiceTranscript: string | null;
  attachedPhotos: EvidenceAttachmentMetadata[];
  attachedDocuments: EvidenceAttachmentMetadata[];
  attachedVoiceNotes: EvidenceVoiceNoteMetadata[];
  attachedVideos: EvidenceAttachmentMetadata[];
  evidenceSummary: EvidenceSummary;
  messageMetadata: {
    attachmentCount: number;
    hasTranscript: boolean;
    transcriptionFailed: boolean;
    transcriptionPending: boolean;
  };
}

export async function buildUnifiedEvidenceContext(
  prisma: PrismaClient,
  messageId: string
): Promise<UnifiedEvidenceContext | null> {
  const message = await prisma.message.findUnique({
    include: {
      attachments: {
        orderBy: {
          createdAt: "asc"
        }
      },
      conversation: {
        include: {
          project: {
            select: {
              code: true,
              id: true,
              name: true,
              status: true
            }
          }
        }
      },
      senderParticipant: {
        select: {
          displayName: true,
          externalIdentifier: true,
          id: true
        }
      }
    },
    where: {
      id: messageId
    }
  });

  if (!message) {
    return null;
  }

  const attachedPhotos = message.attachments.filter(isPhotoAttachment).map(toEvidenceAttachment);
  const attachedDocuments = message.attachments
    .filter(isDocumentAttachment)
    .map(toEvidenceAttachment);
  const attachedVoiceNotes = message.attachments
    .filter((attachment) => isVoiceAttachment(attachment, message.type))
    .map(toVoiceEvidenceAttachment);
  const attachedVideos = message.attachments.filter(isVideoAttachment).map(toEvidenceAttachment);
  const transcripts = attachedVoiceNotes
    .map((attachment) => attachment.transcript?.trim())
    .filter((transcript): transcript is string => Boolean(transcript));
  const evidenceSummary = buildEvidenceSummary({
    attachedDocuments,
    attachedPhotos,
    attachedVideos,
    attachedVoiceNotes
  });
  const transcriptionPending = attachedVoiceNotes.some(
    (attachment) => attachment.transcriptionStatus === "PENDING"
  );
  const transcriptionFailed = attachedVoiceNotes.some(
    (attachment) => attachment.transcriptionStatus === "FAILED"
  );

  return {
    attachedDocuments,
    attachedPhotos,
    attachedVideos,
    attachedVoiceNotes,
    conversation: {
      channel: message.conversation.channel,
      id: message.conversation.id,
      isGroup: message.conversation.isGroup,
      title: message.conversation.title
    },
    evidenceSummary,
    externalMessageId: message.externalMessageId,
    messageId: message.id,
    messageMetadata: {
      attachmentCount: message.attachments.length,
      hasTranscript: transcripts.length > 0,
      transcriptionFailed,
      transcriptionPending
    },
    messageText: message.body,
    messageType: message.type,
    organizationId: message.conversation.organizationId,
    processingStatus: message.processingStatus,
    project: message.conversation.project,
    sender: message.senderParticipant,
    timestamp: message.occurredAt,
    voiceTranscript: transcripts.length > 0 ? transcripts.join("\n\n") : null
  };
}

export function buildEvidenceSummary(input: {
  attachedDocuments: EvidenceAttachmentMetadata[];
  attachedPhotos: EvidenceAttachmentMetadata[];
  attachedVideos: EvidenceAttachmentMetadata[];
  attachedVoiceNotes: EvidenceVoiceNoteMetadata[];
}): EvidenceSummary {
  const pdfCount = input.attachedDocuments.filter(isPdfMetadata).length;
  const documentCount = input.attachedDocuments.length;
  const labels = [
    formatEvidenceLabel(input.attachedPhotos.length, "Photo", "Photos"),
    formatEvidenceLabel(input.attachedVoiceNotes.length, "Voice Note", "Voice Notes"),
    formatEvidenceLabel(pdfCount, "PDF", "PDFs"),
    formatEvidenceLabel(documentCount - pdfCount, "Document", "Documents"),
    formatEvidenceLabel(input.attachedVideos.length, "Video", "Videos")
  ].filter((label): label is string => Boolean(label));

  return {
    attachmentCount:
      input.attachedPhotos.length +
      input.attachedVoiceNotes.length +
      input.attachedDocuments.length +
      input.attachedVideos.length,
    documentCount,
    labels,
    pdfCount,
    photoCount: input.attachedPhotos.length,
    videoCount: input.attachedVideos.length,
    voiceNoteCount: input.attachedVoiceNotes.length
  };
}

export function formatEvidenceSummary(summary: EvidenceSummary): string {
  return summary.labels.length > 0 ? summary.labels.join(" · ") : "No evidence attachments";
}

function toEvidenceAttachment(attachment: Attachment): EvidenceAttachmentMetadata {
  return {
    createdAt: attachment.createdAt,
    filename: attachment.filename,
    id: attachment.id,
    mimeType: attachment.mimeType,
    size: attachment.size,
    storageKey: attachment.storageKey
  };
}

function toVoiceEvidenceAttachment(attachment: Attachment): EvidenceVoiceNoteMetadata {
  return {
    ...toEvidenceAttachment(attachment),
    transcript: attachment.transcript,
    transcriptionError: attachment.transcriptionError,
    transcriptionStatus: attachment.transcriptionStatus
  };
}

function isPhotoAttachment(attachment: Pick<Attachment, "mimeType">): boolean {
  return attachment.mimeType.toLowerCase().startsWith("image/");
}

function isDocumentAttachment(attachment: Pick<Attachment, "filename" | "mimeType">): boolean {
  const mimeType = attachment.mimeType.toLowerCase();
  return (
    mimeType === "application/pdf" ||
    mimeType.startsWith("application/") ||
    mimeType.startsWith("text/") ||
    attachment.filename.toLowerCase().endsWith(".pdf")
  );
}

function isVoiceAttachment(
  attachment: Pick<Attachment, "mimeType">,
  messageType: MessageType
): boolean {
  const mimeType = attachment.mimeType.toLowerCase();
  return (
    mimeType.startsWith("audio/") ||
    (messageType === "VOICE" && mimeType === "application/octet-stream")
  );
}

function isVideoAttachment(attachment: Pick<Attachment, "mimeType">): boolean {
  return attachment.mimeType.toLowerCase().startsWith("video/");
}

function isPdfMetadata(attachment: Pick<EvidenceAttachmentMetadata, "filename" | "mimeType">) {
  return (
    attachment.mimeType.toLowerCase() === "application/pdf" ||
    attachment.filename.toLowerCase().endsWith(".pdf")
  );
}

function formatEvidenceLabel(count: number, singular: string, plural: string): string | null {
  if (count <= 0) {
    return null;
  }

  return `${count} ${count === 1 ? singular : plural}`;
}
