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
  | "PROJECT"
  | "MESSAGE"
  | "TIMELINE_EVENT"
  | "ACTION_ITEM"
  | "AI_CLASSIFICATION"
  | "PHOTO_ANALYSIS"
  | "PROJECT_REPORT";
export type ProcessingJobType =
  | "SEARCH_INDEX"
  | "AI_CLASSIFICATION"
  | "VOICE_TRANSCRIPTION"
  | "PHOTO_ANALYSIS"
  | "REPORT_GENERATION"
  | "MEDIA_DOWNLOAD"
  | "PROJECT_COORDINATOR"
  | "WHATSAPP_DRAFT_SEND";
export type ProcessingJobStatus = "PENDING" | "RUNNING" | "FAILED" | "COMPLETED";
export type WorkerStatus = "ONLINE" | "OFFLINE" | "STARTING" | "STOPPING";
export type ProjectStateHealth = "HEALTHY" | "NEEDS_ATTENTION" | "CRITICAL" | "UNKNOWN";
export type RecommendationType =
  | "PROGRESS_UPDATE"
  | "FOLLOW_UP"
  | "INSPECTION"
  | "REPORT"
  | "RISK"
  | "MISSING_UPDATE"
  | "APPROVAL_REQUIRED"
  | "CLIENT_UPDATE"
  | "SUPPLIER_DELAY"
  | "GENERAL";
export type RecommendationStatus = "PENDING" | "APPROVED" | "DISMISSED" | "COMPLETED" | "FAILED";
export type RecommendationPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type RecommendationConfidence = "HIGH" | "MEDIUM" | "LOW";
export type RecommendationActionType =
  | "CREATE_ACTION_ITEM"
  | "SEND_WHATSAPP_MESSAGE_DRAFT"
  | "GENERATE_REPORT"
  | "SCHEDULE_INSPECTION_REMINDER"
  | "MARK_PROGRESS_REVIEWED"
  | "REQUEST_PROGRESS_UPDATE"
  | "REVIEW_EVIDENCE";
export type CoordinatorType = "PROGRESS" | "FOLLOW_UP" | "INSPECTION" | "REPORT" | "RUNTIME";
export type CoordinatorRunStatus = "STARTED" | "COMPLETED" | "FAILED" | "SKIPPED";
export type WhatsAppDraftStatus = "DRAFT" | "APPROVED" | "SENT" | "CANCELLED" | "FAILED";
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
  isDemo: boolean;
  name: string;
  role: MembershipRole;
  slug: string;
}

export interface TeamProjectReference {
  id: string;
  name: string;
}

export interface TeamMember {
  allProjects: boolean;
  createdAt: string;
  id: string;
  projects: TeamProjectReference[];
  role: MembershipRole;
  user: User;
}

export interface TeamInvitation {
  acceptedAt: string | null;
  createdAt: string;
  email: string;
  expiresAt: string;
  id: string;
  projects: TeamProjectReference[];
  role: MembershipRole;
  status: "ACCEPTED" | "EXPIRED" | "PENDING" | "REVOKED";
}

export interface PublicTeamInvitation {
  email: string;
  expiresAt: string;
  organization: { id: string; name: string };
  projects: TeamProjectReference[];
  role: MembershipRole;
  status: "ACCEPTED" | "EXPIRED" | "PENDING" | "REVOKED";
}

export interface Project {
  id: string;
  code: string;
  name: string;
  organizationId: string;
  status: ProjectStatus;
  timelineEvents?: ProjectTimelineEvent[];
  whatsAppMessages?: ProjectWhatsAppMessage[];
}

