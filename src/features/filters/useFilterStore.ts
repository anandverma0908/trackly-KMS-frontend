import { create } from "zustand";

interface FilterState {
  status?: string;
  priority?: string;
  assignee?: string;
  pod?: string;
  sprint?: string;
}

interface FilterStore {
  activeFilter: FilterState | null;
  setActiveFilter: (filter: FilterState | null) => void;
  clearFilter: () => void;
}

export const useFilterStore = create<FilterStore>((set) => ({
  activeFilter: null,
  setActiveFilter: (filter) => set({ activeFilter: filter }),
  clearFilter: () => set({ activeFilter: null }),
}));
