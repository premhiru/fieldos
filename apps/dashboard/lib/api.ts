export type MembershipRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export type ProjectStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
export type Channel = "WHATSAPP" | "EMAIL" | "SLACK" | "TEAMS" | "SMS";
export type MessageDirection = "INBOUND" | "OUTBOUND";
export type MessageType = "TEXT" | "IMAGE" | "DOCUMENT" | "VOICE" | "VIDEO" | "SYSTEM";

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
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? String(data.error)
        : `Request failed with status ${response.status}`;

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
  login: (body: { email: string; password: string }) =>
    apiRequest<{ user: User }>("/auth/login", {
      body: JSON.stringify(body),
      method: "POST"
    }),
  logout: () =>
    apiRequest<{ ok: true }>("/auth/logout", {
      method: "POST"
    }),
  signup: (body: { email: string; name: string; password: string }) =>
    apiRequest<{ user: User }>("/auth/signup", {
      body: JSON.stringify(body),
      method: "POST"
    })
};
