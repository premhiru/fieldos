import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ActiveOrganizationState {
  activeOrganizationId: string | null;
  setActiveOrganizationId: (organizationId: string | null) => void;
}

export const useActiveOrganizationStore = create<ActiveOrganizationState>()(
  persist(
    (set) => ({
      activeOrganizationId: null,
      setActiveOrganizationId: (activeOrganizationId) => set({ activeOrganizationId })
    }),
    { name: "fieldos-workspace" }
  )
);
