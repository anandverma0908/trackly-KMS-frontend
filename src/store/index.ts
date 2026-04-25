import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FilterState, ThemeId, ColorMode } from "@/types";
import { applyTheme, DEFAULT_THEME, DEFAULT_MODE } from "@/config/themes";
import { getPresetDates } from "@/config/queryKeys";

/* ─────────────────────────────────────────────
   FILTER STORE
   ───────────────────────────────────────────── */
const defaultDates = getPresetDates("thisMonth");

interface FilterStore extends FilterState {
  // Single-value filters
  setFilter: (key: keyof FilterState, value: string | null) => void;
  setDateRange: (from: string, to: string) => void;
  resetFilters: () => void;

  // Multi-select — PODs
  pods: string[];
  togglePod: (pod: string) => void;
  clearPods: () => void;

  // Multi-select — Clients
  clients: string[];
  toggleClient: (client: string) => void;
  clearClients: () => void;
}

const defaultFilters: FilterState = {
  dateFrom: defaultDates.from,
  dateTo: defaultDates.to,
  user: null,
  client: null, // kept for backward compat (single)
  pod: null, // kept for backward compat (single)
  project: null,
  search: "",
  issueType: null,
};

export const useFilterStore = create<FilterStore>((set, get) => ({
  ...defaultFilters,

  // Multi-select arrays
  pods: [],
  clients: [],

  setFilter: (key, value) => set({ [key]: value }),

  setDateRange: (from, to) => set({ dateFrom: from, dateTo: to }),

  resetFilters: () => set({ ...defaultFilters, pods: [], clients: [] }),

  // Toggle a POD in/out of the selected array
  togglePod: (pod) => {
    const current = get().pods;
    const next = current.includes(pod)
      ? current.filter((p) => p !== pod)
      : [...current, pod];
    set({ pods: next });
  },

  clearPods: () => set({ pods: [] }),

  // Toggle a client in/out of the selected array
  toggleClient: (client) => {
    const current = get().clients;
    const next = current.includes(client)
      ? current.filter((c) => c !== client)
      : [...current, client];
    set({ clients: next });
  },

  clearClients: () => set({ clients: [] }),
}));

/* ─────────────────────────────────────────────
   THEME STORE — persisted to localStorage
   ───────────────────────────────────────────── */
interface ThemeStore {
  themeId: ThemeId;
  colorMode: ColorMode;
  setTheme: (id: ThemeId) => void;
  setMode: (mode: ColorMode) => void;
  toggleMode: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      themeId: DEFAULT_THEME,
      colorMode: DEFAULT_MODE,
      setTheme: (id) => {
        set({ themeId: id });
        applyTheme(id, get().colorMode);
      },
      setMode: (mode) => {
        set({ colorMode: mode });
        applyTheme(get().themeId, mode);
      },
      toggleMode: () => {
        const next = get().colorMode === "dark" ? "light" : "dark";
        set({ colorMode: next });
        applyTheme(get().themeId, next);
      },
    }),
    { name: "eap-theme" },
  ),
);

/* ─────────────────────────────────────────────
   NOTIFICATION STORE
   ───────────────────────────────────────────── */
interface NotificationStore {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  decrementUnread: () => void;
  clearUnread: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  unreadCount:     0,
  setUnreadCount:  (n) => set({ unreadCount: n }),
  decrementUnread: () => set({ unreadCount: Math.max(0, get().unreadCount - 1) }),
  clearUnread:     () => set({ unreadCount: 0 }),
}));

/* ─────────────────────────────────────────────
   WIKI STORE
   ───────────────────────────────────────────── */
interface WikiStore {
  activeSpaceId:  string | null;
  activePageId:   string | null;
  setActiveSpace: (id: string | null) => void;
  setActivePage:  (id: string | null) => void;
}

export const useWikiStore = create<WikiStore>()(
  persist(
    (set) => ({
      activeSpaceId:  null,
      activePageId:   null,
      setActiveSpace: (id) => set({ activeSpaceId: id }),
      setActivePage:  (id) => set({ activePageId: id }),
    }),
    { name: "trackly-wiki" },
  ),
);
