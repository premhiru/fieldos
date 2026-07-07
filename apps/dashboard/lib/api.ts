export type MembershipRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export type ProjectStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
export type Channel = "WHATSAPP" | "EMAIL" | "SLACK" | "TEAMS" | "SMS";
export type MessageDirection = "INBOUND" | "OUTBOUND";
export type MessageType = "TEXT" | "IMAGE" | "DOCUMENT" | "VOICE" | "VIDEO" | "SYSTEM";
export type AIMessageCategory =
  | "PROGRESS_UPDATE"
  | "DEFECT"
  | "DELAY"
  | "SAFETY_ISSUE"
  | "DELIVERY"
  | "INSPECTION_REQUEST"
  | "CLIENT_APPROVAL"
  | "VARIATION_ORDER"
  | "RFI"
  | "MATERIAL_ISSUE"
  | "MANPOWER_ISSUE"
  | "GENERAL_NOTE"
  | "UNKNOWN";
export type AIClassificationStatus = "PENDING" | "COMPLETED" | "FAILED" | "NEEDS_REVIEW";
export type ActionItemStatus = "PENDING" | "ACCEPTED" | "COMPLETED" | "IGNORED" | "CONVERTED";
export type ActionItemType = "FOLLOW_UP" | "PROJECT_SUGGESTION";
export type ActionItemPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type MilestoneStatus = "UPCOMING" | "DUE_SOON" | "OVERDUE" | "COMPLETED";
export type DashboardHealth = "HEALTHY" | "NEEDS_ATTENTION" | "CRITICAL";
export type SearchSourceType =
  "PROJECT" | "MESSAGE" | "TIMELINE_EVENT" | "ACTION_ITEM" | "AI_CLASSIFICATION" | "PHOTO_ANALYSIS";
export type ProcessingJobType =
  | "SEARCH_INDEX"
  | "AI_CLASSIFICATION"
  | "VOICE_TRANSCRIPTION"
  | "PHOTO_ANALYSIS"
  | "MEDIA_DOWNLOAD";
export type ProcessingJobStatus = "PENDING" | "RUNNING" | "FAILED" | "COMPLETED";
export type WorkerStatus = "ONLINE" | "OFFLINE" | "STARTING" | "STOPPING";
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

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Organization {
  id: string;
  name: string;
  role: MembershipRole;
  slug: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  organizationId: string;
  status: ProjectStatus;
}

export interface ProjectReference {
  id: string;
  code: string;
  name: string;
}

export interface Conversation {
  id: string;
  organizationId: string;
  projectId: string | null;
  externalId: string;
  channel: Channel;
  title: string;
  isGroup: boolean;
  lastMessageAt: string | null;
  lastMessageBody: string | null;
  project: ProjectReference | null;
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  id: string;
  conversationId: string;
  displayName: string;
  externalIdentifier: string;
  role: string;
  createdAt: string;
}

export interface Attachment {
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
  photoAnalysis?: PhotoAnalysisSummary | null;
  createdAt: string;
}

export interface PhotoAnalysisSummary {
  id: string;
  summary: string;
  detectedObjects: string[];
  possibleIssues: string[];
  confidence: number;
  tags: string[];
  createdAt: string;
}

export interface PhotoAnalysis extends PhotoAnalysisSummary {
  evidenceId: string;
  organizationId: string;
  projectId: string | null;
  conversationId: string;
  messageId: string;
  provider: string;
  evidence: {
    filename: string;
    mimeType: string;
    storageKey: string;
  };
  message: {
    id: string;
    body: string | null;
    occurredAt: string;
    conversation: {
      id: string;
      title: string;
    };
  };
  project: ProjectReference | null;
}

export interface PhotoAnalysisPage {
  analyses: PhotoAnalysis[];
  nextCursor: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderParticipantId: string;
  senderParticipant: Participant;
  direction: MessageDirection;
  type: MessageType;
  body: string | null;
  externalMessageId: string | null;
  processingStatus: MessageProcessingStatus;
  occurredAt: string;
  createdAt: string;
  attachments: Attachment[];
}

