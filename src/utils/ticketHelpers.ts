import type { Ticket } from "@/types";

/* ── Ticket → drawer form shape ─────────────────────────────────────────── */

export interface TicketInitialData {
  title: string;
  description: string;
  issue_type: string;
  priority: string;
  status: string;
  assignee?: string;
  reporter: string;
  pod?: string;
  client?: string;
  story_points?: number;
  labels?: string[];
  due_date?: string;
  epic: string;
  parent: string;
  originalEst: string;
  timeSpent: string;
  remaining: string;
}

export function ticketToInitialData(ticket: Ticket): TicketInitialData {
  return {
    title:        ticket.summary,
    description:  ticket.description ?? "",
    issue_type:   ticket.issue_type,
    priority:     ticket.priority,
    status:       ticket.status,
    assignee:     ticket.assignee,
    reporter:     ticket.reporter ?? "",
    pod:          ticket.pod,
    client:       ticket.client,
    story_points: ticket.story_points,
    labels:       ticket.labels,
    due_date:     ticket.due_date,
    epic:         ticket.epic ?? "",
    parent:       ticket.parent ?? "",
    originalEst:  ticket.original_estimate_hours
      ? String(ticket.original_estimate_hours)
      : "",
    timeSpent:    ticket.hours_spent ? String(ticket.hours_spent) : "",
    remaining:    ticket.remaining_estimate_hours
      ? String(ticket.remaining_estimate_hours)
      : "",
  };
}

/* ── Status metadata ─────────────────────────────────────────────────────── */

export interface StatusMeta {
  color: string;
  bg:    string;
  label: string;
}

const STATUS_MAP: Record<string, StatusMeta> = {
  "In Progress": { color: "var(--accent)",          bg: "rgba(79,126,255,0.15)",  label: "In Progress" },
  "In Review":   { color: "var(--amber)",            bg: "rgba(251,191,36,0.15)", label: "In Review"   },
  "Blocked":     { color: "var(--red,#F87171)",      bg: "rgba(248,113,113,0.15)",label: "Blocked"     },
  "To Do":       { color: "var(--text-3)",           bg: "var(--surface-2)",      label: "To Do"       },
  "Open":        { color: "var(--text-3)",           bg: "var(--surface-2)",      label: "Open"        },
  "Reopened":    { color: "var(--cyan,#22D3EE)",     bg: "rgba(34,211,238,0.12)", label: "Reopened"    },
  "Done":        { color: "var(--green,#34D399)",    bg: "rgba(52,211,153,0.12)", label: "Done"        },
  "Closed":      { color: "var(--green,#34D399)",    bg: "rgba(52,211,153,0.12)", label: "Closed"      },
};

const STATUS_DEFAULT: StatusMeta = {
  color: "var(--text-3)",
  bg:    "var(--surface-2)",
  label: "",
};

export function statusToMeta(status: string): StatusMeta {
  if (status.toLowerCase().includes("block")) return STATUS_MAP["Blocked"];
  return STATUS_MAP[status] ?? { ...STATUS_DEFAULT, label: status };
}

/* ── Priority metadata ───────────────────────────────────────────────────── */

export interface PriorityMeta {
  icon:  string;
  color: string;
  label: string;
}

const PRIORITY_MAP: Record<string, PriorityMeta> = {
  Highest: { icon: "⬆⬆", color: "var(--red,#F87171)",  label: "Highest" },
  High:    { icon: "⬆",   color: "var(--amber)",        label: "High"    },
  Medium:  { icon: "▶",   color: "var(--accent)",       label: "Medium"  },
  Low:     { icon: "⬇",   color: "var(--green)",        label: "Low"     },
  Lowest:  { icon: "⬇⬇", color: "var(--text-3)",       label: "Lowest"  },
};

const PRIORITY_DEFAULT: PriorityMeta = {
  icon:  "▶",
  color: "var(--text-3)",
  label: "",
};

export function priorityToMeta(priority: string): PriorityMeta {
  return PRIORITY_MAP[priority] ?? { ...PRIORITY_DEFAULT, label: priority };
}

/* ── Avatar color ────────────────────────────────────────────────────────── */

const AVATAR_COLORS = [
  "#4F7EFF", "#8B5CF6", "#EC4899", "#F59E0B",
  "#10B981", "#3B82F6", "#EF4444", "#06B6D4",
];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
