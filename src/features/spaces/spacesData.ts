/* ── Spaces / Projects feature data + real-data bridge ── */
import type { PodSummary, SprintDetail } from "@/services/api";
import type { Sprint } from "@/types";

export interface ProjectMember {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  initials: string;
  color: string;
}

export interface ProjectTask {
  id: string;
  key: string;
  title: string;
  status: "To Do" | "In Progress" | "In Review" | "Blocked" | "Done";
  priority: "Critical" | "High" | "Medium" | "Low";
  type: "Story" | "Bug" | "Task" | "Epic" | "Subtask";
  assignee: string;
  assigneeInitials: string;
  assigneeColor: string;
  storyPoints: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
  labels?: string[];
  sprint?: string;
  epicId?: string;
}

export interface ProjectSprint {
  id: string;
  name: string;
  status: "planning" | "active" | "completed";
  startDate: string;
  endDate: string;
  goal: string;
  totalPoints: number;
  donePoints: number;
  tasks: ProjectTask[];
}

export interface ProjectEpic {
  id: string;
  title: string;
  color: string;
  startDate: string;
  endDate: string;
  progress: number;
  tasks: number;
  completed: number;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string;
  status: "active" | "planning" | "on_hold" | "completed";
  category: string;
  color: string;
  lead: string;
  leadInitials: string;
  leadColor: string;
  members: ProjectMember[];
  sprints: ProjectSprint[];
  epics: ProjectEpic[];
  startDate: string;
  endDate?: string;
  progress: number;
  totalTickets: number;
  completedTickets: number;
  inProgressTickets: number;
  blockedTickets: number;
  priority: "high" | "medium" | "low";
  tags: string[];
  weeklyActivity: number[]; // 7 days
  roles: string[]; // who can see this project
}

/* ── Color palettes ── */
const MEMBER_COLORS = [
  "linear-gradient(135deg,#4F7EFF,#818CF8)",
  "linear-gradient(135deg,#34D399,#10B981)",
  "linear-gradient(135deg,#FBBF24,#F59E0B)",
  "linear-gradient(135deg,#F87171,#FCA5A5)",
  "linear-gradient(135deg,#A78BFA,#C4B5FD)",
  "linear-gradient(135deg,#22D3EE,#67E8F9)",
  "linear-gradient(135deg,#64748B,#94A3B8)",
  "linear-gradient(135deg,#FB923C,#FDBA74)",
];

function mk(id: string, name: string, role: string): ProjectMember {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  const color = MEMBER_COLORS[Math.abs(hash) % MEMBER_COLORS.length];
  const parts = name.trim().split(" ");
  const initials =
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : name.slice(0, 2);
  return { id, name, role, initials: initials.toUpperCase(), color };
}

/* ── Shared members pool ── */
const MEMBERS = {
  alex:    mk("u1",  "Alex Rivera",    "Tech Lead"),
  priya:   mk("u2",  "Priya Sharma",   "Backend Engineer"),
  jordan:  mk("u3",  "Jordan Lee",     "Frontend Engineer"),
  sam:     mk("u4",  "Sam Chen",       "Full Stack Engineer"),
  morgan:  mk("u5",  "Morgan Davis",   "DevOps Engineer"),
  taylor:  mk("u6",  "Taylor Kim",     "QA Engineer"),
  casey:   mk("u7",  "Casey Johnson",  "UI/UX Designer"),
  riley:   mk("u8",  "Riley Wong",     "Data Engineer"),
  avery:   mk("u9",  "Avery Martinez", "Backend Engineer"),
  quinn:   mk("u10", "Quinn Brown",    "Security Engineer"),
};

/* ── Tasks factory ── */
function mkTask(
  id: string, key: string, title: string,
  status: ProjectTask["status"], priority: ProjectTask["priority"],
  type: ProjectTask["type"], assigneeName: string,
  sp: number, sprint?: string, epicId?: string,
  labels?: string[], dueDate?: string
): ProjectTask {
  const m = Object.values(MEMBERS).find(m => m.name === assigneeName) ?? MEMBERS.alex;
  return {
    id, key, title, status, priority, type,
    assignee: assigneeName,
    assigneeInitials: m.initials,
    assigneeColor: m.color,
    storyPoints: sp,
    sprint, epicId, labels, dueDate,
    createdAt: "2025-03-01",
    updatedAt: "2025-04-10",
    description: `${title} — detailed description and acceptance criteria for this ticket.`,
  };
}

