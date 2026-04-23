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
  Goal,
  GoalsResponse,
  Decision,
  DecisionsResponse,
  Process,
  ProcessesResponse,
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

function _normalizeSearchResult(raw: any): SearchResult {
  const type = raw.type ?? raw.source_type ?? "wiki";
  const id = raw.id ?? raw.key ?? "";
  const key = raw.key ?? undefined;
  const score = typeof raw.score === "number"
    ? raw.score
    : typeof raw.similarity === "number"
      ? raw.similarity
      : 0;

  const url = raw.url ?? (
    type === "ticket" && key
      ? `/tickets?key=${encodeURIComponent(String(key))}`
      : type === "wiki" && id
        ? `/wiki?page=${encodeURIComponent(String(id))}`
        : undefined
  );

  return {
    id,
    type,
    title: raw.title ?? "",
    key,
    snippet: raw.snippet ?? "",
    score,
    url,
    space: raw.space ?? raw.space_name,
  };
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
  return (data as any[]).map((c) => ({
    ...c,
    author: c.author_name ?? c.author ?? "Unknown",
    content: c.body ?? c.content ?? "",
  }));
}

export async function createComment(key: string, content: string, parentId?: string): Promise<TicketComment> {
  const { data } = await api.post(`/tickets/${key}/comments`, { body: content, parent_id: parentId });
  return { ...data, author: data.author_name ?? "Unknown", content: data.body ?? "" };
}

export async function editComment(key: string, commentId: string, content: string): Promise<TicketComment> {
  const { data } = await api.put(`/tickets/${key}/comments/${commentId}`, { body: content });
  return { ...data, author: data.author_name ?? "Unknown", content: data.body ?? "" };
}

export async function deleteComment(key: string, commentId: string) {
  await api.delete(`/tickets/${key}/comments/${commentId}`);
}

export async function fetchTicketAttachments(key: string): Promise<TicketAttachment[]> {
  const { data } = await api.get(`/tickets/${key}/attachments`);
  return (data as any[]).map((a) => ({
    ...a,
    url: a.url ?? (a.filepath ? `/uploads/${a.filepath.split("/").pop()}` : ""),
    size: a.size_bytes ?? a.size ?? 0,
    uploaded_at: a.created_at ?? "",
  }));
}

export async function uploadAttachment(key: string, file: File): Promise<TicketAttachment> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post(`/tickets/${key}/attachments`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return {
    ...data,
    url: data.url ?? (data.filepath ? `/uploads/${data.filepath.split("/").pop()}` : ""),
    size: data.size_bytes ?? 0,
    uploaded_at: data.created_at ?? "",
  };
}

export interface WorklogEntry {
  id: string;
  author: string;
  author_email?: string;
  log_date: string;
  hours: number;
  comment?: string;
}

export async function fetchTicketWorklogs(key: string): Promise<WorklogEntry[]> {
  const { data } = await api.get(`/tickets/${key}/worklogs`);
  return data ?? [];
}

export interface TicketLink {
  id: string;
  source_ticket_id: string;
  target_key: string;
  target_summary?: string;
  link_type: string;
  created_at: string;
}

export async function fetchTicketLinks(key: string): Promise<TicketLink[]> {
  const { data } = await api.get(`/tickets/${key}/links`);
  return data ?? [];
}

export async function createTicketLink(key: string, link_type: string, target_key: string): Promise<TicketLink> {
  const { data } = await api.post(`/tickets/${key}/links`, { link_type, target_key });
  return data;
}

export async function deleteTicketLink(key: string, linkId: string) {
  await api.delete(`/tickets/${key}/links/${linkId}`);
}

export async function searchTickets(query: string): Promise<{ key: string; summary: string }[]> {
  const { data } = await api.get("/tickets", { params: { search: query, limit: 10 } });
  return (data.tickets ?? []).map((t: any) => ({ key: t.key ?? t.jira_key, summary: t.summary }));
}

