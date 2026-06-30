import { create } from "zustand";

type ServiceStatus = "ok" | "mocked" | "pending";

interface StatusState {
  api: ServiceStatus;
  database: ServiceStatus;
  worker: ServiceStatus;
}

export const useStatusStore = create<StatusState>(() => ({
  api: "mocked",
  database: "mocked",
  worker: "mocked"
}));
