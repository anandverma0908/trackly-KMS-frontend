export type UserRole =
  | 'admin'
  | 'engineering_manager'
  | 'tech_lead'
  | 'team_member'
  | 'finance_viewer'

// export interface AuthUser {
//   id:        string
//   name:      string
//   email:     string
//   role:      UserRole
//   pod:       string | null   // for tech_lead / team_member scope
//   avatarUrl: string | null
// }
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  pod: string | null;
  org_id: string;
  last_login: string | null;
}
export interface AuthState {
  user:        AuthUser | null
  token:       string | null
  isLoggedIn:  boolean
  isLoading:   boolean
}

export interface LoginPayload {
  email:    string
  password: string
}

export interface RoutePermission {
  path:       string
  roles:      UserRole[]
  scopedToPod?: boolean   // if true, tech_lead/member only see their POD
}

export const ROUTE_PERMISSIONS: RoutePermission[] = [
  { path: '/dashboard',    roles: ['admin','engineering_manager','tech_lead','team_member','finance_viewer'] },
  { path: '/tickets',      roles: ['admin','engineering_manager','tech_lead','team_member'], scopedToPod: true },
  { path: '/team',         roles: ['admin','engineering_manager','tech_lead'],               scopedToPod: true },
  { path: '/export',       roles: ['admin','engineering_manager','finance_viewer'] },
  { path: '/manual-entry', roles: ['admin','engineering_manager','tech_lead'] },
  { path: '/settings',     roles: ['admin','engineering_manager','tech_lead','team_member','finance_viewer'] },
  { path: '/admin',        roles: ['admin'] },
]

export const ROLE_LABELS: Record<UserRole, string> = {
  admin:                'Admin',
  engineering_manager:  'Engineering Manager',
  tech_lead:            'Tech Lead',
  team_member:          'Team Member',
  finance_viewer:       'Finance Viewer',
}

export const ROLE_COLORS: Record<UserRole, { bg: string; text: string }> = {
  admin:               { bg: 'rgba(248,113,113,.12)', text: 'var(--red)'    },
  engineering_manager: { bg: 'rgba(167,139,250,.12)', text: 'var(--purple)' },
  tech_lead:           { bg: 'rgba(79,126,255,.12)',  text: 'var(--accent)' },
  team_member:         { bg: 'rgba(52,211,153,.12)',  text: 'var(--green)'  },
  finance_viewer:      { bg: 'rgba(255,255,255,.08)', text: 'var(--text-2)' },
}