export interface ProjectTimelineEvent {
  id: string;
  organizationId: string;
  projectId: string | null;
  sourceType: "MESSAGE" | "ACTION_ITEM" | "REPORT" | "RECOMMENDATION" | "SYSTEM";
  sourceId: string;
  eventType: string;
  title: string;
  description: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface ProjectWhatsAppMessage extends Message {
  conversation: {
    id: string;
    title: string;
  };
}

export interface ProjectState {
  id: string;
  organizationId: string;
  projectId: string;
  health: ProjectStateHealth;
  completionPercent: number;
  lastActivityAt: string | null;
  lastWhatsAppUpdateAt: string | null;
  lastEvidenceAt: string | null;
  lastReportAt: string | null;
  openActionItemCount: number;
  urgentActionItemCount: number;
  highPriorityActionItemCount: number;
  recentProgressSummary: string | null;
  recentRiskSummary: string | null;
  recentEvidenceSummary: string | null;
  recentBlockerSummary: string | null;
  pendingDecisionSummary: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface Recommendation {
  id: string;
  organizationId: string;
  projectId: string;
  type: RecommendationType;
  title: string;
  description: string;
  reason: string;
  confidence: RecommendationConfidence;
  priority: RecommendationPriority;
  status: RecommendationStatus;
  sourceCoordinator: CoordinatorType;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  proposedActionType: RecommendationActionType;
  proposedActionPayload: unknown;
  approvedAt: string | null;
  approvedByUserId: string | null;
  dismissedAt: string | null;
  dismissedByUserId: string | null;
  dismissReason: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  project: ProjectReference;
  whatsAppDrafts?: WhatsAppDraft[];
}

export interface CoordinatorRun {
  id: string;
  organizationId: string;
  projectId: string;
  coordinatorType: CoordinatorType;
  status: CoordinatorRunStatus;
  startedAt: string;
  finishedAt: string | null;
  recommendationsCreated: number;
  error: string | null;
  metadata: unknown;
}

export interface WhatsAppDraft {
  id: string;
  organizationId: string;
  projectId: string;
  whatsappAccountId: string | null;
  conversationId: string | null;
  recommendationId: string | null;
  messageBody: string;
  status: WhatsAppDraftStatus;
  createdByUserId: string | null;
  approvedByUserId: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
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

export type IntelligenceSourceType =
  | "ACTION_ITEM"
  | "AI_CLASSIFICATION"
  | "EVIDENCE"
  | "MESSAGE"
  | "PHOTO_ANALYSIS"
  | "TIMELINE_EVENT"
  | "MILESTONE";

export interface IntelligenceSource {
  id: string;
  label: string;
  type: IntelligenceSourceType;
  href?: string;
}

export interface IntelligenceBullet {
  text: string;
  sources: IntelligenceSource[];
}

export interface IntelligenceRisk {
  confidence: "HIGH" | "MEDIUM" | "LOW";
  explanation: string;
  mitigation: string;
  sources: IntelligenceSource[];
  title: string;
}

export interface PendingDecision {
  category:
    | "APPROVAL_REQUIRED"
    | "CLIENT_FOLLOW_UP"
    | "HIGH_PRIORITY_ACTION_ITEM"
    | "INSPECTION_REVIEW"
    | "SUPPLIER_FOLLOW_UP";
  description: string;
  priority: ActionItemPriority;
  sources: IntelligenceSource[];
  title: string;
}

export interface MorningBrief {
  bullets: IntelligenceBullet[];
  generatedAt: string;
  title: string;
}

export interface DailySummary {
  actionItemsCreated: IntelligenceBullet[];
  approvalsReceived: IntelligenceBullet[];
  evidenceReceived: IntelligenceBullet[];
  inspectionsRequested: IntelligenceBullet[];
  issuesRaised: IntelligenceBullet[];
  timelineHighlights: IntelligenceBullet[];
  title: string;
  workCompleted: IntelligenceBullet[];
}

export interface WeeklyReport {
  appendix: {
    recentActionItems: IntelligenceBullet[];
    recentDocuments: IntelligenceBullet[];
    recentPhotos: IntelligenceBullet[];
  };
  completedWork: IntelligenceBullet[];
  executiveSummary: IntelligenceBullet[];
  generatedAt: string;
  openRisks: IntelligenceRisk[];
  outstandingDecisions: PendingDecision[];
  progressThisWeek: IntelligenceBullet[];
  project: {
    code: string;
    id: string;
    name: string;
    status: ProjectStatus;
  };
  recentEvidence: IntelligenceBullet[];
  title: string;
  upcomingWork: IntelligenceBullet[];
}

export interface ProjectReport {
  id: string;
  organizationId: string;
  projectId: string;
  type: "WEEKLY_PROGRESS";
  status: "PENDING" | "RUNNING" | "FAILED" | "COMPLETED";
  title: string;
  content: unknown;
  markdown: string | null;
  pdfStorageKey: string | null;
  pdfUrl?: string | null;
  contentHash: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  generatedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectIntelligence {
  dailySummary: DailySummary;
  morningBrief: MorningBrief;
  pendingDecisions: PendingDecision[];
  riskSummary: IntelligenceRisk[];
  weeklyReport: WeeklyReport;
}

export interface EvidenceView {
  id: string;
  actionItems: ActionItem[];
  conversation: {
    id: string;
    title: string;
  };
  createdAt: string;
  filename: string;
  message: {
    body: string | null;
    id: string;
    occurredAt: string;
  };
  mimeType: string;
  organizationId: string;
  photoAnalysis: PhotoAnalysis | null;
  project: ProjectReference | null;
  signedUrl: string;
  size: number;
  sourceWhatsAppMessage: {
    conversationTitle: string;
    messageId: string;
  };
  timelineEvents: Array<{
    id: string;
    title: string;
    description: string | null;
    occurredAt: string;
  }>;
  transcript: string | null;
  transcriptionStatus: VoiceTranscriptionStatus;
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
  sourceType: "MESSAGE" | "ACTION_ITEM" | "REPORT" | "RECOMMENDATION" | "SYSTEM";
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

export interface OnboardingStep {
  completed: boolean;
  href: string;
  key:
    | "CREATE_ORGANIZATION"
    | "CREATE_PROJECT"
    | "CONNECT_WHATSAPP"
    | "ACTIVATE_GROUP"
    | "SEND_UPDATE"
    | "OPEN_COMMAND_CENTER";
  label: string;
}

export interface OnboardingState {
  organizationId: string;
  isDemo: boolean;
  progress: number;
  steps: OnboardingStep[];
}

export type FeedbackType = "BUG" | "FEATURE" | "GENERAL";

export interface UserFeedback {
  id: string;
  organizationId: string;
  userId: string;
  type: FeedbackType;
  message: string;
  page: string | null;
  status: string;
  createdAt: string;
}

export interface UserNotification {
  id: string;
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
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
  coordinators: {
    approvalRate: number;
    failedRunsToday: number;
    lastRunPerProject: Array<{
      projectId: string;
      projectName: string;
      coordinatorType: CoordinatorType;
      status: string;
      startedAt: string;
    }>;
    pendingRecommendations: number;
    recommendationsCreatedToday: number;
    runsToday: number;
  };
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

async function apiTextRequest(path: string): Promise<string> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: "include"
  });

