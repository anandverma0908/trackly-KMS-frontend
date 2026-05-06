import axios from "axios";
import type {
  Ticket,
  TicketsResponse,
  SummaryResponse,
  FiltersResponse,
  FilterState,
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
  TestCase,
  TestCycle,
  TestExecution,
  TestCoverage,
  ComplianceDashboard,
  Integration,
  IntegrationType,
  IntegrationEvent,
  ChatChannel,
  ChatMessage,
  GuestAccessToken,
  GuestProfile,
  FormTemplate,
  FormSubmission,
} from "@/types";
import type { Project } from "@/features/spaces/spacesData";
import { getAuthHeader } from "@/features/auth/useAuthStore";

export const api = axios.create({
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
    const rawDetail = err.response?.data?.detail;
    const msg = Array.isArray(rawDetail)
      ? rawDetail.map((e: any) => e.msg ?? String(e)).join('; ')
      : (rawDetail ?? err.message ?? "Unknown error");
    console.error("[API Error]", msg);
    const normalized = new Error(msg) as Error & {
      status?: number;
      code?: string;
      data?: unknown;
    };
    normalized.status = err.response?.status;
    normalized.code = err.code;
    normalized.data = err.response?.data;
    return Promise.reject(normalized);
  },
);

function mock() {
  return (window as any).__EAP_MOCK__ ?? null;
}

function _normalizeSearchResult(raw: any): SearchResult {
  const type = raw.type ?? raw.source_type ?? "wiki";
  const id = raw.id ?? raw.key ?? "";
  // For wiki pages the backend emits the UUID as key — use a readable label instead
  const rawKey = raw.key ?? undefined;
  const key = (type === "wiki" && rawKey && /^[0-9a-f-]{32,}$/i.test(String(rawKey)))
    ? `WIKI · ${(raw.title ?? "page").slice(0, 24)}`
    : rawKey;
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
  const { data } = await api.get<FiltersResponse>("/filters/options");
  return data;
}


