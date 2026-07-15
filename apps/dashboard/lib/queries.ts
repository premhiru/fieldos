import { useQuery } from "@tanstack/react-query";

import { api } from "./api";

export function useMe() {
  return useQuery({
    queryFn: api.getMe,
    queryKey: ["me"],
    retry: false
  });
}

export function useOrganizations() {
  return useQuery({
    queryFn: api.listOrganizations,
    queryKey: ["organizations"],
    retry: false
  });
}

export function useProjects(organizationId: string | null) {
  return useQuery({
    enabled: Boolean(organizationId),
    queryFn: () => api.listProjects(organizationId ?? ""),
    queryKey: ["projects", organizationId],
    retry: false
  });
}

export function useRecentReports(organizationId: string | null) {
  return useQuery({
    enabled: Boolean(organizationId),
    queryFn: () => api.listRecentReports(organizationId ?? "", 5),
    queryKey: ["recent-reports", organizationId],
    refetchInterval: 10_000,
    retry: false
  });
}

export function useOperationsDashboard(organizationId: string | null) {
  return useQuery({
    enabled: Boolean(organizationId),
    queryFn: () => api.getDashboard(organizationId ?? ""),
    queryKey: ["operations-dashboard", organizationId],
    retry: false
  });
}

export function useOnboardingState(organizationId: string | null) {
  return useQuery({
    enabled: Boolean(organizationId),
    queryFn: () => api.getOnboardingState(organizationId ?? ""),
    queryKey: ["onboarding", organizationId],
    retry: false
  });
}

export function useNotifications(organizationId: string | null) {
  return useQuery({
    enabled: Boolean(organizationId),
    queryFn: () => api.listNotifications(organizationId ?? ""),
    queryKey: ["notifications", organizationId],
    refetchInterval: 15_000,
    retry: false
  });
}

export function useConversations(organizationId: string | null, search: string) {
  return useQuery({
    enabled: Boolean(organizationId),
    queryFn: () => api.listConversations(organizationId ?? "", search),
    queryKey: ["conversations", organizationId, search],
    refetchInterval: 5_000,
    retry: false
  });
}