export async function fetchTicketActivity(key: string): Promise<TicketActivity[]> {
  const { data } = await api.get(`/tickets/${key}/activity`);
  return (data as any[]).map((a) => {
    const diffVals = a.diff ? Object.values(a.diff as Record<string, any>) : [];
    const firstVal = diffVals[0] as any;
    return {
      id: a.id,
      ticket_key: key,
      actor: a.actor ?? "System",
      action: a.action,
      field: a.diff ? Object.keys(a.diff as object)[0] : undefined,
      old_value: firstVal?.old?.toString(),
      new_value: firstVal?.new?.toString(),
      created_at: a.created_at ?? "",
    };
  });
}

export interface CodeContextResult {
  connected: boolean;
  files: { path: string; url: string; repo?: string }[];
  prs: { number: string; title: string; status: "open" | "merged" | "closed"; url: string; repo?: string }[];
  search_terms?: string[];
}

export async function fetchTicketCodeContext(key: string, title: string, description?: string): Promise<CodeContextResult> {
  const { data } = await api.get(`/tickets/${encodeURIComponent(key)}/code-context`, {
    params: { title, description: description?.slice(0, 500) ?? "" },
  });
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
  return (data?.results ?? data ?? []).map(_normalizeSearchResult);
}

export async function triggerReindex(): Promise<void> {
  await api.post("/search/reindex");
}

export async function novaQuery(query: string, scope?: 'all' | 'wiki'): Promise<NovaQueryResponse> {
  const { data } = await api.post("/nova/query", { query, scope });
  return {
    answer: data?.answer ?? "",
    query: data?.query ?? query,
    citations: (data?.citations ?? data?.sources ?? []).map(_normalizeSearchResult),
  };
}

/* ── Sprints ── */
export async function fetchSprints(): Promise<Sprint[]> {
  const { data } = await api.get("/sprints");
  return data?.sprints ?? data ?? [];
}

export async function fetchSprint(id: string): Promise<Sprint> {
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
  const rows = data?.data ?? data ?? [];
  return rows.map((row: any) => {
    const completed = Number(row.completed ?? row.points_completed ?? row.velocity ?? 0);
    const committed = Number(row.committed ?? row.points_committed ?? (completed > 0 ? completed + Math.max(3, Math.round(completed * 0.2)) : 0));
    return {
      sprint: row.sprint ?? row.sprint_name ?? row.name ?? "Sprint",
      committed,
      completed,
      pod: row.pod ?? null,
    };
  });
}

export async function generateSprintRetro(sprintId: string) {
  const { data } = await api.post(`/nova/sprint-retro/${sprintId}`);
  return data;
}

export async function generateReleaseNotes(sprintId: string) {
  const { data } = await api.post(`/nova/release-notes/${sprintId}`);
  return data;
}

/* ── Sprint Capacity ── */
export async function fetchSprintCapacity(sprintId: string): Promise<import("@/types").SprintCapacity> {
  const { data } = await api.get(`/sprints/${sprintId}/capacity`);
  return data;
}

export async function fetchSprintBurnUp(sprintId: string): Promise<import("@/types").BurnUpPoint[]> {
  const { data } = await api.get(`/sprints/${sprintId}/burnup`);
  return data?.data ?? data ?? [];
}

/* ── Sprint Lifecycle ── */
export async function freezeSprintScope(sprintId: string) {
  const { data } = await api.post(`/sprints/${sprintId}/scope-freeze`);
  return data;
}

export async function extendSprint(sprintId: string, extraDays: number) {
  const { data } = await api.post(`/sprints/${sprintId}/extend`, { extra_days: extraDays });
  return data;
}

export async function beginEosReview(sprintId: string) {
  const { data } = await api.post(`/sprints/${sprintId}/eos-review`);
  return data;
}

/* ── Sprint Blockers ── */
export async function fetchSprintBlockers(sprintId: string): Promise<import("@/types").SprintBlocker[]> {
  const { data } = await api.get(`/sprints/${sprintId}/blockers`);
  return data?.blockers ?? data ?? [];
}