/* ── Ticket Management ── */
function _mapTicketIn(payload: Partial<TicketCreate>): any {
  const mapped: any = { ...payload };
  if ("title" in mapped) {
    mapped.summary = mapped.title;
    delete mapped.title;
  }
  if ("reporter" in mapped) {
    mapped.reporter_name = mapped.reporter;
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
    description: t.description ?? t.body ?? t.content ?? "",
    reporter: t.reporter ?? t.reporter_name ?? t.created_by ?? t.creator_name ?? t.author_name ?? "",
    created: t.created ?? t.created_at ?? t.jira_created ?? "",
    updated: t.updated ?? t.updated_at ?? t.jira_updated ?? "",
    client: t.client ?? "",
    pod: t.pod ?? t.project_key ?? "",
    assignee: t.assignee ?? "",
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

export async function updateTicketStatus(key: string, status: string) {
  if (mock()?.updateTicketStatus) {
    // Update local mock state immediately, then also fire the real webhook dispatch
    const result = await mock().updateTicketStatus(key, status);
    api.post("/integrations/dispatch", { event_type: "status_changed", ticket_key: key, new_status: status }).catch(() => {});
    return result;
  }
  const { data } = await api.post(`/tickets/${key}/status`, { status });
  return data;
}

export async function submitTicketForApproval(key: string): Promise<Ticket> {
  const { data } = await api.post(`/tickets/${key}/submit-for-approval`);
  return _mapTicketOut(data);
}

export async function approveTicket(key: string): Promise<Ticket> {
  const { data } = await api.post(`/tickets/${key}/approve`);
  return _mapTicketOut(data);
}

export async function rejectTicket(key: string, reason: string): Promise<Ticket> {
  const { data } = await api.post(`/tickets/${key}/reject`, { reason });
  return _mapTicketOut(data);
}

export async function fetchPendingApprovals(): Promise<TicketsResponse> {
  const { data } = await api.get("/tickets/pending-approval");
  return {
    ...data,
    tickets: (data.tickets || []).map(_mapTicketOut),
    count: data.total ?? 0,
    limit: data.limit ?? 50,
    offset: data.offset ?? 0,
  };
}

export async function analyzeTicketNL(text: string, availableUsers: string[] = []): Promise<NLAnalysisResult> {
  if (mock()?.analyzeTicketNL) return mock().analyzeTicketNL(text);
  const { data } = await api.post("/tickets/ai-analyze", { text, available_users: availableUsers });
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
    duplicates: (data.duplicates ?? []).map((d: any) => ({
      ...d,
      key: d.key ?? d.jira_key,
    })),
    confidence: data.confidence ?? fields.confidence,
  };
}

export async function fetchTicketComments(key: string): Promise<TicketComment[]> {
  if (mock()?.fetchTicketComments) {
    const comments = await mock().fetchTicketComments(key);
    return (comments as any[]).map((c) => ({
      ...c,
      author: c.author_name ?? c.author ?? "Unknown",
      content: c.body ?? c.content ?? "",
    }));
  }
  const { data } = await api.get(`/tickets/${key}/comments`);
  return (data as any[]).map((c) => ({
    ...c,
    author: c.author_name ?? c.author ?? "Unknown",
    content: c.body ?? c.content ?? "",
  }));
}

export async function createComment(key: string, content: string, parentId?: string): Promise<TicketComment> {
  if (mock()?.createComment) {
    const c = await mock().createComment(key, content, parentId);
    return { ...c, author: c.author_name ?? c.author ?? "Unknown", content: c.body ?? c.content ?? "" };
  }
  const { data } = await api.post(`/tickets/${key}/comments`, { body: content, parent_id: parentId });
  return { ...data, author: data.author_name ?? "Unknown", content: data.body ?? "" };
}

export async function editComment(key: string, commentId: string, content: string): Promise<TicketComment> {
  if (mock()?.editComment) {
    const c = await mock().editComment(key, commentId, content);
    return { ...c, author: c.author_name ?? c.author ?? "Unknown", content: c.body ?? c.content ?? "" };
  }
  const { data } = await api.put(`/tickets/${key}/comments/${commentId}`, { body: content });
  return { ...data, author: data.author_name ?? "Unknown", content: data.body ?? "" };
}

export async function deleteComment(key: string, commentId: string) {
  if (mock()?.deleteComment) {
    await mock().deleteComment(key, commentId);
    return;
  }
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

export async function exportTicketsAsCsv(filters: MultiFilters): Promise<void> {
  const params = buildParams(filters, filters.pods, filters.clients);
  const response = await api.get("/tickets/export", {
    params,
    responseType: "blob",
  });
  const blob = new Blob([response.data], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const contentDisposition = response.headers["content-disposition"] as string | undefined;
  const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
  const filename = filenameMatch?.[1] ?? "tickets_export.csv";
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export interface ImportSummary {
  created: number;
  updated: number;
  errors: string[];
}

export async function importTicketsFromCsv(file: File): Promise<ImportSummary> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/tickets/import", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data as ImportSummary;
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
  files: {
    path: string;
    url: string;
    repo?: string;
    reason?: string;
    confidence?: number;
    symbol?: string | null;
    matched_terms?: string[];
  }[];
  prs: {
    number: string;
    title: string;
    status: "open" | "merged" | "closed";
    url: string;
    repo?: string;
    reason?: string;
    confidence?: number;
    touched_files?: string[];
    merged_at?: string | null;
    updated_at?: string | null;
    author?: string | null;
  }[];
  search_terms?: string[];
  diagnosis?: {
    summary?: string;
    likely_layer?: string;
    feature_area?: string;
  };
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

export interface WikiIntelligenceResponse {
  spaces: {
    space_id: string;
    health: number;
    page_count: number;
    fresh_count: number;
    aging_count: number;
    stale_count: number;
  }[];
  page_health?: {
    page_id: string;
    title: string;
    days_old: number;
    freshness: "fresh" | "aging" | "stale";
    score: number;
    linked_tickets: number;
    related_count: number;
    has_conflict: boolean;
    coverage: {
      headings: number;
      examples: number;
      links: number;
      diagrams: number;
    };
    compliance: {
      passed: boolean;
      matches: string[];
    };
    related_pages: { id: string; title: string; space_id: string; similarity: number }[];
  };
  stale_pages: { id: string; title: string; days_old: number; linked_tickets: number; score: number }[];
  onboarding_path: { page_id: string; title: string; minutes: number; tag: string; freshness: "fresh" | "aging" | "stale"; score: number }[];
  map_stats: { fresh: number; aging: number; stale: number };
}

export async function fetchWikiIntelligence(spaceId?: string | null, pageId?: string | null): Promise<WikiIntelligenceResponse> {
  const { data } = await api.get("/wiki/intelligence", {
    params: {
      ...(spaceId ? { space_id: spaceId } : {}),
      ...(pageId ? { page_id: pageId } : {}),
    },
  });
  return data;
}

export async function askWikiAssistant(message: string, pageId?: string | null, spaceId?: string | null): Promise<{ answer: string }> {
  const { data } = await api.post("/wiki/ai/assist", {
    message,
    ...(pageId ? { page_id: pageId } : {}),
    ...(spaceId ? { space_id: spaceId } : {}),
  });
  return data;
}

export async function generateWikiTemplate(templateType: string, context?: string): Promise<string> {
  const { data } = await api.post("/wiki/ai/generate-template", {
    template_type: templateType,
    context: context ?? "",
  });
  return data?.content ?? "";
}

export async function fetchRelatedDocs(type: 'ticket' | 'wiki', id: string | number): Promise<RelatedDoc[]> {
  const path = type === 'ticket' ? `/tickets/${id}/related` : `/wiki/pages/${id}/related`;
  const { data } = await api.get(path);
  return data;
}

export async function postWikiAwareness(
  pageId: string,
  payload: { user_id: string; name: string; color: string; cursor?: any },
) {
  await api.post(`/wiki/pages/${pageId}/awareness`, payload);
}

export async function fetchWikiAwareness(
  pageId: string,
): Promise<Array<{ user_id: string; name: string; color: string; cursor?: any; timestamp: number }>> {
  const { data } = await api.get(`/wiki/pages/${pageId}/awareness`);
  return data ?? [];
}

export async function extractMeetingActions(content: string) {
  const { data } = await api.post("/wiki/ai/meeting-notes", { notes: content });
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

export async function novaQuery(query: string, scope?: 'all' | 'wiki', pod?: string): Promise<NovaQueryResponse> {
  const { data } = await api.post("/nova/query", { query, scope, pod });
  return {
    answer: data?.answer ?? "",
    query: data?.query ?? query,
    citations: (data?.citations ?? data?.sources ?? []).map(_normalizeSearchResult),
  };
}

/* ── Media-to-Ticket ── */
export async function analyzeScreenshot(base64: string, description: string): Promise<{
  title: string; description: string; repro_steps: string[];
  severity: string; issue_type: string;
}> {
  const { data } = await api.post("/nova/analyze-image", { image: base64, description });
  return data;
}

export async function transcribeMedia(file: File): Promise<{
  transcript: string;
  fields: { title?: string; description?: string; priority?: string; issue_type?: string };
  source: string;
}> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/nova/transcribe", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function novaGenerate(
  prompt: string,
  systemPrompt?: string,
  temperature = 0.3,
): Promise<string> {
  const { data } = await api.post("/nova/generate", {
    prompt,
    system_prompt: systemPrompt,
    temperature,
    max_tokens: 800,
  });
  return data?.answer ?? "";
}

export interface AgentStepResult {
  iteration:   number;
  tool_call?:  { action: string; parameters: Record<string, unknown>; reasoning?: string };
  tool_result?:{ success: boolean; data: unknown; error?: string };
  final_text?: string;
  timestamp:   string;
}

export interface AgentResponse {
  answer:          string;
  steps:           AgentStepResult[];
  tools_used:      string[];
  created_ticket?: { id: string; title: string; priority: string; issue_type: string } | null;
}

export async function novaAgent(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  maxIterations = 8,
): Promise<AgentResponse> {
  const { data } = await api.post("/nova/agent", {
    message,
    history,
    max_iterations: maxIterations,
  });
  return data as AgentResponse;
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

export async function createSprint(payload: { name: string; goal?: string; start_date: string; end_date: string; project_id?: string; ticket_keys?: string[] }): Promise<Sprint> {
  const { data } = await api.post("/sprints", payload);
  return data;
}

export async function deleteSprint(id: string): Promise<void> {
  await api.delete(`/sprints/${id}`);
}

export async function startSprint(id: string, body?: { name?: string; goal?: string; start_date?: string; end_date?: string }): Promise<Sprint> {
  const { data } = await api.post(`/sprints/${id}/start`, body ?? {});
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

function _normalizeStandup(raw: unknown): Standup | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  // Handle backend wrapping: { standup: { ... } }
  if (s.standup && typeof s.standup === "object") {
    return _normalizeStandup(s.standup);
  }
  // Must have an id to be a valid standup
  if (typeof s.id !== "number" && typeof s.id !== "string") return null;
  // Accept "engineer" or "user_name" (generate endpoint used to return user_name)
  const engineer = (typeof s.engineer === "string" ? s.engineer : null)
    ?? (typeof s.user_name === "string" ? s.user_name : null);
  if (!engineer) return null;
  return {
    id: String(s.id),
    engineer,
    engineer_email: typeof s.engineer_email === "string" ? s.engineer_email : "",
    date: typeof s.date === "string" ? s.date : "",
    yesterday: typeof s.yesterday === "string" ? s.yesterday : "",
    today: typeof s.today === "string" ? s.today : "",
    blockers: typeof s.blockers === "string" ? s.blockers : "",
    pod: typeof s.pod === "string" ? s.pod : "",
    shared: !!s.shared,
    created_at: typeof s.created_at === "string" ? s.created_at : "",
  };
}

function _normalizeStandups(raw: unknown): Standup[] {
  if (!raw || typeof raw !== "object") return [];
  const d = raw as Record<string, unknown>;
  const arr = Array.isArray(d.standups) ? d.standups : Array.isArray(d) ? d : [];
  return arr.map(_normalizeStandup).filter(Boolean) as Standup[];
}

export async function fetchTodayStandup(): Promise<Standup | null> {
  if (mock()?.fetchTodayStandup) {
    const raw = await mock().fetchTodayStandup();
    return _normalizeStandup(raw);
  }
  try {
    const { data } = await api.get("/nova/standup/today");
    return _normalizeStandup(data);
  } catch {
    return null;
  }
}

export async function fetchMyStandupByDate(date: string): Promise<Standup | null> {
  try {
    const { data } = await api.get("/nova/standup/my", { params: { standup_date: date } });
    return _normalizeStandup(data);
  } catch {
    return null;
  }
}

export async function fetchTeamStandups(date?: string, pod?: string): Promise<Standup[]> {
  if (mock()?.fetchTeamStandups) {
    const raw = await mock().fetchTeamStandups(date, pod);
    return _normalizeStandups(raw);
  }
  try {
    const { data } = await api.get("/nova/standup/team", { params: { standup_date: date, pod } });
    return _normalizeStandups(data);
  } catch {
    return [];
  }
}

export async function updateStandup(id: string, payload: Partial<Standup>): Promise<Standup> {
  if (mock()?.updateStandup) {
    const raw = await mock().updateStandup(id, payload);
    const s = _normalizeStandup(raw);
    if (!s) throw new Error("Invalid standup response from server");
    return s;
  }
  const { data } = await api.put(`/nova/standup/${id}`, payload);
  const s = _normalizeStandup(data);
  if (!s) throw new Error("Invalid standup response from server");
  return s;
}

export async function createStandup(payload: Partial<Standup>): Promise<Standup> {
  if (mock()?.createStandup) {
    const raw = await mock().createStandup(payload);
    const s = _normalizeStandup(raw);
    if (!s) throw new Error("Invalid standup response from server");
    return s;
  }
  const { data } = await api.post("/nova/standup", payload);
  const s = _normalizeStandup(data);
  if (!s) throw new Error("Invalid standup response from server");
  return s;
}

export async function generateStandup(): Promise<Standup> {
  if (mock()?.generateStandup) {
    const raw = await mock().generateStandup();
    const s = _normalizeStandup(raw);
    if (!s) throw new Error("Invalid standup response from server");
    return s;
  }
  try {
    // Backend may require a body (even empty {}) for POST endpoints
    const { data } = await api.post("/nova/standup/generate", {
      date: new Date().toISOString().slice(0, 10),
    });
    const s = _normalizeStandup(data);
    if (!s) throw new Error("Invalid standup response from server");
    return s;
  } catch (err: any) {
    const status = err?.status ?? err?.response?.status;
    const detail = err?.data?.detail ?? err?.response?.data?.detail ?? "";
    const msg = err?.message || "";

    if (status === 404 || msg.includes("404") || msg.includes("Not Found")) {
      throw new Error("AI generation is not available on the backend yet. Please use 'Write Standup' instead.");
    }
    if (status === 422) {
      throw new Error(
        detail || "The backend rejected the request. Make sure the POST body matches what the endpoint expects."
      );
    }
    throw err;
  }
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
  active_sprint_id: string | null;
  risk_flags: PodRiskFlags;
  trend: number[];
}

export interface HealthForecastResult {
  missed_weeks: number;
  summary: string;
  options: { label: string; impact: string; risk: "Low" | "Medium" | "High" }[];
  health_score: number;
  delivery_confidence: number;
}

export async function fetchHealthForecast(pod: string): Promise<HealthForecastResult> {
  const { data } = await api.post<HealthForecastResult>(`/nova/health-forecast/${pod}`);
  return data;
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

export async function fetchAnomalies(pod?: string): Promise<SpaceAnomaly[]> {
  const { data } = await api.get<SpaceAnomaly[]>("/spaces/anomalies", { params: pod ? { pod } : undefined });
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

export async function fetchSpacesBrief(pod: string, force = false): Promise<SpacesBriefResult> {
  const { data } = await api.post<SpacesBriefResult>(`/nova/spaces-brief/${pod}`, null, {
    params: force ? { force: true } : undefined,
  });
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

/* ── Spaces / Projects ── */
export async function fetchProject(pod: string): Promise<Project> {
  if (mock()?.fetchProject) return mock().fetchProject(pod);
  const { data } = await api.get<Project>(`/spaces/${pod}/project`);
  return data;
}

export interface StoryInsight {
  label: string;
  color: "green" | "amber" | "red" | "accent";
  text: string;
}

export interface StoryItem {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  assignee: string;
  assigneeInitials: string;
  assigneeColor: string;
  epicId?: string;
  storyPoints: number;
  totalTasks: number;
  doneTasks: number;
  blockedTasks: number;
  progressPct: number;
  eosInsight: StoryInsight;
  tasks: import("@/features/spaces/spacesData").ProjectTask[];
}

export interface StoriesResponse {
  sprint_id: string | null;
  sprint_name: string;
  stories: StoryItem[];
  everything_else: {
    totalTasks: number;
    doneTasks: number;
    tasks: import("@/features/spaces/spacesData").ProjectTask[];
  };
}

export async function fetchStories(pod: string, sprintId?: string): Promise<StoriesResponse> {
  const params = sprintId ? `?sprint_id=${sprintId}` : "";
  const { data } = await api.get(`/spaces/${pod}/stories${params}`);
  return data;
}

export async function fetchBurndownReport(pod: string): Promise<{ sprint: { id: string; name: string; total_points: number } | null; data: { date: string; remaining: number; ideal: number }[] }> {
  const { data } = await api.get(`/spaces/${pod}/reports/burndown`);
  return data;
}

export async function fetchVelocityReport(pod: string): Promise<{ sprint: string; committed: number; completed: number; start_date: string; end_date: string }[]> {
  const { data } = await api.get(`/spaces/${pod}/reports/velocity`);
  return data;
}

export async function fetchCfdReport(pod: string): Promise<{ date: string; "To Do": number; "In Progress": number; "In Review": number; Blocked: number; Done: number }[]> {
  const { data } = await api.get(`/spaces/${pod}/reports/cfd`);
  return data;
}

export async function createEpic(pod: string, payload: { title: string; color?: string; start_date?: string; end_date?: string }) {
  const { data } = await api.post(`/spaces/${pod}/epics`, payload);
  return data;
}

export async function updateEpic(pod: string, epicId: string, payload: { title?: string; color?: string; start_date?: string; end_date?: string }) {
  const { data } = await api.put(`/spaces/${pod}/epics/${epicId}`, payload);
  return data;
}

export async function deleteEpic(pod: string, epicId: string) {
  await api.delete(`/spaces/${pod}/epics/${epicId}`);
}

export async function linkTicketToEpic(ticketKey: string, epicId: string | null) {
  const { data } = await api.post(`/tickets/${ticketKey}/epic`, { epic_id: epicId });
  return data;
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: Record<string, any>;
  is_shared: boolean;
  created_at?: string;
}

export async function fetchSavedFilters(): Promise<SavedFilter[]> {
  const { data } = await api.get("/filters");
  return data ?? [];
}

export async function createSavedFilter(payload: { name: string; filters: Record<string, any>; is_shared?: boolean }): Promise<SavedFilter> {
  const { data } = await api.post("/filters", payload);
  return data;
}

export async function updateSavedFilter(id: string, payload: { name?: string; filters?: Record<string, any>; is_shared?: boolean }): Promise<SavedFilter> {
  const { data } = await api.put(`/filters/${id}`, payload);
  return data;
}

export async function deleteSavedFilter(id: string) {
  await api.delete(`/filters/${id}`);
}

export interface BoardConfig {
  columns: { id: string; name: string; status_mapping: string[] }[];
  swimlane_by: "none" | "assignee" | "epic" | "priority";
  wip_limits: Record<string, number>;
}

export async function fetchBoardConfig(pod: string): Promise<BoardConfig> {
  const { data } = await api.get(`/spaces/${pod}/board-config`);
  return data;
}

export async function updateBoardConfig(pod: string, payload: BoardConfig): Promise<BoardConfig> {
  const { data } = await api.put(`/spaces/${pod}/board-config`, payload);
  return data;
}

export interface Release {
  id: string;
  name: string;
  description?: string;
  status: "unreleased" | "released";
  release_date?: string;
  ticket_count: number;
  created_at?: string;
}

export async function fetchReleases(pod: string): Promise<Release[]> {
  const { data } = await api.get(`/spaces/${pod}/releases`);
  return data ?? [];
}

export async function createRelease(pod: string, payload: { name: string; description?: string; release_date?: string }): Promise<Release> {
  const { data } = await api.post(`/spaces/${pod}/releases`, payload);
  return data;
}

export async function updateRelease(pod: string, id: string, payload: Partial<{ name: string; description: string; status: string; release_date: string }>): Promise<Release> {
  const { data } = await api.put(`/spaces/${pod}/releases/${id}`, payload);
  return data;
}

export async function deleteRelease(pod: string, id: string) {
  await api.delete(`/spaces/${pod}/releases/${id}`);
}

export async function setFixVersion(ticketKey: string, versionName: string | null) {
  const { data } = await api.post(`/spaces/tickets/${ticketKey}/fix-version`, { version_name: versionName });
  return data;
}

export interface ReleaseTicket {
  id: string;
  key: string;
  summary: string;
  status?: string;
  priority?: string;
  issue_type?: string;
  assignee?: string;
  assignee_email?: string;
  story_points?: number;
  url?: string;
}

export async function fetchReleaseTickets(pod: string, releaseId: string): Promise<ReleaseTicket[]> {
  const { data } = await api.get(`/spaces/${pod}/releases/${releaseId}/tickets`);
  return data ?? [];
}

export async function fetchPodTickets(pod: string, search?: string): Promise<{ tickets: ReleaseTicket[]; total: number }> {
  const params = new URLSearchParams({ pod, limit: "100" });
  if (search) params.set("search", search);
  const { data } = await api.get(`/tickets?${params.toString()}`);
  return data;
}

export async function fetchPodEpics(pod: string): Promise<{ key: string; summary: string }[]> {
  const { data } = await api.get(`/spaces/${pod}/epics`);
  return (data ?? []).map((e: any) => ({ key: e.id, summary: e.title }));
}

export async function fetchPodStories(pod: string, search?: string): Promise<{ key: string; summary: string }[]> {
  const params: Record<string, any> = { pod, limit: 100 };
  if (search) params.search = search;
  const { data } = await api.get("/tickets", { params });
  return (data.tickets ?? [])
    .filter((t: any) => ["Story", "Task", "Bug", "Epic", "Improvement"].includes(t.issue_type))
    .map((t: any) => ({ key: t.key ?? t.jira_key, summary: t.summary, issue_type: t.issue_type }));
}

export interface AutomationRule {
  id: string;
  name: string;
  is_active: boolean;
  trigger_type: string;
  trigger_config: Record<string, any>;
  condition_type?: string;
  condition_config?: Record<string, any>;
  action_type: string;
  action_config: Record<string, any>;
  run_count: number;
  created_at?: string;
}

export async function fetchAutomations(pod: string): Promise<AutomationRule[]> {
  const { data } = await api.get(`/spaces/${pod}/automations`);
  return data ?? [];
}

export async function createAutomation(pod: string, payload: Omit<AutomationRule, "id" | "run_count" | "created_at">): Promise<AutomationRule> {
  const { data } = await api.post(`/spaces/${pod}/automations`, payload);
  return data;
}

export async function updateAutomation(pod: string, id: string, payload: Partial<AutomationRule>): Promise<AutomationRule> {
  const { data } = await api.put(`/spaces/${pod}/automations/${id}`, payload);
  return data;
}

export async function deleteAutomation(pod: string, id: string) {
  await api.delete(`/spaces/${pod}/automations/${id}`);
}

export interface CustomFieldDefinition {
  id: string;
  org_id: string;
  pod: string;
  name: string;
  field_type: "text" | "number" | "select" | "date" | "checkbox";
  options?: string[];
  is_required: boolean;
  display_order: number;
  created_at?: string;
}

export async function fetchCustomFields(pod: string): Promise<CustomFieldDefinition[]> {
  const { data } = await api.get(`/spaces/${pod}/custom-fields`);
  return data ?? [];
}

export async function createCustomField(pod: string, payload: Omit<CustomFieldDefinition, "id" | "org_id" | "pod" | "created_at">): Promise<CustomFieldDefinition> {
  const { data } = await api.post(`/spaces/${pod}/custom-fields`, payload);
  return data;
}

export async function updateCustomField(pod: string, id: string, payload: Partial<CustomFieldDefinition>): Promise<CustomFieldDefinition> {
  const { data } = await api.put(`/spaces/${pod}/custom-fields/${id}`, payload);
  return data;
}

export async function deleteCustomField(pod: string, id: string) {
  await api.delete(`/spaces/${pod}/custom-fields/${id}`);
}

export async function fetchSubtasks(ticketKey: string): Promise<Ticket[]> {
  const { data } = await api.get(`/tickets/${ticketKey}/subtasks`);
  return (data ?? []).map(_mapTicketOut);
}

export async function createSubtask(ticketKey: string, payload: { summary: string; assignee?: string; story_points?: number }): Promise<Ticket> {
  const { data } = await api.post(`/tickets/${ticketKey}/subtasks`, payload);
  return _mapTicketOut(data);
}

export async function unlinkSubtask(ticketKey: string, childKey: string) {
  await api.delete(`/tickets/${ticketKey}/subtasks/${childKey}`);
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

export async function fetchSpacesList(): Promise<{ pod: string }[]> {
  const { data } = await api.get<{ pod: string }[]>("/spaces");
  return data ?? [];
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
  const raw: any[] = data?.notifications ?? data ?? [];
  return raw.map((n) => ({
    ...n,
    message: n.body ?? n.message ?? "",
    read: n.is_read ?? n.read ?? false,
  }));
}

export async function markNotificationRead(id: string) {
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

export interface BugCostData {
  total_bugs: number;
  open_bugs: number;
  high_priority_bugs: number;
  total_hours: number;
  total_cost_usd: number;
  avg_hours_per_bug: number;
  avg_hourly_rate: number;
  by_pod: { pod: string; count: number; hours: number; open: number; cost_usd: number }[];
}

export async function fetchBugCost(): Promise<BugCostData> {
  const { data } = await api.get("/analytics/bug-cost");
  return data;
}

export interface RecurringPattern {
  pattern: string;
  occurrences: number;
  ticket_keys: string[];
  severity: "high" | "medium" | "low";
}

export async function fetchRecurringProblems(): Promise<{ patterns: RecurringPattern[]; total_bugs_analyzed: number }> {
  const { data } = await api.get("/analytics/recurring-problems");
  return data;
}

export interface ClientHealthEntry {
  client: string;
  health_score: number;
  status: "Healthy" | "At Risk" | "Critical";
  total_tickets: number;
  done_tickets: number;
  delivery_rate: number;
  bug_rate: number;
  blocked_tickets: number;
  overdue_tickets: number;
  total_hours: number;
}

export async function fetchClientHealth(): Promise<ClientHealthEntry[]> {
  const { data } = await api.get("/analytics/client-health");
  return Array.isArray(data) ? data : data?.data ?? [];
}

export interface SentimentSignal {
  engineer: string;
  signal: string;
  phrases: string[];
  ticket_keys: string[];
  severity: "high" | "medium";
  sprint: string;
}
export interface SentimentSignalsResponse {
  signals: SentimentSignal[];
  window_hours: number;
}
export async function fetchSentimentSignals(): Promise<SentimentSignalsResponse> {
  const { data } = await api.get("/analytics/sentiment-signals");
  return data;
}

export interface BenchmarkEntry {
  metric: string;
  your_value: string;
  industry_avg: string;
  similar_teams: string;
  direction: "up" | "down";
  insight: string;
}
export async function fetchBenchmarks(): Promise<BenchmarkEntry[]> {
  const { data } = await api.get("/analytics/benchmarks");
  return Array.isArray(data) ? data : data?.data ?? [];
}

export interface ResourceGap {
  goal: string;
  skill: string;
  urgency: "high" | "medium";
  needed_by: string;
  note: string;
}
export interface ResourceGapsResponse {
  gaps: ResourceGap[];
  total_open_high_priority: number;
  team_size: number;
  forecast_note: string;
}
export async function fetchResourceGaps(): Promise<ResourceGapsResponse> {
  const { data } = await api.get("/analytics/resource-gaps");
  return data;
}

export interface VelocityAnomalySprint {
  sprint_id:    string;
  name:         string;
  velocity:     number;
  rolling_avg:  number;
  z_score:      number;
  is_anomaly:   boolean;
  direction:    "drop" | "spike" | "normal";
}

export interface VelocityAnomalyResult {
  sprints: VelocityAnomalySprint[];
  summary: {
    total_sprints:   number;
    anomaly_count:   number;
    avg_velocity:    number;
    trend_direction: "improving" | "declining" | "stable";
  };
}

export async function fetchVelocityAnomalies(): Promise<VelocityAnomalyResult> {
  const { data } = await api.get<VelocityAnomalyResult>("/analytics/velocity-anomalies");
  return data;
}

export interface CognitiveLoadMember {
  name: string;
  load_score: number;
  level: "Overloaded" | "High" | "Moderate" | "Optimal";
  wip_count: number;
  high_priority_count: number;
  overdue_count: number;
  story_points: number;
}

export async function fetchCognitiveLoad(): Promise<{ members: CognitiveLoadMember[]; ai_summary: string; total_members: number }> {
  const { data } = await api.get("/nova/cognitive-load");
  return data;
}

export interface PodBalance {
  pod: string;
  members: number;
  avg_pts: number;
  imbalance_pct: number;
  most_loaded: string;
  least_loaded: string;
}

export async function fetchTeamChemistry(): Promise<{ pod_balance: PodBalance[]; ai_analysis: string; pod_count: number }> {
  const { data } = await api.get("/nova/team-chemistry");
  return data;
}

export interface ExpertiseMember {
  name: string;
  pods: string[];
  ticket_count: number;
  specializations: string[];
  knowledge_breadth: number;
}

export async function fetchMemoryGraph(): Promise<{ expertise_map: ExpertiseMember[]; bus_factor_risks: { pod: string; contributors: number; risk: string }[]; ai_summary: string }> {
  const { data } = await api.get("/nova/memory-graph");
  return data;
}

/* ── Chat ── */
export async function fetchChatChannels(): Promise<ChatChannel[]> {
  const { data } = await api.get("/chat/channels");
  return data;
}

export async function createChatChannel(payload: {
  name: string;
  type: "pod" | "general";
  is_private?: boolean;
  member_ids?: string[];
  pod?: string | null;
}): Promise<ChatChannel> {
  const { data } = await api.post("/chat/channels", payload);
  return data;
}

export async function fetchChatMessages(
  channelId: string,
  limit = 50,
  offset = 0
): Promise<{ messages: ChatMessage[]; limit: number; offset: number }> {
  const { data } = await api.get(`/chat/channels/${channelId}/messages`, {
    params: { limit, offset },
  });
  return data;
}

export async function sendChatMessage(
  channelId: string,
  body: string,
  parentId?: string | null
): Promise<ChatMessage> {
  const { data } = await api.post(`/chat/channels/${channelId}/messages`, {
    body,
    parent_id: parentId,
  });
  return data;
}

export async function fetchChannelMembers(channelId: string): Promise<{
  user_id: string; name: string; email: string; role: string; added_at: string; is_creator: boolean;
}[]> {
  const { data } = await api.get(`/chat/channels/${channelId}/members`);
  return data;
}

export async function addChannelMember(channelId: string, userId: string): Promise<void> {
  await api.post(`/chat/channels/${channelId}/members`, { user_id: userId });
}

export async function removeChannelMember(channelId: string, userId: string): Promise<void> {
  await api.delete(`/chat/channels/${channelId}/members/${userId}`);
}

export async function deleteChatChannel(channelId: string): Promise<{ status: string }> {
  const { data } = await api.delete(`/chat/channels/${channelId}`);
  return data;
}

export async function fetchOrgMembers() {
  if (mock()?.fetchOrgMembers) return mock().fetchOrgMembers();
  const { data } = await api.get("/users/members");
  // Backend may return { members: [...] } or plain [...]
  const members = Array.isArray(data) ? data : data?.members ?? [];
  return members as import("@/types").OrgMember[];
}

export interface ActivityEntry {
  id: string;
  source: "ticket" | "manual";
  date: string;
  activity: string;
  hours: number;
  pod: string | null;
  client: string | null;
  entry_type: string | null;
  ticket_key: string | null;
  ticket_summary?: string | null;
  notes: string | null;
  user_name: string;
}

export async function fetchUserActivity(params: {
  user: string;
  dateFrom: string;
  dateTo: string;
}): Promise<ActivityEntry[]> {
  const { data } = await api.get<ActivityEntry[]>("/activity", {
    params: { user: params.user, date_from: params.dateFrom, date_to: params.dateTo },
  });
  return data ?? [];
}

export async function fetchNovaStatus() {
  const { data } = await api.get("/nova/status");
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
  if (mock()?.fetchMyWork) return mock().fetchMyWork();
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

type ApiErrorLike = Error & {
  status?: number;
  code?: string;
};

const LOCAL_DECISIONS_KEY = "trackly-local-decisions";
const LOCAL_PROCESSES_KEY = "trackly-local-processes";

const SEEDED_DECISIONS: Decision[] = [
  {
    id: "dec-local-1",
    number: 1,
    title: "Adopt React Query for server state",
    status: "accepted",
    owner: "Platform Team",
    date: "2026-04-10",
    context: "The app needed a consistent pattern for fetching, caching, and invalidating remote data.",
    decision: "Use React Query for frontend server-state management across product surfaces.",
    rationale: "It reduces ad hoc loading state code and gives the team predictable cache invalidation.",
    alternatives: ["Hand-rolled hooks per page", "Redux-managed async state"],
    consequences: "All new API-backed screens should use shared query keys and mutation invalidation.",
    linkedTickets: ["TRK-161"],
    tags: ["frontend", "data"],
    space_id: null,
    org_level: true,
    created_at: "2026-04-10T09:00:00.000Z",
    updated_at: "2026-04-10T09:00:00.000Z",
  },
  {
    id: "dec-local-2",
    number: 2,
    title: "Store project-specific knowledge by space",
    status: "proposed",
    owner: "Anand V.",
    date: "2026-04-18",
    context: "Teams need decisions and SOPs to be discoverable both inside a space and globally.",
    decision: "Support both org-wide and space-scoped knowledge records in the frontend model.",
    rationale: "This keeps shared standards reusable while allowing project-specific documentation.",
    alternatives: ["Org-wide records only", "Separate products for each project"],
    consequences: "APIs and local fallback both need to filter by `space_id` and `org_level`.",
    linkedTickets: ["TRK-163"],
    tags: ["knowledge", "spaces"],
    space_id: "DPAI",
    org_level: false,
    created_at: "2026-04-18T10:30:00.000Z",
    updated_at: "2026-04-18T10:30:00.000Z",
  },
];

const SEEDED_PROCESSES: Process[] = [
  {
    id: "proc-local-1",
    title: "Incident Triage Runbook",
    category: "runbook",
    status: "active",
    owner: "SRE Team",
    lastUpdated: "2026-04-12",
    description: "Use this runbook when a production incident is reported and the owning pod needs a shared triage flow.",
    steps: [
      {
        id: "proc-local-1-step-1",
        order: 1,
        title: "Acknowledge the incident",
        description: "Confirm the issue, severity, and channel for updates.",
        owner: "Incident Commander",
        estimatedTime: "5 min",
        required: true,
      },
      {
        id: "proc-local-1-step-2",
        order: 2,
        title: "Assign an owner",
        description: "Choose the on-call engineer or most relevant pod owner to lead mitigation.",
        owner: "Incident Commander",
        estimatedTime: "5 min",
        required: true,
      },
      {
        id: "proc-local-1-step-3",
        order: 3,
        title: "Document current status",
        description: "Record impact, workaround, and next update time in the incident thread.",
        owner: "Responder",
        estimatedTime: "10 min",
        required: true,
      },
    ],
    tags: ["incident", "ops"],
    complianceRequired: false,
    avgCompletionTime: "20 min",
    runCount: 14,
    space_id: null,
    org_level: true,
    created_at: "2026-04-12T08:00:00.000Z",
    updated_at: "2026-04-12T08:00:00.000Z",
  },
  {
    id: "proc-local-2",
    title: "Release Readiness Checklist",
    category: "workflow",
    status: "review",
    owner: "Product Engineering",
    lastUpdated: "2026-04-20",
    description: "Checklist for validating a sprint release before rollout to production.",
    steps: [
      {
        id: "proc-local-2-step-1",
        order: 1,
        title: "Confirm QA sign-off",
        description: "Verify that all release tickets are QA-approved or explicitly waived.",
        owner: "QA Lead",
        estimatedTime: "10 min",
        required: true,
      },
      {
        id: "proc-local-2-step-2",
        order: 2,
        title: "Review release notes",
        description: "Summarize customer-facing changes and operational concerns.",
        owner: "Release Manager",
        estimatedTime: "15 min",
        required: true,
      },
    ],
    tags: ["release", "qa"],
    complianceRequired: true,
    avgCompletionTime: "30 min",
    runCount: 6,
    space_id: "DPAI",
    org_level: false,
    created_at: "2026-04-20T11:15:00.000Z",
    updated_at: "2026-04-20T11:15:00.000Z",
  },
];

function _canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function _readLocalCollection<T>(key: string, seed: T[]): T[] {
  if (!_canUseBrowserStorage()) return [...seed];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      window.localStorage.setItem(key, JSON.stringify(seed));
      return [...seed];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...seed];
  } catch {
    return [...seed];
  }
}

function _writeLocalCollection<T>(key: string, items: T[]) {
  if (!_canUseBrowserStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(items));
}

function _shouldUseKnowledgeFallback(error: unknown): boolean {
  const e = error as ApiErrorLike | undefined;
  return e?.status === 404 || e?.status === 405 || e?.status === 501 || e?.code === "ERR_NETWORK";
}

function _getLocalDecisions(): Decision[] {
  return _readLocalCollection(LOCAL_DECISIONS_KEY, SEEDED_DECISIONS).map(_mapDecisionOut);
}

function _saveLocalDecisions(items: Decision[]) {
  _writeLocalCollection(LOCAL_DECISIONS_KEY, items);
}

function _getLocalProcesses(): Process[] {
  return _readLocalCollection(LOCAL_PROCESSES_KEY, SEEDED_PROCESSES).map(_mapProcessOut);
}

function _saveLocalProcesses(items: Process[]) {
  _writeLocalCollection(LOCAL_PROCESSES_KEY, items);
}

function _makeLocalId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  if (mock()?.fetchDecisions) return mock().fetchDecisions(params);
  try {
    const { data } = await api.get<any>("/decisions", { params });
    const decisions = (data.decisions ?? data ?? []).map(_mapDecisionOut);
    return { decisions, total: data.total ?? decisions.length };
  } catch (error) {
    if (!_shouldUseKnowledgeFallback(error)) throw error;
    const decisions = _getLocalDecisions().filter((decision) => {
      if (params?.space_id && decision.space_id !== params.space_id && !decision.org_level) return false;
      if (params?.org_level !== undefined && decision.org_level !== params.org_level) return false;
      if (params?.status && decision.status !== params.status) return false;
      return true;
    });
    return { decisions, total: decisions.length };
  }
}

export async function createDecision(
  payload: Omit<Decision, "id" | "created_at" | "updated_at">,
): Promise<Decision> {
  if (mock()?.createDecision) return mock().createDecision(payload);
  try {
    const { data } = await api.post<any>("/decisions", {
      ...payload,
      linked_tickets: payload.linkedTickets,
    });
    return _mapDecisionOut(data);
  } catch (error) {
    if (!_shouldUseKnowledgeFallback(error)) throw error;
    const items = _getLocalDecisions();
    const now = new Date().toISOString();
    const created = _mapDecisionOut({
      ...payload,
      id: _makeLocalId("decision"),
      number: items.length + 1,
      created_at: now,
      updated_at: now,
    });
    items.unshift(created);
    _saveLocalDecisions(items);
    return created;
  }
}

export async function deleteDecision(id: string): Promise<void> {
  if (mock()?.deleteDecision) return mock().deleteDecision(id);
  try {
    await api.delete(`/decisions/${id}`);
  } catch (error) {
    if (!_shouldUseKnowledgeFallback(error)) throw error;
    _saveLocalDecisions(_getLocalDecisions().filter((item) => item.id !== id));
  }
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
  if (mock()?.fetchProcesses) return mock().fetchProcesses(params);
  try {
    const { data } = await api.get<any>("/processes", { params });
    const processes = (data.processes ?? data ?? []).map(_mapProcessOut);
    return { processes, total: data.total ?? processes.length };
  } catch (error) {
    if (!_shouldUseKnowledgeFallback(error)) throw error;
    const processes = _getLocalProcesses().filter((process) => {
      if (params?.space_id && process.space_id !== params.space_id && !process.org_level) return false;
      if (params?.org_level !== undefined && process.org_level !== params.org_level) return false;
      if (params?.category && process.category !== params.category) return false;
      return true;
    });
    return { processes, total: processes.length };
  }
}

export async function createProcess(
  payload: Omit<Process, "id" | "created_at" | "updated_at">,
): Promise<Process> {
  if (mock()?.createProcess) return mock().createProcess(payload);
  try {
    const { data } = await api.post<any>("/processes", {
      ...payload,
      last_updated: payload.lastUpdated,
      compliance_required: payload.complianceRequired,
      avg_completion_time: payload.avgCompletionTime,
      run_count: payload.runCount,
    });
    return _mapProcessOut(data);
  } catch (error) {
    if (!_shouldUseKnowledgeFallback(error)) throw error;
    const items = _getLocalProcesses();
    const now = new Date().toISOString();
    const created = _mapProcessOut({
      ...payload,
      id: _makeLocalId("process"),
      created_at: now,
      updated_at: now,
    });
    items.unshift(created);
    _saveLocalProcesses(items);
    return created;
  }
}

export async function deleteProcess(id: string): Promise<void> {
  if (mock()?.deleteProcess) return mock().deleteProcess(id);
  try {
    await api.delete(`/processes/${id}`);
  } catch (error) {
    if (!_shouldUseKnowledgeFallback(error)) throw error;
    _saveLocalProcesses(_getLocalProcesses().filter((item) => item.id !== id));
  }
}

// ── Tests / QA ────────────────────────────────────────────────────────────────

export async function fetchTestCases(pod: string, ticketKey?: string): Promise<TestCase[]> {
  const params: Record<string, string> = {};
  if (ticketKey) params.ticket_key = ticketKey;
  const { data } = await api.get(`/spaces/${pod}/tests/cases`, { params });
  return data;
}

export async function createTestCase(
  pod: string,
  payload: {
    title: string;
    description?: string;
    preconditions?: string;
    steps?: { step: string; expected_result: string }[];
    priority?: string;
    ticket_key?: string;
    ticket_id?: string;
  },
): Promise<TestCase> {
  const { data } = await api.post(`/spaces/${pod}/tests/cases`, payload);
  return data;
}

export async function updateTestCase(
  pod: string,
  caseId: string,
  payload: Partial<{
    title: string;
    description: string;
    preconditions: string;
    steps: { step: string; expected_result: string }[];
    priority: string;
    status: string;
    ticket_key: string;
  }>,
): Promise<TestCase> {
  const { data } = await api.put(`/spaces/${pod}/tests/cases/${caseId}`, payload);
  return data;
}

export async function deleteTestCase(pod: string, caseId: string): Promise<void> {
  await api.delete(`/spaces/${pod}/tests/cases/${caseId}`);
}

export async function generateTestCases(
  pod: string,
  payload: {
    ticket_key: string;
    ticket_summary: string;
    ticket_description?: string;
    count?: number;
  },
): Promise<TestCase[]> {
  const { data } = await api.post(`/spaces/${pod}/tests/cases/generate`, payload);
  return data;
}

export async function fetchTestCycles(pod: string): Promise<TestCycle[]> {
  const { data } = await api.get(`/spaces/${pod}/tests/cycles`);
  return data;
}

export async function createTestCycle(
  pod: string,
  payload: { name: string; description?: string; sprint_id?: string; release_id?: string },
): Promise<TestCycle> {
  const { data } = await api.post(`/spaces/${pod}/tests/cycles`, payload);
  return data;
}

export async function updateTestCycle(
  pod: string,
  cycleId: string,
  payload: Partial<{ name: string; description: string; status: string }>,
): Promise<TestCycle> {
  const { data } = await api.put(`/spaces/${pod}/tests/cycles/${cycleId}`, payload);
  return data;
}

export async function deleteTestCycle(pod: string, cycleId: string): Promise<void> {
  await api.delete(`/spaces/${pod}/tests/cycles/${cycleId}`);
}

export async function fetchTestExecutions(pod: string, cycleId: string): Promise<TestExecution[]> {
  const { data } = await api.get(`/spaces/${pod}/tests/cycles/${cycleId}/executions`);
  return data;
}

export async function addTestToCycle(
  pod: string,
  cycleId: string,
  testCaseId: string,
): Promise<TestExecution> {
  const { data } = await api.post(`/spaces/${pod}/tests/cycles/${cycleId}/executions`, { test_case_id: testCaseId });
  return data;
}

export async function updateTestExecution(
  pod: string,
  execId: string,
  payload: { status: string; notes?: string },
): Promise<TestExecution> {
  const { data } = await api.put(`/spaces/${pod}/tests/executions/${execId}`, payload);
  return data;
}

export async function removeTestFromCycle(pod: string, execId: string): Promise<void> {
  await api.delete(`/spaces/${pod}/tests/executions/${execId}`);
}

export async function fetchTestCoverage(pod: string): Promise<TestCoverage> {
  const { data } = await api.get(`/spaces/${pod}/tests/coverage`);
  return data;
}

// ── Code Review Snapshots ──────────────────────────────────────────────────

export interface CodeReviewSnapshotMeta {
  id: string;
  github_repo: string;
  total_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  scanned_files_count: number;
  run_at: string;
}

export interface CodeReviewSnapshotDetail extends CodeReviewSnapshotMeta {
  findings: Record<string, unknown>[];
  scanned_files: string[];
}

export async function fetchCodeReviewHistory(repo: string): Promise<CodeReviewSnapshotMeta[]> {
  const { data } = await api.get(`/code-review/snapshots?repo=${encodeURIComponent(repo)}`);
  return data?.snapshots ?? [];
}

export async function fetchCodeReviewSnapshot(id: string): Promise<CodeReviewSnapshotDetail> {
  const { data } = await api.get(`/code-review/snapshots/${id}`);
  return data;
}

// ── Compliance Dashboard ───────────────────────────────────────────────────

export async function fetchComplianceDashboard(): Promise<ComplianceDashboard> {
  const { data } = await api.get("/processes/compliance/dashboard");
  return data;
}

// ── Integrations (Slack / Teams / Webhooks) ────────────────────────────────

export async function fetchIntegrations(): Promise<Integration[]> {
  const { data } = await api.get("/integrations");
  return data;
}

export async function createIntegration(payload: {
  name: string;
  type: IntegrationType;
  webhook_url: string;
  events: IntegrationEvent[];
  is_active?: boolean;
}): Promise<Integration> {
  const { data } = await api.post("/integrations", payload);
  return data;
}

export async function updateIntegration(
  id: string,
  payload: Partial<{
    name: string;
    type: IntegrationType;
    webhook_url: string;
    events: IntegrationEvent[];
    is_active: boolean;
  }>,
): Promise<Integration> {
  const { data } = await api.put(`/integrations/${id}`, payload);
  return data;
}

export async function deleteIntegration(id: string): Promise<void> {
  await api.delete(`/integrations/${id}`);
}

export async function testIntegration(id: string): Promise<{ ok: boolean; message: string }> {
  const { data } = await api.post(`/integrations/${id}/test`);
  return data;
}

export async function fetchAuditLogs(params?: {
  entity_type?: string
  action?: string
  user_id?: string
  limit?: number
  offset?: number
}): Promise<import("@/types").AuditLogResponse> {
  const { data } = await api.get("/audit-logs", { params })
  return data
}

/* ── Guest / Client Portal ── */

export async function fetchGuestTokens(): Promise<GuestAccessToken[]> {
  const { data } = await api.get("/guest/tokens");
  return data ?? [];
}

export async function createGuestToken(payload: {
  email: string;
  name: string;
  allowed_pods: string[];
  allowed_tickets?: string[];
  expires_at?: string | null;
}): Promise<GuestAccessToken> {
  const { data } = await api.post("/guest/tokens", payload);
  return data;
}

export async function revokeGuestToken(id: string): Promise<void> {
  await api.delete(`/guest/tokens/${id}`);
}

export async function fetchGuestMe(guestToken: string): Promise<GuestProfile> {
  const { data } = await api.get("/guest/me", {
    headers: { "X-Guest-Token": guestToken },
  });
  return data;
}

export async function fetchGuestTickets(guestToken: string, params?: { limit?: number; offset?: number }): Promise<TicketsResponse> {
  const { data } = await api.get("/guest/tickets", {
    headers: { "X-Guest-Token": guestToken },
    params,
  });
  return {
    tickets: (data.tickets ?? []).map(_mapTicketOut),
    count: data.count ?? data.total ?? 0,
    total: data.total ?? 0,
    limit: data.limit ?? 50,
    offset: data.offset ?? 0,
  };
}

/* ── Forms / Intake ── */
export async function fetchFormTemplates(): Promise<FormTemplate[]> {
  const { data } = await api.get("/forms");
  return data ?? [];
}

export async function createFormTemplate(payload: Omit<FormTemplate, "id" | "org_id" | "created_at">): Promise<FormTemplate> {
  const { data } = await api.post("/forms", payload);
  return data;
}

export async function fetchFormTemplate(id: string): Promise<FormTemplate> {
  const { data } = await api.get(`/forms/${id}`);
  return data;
}

export async function submitFormResponse(id: string, payload: { submitter_email: string; responses: Record<string, any> }): Promise<FormSubmission> {
  const { data } = await api.post(`/forms/${id}/submissions`, payload);
  return data;
}

export async function fetchFormSubmissions(id: string): Promise<FormSubmission[]> {
  const { data } = await api.get(`/forms/${id}/submissions`);
  return data ?? [];
}

export interface ConvertSubmissionPayload {
  title: string;
  description?: string;
  pod?: string;
  client?: string;
  issue_type?: string;
  priority?: string;
  assignee?: string;
}

export async function convertSubmission(id: string, payload: ConvertSubmissionPayload): Promise<FormSubmission> {
  const { data } = await api.post(`/forms/submissions/${id}/convert`, payload);
  return data;
}