export interface EvidenceAttachmentMetadata {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  createdAt: string;
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
  project: ProjectReference | null;
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
  timestamp: string;
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

export interface AIMessageClassification {
  id: string;
  organizationId: string;
  projectId: string | null;
  messageId: string;
  category: AIMessageCategory | null;
  summary: string | null;
  location: string | null;
  actionRequired: boolean;
  confidence: number | null;
  reasoningSummary: string | null;
  status: AIClassificationStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  message?: {
    id: string;
    body: string | null;
    occurredAt: string;
    conversation: {
      id: string;
      title: string;
    };
  };
}

export interface ActionItem {
  id: string;
  organizationId: string;
  projectId: string | null;
  messageId: string;
  classificationId: string | null;
  suggestedProjectId: string | null;
  type: ActionItemType;
  priority: ActionItemPriority;
  title: string;
  description: string | null;
  confidence: number | null;
  status: ActionItemStatus;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  acceptedByUserId: string | null;
  assignedToUserId: string | null;
  completedAt: string | null;
  ignoredAt: string | null;
  ignoredByUserId: string | null;
  message?: {
    id: string;
    body: string | null;
    occurredAt: string;
    conversation: {
      id: string;
      title: string;
    };
  };
  suggestedProject?: ProjectReference | null;
  project?: ProjectReference | null;
}

export interface DashboardSummary {
  activeProjects: number;
  healthyProjects: number;
  projectsNeedingAttention: number;
  criticalProjects: number;
  openActionItems: number;
  highPriorityActionItems: number;
  todaysActivityCount: number;
  pendingAIReviews: number;
}

export interface DashboardProject {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  health: DashboardHealth;
  lastActivityAt: string | null;
  highestPriorityIssue: string | null;
  openActionItemCount: number;
  rankScore: number;
}

export interface DashboardActionItemGroups {
  urgent: ActionItem[];
  high: ActionItem[];
  medium: ActionItem[];
  low: ActionItem[];
}

export interface DashboardRecentActivity {
  conversationId: string | null;
  description: string | null;
  id: string;
  projectId: string;
  projectName: string;
  sourceId: string;
  sourceType: "MESSAGE" | "ACTION_ITEM" | "REPORT" | "SYSTEM";
  eventType: string;
  icon: string;
  title: string;
  occurredAt: string;
}

export interface Milestone {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  dueDate: string;
  status: MilestoneStatus;
  createdAt: string;
  updatedAt: string;
  project: ProjectReference;
}

export interface DashboardBrief {
  bullets: string[];
  generatedBy: "AI" | "FALLBACK";
}

export interface OperationsDashboard {
  summary: DashboardSummary;
  projects: DashboardProject[];
  actionItems: DashboardActionItemGroups;
  recentActivity: DashboardRecentActivity[];
  milestones: Milestone[];
  brief: DashboardBrief;
}

export interface SearchResult {
  id: string;
  organizationId: string;
  projectId: string | null;
  sourceType: SearchSourceType;
  sourceId: string;
  title: string;
  snippet: string;
  metadata: unknown;
  occurredAt: string | null;
  createdAt: string;
  updatedAt: string;
  project: ProjectReference | null;
}

export interface SearchResponse {
  results: SearchResult[];
  nextCursor: string | null;
}

export interface SearchAnswerSource {
  sourceType: SearchSourceType;
  sourceId: string;
  title: string;
  snippet: string;
  occurredAt: string | null;
  projectName: string | null;
}

export interface SearchAnswer {
  answer: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  sources: SearchAnswerSource[];
}

export interface ProcessingJob {
  id: string;
  organizationId: string;
  projectId: string | null;
  type: ProcessingJobType;
  status: ProcessingJobStatus;
  sourceType: string;
  sourceId: string;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  correlationId: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerHeartbeat {
  id: string;
  workerName: string;
  version: string;
  status: WorkerStatus;
  lastHeartbeatAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobMetrics {
  completedToday: number;
  failed: number;
  pending: number;
  running: number;
  type: ProcessingJobType;
}

export interface AdminOperations {
  ai: {
    averageProcessingTimeMs: number | null;
    failuresToday: number;
    jobsPending: number;
  };
  jobSummary: JobMetrics[];
  media: {
    failedDownloads: number;
    pendingDownloads: number;
    pendingPhotoAnalyses: number;
    pendingTranscriptions: number;
  };
  search: {
    completedToday: number;
    pendingIndexJobs: number;
  };
  whatsApp: {
    connectedAccounts: number;
    disconnectedAccounts: number;
    failedConnections: number;
    qrPending: number;
  };
  workers: WorkerHeartbeat[];
}

export type WhatsAppConnectorType = "BAILEYS" | "META_CLOUD";
export type WhatsAppAccountStatus =
  "PENDING_QR" | "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR";
export type WhatsAppChatMappingStatus = "DISCOVERED" | "ACTIVE" | "IGNORED" | "ARCHIVED";

export interface WhatsAppAccount {
  id: string;
  organizationId: string;
  displayName: string;
  phoneNumber: string | null;
  connectorType: WhatsAppConnectorType;
  status: WhatsAppAccountStatus;
  sessionKey: string;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppChatMapping {
  id: string;
  organizationId: string;
  whatsappAccountId: string;
  conversationId: string | null;
  projectId: string | null;
  jid: string;
  chatName: string | null;
  isGroup: boolean;
  status: WhatsAppChatMappingStatus;
  activatedAt: string | null;
  activatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  project: ProjectReference | null;
  conversation: {
    id: string;
    title: string;
    projectId: string | null;
  } | null;
}

class DashboardApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "DashboardApiError";
  }
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function apiRequest<TResponse>(
  path: string,
  options: RequestInit = {}
): Promise<TResponse> {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: "include",
    headers,
    ...options
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    if (typeof data === "object" && data !== null && "error" in data) {
      const error = data.error;

      if (typeof error === "string") {
        message = error;
      } else if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string"
      ) {
        message = error.message;
      }
    }

    throw new DashboardApiError(message, response.status);
  }

