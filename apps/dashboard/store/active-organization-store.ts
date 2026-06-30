import { create } from "zustand";

interface ActiveOrganizationState {
  activeOrganizationId: string | null;
  setActiveOrganizationId: (organizationId: string | null) => void;
}

export const useActiveOrganizationStore = create<ActiveOrganizationState>((set) => ({
  activeOrganizationId: null,
  setActiveOrganizationId: (activeOrganizationId) => set({ activeOrganizationId })
}));
