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
  backlogTasks?: ProjectTask[];
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
  alex: mk("u1", "Alex Rivera", "Tech Lead"),
  priya: mk("u2", "Priya Sharma", "Backend Engineer"),
  jordan: mk("u3", "Jordan Lee", "Frontend Engineer"),
  sam: mk("u4", "Sam Chen", "Full Stack Engineer"),
  morgan: mk("u5", "Morgan Davis", "DevOps Engineer"),
  taylor: mk("u6", "Taylor Kim", "QA Engineer"),
  casey: mk("u7", "Casey Johnson", "UI/UX Designer"),
  riley: mk("u8", "Riley Wong", "Data Engineer"),
  avery: mk("u9", "Avery Martinez", "Backend Engineer"),
  quinn: mk("u10", "Quinn Brown", "Security Engineer"),
};

/* ── Tasks factory ── */
function mkTask(
  id: string,
  key: string,
  title: string,
  status: ProjectTask["status"],
  priority: ProjectTask["priority"],
  type: ProjectTask["type"],
  assigneeName: string,
  sp: number,
  sprint?: string,
  epicId?: string,
  labels?: string[],
  dueDate?: string,
): ProjectTask {
  const m =
    Object.values(MEMBERS).find((m) => m.name === assigneeName) ?? MEMBERS.alex;
  return {
    id,
    key,
    title,
    status,
    priority,
    type,
    assignee: assigneeName,
    assigneeInitials: m.initials,
    assigneeColor: m.color,
    storyPoints: sp,
    sprint,
    epicId,
    labels,
    dueDate,
    createdAt: "2025-03-01",
    updatedAt: "2025-04-10",
    description: `${title} — detailed description and acceptance criteria for this ticket.`,
  };
}