  if (!response.ok) {
    throw new DashboardApiError(`Request failed with status ${response.status}`, response.status);
  }

  return response.text();
}

async function apiBlobRequest(path: string): Promise<Blob> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: "include"
  });

  if (!response.ok) {
    throw new DashboardApiError(`Request failed with status ${response.status}`, response.status);
  }

  return response.blob();
}

export const api = {
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    apiRequest<{ ok: true }>("/auth/change-password", {
      body: JSON.stringify(body),
      method: "POST"
    }),
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
  forgotPassword: (body: { email: string }) =>
    apiRequest<{ message: string; ok: true; resetUrl?: string }>("/auth/forgot-password", {
      body: JSON.stringify(body),
      method: "POST"
    }),
  getDashboard: (organizationId: string) => {
    const params = new URLSearchParams({ organizationId });
    return apiRequest<{ dashboard: OperationsDashboard }>(`/dashboard?${params.toString()}`);
  },
  getOnboardingState: (organizationId: string) =>
    apiRequest<{ onboarding: OnboardingState }>(`/organizations/${organizationId}/onboarding`),
  resetDemoWorkspace: () =>
    apiRequest<{
      demo: {
        organization: Organization;
        projects: Project[];
        conversations: Conversation[];
      };
    }>("/demo/reset", {
      method: "POST"
    }),
  resetPassword: (body: { newPassword: string; token: string }) =>
    apiRequest<{ ok: true }>("/auth/reset-password", {
      body: JSON.stringify(body),
      method: "POST"
    }),
  submitFeedback: (body: {
    message: string;
    organizationId: string;
    page?: string;
    type: FeedbackType;
  }) =>
    apiRequest<{ feedback: UserFeedback }>("/feedback", {
      body: JSON.stringify(body),
      method: "POST"
    }),
  listNotifications: (organizationId: string) => {
    const params = new URLSearchParams({ organizationId });
    return apiRequest<{ notifications: UserNotification[] }>(`/notifications?${params.toString()}`);
  },
  markNotificationRead: (notificationId: string) =>
    apiRequest<{ notification: UserNotification }>(`/notifications/${notificationId}/read`, {
      method: "POST"
    }),
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
  getProjectState: (projectId: string) =>
    apiRequest<{ state: ProjectState }>(`/projects/${projectId}/state`),
  rebuildProjectState: (projectId: string) =>
    apiRequest<{ state: ProjectState }>(`/projects/${projectId}/state/rebuild`, {
      method: "POST"
    }),
  runProjectCoordinators: (projectId: string) =>
    apiRequest<{
      run: {
        projectState: ProjectState;
        results: Array<{ coordinatorType: CoordinatorType; recommendationsCreated: number }>;
      };
    }>(`/projects/${projectId}/coordinators/run`, {
      method: "POST"
    }),
  listProjectCoordinatorRuns: (projectId: string) =>
    apiRequest<{ runs: CoordinatorRun[] }>(`/projects/${projectId}/coordinators/runs`),
  listRecommendations: (organizationId: string, status: RecommendationStatus = "PENDING") => {
    const params = new URLSearchParams({ organizationId, status });
    return apiRequest<{ recommendations: Recommendation[] }>(
      `/recommendations?${params.toString()}`
    );
  },
  listProjectRecommendations: (projectId: string, status: RecommendationStatus = "PENDING") => {
    const params = new URLSearchParams({ status });
    return apiRequest<{ recommendations: Recommendation[] }>(
      `/projects/${projectId}/recommendations?${params.toString()}`
    );
  },
  getRecommendation: (recommendationId: string) =>
    apiRequest<{ recommendation: Recommendation }>(`/recommendations/${recommendationId}`),
  approveRecommendation: (recommendationId: string) =>
    apiRequest<{
      approval: {
        actionItemId?: string;
        draft?: WhatsAppDraft;
        recommendation: Recommendation;
        reportId?: string;
      };
    }>(`/recommendations/${recommendationId}/approve`, {
      method: "POST"
    }),
  dismissRecommendation: (recommendationId: string, dismissReason?: string) =>
    apiRequest<{ recommendation: Recommendation }>(`/recommendations/${recommendationId}/dismiss`, {
      body: JSON.stringify({ dismissReason: dismissReason ?? null }),
      method: "POST"
    }),
  completeRecommendation: (recommendationId: string) =>
    apiRequest<{ recommendation: Recommendation }>(
      `/recommendations/${recommendationId}/complete`,
      {
        method: "POST"
      }
    ),
  listWhatsAppDrafts: (organizationId: string, projectId?: string | null) => {
    const params = new URLSearchParams({ organizationId });

    if (projectId) {
      params.set("projectId", projectId);
    }

    return apiRequest<{ drafts: WhatsAppDraft[] }>(`/whatsapp/drafts?${params.toString()}`);
  },
  getWhatsAppDraft: (draftId: string) =>
    apiRequest<{ draft: WhatsAppDraft }>(`/whatsapp/drafts/${draftId}`),
  updateWhatsAppDraft: (draftId: string, body: { messageBody: string }) =>
    apiRequest<{ draft: WhatsAppDraft }>(`/whatsapp/drafts/${draftId}`, {
      body: JSON.stringify(body),
      method: "PATCH"
    }),
  sendWhatsAppDraft: (draftId: string) =>
    apiRequest<{
      result:
        | { draft: WhatsAppDraft; sent: true }
        | { draft: WhatsAppDraft; queued: true; sent: false }
        | { draft: WhatsAppDraft; sent: false; error: string };
    }>(`/whatsapp/drafts/${draftId}/send`, {
      method: "POST"
    }),
  cancelWhatsAppDraft: (draftId: string) =>
    apiRequest<{ draft: WhatsAppDraft }>(`/whatsapp/drafts/${draftId}/cancel`, {
      method: "POST"
    }),
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
  getEvidenceView: (evidenceId: string) =>
    apiRequest<{ evidence: EvidenceView }>(`/evidence/${evidenceId}/view`),
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
  getProjectIntelligence: (projectId: string) =>
    apiRequest<{ intelligence: ProjectIntelligence; latestReport: ProjectReport | null }>(
      `/projects/${projectId}/intelligence`
    ),
  getProjectMorningBrief: (projectId: string) =>
    apiRequest<{ morningBrief: MorningBrief }>(`/projects/${projectId}/morning-brief`),
  getProjectDailySummary: (projectId: string) =>
    apiRequest<{ dailySummary: DailySummary }>(`/projects/${projectId}/daily-summary`),
  getProjectWeeklyReport: (projectId: string) =>
    apiRequest<{ weeklyReport: WeeklyReport; latestReport: ProjectReport | null }>(
      `/projects/${projectId}/weekly-report`
    ),
  getProjectRiskSummary: (projectId: string) =>
    apiRequest<{ risks: IntelligenceRisk[] }>(`/projects/${projectId}/risks`),
  getProjectPendingDecisions: (projectId: string) =>
    apiRequest<{ pendingDecisions: PendingDecision[] }>(`/projects/${projectId}/pending-decisions`),
  generateProjectReport: (projectId: string) =>
    apiRequest<{ report: ProjectReport }>(`/projects/${projectId}/reports/generate`, {
      body: JSON.stringify({ type: "WEEKLY_PROGRESS" }),
      method: "POST"
    }),
  exportProjectWeeklyReportMarkdown: (projectId: string) =>
    apiTextRequest(`/projects/${projectId}/weekly-report?format=markdown`),
  exportProjectWeeklyReportPdf: (projectId: string) =>
    apiBlobRequest(`/projects/${projectId}/weekly-report?format=pdf`),
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
  getInvitation: (token: string) =>
    apiRequest<{ invitation: PublicTeamInvitation }>(`/invitations/${encodeURIComponent(token)}`),
  acceptInvitation: (token: string) =>
    apiRequest<{ ok: true }>(`/invitations/${encodeURIComponent(token)}/accept`, {
      method: "POST"
    }),
  listTeam: (organizationId: string) =>
    apiRequest<{ invitations: TeamInvitation[]; members: TeamMember[] }>(
      `/organizations/${organizationId}/team`
    ),
  inviteTeamMember: (
    organizationId: string,
    body: { email: string; projectIds: string[]; role: "ADMIN" | "MEMBER" | "VIEWER" }
  ) =>
    apiRequest<{
      deliveryStatus: "FAILED" | "NOT_CONFIGURED" | "SENT";
      invitationId: string;
      invitationUrl: string;
    }>(`/organizations/${organizationId}/invitations`, {
      body: JSON.stringify(body),
      method: "POST"
    }),
  resendTeamInvitation: (organizationId: string, invitationId: string) =>
    apiRequest<{
      deliveryStatus: "FAILED" | "NOT_CONFIGURED" | "SENT";
      invitationId: string;
      invitationUrl: string;
    }>(`/organizations/${organizationId}/invitations/${invitationId}/resend`, {
      method: "POST"
    }),
  revokeTeamInvitation: (organizationId: string, invitationId: string) =>
    apiRequest<{ ok: true }>(`/organizations/${organizationId}/invitations/${invitationId}`, {
      method: "DELETE"
    }),
  updateTeamMember: (
    organizationId: string,
    membershipId: string,
    body: { projectIds: string[]; role: "ADMIN" | "MEMBER" | "VIEWER" }
  ) =>
    apiRequest<{ ok: true }>(`/organizations/${organizationId}/members/${membershipId}`, {
      body: JSON.stringify(body),
      method: "PATCH"
    }),
  removeTeamMember: (organizationId: string, membershipId: string) =>
    apiRequest<{ ok: true }>(`/organizations/${organizationId}/members/${membershipId}`, {
      method: "DELETE"
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