/* ── Projects ── */
export const MOCK_PROJECTS: Project[] = [
  /* ── 1. NOVA AI Platform ── */
  {
    id: "p1", key: "NAP", name: "NOVA AI Platform",
    description: "Core AI assistant engine powering intelligent query responses, semantic search, and knowledge gap detection across the workspace.",
    status: "active", category: "AI / ML", color: "#4F7EFF",
    lead: "Alex Rivera", leadInitials: "AR", leadColor: MEMBERS.alex.color,
    members: [MEMBERS.alex, MEMBERS.priya, MEMBERS.sam, MEMBERS.riley, MEMBERS.avery],
    startDate: "2025-01-15", progress: 68,
    totalTickets: 42, completedTickets: 28, inProgressTickets: 8, blockedTickets: 2,
    priority: "high", tags: ["AI", "ML", "NLP"],
    weeklyActivity: [4, 7, 5, 9, 6, 3, 8],
    roles: ["admin", "engineering_manager", "tech_lead", "team_member"],
    epics: [
      { id: "e1", title: "Semantic Search Engine", color: "#4F7EFF", startDate: "2025-01-15", endDate: "2025-03-30", progress: 85, tasks: 12, completed: 10 },
      { id: "e2", title: "Knowledge Gap Detection", color: "#A78BFA", startDate: "2025-02-01", endDate: "2025-04-30", progress: 55, tasks: 8, completed: 4 },
      { id: "e3", title: "AI Chat Interface", color: "#22D3EE", startDate: "2025-03-01", endDate: "2025-05-31", progress: 40, tasks: 10, completed: 4 },
    ],
    sprints: [
      {
        id: "s1", name: "Sprint 7 — Model Tuning", status: "active",
        startDate: "2025-04-01", endDate: "2025-04-14",
        goal: "Fine-tune model responses and improve accuracy by 15%",
        totalPoints: 34, donePoints: 21,
        tasks: [
          mkTask("t1","NAP-101","Fine-tune GPT response formatting","In Progress","High","Story","Alex Rivera",5,"s1","e1"),
          mkTask("t2","NAP-102","Implement vector similarity threshold","Done","High","Task","Priya Sharma",3,"s1","e1"),
          mkTask("t3","NAP-103","Semantic cache layer for repeated queries","In Review","Medium","Story","Sam Chen",5,"s1","e1"),
          mkTask("t4","NAP-104","Fix hallucination in wiki citations","In Progress","Critical","Bug","Riley Wong",3,"s1","e2",["bug","ai"]),
          mkTask("t5","NAP-105","Batch embedding pipeline optimisation","To Do","Medium","Task","Avery Martinez",5,"s1","e2"),
          mkTask("t6","NAP-106","Add confidence score to Nova answers","To Do","Low","Story","Priya Sharma",3,"s1","e3"),
          mkTask("t7","NAP-107","Streaming token output for chat UI","To Do","High","Task","Sam Chen",5,"s1","e3"),
          mkTask("t8","NAP-108","Unit tests for embedding service","Done","Medium","Task","Alex Rivera",2,"s1","e1"),
          mkTask("t9","NAP-109","Rate limiter for AI endpoints","Blocked","High","Task","Riley Wong",3,"s1",undefined,["blocked"],"2025-04-15"),
        ],
      },
    ],
  },

  /* ── 2. Trackly Core ── */
  {
    id: "p2", key: "TRK", name: "Trackly Core Platform",
    description: "The main SaaS product — ticket management, sprint planning, kanban, and team analytics for high-performance engineering teams.",
    status: "active", category: "Product", color: "#34D399",
    lead: "Jordan Lee", leadInitials: "JL", leadColor: MEMBERS.jordan.color,
    members: [MEMBERS.jordan, MEMBERS.casey, MEMBERS.taylor, MEMBERS.morgan, MEMBERS.sam],
    startDate: "2024-10-01", progress: 82,
    totalTickets: 78, completedTickets: 64, inProgressTickets: 10, blockedTickets: 1,
    priority: "high", tags: ["SaaS", "Frontend", "Backend"],
    weeklyActivity: [9, 11, 8, 12, 10, 7, 6],
    roles: ["admin", "engineering_manager", "tech_lead", "team_member"],
    epics: [
      { id: "e4", title: "Spaces Feature", color: "#34D399", startDate: "2025-03-15", endDate: "2025-05-15", progress: 30, tasks: 14, completed: 4 },
      { id: "e5", title: "Sprint Analytics", color: "#FBBF24", startDate: "2025-02-01", endDate: "2025-04-15", progress: 90, tasks: 9, completed: 8 },
      { id: "e6", title: "Mobile Responsive", color: "#F87171", startDate: "2025-04-01", endDate: "2025-06-30", progress: 15, tasks: 12, completed: 2 },
    ],
    sprints: [
      {
        id: "s2", name: "Sprint 14 — Spaces MVP", status: "active",
        startDate: "2025-04-01", endDate: "2025-04-14",
        goal: "Deliver Spaces page and project detail view",
        totalPoints: 45, donePoints: 32,
        tasks: [
          mkTask("t10","TRK-201","Spaces page — project card grid","Done","High","Story","Jordan Lee",5,"s2","e4"),
          mkTask("t11","TRK-202","Project detail header + tabs","In Progress","High","Story","Casey Johnson",8,"s2","e4"),
          mkTask("t12","TRK-203","Backlog tab with sorting","In Progress","Medium","Story","Sam Chen",5,"s2","e4"),
          mkTask("t13","TRK-204","Kanban board per project","To Do","High","Story","Jordan Lee",8,"s2","e4"),
          mkTask("t14","TRK-205","Summary tab KPI widgets","To Do","Medium","Story","Taylor Kim",5,"s2","e4"),
          mkTask("t15","TRK-206","Roadmap Gantt view","To Do","Low","Story","Casey Johnson",8,"s2","e4"),
          mkTask("t16","TRK-207","Fix drag-drop in Safari","In Review","Critical","Bug","Morgan Davis",3,"s2",undefined,["bug","safari"],"2025-04-12"),
          mkTask("t17","TRK-208","E2E tests for sprint flow","Done","Medium","Task","Taylor Kim",3,"s2","e5"),
        ],
      },
    ],
  },

  /* ── 3. DataSync Pipeline ── */
  {
    id: "p3", key: "DSP", name: "DataSync Pipeline",
    description: "Real-time data synchronisation pipeline connecting JIRA, GitHub, Slack and internal tools to the unified Trackly data lake.",
    status: "active", category: "Infrastructure", color: "#A78BFA",
    lead: "Riley Wong", leadInitials: "RW", leadColor: MEMBERS.riley.color,
    members: [MEMBERS.riley, MEMBERS.morgan, MEMBERS.avery, MEMBERS.priya],
    startDate: "2025-02-01", progress: 51,
    totalTickets: 35, completedTickets: 18, inProgressTickets: 9, blockedTickets: 3,
    priority: "medium", tags: ["Pipeline", "DevOps", "Integrations"],
    weeklyActivity: [3, 5, 4, 6, 7, 5, 4],
    roles: ["admin", "engineering_manager", "tech_lead"],
    epics: [
      { id: "e7", title: "JIRA Connector", color: "#A78BFA", startDate: "2025-02-01", endDate: "2025-04-30", progress: 70, tasks: 10, completed: 7 },
      { id: "e8", title: "GitHub Webhooks", color: "#22D3EE", startDate: "2025-03-01", endDate: "2025-05-31", progress: 40, tasks: 8, completed: 3 },
    ],
    sprints: [
      {
        id: "s3", name: "Sprint 5 — JIRA Sync", status: "active",
        startDate: "2025-04-01", endDate: "2025-04-14",
        goal: "Complete JIRA bidirectional sync with conflict resolution",
        totalPoints: 28, donePoints: 14,
        tasks: [
          mkTask("t18","DSP-301","JIRA webhook receiver service","Done","High","Story","Riley Wong",5,"s3","e7"),
          mkTask("t19","DSP-302","Conflict resolution strategy","In Progress","High","Story","Morgan Davis",8,"s3","e7"),
          mkTask("t20","DSP-303","Rate limiting for API calls","In Progress","Medium","Task","Avery Martinez",3,"s3","e7"),
          mkTask("t21","DSP-304","Dead letter queue for failed events","To Do","Medium","Task","Priya Sharma",5,"s3","e8"),
          mkTask("t22","DSP-305","GitHub PR status sync","Blocked","High","Story","Riley Wong",5,"s3","e8",["blocked"],"2025-04-13"),
          mkTask("t23","DSP-306","Monitoring dashboard for pipeline","To Do","Low","Task","Morgan Davis",2,"s3"),
        ],
      },
    ],
  },

  /* ── 4. Security Hardening ── */
  {
    id: "p4", key: "SEC", name: "Security Hardening Q2",
    description: "Compliance-driven security initiative: SOC2 readiness, penetration testing remediation, and zero-trust network implementation.",
    status: "active", category: "Security", color: "#F87171",
    lead: "Quinn Brown", leadInitials: "QB", leadColor: MEMBERS.quinn.color,
    members: [MEMBERS.quinn, MEMBERS.morgan, MEMBERS.alex],
    startDate: "2025-03-01", progress: 38,
    totalTickets: 24, completedTickets: 9, inProgressTickets: 5, blockedTickets: 4,
    priority: "high", tags: ["Security", "SOC2", "Compliance"],
    weeklyActivity: [2, 3, 4, 3, 5, 4, 3],
    roles: ["admin", "engineering_manager"],
    epics: [
      { id: "e9", title: "SOC2 Compliance", color: "#F87171", startDate: "2025-03-01", endDate: "2025-06-30", progress: 35, tasks: 15, completed: 5 },
    ],
    sprints: [
      {
        id: "s4", name: "Sprint 3 — Pen Test Fixes", status: "active",
        startDate: "2025-04-01", endDate: "2025-04-14",
        goal: "Address all critical and high findings from Q1 pen test",
        totalPoints: 22, donePoints: 8,
        tasks: [
          mkTask("t24","SEC-401","Patch SQL injection in report export","Done","Critical","Bug","Quinn Brown",3,"s4","e9",["bug","security"]),
          mkTask("t25","SEC-402","Implement CSP headers","In Progress","High","Task","Morgan Davis",3,"s4","e9"),
          mkTask("t26","SEC-403","MFA enforcement for admin accounts","In Progress","Critical","Story","Alex Rivera",5,"s4","e9"),
          mkTask("t27","SEC-404","Rotate all service account secrets","Blocked","Critical","Task","Quinn Brown",3,"s4","e9",["blocked"],"2025-04-11"),
          mkTask("t28","SEC-405","Audit log for sensitive data access","To Do","High","Story","Morgan Davis",5,"s4","e9"),
          mkTask("t29","SEC-406","RBAC review and tighten permissions","To Do","High","Task","Alex Rivera",3,"s4","e9"),
        ],
      },
    ],
  },

  /* ── 5. Mobile App ── */
  {
    id: "p5", key: "MOB", name: "Trackly Mobile",
    description: "Native mobile experience for iOS and Android — sprint overview, ticket updates, standup submission, and push notifications.",
    status: "planning", category: "Mobile", color: "#FBBF24",
    lead: "Casey Johnson", leadInitials: "CJ", leadColor: MEMBERS.casey.color,
    members: [MEMBERS.casey, MEMBERS.jordan, MEMBERS.taylor],
    startDate: "2025-05-01", progress: 8,
    totalTickets: 18, completedTickets: 1, inProgressTickets: 2, blockedTickets: 0,
    priority: "medium", tags: ["Mobile", "iOS", "Android"],
    weeklyActivity: [1, 0, 2, 1, 3, 2, 1],
    roles: ["admin", "engineering_manager", "tech_lead"],
    epics: [
      { id: "e10", title: "Core Navigation", color: "#FBBF24", startDate: "2025-05-01", endDate: "2025-07-31", progress: 5, tasks: 8, completed: 0 },
    ],
    sprints: [
      {
        id: "s5", name: "Sprint 1 — Discovery", status: "active",
        startDate: "2025-04-07", endDate: "2025-04-21",
        goal: "Design system setup and core navigation prototype",
        totalPoints: 13, donePoints: 2,
        tasks: [
          mkTask("t30","MOB-101","Setup React Native project","Done","High","Task","Casey Johnson",2,"s5","e10"),
          mkTask("t31","MOB-102","Design system tokens for mobile","In Progress","High","Task","Casey Johnson",3,"s5","e10"),
          mkTask("t32","MOB-103","Bottom nav prototype","To Do","Medium","Story","Jordan Lee",5,"s5","e10"),
          mkTask("t33","MOB-104","Push notification service","To Do","Medium","Task","Taylor Kim",3,"s5","e10"),
        ],
      },
    ],
  },

  /* ── 6. Analytics V2 ── */
  {
    id: "p6", key: "ANV", name: "Analytics Engine V2",
    description: "Next-generation analytics platform with predictive burndown, team health scores, and executive-level reporting dashboards.",
    status: "on_hold", category: "Analytics", color: "#22D3EE",
    lead: "Sam Chen", leadInitials: "SC", leadColor: MEMBERS.sam.color,
    members: [MEMBERS.sam, MEMBERS.riley, MEMBERS.priya],
    startDate: "2025-04-15", progress: 12,
    totalTickets: 22, completedTickets: 3, inProgressTickets: 1, blockedTickets: 2,
    priority: "low", tags: ["Analytics", "Charts", "BI"],
    weeklyActivity: [1, 0, 1, 0, 2, 1, 0],
    roles: ["admin", "engineering_manager"],
    epics: [
      { id: "e11", title: "Predictive Burndown", color: "#22D3EE", startDate: "2025-04-15", endDate: "2025-07-31", progress: 10, tasks: 10, completed: 1 },
    ],
    sprints: [
      {
        id: "s6", name: "Sprint 1 — Architecture", status: "planning",
        startDate: "2025-04-15", endDate: "2025-04-28",
        goal: "Define data model and query engine architecture",
        totalPoints: 18, donePoints: 2,
        tasks: [
          mkTask("t34","ANV-101","Define analytics data model","Done","High","Story","Sam Chen",5,"s6","e11"),
          mkTask("t35","ANV-102","Research time-series DB options","In Progress","Medium","Task","Riley Wong",3,"s6","e11"),
          mkTask("t36","ANV-103","Predictive model POC","Blocked","High","Story","Priya Sharma",8,"s6","e11",["blocked"]),
          mkTask("t37","ANV-104","Executive dashboard wireframes","To Do","Low","Task","Sam Chen",2,"s6"),
        ],
      },
    ],
  },
];

