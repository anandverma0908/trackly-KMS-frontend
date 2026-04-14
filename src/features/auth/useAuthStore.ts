import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser, UserRole } from "./types";
import { ROUTE_PERMISSIONS } from "./types";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface LoginPayload {
  email: string;
  password: string;
}

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  isLoggedIn: boolean;

  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
  can: (action: string) => boolean;
  canAccessRoute: (path: string) => boolean;
  getScopedPod: () => string | null;
}

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    "manage:all",
    "manage:settings",
    "manage:users",
    "view:all",
    "view:teams",
    "view:tickets",
    "export:all",
  ],
  engineering_manager: [
    "view:all",
    "export:all",
    "entry:manual",
    "view:teams",
    "view:tickets",
    "manage:settings",
  ],
  tech_lead: [
    "view:pod",
    "entry:manual",
    "view:teams",
    "view:tickets",
    "manage:settings",
  ],
  team_member: ["view:own", "entry:manual", "manage:settings"],
  finance_viewer: ["view:summary", "view:teams", "manage:settings"],
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoggedIn: false,

      login: async ({ email, password }: LoginPayload) => {
        const res = await fetch(`${API}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Login failed");

        set({
          user: data.user,
          token: data.access_token,
          isLoggedIn: true,
        });
      },

      logout: () => {
        const { token } = get();
        if (token) {
          fetch(`${API}/api/auth/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }
        set({ user: null, token: null, isLoggedIn: false });
      },

      can: (action: string) => {
        const { user } = get();
        if (!user) return false;
        const perms = ROLE_PERMISSIONS[user.role] ?? [];
        return perms.includes(action);
      },

      canAccessRoute: (path: string) => {
        const { user } = get();
        if (!user) return false;
        const allowed = ROUTE_PERMISSIONS[path];
        if (!allowed) return true;
        return allowed.includes(user.role);
      },

      getScopedPod: () => {
        const { user } = get();
        if (!user) return null;
        if (user.role === "tech_lead" || user.role === "team_member") {
          return user.pod ?? null;
        }
        return null;
      },
    }),
    {
      name: "eap-auth",
      partialize: (s) => ({
        user: s.user,
        token: s.token,
        isLoggedIn: s.isLoggedIn,
      }),
    },
  ),
);

export function getAuthHeader(): Record<string, string> {
  const token = useAuthStore.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