export async function escalateBlocker(sprintId: string, ticketKey: string) {
  const { data } = await api.post(`/sprints/${sprintId}/blockers/${ticketKey}/escalate`);
  return data;
}

/* ── Sprint Dependencies ── */
export async function fetchSprintDependencies(sprintId: string): Promise<import("@/types").SprintDependencyGraph> {
  const { data } = await api.get(`/sprints/${sprintId}/dependencies`);
  return data;
}

/* ── Sprint What-If ── */
export async function runWhatIfSimulation(
  sprintId: string,
  changes: { type: 'reassign' | 'remove' | 'add' | 'extend' | 'split'; ticket_key?: string; target_user?: string; extra_days?: number; description: string }[]
): Promise<import("@/types").WhatIfScenario[]> {
  const { data } = await api.post(`/sprints/${sprintId}/what-if`, { changes });
  return data?.scenarios ?? data ?? [];
}

/* ── Sprint Timeline ── */
export async function fetchSprintTimeline(sprintId: string): Promise<import("@/types").TimelineEvent[]> {
  const { data } = await api.get(`/sprints/${sprintId}/timeline`);
  return data?.events ?? data ?? [];
}

/* ── Sprint Team ── */
export async function fetchSprintTeam(sprintId: string): Promise<{ members: import("@/types").SprintMemberCapacity[]; roster: { user_id: string; name: string; role: string; avatar?: string; capacity_hours: number; assigned_points: number; ticket_count: number }[] }> {
  const { data } = await api.get(`/sprints/${sprintId}/team`);
  return data;
}

/* ── Sprint Wiki Gaps ── */
export async function fetchSprintWikiGaps(sprintId: string): Promise<import("@/types").SprintWikiGap[]> {
  const { data } = await api.get(`/sprints/${sprintId}/wiki-gaps`);
  return data?.gaps ?? data ?? [];
}

/* ── Sprint Forecast ── */
export async function fetchSprintForecast(sprintId: string): Promise<import("@/types").SprintForecast> {
  const { data } = await api.get(`/sprints/${sprintId}/forecast`);
  return data;
}

/* ── Sprint Drift ── */
export async function fetchSprintDrift(sprintId: string): Promise<{ drift_points: import("@/types").BurndownPoint[]; anomalies: { date: string; type: string; severity: 'high' | 'medium' | 'low'; description: string }[]; nova_summary: string }> {
  const { data } = await api.get(`/sprints/${sprintId}/drift`);
  return data;
}

/* ── Velocity Trend ── */
export async function fetchVelocityTrend(pod?: string): Promise<import("@/types").VelocityPoint[]> {
  const { data } = await api.get("/analytics/velocity-trend", { params: pod ? { pod } : {} });
  return data?.data ?? data ?? [];
}

/* ── Sprint Comparison ── */
export async function fetchSprintComparison(sprintA: string, sprintB: string): Promise<import("@/types").SprintComparison> {
  const { data } = await api.get("/sprints/compare", { params: { sprint_a: sprintA, sprint_b: sprintB } });
  return data;
}

/* ── Sprint Risk Heatmap ── */
export async function fetchSprintRiskHeatmap(sprintId: string): Promise<import("@/types").SprintRiskTicket[]> {
  const { data } = await api.get(`/sprints/${sprintId}/risk-heatmap`);
  return data?.tickets ?? data ?? [];
}

