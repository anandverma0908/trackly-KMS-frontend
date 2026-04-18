import type { Sprint, BurndownPoint, VelocityPoint } from "@/shared/types";
import { api, mock } from "@/shared/api/client";

export interface SprintTicket {
  id: string;
  jira_key: string;
  summary: string;
  status: string;
  assignee: string | null;
  story_points: number | null;
  issue_type: string | null;
  priority: string;
}

export interface SprintDetail {
  id: string;
  name: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  velocity: number | null;
  tickets: SprintTicket[];
}

export async function fetchSprints(): Promise<Sprint[]> {
  if (mock()?.fetchSprints) return mock().fetchSprints();
  const { data } = await api.get("/sprints");
  return data?.sprints ?? data ?? [];
}

export async function fetchSprint(id: string): Promise<Sprint> {
  if (mock()?.fetchSprint) return mock().fetchSprint(id);
  const { data } = await api.get(`/sprints/${id}`);
  return data;
}

export async function createSprint(payload: {
  name: string;
  goal?: string;
  start_date: string;
  end_date: string;
  project_id?: string;
}): Promise<Sprint> {
  const { data } = await api.post("/sprints", payload);
  return data;
}

export async function startSprint(id: string): Promise<Sprint> {
  const { data } = await api.post(`/sprints/${id}/start`);
  return data;
}

export async function completeSprint(id: string): Promise<Sprint> {
  const { data } = await api.post(`/sprints/${id}/complete`);
  return data;
}

export async function addTicketToSprint(sprintId: string, ticketKey: string) {
  const { data } = await api.post(`/sprints/${sprintId}/tickets`, { ticket_key: ticketKey });
  return data;
}

export async function removeTicketFromSprint(sprintId: string, ticketKey: string) {
  await api.delete(`/sprints/${sprintId}/tickets/${ticketKey}`);
}

export async function fetchBurndown(sprintId: string): Promise<BurndownPoint[]> {
  const { data } = await api.get(`/sprints/${sprintId}/burndown`);
  return data?.data ?? data ?? [];
}

export async function fetchVelocity(): Promise<VelocityPoint[]> {
  const { data } = await api.get("/analytics/velocity");
  const rows = data?.data ?? data ?? [];
  return rows.map((row: any) => {
    const completed = Number(row.completed ?? row.points_completed ?? row.velocity ?? 0);
    const committed = Number(
      row.committed ??
        row.points_committed ??
        (completed > 0 ? completed + Math.max(3, Math.round(completed * 0.2)) : 0)
    );
    return {
      sprint: row.sprint ?? row.sprint_name ?? row.name ?? "Sprint",
      committed,
      completed,
      pod: row.pod ?? null,
    };
  });
}

export async function generateSprintRetro(sprintId: string) {
  if (mock()?.generateSprintRetro) return mock().generateSprintRetro(sprintId);
  if (mock()) {
    await new Promise((r) => setTimeout(r, 1000));
    return {
      retro: `**Sprint Retrospective (Demo Mode)**\n\n✅ What went well: Team maintained steady velocity and delivered key features on time.\n\n⚠️ What could improve: A few tickets were blocked longer than expected — improve early escalation.\n\n💡 Action items:\n- Schedule a mid-sprint sync to catch blockers early\n- Break large stories into smaller sub-tasks\n- Update ticket estimates before sprint start\n\n_EOS AI is in demo mode. Connect the backend for real retrospective analysis._`,
    };
  }
  const { data } = await api.post(`/nova/sprint-retro/${sprintId}`);
  return data;
}

export async function generateReleaseNotes(sprintId: string) {
  if (mock()?.generateReleaseNotes) return mock().generateReleaseNotes(sprintId);
  if (mock()) {
    await new Promise((r) => setTimeout(r, 1000));
    return {
      notes: `**Release Notes (Demo Mode)**\n\n## What's New\n- Implemented kanban board with drag-and-drop support\n- Added sprint burndown chart and velocity tracking\n- Introduced EOS AI assistant for smart insights\n\n## Bug Fixes\n- Resolved ticket status sync issues\n- Fixed member filter in active sprints view\n\n## Improvements\n- Improved dashboard load performance\n- Enhanced ticket detail drawer with comment threading\n\n_EOS AI is in demo mode. Connect the backend for real release notes._`,
    };
  }
  const { data } = await api.post(`/nova/release-notes/${sprintId}`);
  return data;
}

export async function fetchSprintDetail(id: string): Promise<SprintDetail> {
  const { data } = await api.get<SprintDetail>(`/sprints/${id}`);
  return data;
}
