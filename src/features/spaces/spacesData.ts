/* ── Spaces / Projects feature data + real-data bridge ── */

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
  status: string; // allow unmapped statuses from backend
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
  parentId?: string;
  pod?: string;
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

/* ── Helpers ── */
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

export function getTaskStatusColor(status: string): string {
  return (
    {
      "To Do": "var(--text-3)",
      "In Progress": "var(--amber)",
      "In Review": "var(--purple)",
      Blocked: "var(--red)",
      Done: "var(--green)",
    } as Record<string, string>
  )[status] ?? "var(--text-3)";
}