/* ── Sprint AI Chat ── */
export async function sendSprintChat(sprintId: string, message: string, history: { role: string; text: string }[]): Promise<import("@/types").SprintChatMessage> {
  const { data } = await api.post(`/nova/sprint-chat/${sprintId}`, { message, history });
  return {
    id: data.id ?? `msg_${Date.now()}`,
    role: 'assistant',
    text: data.answer ?? data.text ?? "",
    citations: data.citations ?? [],
    created_at: data.created_at ?? new Date().toISOString(),
  };
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
export interface PodRiskFlags {
  blocked: number;
  overdue: number;
  bug_rate: number;
  stale: number;
}

export interface PodSummary {
  pod: string;
  statuses: Record<string, number>;
  total_hours: number;
  health_score: number;
  delivery_confidence: number;
  sprint_prediction: number | null;
  has_active_sprint: boolean;
  sprint_name: string | null;
  risk_flags: PodRiskFlags;
  trend: number[];
}

export async function fetchPodSummary(): Promise<PodSummary[]> {
  if (mock()?.fetchPodSummary) return mock().fetchPodSummary();
  const { data } = await api.get<PodSummary[]>("/analytics/pod-summary");
  return data ?? [];
}

export interface SpaceHealthRadar {
  delivery: number; velocity: number; clarity: number;
  momentum: number; flow: number; quality: number; on_time: number;
}

export interface SpaceHealth {
  health_score: number;
  radar: SpaceHealthRadar;
  delivery_confidence: number;
  sprint_prediction: number | null;
  trend: number[];
  risk_flags: PodRiskFlags;
}

export async function fetchSpaceHealth(pod: string): Promise<SpaceHealth> {
  const { data } = await api.get<SpaceHealth>(`/spaces/${pod}/health`);
  return data;
}

export interface SpaceAnomaly {
  pod: string;
  type: string;
  severity: "high" | "medium" | "low";
  description: string;
  detected_at: string;
}

export async function fetchAnomalies(): Promise<SpaceAnomaly[]> {
  const { data } = await api.get<SpaceAnomaly[]>("/spaces/anomalies");
  return data ?? [];
}

export interface SpaceDependency {
  from_pod: string;
  to_pod: string;
  blocker_ticket_key: string;
  blocker_summary: string;
  impact_score: number;
}

export async function fetchDependencies(): Promise<SpaceDependency[]> {
  const { data } = await api.get<SpaceDependency[]>("/spaces/dependencies");
  return data ?? [];
}

export interface CapacityEntry {
  engineer: string;
  pod: string;
  allocated_pts: number;
  ticket_count: number;
  capacity_pct: number;
  overloaded: boolean;
}

export async function fetchCapacity(): Promise<CapacityEntry[]> {
  const { data } = await api.get<CapacityEntry[]>("/analytics/capacity");
  return data ?? [];
}

export interface SpacesBriefResult {
  pod: string;
  health_score: number;
  brief: string;
  velocity_signal: string;
  risk_signal: string;
  recommendation: string;
  nova_powered: boolean;
}

export async function fetchSpacesBrief(pod: string): Promise<SpacesBriefResult> {
  const { data } = await api.post<SpacesBriefResult>(`/nova/spaces-brief/${pod}`);
  return data;
}

export interface SelfOrgSuggestion {
  from_pod: string;
  to_pod: string;
  reason: string;
  confidence: number;
  urgency: "high" | "medium" | "low";
}

export interface SelfOrgResult {
  suggestions: SelfOrgSuggestion[];
  nova_powered: boolean;
  pod_snapshots: { pod: string; health_score: number; blocked: number; member_count: number }[];
}

export async function fetchSelfOrg(): Promise<SelfOrgResult> {
  const { data } = await api.get<SelfOrgResult>("/nova/self-org");
  return data;
}

export interface SprintDraftTicket {
  key: string;
  summary: string;
  suggested_points: number;
  priority: string;
  rationale: string;
}

export interface SprintDraftResult {
  pod: string;
  tickets: SprintDraftTicket[];
  total_points: number;
  rationale: string;
  nova_powered: boolean;
}

export async function fetchSprintDraft(pod: string): Promise<SprintDraftResult> {
  const { data } = await api.post<SprintDraftResult>(`/nova/sprint-draft/${pod}`);
  return data;
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
  member_ids?: string[];
}) {
  if (mock()?.createSpace) return mock().createSpace(payload);
  const { data } = await api.post("/spaces", payload);
  return data;
}

export async function fetchOrgUsers() {
  const { data } = await api.get("/users/members");
  return data as { id: string; name: string; email: string; role: string; initials: string; color: string }[];
}

