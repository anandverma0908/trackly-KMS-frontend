/* ── Roles ── */
export type UserRole =
  | 'admin'
  | 'engineering_manager'
  | 'tech_lead'
  | 'team_member'
  | 'finance_viewer'

/* ── User object ── */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  pod: string | null;
  org_id: string;
  last_login: string | null;
}
/* ── Role colors (for badges) ── */
export const ROLE_COLORS: Record<UserRole, { bg: string; text: string }> = {
  admin:               { bg: 'rgba(248,113,113,.12)', text: 'var(--red)'    },
  engineering_manager: { bg: 'rgba(167,139,250,.12)', text: 'var(--purple)' },
  tech_lead:           { bg: 'rgba(79,126,255,.12)',  text: 'var(--accent)' },
  team_member:         { bg: 'rgba(52,211,153,.12)',  text: 'var(--green)'  },
  finance_viewer:      { bg: 'rgba(255,255,255,.08)', text: 'var(--text-2)' },
}
