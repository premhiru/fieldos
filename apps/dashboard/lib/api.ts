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
export type ActionItemStatus = "PENDING" | "ACCEPTED" | "IGNORED" | "CONVERTED";
export type ActionItemType = "FOLLOW_UP" | "PROJECT_SUGGESTION";

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
  createdAt: string;
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
  occurredAt: string;
  createdAt: string;
  attachments: Attachment[];
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
  title: string;
  description: string | null;
  confidence: number | null;
  status: ActionItemStatus;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  acceptedByUserId: string | null;
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
  getProject: (projectId: string) => apiRequest<{ project: Project }>(`/projects/${projectId}`),
  getMessageClassification: (messageId: string) =>
    apiRequest<{ classification: AIMessageClassification | null }>(
      `/messages/${messageId}/classification`
    ),
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
  listProjects: (organizationId: string) =>
    apiRequest<{ projects: Project[] }>(`/organizations/${organizationId}/projects`),
  listProjectAIClassifications: (projectId: string) =>
    apiRequest<{ classifications: AIMessageClassification[] }>(
      `/projects/${projectId}/ai-classifications`
    ),
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