export async function addSpaceMember(pod: string, user_id: string, role = "member") {
  const { data } = await api.post(`/spaces/${pod}/members`, { user_id, role });
  return data;
}

export async function removeSpaceMember(pod: string, user_id: string) {
  const { data } = await api.delete(`/spaces/${pod}/members/${user_id}`);
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

export interface MyBriefResponse {
  brief:              string;
  top_ticket_key:     string | null;
  sprint_probability: number | null;
  blocker_count:      number;
  overdue_count:      number;
  wip_count:          number;
  open_count:         number;
  chips: Array<{ label: string; type: "critical" | "warning" | "info" | "action" }>;
}

export async function fetchMyBrief(): Promise<MyBriefResponse> {
  const { data } = await api.get("/nova/my-brief");
  return data;
}

/* ── My Work (AI-powered consolidated endpoint) ── */

export interface MyWorkAIRanking {
  key:     string;
  rank:    number;
  score:   number;
  urgency: "critical" | "high" | "medium" | "low";
  reason:  string;
  action:  string;
}

export interface MyWorkFlowAnalysis {
  context_switches: number;
  flow_state:       "focused" | "disrupted" | "scattered";
  recommendation:   string;
  focus_on:         string[];
}

export interface MyWorkBlockerPrediction {
  key:               string;
  reason:            string;
  hours_until_block: number;
  confidence:        number;
}

export interface MyWorkSprintRisk {
  committed:    number;
  completed:    number;
  remaining:    number;
  probability:  number;
  days_left:    number;
  wip_count:    number;
  status:       "on_track" | "at_risk" | "off_track";
  coaching:     string;
  sprint_name?: string;
}

export interface MyWorkTimeEnergy {
  total_logged:    number;
  total_estimated: number;
  overrun_count:   number;
  velocity_by_day: number[];
  peak_window:     string;
  focus_score:     number;
}

export interface MyWorkActivity {
  key:     string;
  summary: string;
  change:  string;
  time:    string;
  type:    "status" | "comment" | "assign" | "blocker";
}

export interface MyWorkResponse {
  tickets:             any[];
  priority_queue:      MyWorkAIRanking[];
  flow_analysis:       MyWorkFlowAnalysis;
  blocker_predictions: MyWorkBlockerPrediction[];
  sprint_risk:         MyWorkSprintRisk | null;
  time_energy:         MyWorkTimeEnergy;
  brief:               string;
  brief_chips:         Array<{ label: string; type: "critical" | "warning" | "info" | "action" }>;
  recent_activity:     MyWorkActivity[];
}

export async function fetchMyWork(): Promise<MyWorkResponse> {
  const { data } = await api.get("/nova/my-work");
  return data;
}

/* ── Timer / Time logging ── */
export async function logTime(ticketKey: string, hours: number, comment: string, date: string) {
  const { data } = await api.post(`/tickets/${ticketKey}/worklogs`, { hours, comment, date });
  return data;
}

/* ── Goals / OKRs ── */
export async function fetchGoals(quarter?: string): Promise<GoalsResponse> {
  const { data } = await api.get<GoalsResponse>("/goals", { params: quarter ? { quarter } : undefined });
  return data;
}

export async function fetchGoal(id: string): Promise<Goal> {
  const { data } = await api.get<Goal>(`/goals/${id}`);
  return data;
}

export async function createGoal(payload: Omit<Goal, "id" | "created_at" | "updated_at" | "nova_insight">): Promise<Goal> {
  const { data } = await api.post<Goal>("/goals", payload);
  return data;
}

export async function updateGoal(id: string, payload: Partial<Omit<Goal, "id" | "created_at" | "updated_at">>): Promise<Goal> {
  const { data } = await api.patch<Goal>(`/goals/${id}`, payload);
  return data;
}

export async function deleteGoal(id: string): Promise<void> {
  await api.delete(`/goals/${id}`);
}

export async function fetchGoalNovaInsight(goalId: string): Promise<string> {
  const { data } = await api.post<{ insight: string }>("/nova/goals-insight", { goal_id: goalId });
  return data.insight;
}

/* ── Decisions / ADRs ── */
function _mapDecisionOut(d: any): Decision {
  return {
    ...d,
    linkedTickets: d.linkedTickets ?? d.linked_tickets ?? [],
    tags: d.tags ?? [],
    alternatives: d.alternatives ?? [],
    space_id: d.space_id ?? null,
    org_level: d.org_level ?? false,
  };
}

export async function fetchDecisions(params?: {
  space_id?: string;
  org_level?: boolean;
  status?: string;
}): Promise<DecisionsResponse> {
  const { data } = await api.get<any>("/decisions", { params });
  const decisions = (data.decisions ?? data ?? []).map(_mapDecisionOut);
  return { decisions, total: data.total ?? decisions.length };
}

export async function fetchDecision(id: string): Promise<Decision> {
  const { data } = await api.get<any>(`/decisions/${id}`);
  return _mapDecisionOut(data);
}

export async function createDecision(
  payload: Omit<Decision, "id" | "created_at" | "updated_at">,
): Promise<Decision> {
  const { data } = await api.post<any>("/decisions", {
    ...payload,
    linked_tickets: payload.linkedTickets,
  });
  return _mapDecisionOut(data);
}

export async function updateDecision(
  id: string,
  payload: Partial<Omit<Decision, "id">>,
): Promise<Decision> {
  const { data } = await api.patch<any>(`/decisions/${id}`, {
    ...payload,
    linked_tickets: payload.linkedTickets,
  });
  return _mapDecisionOut(data);
}

export async function deleteDecision(id: string): Promise<void> {
  await api.delete(`/decisions/${id}`);
}

/* ── Processes / SOPs ── */
function _mapProcessOut(p: any): Process {
  return {
    ...p,
    lastUpdated: p.lastUpdated ?? p.last_updated ?? p.updated_at ?? "",
    complianceRequired: p.complianceRequired ?? p.compliance_required ?? false,
    avgCompletionTime: p.avgCompletionTime ?? p.avg_completion_time,
    runCount: p.runCount ?? p.run_count ?? 0,
    tags: p.tags ?? [],
    steps: (p.steps ?? []).map((s: any) => ({
      ...s,
      estimatedTime: s.estimatedTime ?? s.estimated_time,
    })),
    space_id: p.space_id ?? null,
    org_level: p.org_level ?? false,
  };
}

export async function fetchProcesses(params?: {
  space_id?: string;
  org_level?: boolean;
  category?: string;
}): Promise<ProcessesResponse> {
  const { data } = await api.get<any>("/processes", { params });
  const processes = (data.processes ?? data ?? []).map(_mapProcessOut);
  return { processes, total: data.total ?? processes.length };
}

export async function fetchProcess(id: string): Promise<Process> {
  const { data } = await api.get<any>(`/processes/${id}`);
  return _mapProcessOut(data);
}

export async function createProcess(
  payload: Omit<Process, "id" | "created_at" | "updated_at">,
): Promise<Process> {
  const { data } = await api.post<any>("/processes", {
    ...payload,
    last_updated: payload.lastUpdated,
    compliance_required: payload.complianceRequired,
    avg_completion_time: payload.avgCompletionTime,
    run_count: payload.runCount,
  });
  return _mapProcessOut(data);
}

export async function updateProcess(
  id: string,
  payload: Partial<Omit<Process, "id">>,
): Promise<Process> {
  const { data } = await api.patch<any>(`/processes/${id}`, {
    ...payload,
    last_updated: payload.lastUpdated,
    compliance_required: payload.complianceRequired,
    avg_completion_time: payload.avgCompletionTime,
    run_count: payload.runCount,
  });
  return _mapProcessOut(data);
}

export async function deleteProcess(id: string): Promise<void> {
  await api.delete(`/processes/${id}`);
}
