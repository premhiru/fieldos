export type MembershipRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export type ProjectStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";

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
  getMe: () => apiRequest<{ user: User }>("/auth/me"),
  getProject: (projectId: string) => apiRequest<{ project: Project }>(`/projects/${projectId}`),
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