  return data as TResponse;
}

export const api = {
  createOrganization: (body: { name: string; slug: string }) =>
    apiRequest<{ organization: Organization }>("/organizations", {
      body: JSON.stringify(body),
      method: "POST"
    }),
  createProject: (
    organizationId: string,
    body: { code: string; name: string; status: ProjectStatus }
  ) =>
    apiRequest<{ project: Project }>(`/organizations/${organizationId}/projects`, {
      body: JSON.stringify(body),
      method: "POST"
    }),
  getConversation: (conversationId: string) =>
    apiRequest<{ conversation: Conversation }>(`/conversations/${conversationId}`),
  getMe: () => apiRequest<{ user: User }>("/auth/me"),
  getDashboard: (organizationId: string) => {
    const params = new URLSearchParams({ organizationId });
    return apiRequest<{ dashboard: OperationsDashboard }>(`/dashboard?${params.toString()}`);
  },
  getAdminOperations: (organizationId: string) => {
    const params = new URLSearchParams({ organizationId });
    return apiRequest<{ operations: AdminOperations }>(`/admin/operations?${params.toString()}`);
  },
  listAdminJobs: (organizationId: string) => {
    const params = new URLSearchParams({ organizationId });
    return apiRequest<{ jobs: ProcessingJob[] }>(`/admin/jobs?${params.toString()}`);
  },
  retryAdminJob: (jobId: string) =>
    apiRequest<{ job: ProcessingJob }>(`/admin/jobs/${jobId}/retry`, {
      method: "POST"
    }),
  retryFailedAdminJobs: (organizationId: string) => {
    const params = new URLSearchParams({ organizationId });
    return apiRequest<{ retried: number }>(`/admin/jobs/retry-failed?${params.toString()}`, {
      method: "POST"
    });
  },
  getProject: (projectId: string) => apiRequest<{ project: Project }>(`/projects/${projectId}`),
  getMessageClassification: (messageId: string) =>
    apiRequest<{ classification: AIMessageClassification | null }>(
      `/messages/${messageId}/classification`
    ),
  getMessageContext: (messageId: string) =>
    apiRequest<{ context: UnifiedEvidenceContext | null }>(`/messages/${messageId}/context`),
  getMessageEvidenceSummary: (messageId: string) =>
    apiRequest<{ evidenceSummary: EvidenceSummary | null }>(
      `/messages/${messageId}/evidence-summary`
    ),
  getPhotoAnalysis: (photoAnalysisId: string) =>
    apiRequest<{ analysis: PhotoAnalysis }>(`/photo-analysis/${photoAnalysisId}`),
  getEvidencePhotoAnalysis: (evidenceId: string) =>
    apiRequest<{ analysis: PhotoAnalysis }>(`/evidence/${evidenceId}/photo-analysis`),
  getWhatsAppQr: (accountId: string) =>
    apiRequest<{ qr: string | null; status: WhatsAppAccountStatus }>(
      `/whatsapp/accounts/${accountId}/qr`
    ),
  listConversationMessages: (conversationId: string) =>
    apiRequest<{ messages: Message[] }>(`/conversations/${conversationId}/messages`),
  listConversations: (organizationId: string, search = "") => {
    const params = new URLSearchParams({ organizationId });

    if (search.trim()) {
      params.set("search", search.trim());
    }

    return apiRequest<{ conversations: Conversation[] }>(`/conversations?${params.toString()}`);
  },
  listOrganizations: () => apiRequest<{ organizations: Organization[] }>("/organizations"),
  search: (input: {
    cursor?: string | null;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    organizationId: string;
    projectId?: string | null;
    q: string;
    type?: SearchSourceType | "";
  }) => {
    const params = new URLSearchParams({
      limit: String(input.limit ?? 10),
      organizationId: input.organizationId,
      q: input.q
    });

    if (input.cursor) {
      params.set("cursor", input.cursor);
    }

    if (input.projectId) {
      params.set("projectId", input.projectId);
    }

    if (input.type) {
      params.set("type", input.type);
    }

    if (input.dateFrom) {
      params.set("dateFrom", input.dateFrom);
    }

    if (input.dateTo) {
      params.set("dateTo", input.dateTo);
    }

    return apiRequest<SearchResponse>(`/search?${params.toString()}`);
  },
  askSearch: (body: { organizationId: string; projectId?: string | null; question: string }) =>
    apiRequest<SearchAnswer>("/search/ask", {
      body: JSON.stringify(body),
      method: "POST"
    }),
  askProjectSearch: (projectId: string, body: { question: string }) =>
    apiRequest<SearchAnswer>(`/projects/${projectId}/search/ask`, {
      body: JSON.stringify(body),
      method: "POST"
    }),
  listProjects: (organizationId: string) =>
    apiRequest<{ projects: Project[] }>(`/organizations/${organizationId}/projects`),
  listProjectAIClassifications: (projectId: string) =>
    apiRequest<{ classifications: AIMessageClassification[] }>(
      `/projects/${projectId}/ai-classifications`
    ),
  listProjectPhotoAnalysis: (
    projectId: string,
    input: { cursor?: string | null; limit?: number } = {}
  ) => {
    const params = new URLSearchParams({
      limit: String(input.limit ?? 20)
    });

    if (input.cursor) {
      params.set("cursor", input.cursor);
    }

    return apiRequest<PhotoAnalysisPage>(
      `/projects/${projectId}/photo-analysis?${params.toString()}`
    );
  },
  listProjectActionItems: (projectId: string) =>
    apiRequest<{ actionItems: ActionItem[] }>(`/projects/${projectId}/action-items`),
  listWhatsAppAccounts: (organizationId: string) => {
    const params = new URLSearchParams({ organizationId });
    return apiRequest<{ accounts: WhatsAppAccount[] }>(`/whatsapp/accounts?${params.toString()}`);
  },
  listWhatsAppChats: (accountId: string) =>
    apiRequest<{ chats: WhatsAppChatMapping[] }>(`/whatsapp/accounts/${accountId}/chats`),
  login: (body: { email: string; password: string }) =>
    apiRequest<{ user: User }>("/auth/login", {
      body: JSON.stringify(body),
      method: "POST"
    }),
  logout: () =>
    apiRequest<{ ok: true }>("/auth/logout", {
      method: "POST"
    }),
  connectWhatsAppAccount: (accountId: string) =>
    apiRequest<{ account: WhatsAppAccount }>(`/whatsapp/accounts/${accountId}/connect`, {
      method: "POST"
    }),
  createWhatsAppAccount: (body: { displayName: string; organizationId: string }) =>
    apiRequest<{ account: WhatsAppAccount }>("/whatsapp/accounts", {
      body: JSON.stringify(body),
      method: "POST"
    }),
  disconnectWhatsAppAccount: (accountId: string) =>
    apiRequest<{ account: WhatsAppAccount }>(`/whatsapp/accounts/${accountId}/disconnect`, {
      method: "POST"
    }),
  signup: (body: { email: string; name: string; password: string }) =>
    apiRequest<{ user: User }>("/auth/signup", {
      body: JSON.stringify(body),
      method: "POST"
    }),
  classifyMessage: (messageId: string) =>
    apiRequest<{ classification: AIMessageClassification | null }>(
      `/messages/${messageId}/classify`,
      {
        method: "POST"
      }
    ),
  acceptActionItem: (actionItemId: string) =>
    apiRequest<{ actionItem: ActionItem }>(`/action-items/${actionItemId}/accept`, {
      method: "POST"
    }),
  completeActionItem: (actionItemId: string) =>
    apiRequest<{ actionItem: ActionItem }>(`/action-items/${actionItemId}/complete`, {
      method: "POST"
    }),
  updateWhatsAppChatMapping: (mappingId: string, body: { projectId: string | null }) =>
    apiRequest<{ chat: WhatsAppChatMapping }>(`/whatsapp/chat-mappings/${mappingId}`, {
      body: JSON.stringify(body),
      method: "PATCH"
    }),
  activateWhatsAppChatMapping: (mappingId: string, body: { projectId: string }) =>
    apiRequest<{ chat: WhatsAppChatMapping }>(`/whatsapp/chat-mappings/${mappingId}/activate`, {
      body: JSON.stringify(body),
      method: "POST"
    }),
  archiveWhatsAppChatMapping: (mappingId: string) =>
    apiRequest<{ chat: WhatsAppChatMapping }>(`/whatsapp/chat-mappings/${mappingId}/archive`, {
      method: "POST"
    }),
  ignoreWhatsAppChatMapping: (mappingId: string) =>
    apiRequest<{ chat: WhatsAppChatMapping }>(`/whatsapp/chat-mappings/${mappingId}/ignore`, {
      method: "POST"
    }),
  ignoreActionItem: (actionItemId: string) =>
    apiRequest<{ actionItem: ActionItem }>(`/action-items/${actionItemId}/ignore`, {
      method: "POST"
    })
};