/* ── Helpers ── */
export function getProjectById(id: string): Project | undefined {
  return MOCK_PROJECTS.find((p) => p.id === id);
}

export function getStatusColor(status: Project["status"]): string {
  return {
    active:    "var(--green)",
    planning:  "var(--amber)",
    on_hold:   "var(--text-3)",
    completed: "var(--accent)",
  }[status];
}

export function getPriorityColor(priority: ProjectTask["priority"]): string {
  return {
    Critical: "var(--red)",
    High:     "var(--amber)",
    Medium:   "var(--accent)",
    Low:      "var(--text-3)",
  }[priority];
}

export function getTaskStatusColor(status: ProjectTask["status"]): string {
  return {
    "To Do":       "var(--text-3)",
    "In Progress": "var(--amber)",
    "In Review":   "var(--purple)",
    "Blocked":     "var(--red)",
    "Done":        "var(--green)",
  }[status];
}

/* ── Real-data bridge: build a Project from API data ── */
function normalizeStatus(s: string): ProjectTask["status"] {
  const l = s.toLowerCase();
  if (l === "done" || l === "closed" || l === "resolved") return "Done";
  if (l === "blocked") return "Blocked";
  if (l.includes("review") || l.includes("qa")) return "In Review";
  if (l.includes("progress") || l.includes("development")) return "In Progress";
  return "To Do";
}