/* ── Projects ── */
export const MOCK_PROJECTS: Project[] = [
  /* ── 1. DPAI ── */
  {
    id: "p1",
    key: "DPAI",
    name: "DPAI",
    description:
      "Data & AI pod driving ML pipelines, predictive analytics, and intelligent automation across client solutions.",
    status: "active",
    category: "AI / ML",
    color: "#4F7EFF",
    lead: "Alex Rivera",
    leadInitials: "AR",
    leadColor: MEMBERS.alex.color,
    members: [
      MEMBERS.alex,
      MEMBERS.priya,
      MEMBERS.sam,
      MEMBERS.riley,
      MEMBERS.avery,
    ],
    startDate: "2026-01-01",
    progress: 68,
    totalTickets: 412,
    completedTickets: 280,
    inProgressTickets: 80,
    blockedTickets: 12,
    priority: "high",
    tags: ["AI", "ML", "Data"],
    weeklyActivity: [4, 7, 5, 9, 6, 3, 8],
    roles: ["admin", "engineering_manager", "tech_lead", "team_member"],
    epics: [
      {
        id: "e1",
        title: "ML Pipeline v3",
        color: "#4F7EFF",
        startDate: "2026-01-15",
        endDate: "2026-03-30",
        progress: 75,
        tasks: 12,
        completed: 9,
      },
      {
        id: "e2",
        title: "Predictive Analytics",
        color: "#A78BFA",
        startDate: "2026-02-01",
        endDate: "2026-04-30",
        progress: 55,
        tasks: 8,
        completed: 4,
      },
    ],
    sprints: [
      {
        id: "s1",
        name: "Sprint 12",
        status: "active",
        startDate: "2026-04-01",
        endDate: "2026-04-14",
        goal: "Improve model accuracy and pipeline throughput",
        totalPoints: 34,
        donePoints: 21,
        tasks: [
          mkTask(
            "t1",
            "DPAI-101",
            "ML pipeline for Colgate analytics dashboard",
            "In Progress",
            "High",
            "Story",
            "Alex Rivera",
            5,
            "s1",
            "e1",
          ),
          mkTask(
            "t2",
            "DPAI-102",
            "Implement vector similarity threshold",
            "Done",
            "High",
            "Task",
            "Priya Sharma",
            3,
            "s1",
            "e1",
          ),
          mkTask(
            "t3",
            "DPAI-103",
            "Semantic cache layer for repeated queries",
            "In Review",
            "Medium",
            "Story",
            "Sam Chen",
            5,
            "s1",
            "e1",
          ),
          mkTask(
            "t4",
            "DPAI-104",
            "Fix hallucination in forecasting module",
            "In Progress",
            "Critical",
            "Bug",
            "Riley Wong",
            3,
            "s1",
            "e2",
            ["bug", "ai"],
          ),
          mkTask(
            "t5",
            "DPAI-105",
            "Batch embedding pipeline optimisation",
            "To Do",
            "Medium",
            "Task",
            "Avery Martinez",
            5,
            "s1",
            "e2",
          ),
        ],
      },
    ],
  },

  /* ── 2. SNOP ── */
  {
    id: "p2",
    key: "SNOP",
    name: "SNOP",
    description:
      "Supply & Network Operations pod — demand planning, supply chain optimisation, and operational analytics.",
    status: "active",
    category: "Operations",
    color: "#A78BFA",
    lead: "Jordan Lee",
    leadInitials: "JL",
    leadColor: MEMBERS.jordan.color,
    members: [
      MEMBERS.jordan,
      MEMBERS.casey,
      MEMBERS.taylor,
      MEMBERS.morgan,
      MEMBERS.sam,
    ],
    startDate: "2026-01-01",
    progress: 72,
    totalTickets: 298,
    completedTickets: 214,
    inProgressTickets: 45,
    blockedTickets: 8,
    priority: "high",
    tags: ["Supply Chain", "Planning", "Ops"],
    weeklyActivity: [9, 11, 8, 12, 10, 7, 6],
    roles: ["admin", "engineering_manager", "tech_lead", "team_member"],
    epics: [
      {
        id: "e3",
        title: "Demand Forecasting",
        color: "#A78BFA",
        startDate: "2026-01-15",
        endDate: "2026-05-15",
        progress: 60,
        tasks: 14,
        completed: 8,
      },
      {
        id: "e4",
        title: "Network Optimisation",
        color: "#FBBF24",
        startDate: "2026-02-01",
        endDate: "2026-04-15",
        progress: 85,
        tasks: 9,
        completed: 8,
      },
    ],
    sprints: [
      {
        id: "s2",
        name: "Sprint 10",
        status: "active",
        startDate: "2026-04-01",
        endDate: "2026-04-14",
        goal: "Deliver demand planning module enhancements",
        totalPoints: 45,
        donePoints: 32,
        tasks: [
          mkTask(
            "t6",
            "SNOP-201",
            "Demand planning dashboard v2",
            "Done",
            "High",
            "Story",
            "Jordan Lee",
            5,
            "s2",
            "e3",
          ),
          mkTask(
            "t7",
            "SNOP-202",
            "Network flow optimisation algorithm",
            "In Progress",
            "High",
            "Story",
            "Casey Johnson",
            8,
            "s2",
            "e4",
          ),
          mkTask(
            "t8",
            "SNOP-203",
            "Supply variance alert system",
            "In Progress",
            "Medium",
            "Story",
            "Sam Chen",
            5,
            "s2",
            "e3",
          ),
          mkTask(
            "t9",
            "SNOP-204",
            "Fix data sync lag in reporting",
            "In Review",
            "Critical",
            "Bug",
            "Morgan Davis",
            3,
            "s2",
            undefined,
            ["bug"],
            "2026-04-12",
          ),
        ],
      },
    ],
  },

  /* ── 3. EDM ── */
  {
    id: "p3",
    key: "EDM",
    name: "EDM",
    description:
      "Enterprise Data Management pod — data schemas, migrations, master data governance, and quality frameworks.",
    status: "active",
    category: "Data Engineering",
    color: "#FBBF24",
    lead: "Riley Wong",
    leadInitials: "RW",
    leadColor: MEMBERS.riley.color,
    members: [MEMBERS.riley, MEMBERS.morgan, MEMBERS.avery, MEMBERS.priya],
    startDate: "2026-01-01",
    progress: 58,
    totalTickets: 241,
    completedTickets: 140,
    inProgressTickets: 60,
    blockedTickets: 15,
    priority: "medium",
    tags: ["Data", "Governance", "Schema"],
    weeklyActivity: [3, 5, 4, 6, 7, 5, 4],
    roles: ["admin", "engineering_manager", "tech_lead", "team_member"],
    epics: [
      {
        id: "e5",
        title: "Schema Migration v8",
        color: "#FBBF24",
        startDate: "2026-02-01",
        endDate: "2026-04-30",
        progress: 70,
        tasks: 10,
        completed: 7,
      },
      {
        id: "e6",
        title: "Data Quality Framework",
        color: "#22D3EE",
        startDate: "2026-03-01",
        endDate: "2026-05-31",
        progress: 40,
        tasks: 8,
        completed: 3,
      },
    ],
    sprints: [
      {
        id: "s3",
        name: "Sprint 8",
        status: "active",
        startDate: "2026-04-01",
        endDate: "2026-04-14",
        goal: "Complete EDM schema migration and data quality checks",
        totalPoints: 28,
        donePoints: 14,
        tasks: [
          mkTask(
            "t10",
            "EDM-301",
            "EDM data schema migration v8",
            "Done",
            "High",
            "Story",
            "Riley Wong",
            5,
            "s3",
            "e5",
          ),
          mkTask(
            "t11",
            "EDM-302",
            "Data quality validation rules",
            "In Progress",
            "High",
            "Story",
            "Morgan Davis",
            8,
            "s3",
            "e6",
          ),
          mkTask(
            "t12",
            "EDM-303",
            "Master data reconciliation job",
            "In Progress",
            "Medium",
            "Task",
            "Avery Martinez",
            3,
            "s3",
            "e5",
          ),
          mkTask(
            "t13",
            "EDM-304",
            "Dead letter queue for failed events",
            "To Do",
            "Medium",
            "Task",
            "Priya Sharma",
            5,
            "s3",
            "e6",
          ),
          mkTask(
            "t14",
            "EDM-305",
            "Data lineage tracking",
            "Blocked",
            "High",
            "Story",
            "Riley Wong",
            5,
            "s3",
            "e6",
            ["blocked"],
            "2026-04-13",
          ),
        ],
      },
    ],
  },

  /* ── 4. PLAT ── */
  {
    id: "p4",
    key: "PLAT",
    name: "PLAT",
    description:
      "Platform engineering pod — shared infrastructure, developer tooling, CI/CD, and cloud architecture.",
    status: "active",
    category: "Platform",
    color: "#34D399",
    lead: "Quinn Brown",
    leadInitials: "QB",
    leadColor: MEMBERS.quinn.color,
    members: [MEMBERS.quinn, MEMBERS.morgan, MEMBERS.alex],
    startDate: "2026-01-01",
    progress: 45,
    totalTickets: 198,
    completedTickets: 89,
    inProgressTickets: 50,
    blockedTickets: 10,
    priority: "high",
    tags: ["Platform", "DevOps", "Infrastructure"],
    weeklyActivity: [2, 3, 4, 3, 5, 4, 3],
    roles: ["admin", "engineering_manager", "tech_lead", "team_member"],
    epics: [
      {
        id: "e7",
        title: "AKS Cluster Migration",
        color: "#34D399",
        startDate: "2026-03-01",
        endDate: "2026-06-30",
        progress: 40,
        tasks: 15,
        completed: 6,
      },
    ],
    sprints: [
      {
        id: "s4",
        name: "Sprint 6",
        status: "active",
        startDate: "2026-04-01",
        endDate: "2026-04-14",
        goal: "Complete AKS private network migration and CI/CD hardening",
        totalPoints: 22,
        donePoints: 8,
        tasks: [
          mkTask(
            "t15",
            "PLAT-401",
            "AKS cluster migration to private network",
            "Done",
            "Critical",
            "Task",
            "Quinn Brown",
            3,
            "s4",
            "e7",
          ),
          mkTask(
            "t16",
            "PLAT-402",
            "CI/CD pipeline optimisation",
            "In Progress",
            "High",
            "Task",
            "Morgan Davis",
            3,
            "s4",
            "e7",
          ),
          mkTask(
            "t17",
            "PLAT-403",
            "Helm chart standardisation",
            "In Progress",
            "Critical",
            "Story",
            "Alex Rivera",
            5,
            "s4",
            "e7",
          ),
          mkTask(
            "t18",
            "PLAT-404",
            "Monitoring stack upgrade",
            "Blocked",
            "Critical",
            "Task",
            "Quinn Brown",
            3,
            "s4",
            "e7",
            ["blocked"],
            "2026-04-11",
          ),
          mkTask(
            "t19",
            "PLAT-405",
            "Cost optimisation review",
            "To Do",
            "High",
            "Story",
            "Morgan Davis",
            5,
            "s4",
            "e7",
          ),
        ],
      },
    ],
  },

  /* ── 5. SNOE ── */
  {
    id: "p5",
    key: "SNOE",
    name: "SNOE",
    description:
      "Sales & Network Operations Excellence pod — revenue analytics, territory planning, and sales performance tooling.",
    status: "active",
    category: "Sales Ops",
    color: "#22D3EE",
    lead: "Casey Johnson",
    leadInitials: "CJ",
    leadColor: MEMBERS.casey.color,
    members: [MEMBERS.casey, MEMBERS.jordan, MEMBERS.taylor],
    startDate: "2026-01-01",
    progress: 52,
    totalTickets: 142,
    completedTickets: 74,
    inProgressTickets: 30,
    blockedTickets: 5,
    priority: "medium",
    tags: ["Sales", "Analytics", "Operations"],
    weeklyActivity: [1, 3, 2, 4, 3, 2, 1],
    roles: ["admin", "engineering_manager", "tech_lead", "team_member"],
    epics: [
      {
        id: "e8",
        title: "Territory Planning",
        color: "#22D3EE",
        startDate: "2026-02-01",
        endDate: "2026-07-31",
        progress: 45,
        tasks: 8,
        completed: 4,
      },
    ],
    sprints: [
      {
        id: "s5",
        name: "Sprint 7",
        status: "active",
        startDate: "2026-04-07",
        endDate: "2026-04-21",
        goal: "Territory planning module and sales analytics v2",
        totalPoints: 13,
        donePoints: 6,
        tasks: [
          mkTask(
            "t20",
            "SNOE-101",
            "Territory planning dashboard",
            "Done",
            "High",
            "Task",
            "Casey Johnson",
            2,
            "s5",
            "e8",
          ),
          mkTask(
            "t21",
            "SNOE-102",
            "Sales performance KPI widgets",
            "In Progress",
            "High",
            "Task",
            "Casey Johnson",
            3,
            "s5",
            "e8",
          ),
          mkTask(
            "t22",
            "SNOE-103",
            "Revenue attribution model",
            "To Do",
            "Medium",
            "Story",
            "Jordan Lee",
            5,
            "s5",
            "e8",
          ),
          mkTask(
            "t23",
            "SNOE-104",
            "Export to PowerBI connector",
            "To Do",
            "Medium",
            "Task",
            "Taylor Kim",
            3,
            "s5",
            "e8",
          ),
        ],
      },
    ],
  },

  /* ── 6. Product AI ── */
  {
    id: "p6",
    key: "PA",
    name: "Product AI",
    description:
      "Product AI pod — AI-powered product features, recommendation engines, and intelligent UX personalisation.",
    status: "active",
    category: "AI / Product",
    color: "#F87171",
    lead: "Sam Chen",
    leadInitials: "SC",
    leadColor: MEMBERS.sam.color,
    members: [MEMBERS.sam, MEMBERS.riley, MEMBERS.priya],
    startDate: "2026-01-01",
    progress: 35,
    totalTickets: 118,
    completedTickets: 41,
    inProgressTickets: 28,
    blockedTickets: 6,
    priority: "high",
    tags: ["AI", "Product", "Recommendations"],
    weeklyActivity: [2, 3, 4, 5, 4, 3, 4],
    roles: ["admin", "engineering_manager", "tech_lead", "team_member"],
    epics: [
      {
        id: "e9",
        title: "Recommendation Engine",
        color: "#F87171",
        startDate: "2026-02-15",
        endDate: "2026-07-31",
        progress: 30,
        tasks: 10,
        completed: 3,
      },
    ],
    sprints: [
      {
        id: "s6",
        name: "Sprint 4",
        status: "active",
        startDate: "2026-04-01",
        endDate: "2026-04-14",
        goal: "Recommendation engine POC and AI feature flags",
        totalPoints: 18,
        donePoints: 6,
        tasks: [
          mkTask(
            "t24",
            "PAI-101",
            "Recommendation engine POC",
            "Done",
            "High",
            "Story",
            "Sam Chen",
            5,
            "s6",
            "e9",
          ),
          mkTask(
            "t25",
            "PAI-102",
            "AI feature flag framework",
            "In Progress",
            "Medium",
            "Task",
            "Riley Wong",
            3,
            "s6",
            "e9",
          ),
          mkTask(
            "t26",
            "PAI-103",
            "Personalisation model integration",
            "Blocked",
            "High",
            "Story",
            "Priya Sharma",
            8,
            "s6",
            "e9",
            ["blocked"],
          ),
          mkTask(
            "t27",
            "PAI-104",
            "A/B testing infrastructure",
            "To Do",
            "Low",
            "Task",
            "Sam Chen",
            2,
            "s6",
          ),
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
    active: "var(--green)",
    planning: "var(--amber)",
    on_hold: "var(--text-3)",
    completed: "var(--accent)",
  }[status];
}

export function getPriorityColor(priority: ProjectTask["priority"]): string {
  return {
    Critical: "var(--red)",
    High: "var(--amber)",
    Medium: "var(--accent)",
    Low: "var(--text-3)",
  }[priority];
}

export function getTaskStatusColor(status: ProjectTask["status"]): string {
  return {
    "To Do": "var(--text-3)",
    "In Progress": "var(--amber)",
    "In Review": "var(--purple)",
    Blocked: "var(--red)",
    Done: "var(--green)",
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
  if (!name) return "";
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

  const totalTickets = Object.values(statuses).reduce((a, b) => a + b, 0);
  const completedTickets = DONE_KEYS.reduce(
    (a, k) => a + (statuses[k] ?? 0),
    0,
  );
  const inProgress = IN_PROG_KEYS.reduce((a, k) => a + (statuses[k] ?? 0), 0);
  const blocked = BLOCKED_KEYS.reduce((a, k) => a + (statuses[k] ?? 0), 0);
  const progress =
    totalTickets > 0 ? Math.round((completedTickets / totalTickets) * 100) : 0;

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
  const sprintTasks: ProjectTask[] = (sprintDetail?.tickets ?? []).map(
    (t, i) => ({
      id: t.id,
      key: t.jira_key,
      title: t.summary,
      status: normalizeStatus(t.status),
      priority: normalizePriority(t.priority),
      type: normalizeType(t.issue_type),
      assignee: t.assignee ?? "",
      assigneeInitials: initials(t.assignee),
      assigneeColor: hashColor(t.assignee ?? String(i)),
      storyPoints: t.story_points ?? 0,
      createdAt: "2026-01-01",
      updatedAt: "2026-04-14",
    }),
  );

  const projectSprint: ProjectSprint | undefined = activeSprint
    ? {
        id: String(activeSprint.id),
        name: activeSprint.name,
        status: activeSprint.status as ProjectSprint["status"],
        startDate: activeSprint.start_date ?? "",
        endDate: activeSprint.end_date ?? "",
        goal: activeSprint.goal ?? "",
        totalPoints: activeSprint.total_points ?? 0,
        donePoints: activeSprint.done_points ?? 0,
        tasks: sprintTasks,
      }
    : undefined;

  return {
    id: pod,
    key: pod,
    name: `${pod} Pod`,
    description: `${pod} engineering pod — ${totalTickets.toLocaleString()} total tickets`,
    status: "active",
    category: "Product",
    color: podColor,
    lead: members[0]?.name ?? "",
    leadInitials: members[0]?.initials ?? "",
    leadColor: members[0]?.color ?? podColor,
    members: members.slice(0, 8),
    sprints: projectSprint ? [projectSprint] : [],
    epics: [],
    startDate: "2026-01-01",
    progress,
    totalTickets,
    completedTickets,
    inProgressTickets: inProgress,
    blockedTickets: blocked,
    priority: "high",
    tags: [pod],
    weeklyActivity: [3, 5, 4, 6, 7, 5, 4],
    roles: ["admin", "engineering_manager", "tech_lead", "team_member"],
    backlogTasks: [],
  };
}
