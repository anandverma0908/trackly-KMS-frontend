import axios from "axios";
import type {
  Ticket,
  TicketsResponse,
  SummaryResponse,
  FiltersResponse,
  FilterState,
  ExportConfig,
  TicketCreate,
  TicketComment,
  TicketAttachment,
  TicketActivity,
  NLAnalysisResult,
  WikiSpace,
  WikiPage,
  WikiVersion,
  RelatedDoc,
  Sprint,
  BurndownPoint,
  VelocityPoint,
  Standup,
  KnowledgeGap,
  SearchResult,
  NovaQueryResponse,
  Notification,
  ClientBudget,
  BurnRateAlert,
  WorkloadEntry,
} from "@/types";
import type { Project } from "@/features/spaces/spacesData";
import { getAuthHeader } from "@/features/auth/useAuthStore";

const api = axios.create({
  baseURL: "/api",
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const headers = getAuthHeader();
  if (headers.Authorization) {
    config.headers.Authorization = headers.Authorization;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.detail ?? err.message ?? "Unknown error";
    console.error("[API Error]", msg);
    return Promise.reject(new Error(msg));
  },
);

function mock() {
  return (window as any).__EAP_MOCK__ ?? null;
}

/* ── Param builder — returns plain object for axios ── */
function buildParams(
  filters: Partial<FilterState>,
  pods?: string[],
  clients?: string[],
): Record<string, string> {
  const p: Record<string, string> = {};

  if (filters.dateFrom) p.date_from = filters.dateFrom;
  if (filters.dateTo)   p.date_to   = filters.dateTo;
  if (filters.user)     p.user      = filters.user;
  if (filters.project)  p.project   = filters.project;

  // Send as comma-separated — backend splits on ","
  const podList = pods?.length ? pods : filters.pod ? [filters.pod] : [];
  if (podList.length > 0) p.pod = podList.join(",");

  const clientList = clients?.length ? clients : filters.client ? [filters.client] : [];
  if (clientList.length > 0) p.client = clientList.join(",");

  return p;
}

export interface MultiFilters extends Partial<FilterState> {
  pods?: string[];
  clients?: string[];
}

export async function fetchTickets(filters: MultiFilters): Promise<TicketsResponse> {
  if (mock()) {
    const res = await mock().fetchTickets(filters);
    return { ...res, tickets: res.tickets.map(_mapTicketOut) };
  }
  const { data } = await api.get<any>("/tickets", {
    params: buildParams(filters, filters.pods, filters.clients),
  });
  return {
    ...data,
    tickets: (data.tickets || []).map(_mapTicketOut),
  };
}

export async function fetchTicket(key: string): Promise<Ticket> {
  if (mock()) {
    const t = await mock().fetchTicket(key);
    return _mapTicketOut(t);
  }
  const { data } = await api.get<any>(`/tickets/${key}`);
  return _mapTicketOut(data);
}

export async function fetchSummary(filters: MultiFilters): Promise<SummaryResponse> {
  if (mock()) return mock().fetchSummary(filters);
  const { data } = await api.get<SummaryResponse>("/summary", {
    params: buildParams(filters, filters.pods, filters.clients),
  });
  return data;
}

export async function fetchFilters(): Promise<FiltersResponse> {
  if (mock()) return mock().fetchFilters();
  const { data } = await api.get<FiltersResponse>("/filters");
  return data;
}

export async function downloadMonthlyReport(config: ExportConfig): Promise<void> {
  if (mock()) { mock().downloadMonthlyReport(config); return; }
  const p: Record<string, string> = {};
  if (config.dateFrom)   p.date_from   = config.dateFrom;
  if (config.dateTo)     p.date_to     = config.dateTo;
  if (config.monthLabel) p.month_label = config.monthLabel;
  if (config.pod)        p.pod         = config.pod;
  if (config.client)     p.client      = config.client;
  if (config.project)    p.project     = config.project;
  if (config.engineer)   p.user        = config.engineer;
  const { data } = await api.get("/export/monthly", { params: p, responseType: "blob" });
  _download(data, `timesheet_${config.monthLabel?.replace(" ", "_") ?? "report"}.xlsx`);
}

export async function downloadFYReport(config: ExportConfig): Promise<void> {
  if (mock()) { mock().downloadFYReport(config); return; }
  const p: Record<string, string> = {};
  if (config.dateFrom) p.date_from = config.dateFrom;
  if (config.dateTo)   p.date_to   = config.dateTo;
  if (config.fyLabel)  p.fy_label  = config.fyLabel;
  if (config.pod)      p.pod       = config.pod;
  if (config.client)   p.client    = config.client;
  if (config.project)  p.project   = config.project;
  if (config.engineer) p.user      = config.engineer;
  const { data } = await api.get("/export/fy", { params: p, responseType: "blob" });
  _download(data, `engineering_FY_${config.fyLabel ?? "2024-2025"}.xlsx`);
}

function _download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Ticket Management ── */
function _mapTicketIn(payload: Partial<TicketCreate>): any {
  const mapped: any = { ...payload };
  if ("title" in mapped) {
    mapped.summary = mapped.title;
    delete mapped.title;
  }
  if ("key" in mapped) {
    mapped.jira_key = mapped.key;
    delete mapped.key;
  }
  return mapped;
}

function _mapTicketOut(t: any): Ticket {
  return {
    ...t,
    key: t.key ?? t.jira_key,
    summary: t.summary ?? t.title ?? "",
    created: t.created ?? t.created_at ?? t.jira_created ?? "",
    updated: t.updated ?? t.updated_at ?? t.jira_updated ?? "",
    hours_spent: t.hours_spent ?? 0,
    worklogs: t.worklogs ?? [],
  };
}

export async function createTicket(payload: TicketCreate) {
  if (mock()?.createTicket) {
    const t = await mock().createTicket(payload);
    return _mapTicketOut(t);
  }
  const { data } = await api.post("/tickets", _mapTicketIn(payload));
  return _mapTicketOut(data);
}

export async function updateTicket(key: string, payload: Partial<TicketCreate>) {
  if (mock()?.updateTicket) {
    const t = await mock().updateTicket(key, payload);
    return _mapTicketOut(t);
  }
  const { data } = await api.put(`/tickets/${key}`, _mapTicketIn(payload));
  return _mapTicketOut(data);
}

export async function deleteTicket(key: string) {
  if (mock()?.deleteTicket) return mock().deleteTicket(key);
  await api.delete(`/tickets/${key}`);
}

export async function updateTicketStatus(key: string, status: string) {
  if (mock()?.updateTicketStatus) return mock().updateTicketStatus(key, status);
  const { data } = await api.post(`/tickets/${key}/status`, { status });
  return data;
}

export async function analyzeTicketNL(text: string): Promise<NLAnalysisResult> {
  if (mock()?.analyzeTicketNL) return mock().analyzeTicketNL(text);
  const { data } = await api.post("/tickets/ai-analyze", { text });
  const fields = data.fields ?? {};
  return {
    title: fields.title,
    description: fields.description,
    pod: fields.pod,
    client: fields.client,
    issue_type: fields.issue_type,
    priority: fields.priority,
    story_points: fields.story_points,
    assignee: fields.assignee,
    labels: fields.labels,
    duplicates: data.duplicates,
    confidence: data.confidence,
  };
}

export async function analyzeTicket(key: string): Promise<NLAnalysisResult> {
  const { data } = await api.post("/tickets/ai-analyze", { ticket_key: key });
  return data;
}

export async function fetchTicketComments(key: string): Promise<TicketComment[]> {
  const { data } = await api.get(`/tickets/${key}/comments`);
  return data;
}

export async function createComment(key: string, content: string, parentId?: number): Promise<TicketComment> {
  const { data } = await api.post(`/tickets/${key}/comments`, { body: content, parent_id: parentId });
  return data;
}

export async function deleteComment(key: string, commentId: number) {
  await api.delete(`/tickets/${key}/comments/${commentId}`);
}

export async function fetchTicketAttachments(key: string): Promise<TicketAttachment[]> {
  const { data } = await api.get(`/tickets/${key}/attachments`);
  return data;
}

export async function uploadAttachment(key: string, file: File): Promise<TicketAttachment> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post(`/tickets/${key}/attachments`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function fetchTicketActivity(key: string): Promise<TicketActivity[]> {
  const { data } = await api.get(`/tickets/${key}/activity`);
  return data;
}

/* ── Wiki ── */
export async function fetchWikiSpaces(): Promise<WikiSpace[]> {
  const { data } = await api.get("/wiki/spaces");
  return data;
}

export async function createWikiSpace(payload: { name: string; description: string }): Promise<WikiSpace> {
  const slug = payload.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const { data } = await api.post("/wiki/spaces", { ...payload, slug });
  return data;
}

export async function fetchWikiPages(spaceId?: string): Promise<WikiPage[]> {
  const { data } = await api.get("/wiki/pages", { params: spaceId ? { space_id: spaceId } : {} });
  return data;
}

export async function fetchWikiPage(id: string): Promise<WikiPage> {
  const { data } = await api.get(`/wiki/pages/${id}`);
  return data;
}

export async function createWikiPage(payload: { space_id: string; title: string; content: string; parent_id?: string }): Promise<WikiPage> {
  const { data } = await api.post("/wiki/pages", { ...payload, content_md: payload.content });
  return data;
}

export async function updateWikiPage(id: string, payload: { title?: string; content?: string }): Promise<WikiPage> {
  const mapped: any = { ...payload };
  if (payload.content !== undefined) {
    mapped.content_md = payload.content;
    delete mapped.content;
  }
  const { data } = await api.put(`/wiki/pages/${id}`, mapped);
  return data;
}

export async function deleteWikiPage(id: string) {
  await api.delete(`/wiki/pages/${id}`);
}

export async function fetchWikiVersions(id: string): Promise<WikiVersion[]> {
  const { data } = await api.get(`/wiki/pages/${id}/versions`);
  return data;
}

export async function restoreWikiVersion(id: string, version: number): Promise<WikiPage> {
  const { data } = await api.post(`/wiki/pages/${id}/restore`, null, { params: { version } });
  return data;
}

export async function fetchRelatedDocs(type: 'ticket' | 'wiki', id: string | number): Promise<RelatedDoc[]> {
  const path = type === 'ticket' ? `/tickets/${id}/related` : `/wiki/pages/${id}/related`;
  const { data } = await api.get(path);
  return data;
}

export async function extractMeetingActions(content: string) {
  const { data } = await api.post("/wiki/ai/meeting-notes", { content });
  return data;
}

/* ── Search ── */
export async function semanticSearch(query: string, scope?: 'all' | 'tickets' | 'wiki'): Promise<SearchResult[]> {
  const { data } = await api.post("/search", { query, scope: scope ?? 'all' });
  return data?.results ?? data ?? [];
}

export async function novaQuery(query: string, scope?: 'all' | 'wiki'): Promise<NovaQueryResponse> {
  const { data } = await api.post("/nova/query", { query, scope });
  return data;
}

/* ── Sprints ── */
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

export async function createSprint(payload: { name: string; goal?: string; start_date: string; end_date: string; project_id?: string }): Promise<Sprint> {
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
  return data?.data ?? data ?? [];
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

/* ── Standup ── */
export async function fetchTodayStandup(): Promise<Standup | null> {
  try {
    const { data } = await api.get("/nova/standup/today");
    return data;
  } catch {
    return null;
  }
}

export async function fetchTeamStandups(date?: string, pod?: string): Promise<Standup[]> {
  const { data } = await api.get("/nova/standup/team", { params: { date, pod } });
  return data?.standups ?? data ?? [];
}

export async function updateStandup(id: number, payload: Partial<Standup>): Promise<Standup> {
  const { data } = await api.put(`/nova/standup/${id}`, payload);
  return data;
}

export async function generateStandup(): Promise<Standup> {
  const { data } = await api.post("/nova/standup/generate");
  return data;
}

/* ── Knowledge Gaps ── */
export async function fetchKnowledgeGaps(): Promise<KnowledgeGap[]> {
  const { data } = await api.get("/nova/knowledge-gaps");
  return data?.gaps ?? data ?? [];
}

export async function detectKnowledgeGaps() {
  const { data } = await api.post("/nova/knowledge-gaps/detect");
  return data;
}

/* ── Pod Analytics ── */
export interface PodSummary {
  pod: string;
  statuses: Record<string, number>;
  total_hours: number;
}

export async function fetchPodSummary(): Promise<PodSummary[]> {
  const { data } = await api.get<PodSummary[]>("/analytics/pod-summary");
  return data ?? [];
}

/* ── Sprint Detail (with tickets) ── */
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

export async function fetchSprintDetail(id: string): Promise<SprintDetail> {
  const { data } = await api.get<SprintDetail>(`/sprints/${id}`);
  return data;
}

/* ── Spaces / Projects ── */
export async function fetchProject(pod: string): Promise<Project> {
  if (mock()?.fetchProject) return mock().fetchProject(pod);
  const { data } = await api.get<Project>(`/spaces/${pod}/project`);
  return data;
}

export async function createSpace(payload: {
  key: string;
  name: string;
  description: string;
  category: string;
  color: string;
}) {
  if (mock()?.createSpace) return mock().createSpace(payload);
  const { data } = await api.post("/spaces", payload);
  return data;
}

export async function deleteSpace(pod: string) {
  if (mock()?.deleteSpace) return mock().deleteSpace(pod);
  const { data } = await api.delete(`/spaces/${pod}`);
  return data;
}

/* ── Notifications ── */
export async function fetchNotifications(): Promise<Notification[]> {
  const { data } = await api.get("/notifications");
  return data?.notifications ?? data ?? [];
}

export async function markNotificationRead(id: number) {
  await api.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  await api.post("/notifications/read-all");
}

/* ── Client Budget / Burn Rate ── */
export async function fetchBurnRates(): Promise<ClientBudget[]> {
  const { data } = await api.get("/clients/burn-rate");
  return Array.isArray(data) ? data : (data?.clients ?? []);
}

export async function setClientBudget(client: string, budgetHours: number) {
  const now = new Date();
  const { data } = await api.post("/clients/budget", {
    client,
    month: now.getMonth() + 1,
    year:  now.getFullYear(),
    budget_hours: budgetHours,
  });
  return data;
}

export async function fetchBurnRateAlerts(): Promise<BurnRateAlert[]> {
  const { data } = await api.get("/clients/burn-rate/alerts");
  return Array.isArray(data) ? data : (data?.alerts ?? []);
}

/* ── Analytics ── */
export async function fetchWorkload(): Promise<WorkloadEntry[]> {
  const { data } = await api.get("/analytics/workload");
  return data?.data ?? data ?? [];
}

export async function fetchOrgMembers() {
  const { data } = await api.get("/users/members");
  return data as import("@/types").OrgMember[];
}

export async function fetchNovaStatus() {
  const { data } = await api.get("/nova/status");
  return data;
}

/* ── Timer / Time logging ── */
export async function logTime(ticketKey: string, hours: number, comment: string, date: string) {
  const { data } = await api.post(`/tickets/${ticketKey}/worklogs`, { hours, comment, date });
  return data;
}