function normalizePriority(p: string): ProjectTask["priority"] {
  const l = p.toLowerCase();
  if (l === "critical" || l === "blocker") return "Critical";
  if (l === "high") return "High";
  if (l === "low" || l === "minor" || l === "trivial") return "Low";
  return "Medium";
}

function normalizeType(t: string | null): ProjectTask["type"] {
  if (!t) return "Task";
  const l = t.toLowerCase();
  if (l.includes("bug") || l.includes("defect")) return "Bug";
  if (l.includes("story") || l.includes("feature")) return "Story";
  if (l.includes("epic")) return "Epic";
  if (l.includes("subtask") || l.includes("sub-task")) return "Subtask";
  return "Task";
}

function hashColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return MEMBER_COLORS[Math.abs(h) % MEMBER_COLORS.length];
}

function initials(name: string | null): string {
  if (!name) return "??";
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export function buildProjectFromAPI(
  pod: string,
  podStats: PodSummary | undefined,
  activeSprint: (Sprint & { ticket_count?: number }) | undefined,
  sprintDetail: SprintDetail | undefined,
  podColor: string,
): Project {
  const statuses = podStats?.statuses ?? {};
  const DONE_KEYS = ["Done", "Closed", "Resolved"];
  const IN_PROG_KEYS = ["In Progress", "In Development", "Development Ready"];
  const BLOCKED_KEYS = ["Blocked"];

  const totalTickets    = Object.values(statuses).reduce((a, b) => a + b, 0);
  const completedTickets = DONE_KEYS.reduce((a, k) => a + (statuses[k] ?? 0), 0);
  const inProgress       = IN_PROG_KEYS.reduce((a, k) => a + (statuses[k] ?? 0), 0);
  const blocked          = BLOCKED_KEYS.reduce((a, k) => a + (statuses[k] ?? 0), 0);
  const progress         = totalTickets > 0 ? Math.round((completedTickets / totalTickets) * 100) : 0;

  // Build members from sprint ticket assignees
  const memberMap: Record<string, ProjectMember> = {};
  (sprintDetail?.tickets ?? []).forEach((t, i) => {
    if (t.assignee && !memberMap[t.assignee]) {
      memberMap[t.assignee] = {
        id: `m-${pod}-${i}`,
        name: t.assignee,
        role: "Team Member",
        initials: initials(t.assignee),
        color: hashColor(t.assignee),
      };
    }
  });
  const members = Object.values(memberMap);

  // Map sprint tickets to ProjectTask[]
  const sprintTasks: ProjectTask[] = (sprintDetail?.tickets ?? []).map((t, i) => ({
    id:              t.id,
    key:             t.jira_key,
    title:           t.summary,
    status:          normalizeStatus(t.status),
    priority:        normalizePriority(t.priority),
    type:            normalizeType(t.issue_type),
    assignee:        t.assignee ?? "Unassigned",
    assigneeInitials: initials(t.assignee),
    assigneeColor:   hashColor(t.assignee ?? String(i)),
    storyPoints:     t.story_points ?? 0,
    createdAt:       "2026-01-01",
    updatedAt:       "2026-04-14",
  }));

  const projectSprint: ProjectSprint | undefined = activeSprint ? {
    id:          String(activeSprint.id),
    name:        activeSprint.name,
    status:      activeSprint.status as ProjectSprint["status"],
    startDate:   activeSprint.start_date ?? "",
    endDate:     activeSprint.end_date ?? "",
    goal:        activeSprint.goal ?? "",
    totalPoints: activeSprint.total_points ?? 0,
    donePoints:  activeSprint.done_points ?? 0,
    tasks:       sprintTasks,
  } : undefined;

  return {
    id:                pod,
    key:               pod,
    name:              `${pod} Pod`,
    description:       `${pod} engineering pod — ${totalTickets.toLocaleString()} total tickets`,
    status:            "active",
    category:          "Product",
    color:             podColor,
    lead:              members[0]?.name ?? "Team Lead",
    leadInitials:      members[0]?.initials ?? "TL",
    leadColor:         members[0]?.color ?? podColor,
    members:           members.slice(0, 8),
    sprints:           projectSprint ? [projectSprint] : [],
    epics:             [],
    startDate:         "2026-01-01",
    progress,
    totalTickets,
    completedTickets,
    inProgressTickets: inProgress,
    blockedTickets:    blocked,
    priority:          "high",
    tags:              [pod],
    weeklyActivity:    [3, 5, 4, 6, 7, 5, 4],
    roles:             ["admin", "engineering_manager", "tech_lead", "team_member"],
  };
}
