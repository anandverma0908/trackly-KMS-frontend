import type {
  Ticket,
  TicketsResponse,
  TicketCreate,
  TicketComment,
  TicketAttachment,
  TicketActivity,
  NLAnalysisResult,
} from "@/shared/types";
import { api, mock } from "@/shared/api/client";
import { buildParams, MultiFilters } from "@/shared/api/utils";

function mapTicketIn(payload: Partial<TicketCreate>): any {
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

function mapTicketOut(t: any): Ticket {
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

export async function fetchTickets(filters: MultiFilters): Promise<TicketsResponse> {
  if (mock()) {
    const res = await mock().fetchTickets(filters);
    return { ...res, tickets: res.tickets.map(mapTicketOut) };
  }
  const { data } = await api.get<any>("/tickets", {
    params: buildParams(filters, filters.pods, filters.clients),
  });
  return {
    ...data,
    tickets: (data.tickets || []).map(mapTicketOut),
  };
}

export async function fetchTicket(key: string): Promise<Ticket> {
  if (mock()) {
    const t = await mock().fetchTicket(key);
    return mapTicketOut(t);
  }
  const { data } = await api.get<any>(`/tickets/${key}`);
  return mapTicketOut(data);
}

export async function createTicket(payload: TicketCreate) {
  if (mock()?.createTicket) {
    const t = await mock().createTicket(payload);
    return mapTicketOut(t);
  }
  const { data } = await api.post("/tickets", mapTicketIn(payload));
  return mapTicketOut(data);
}

export async function updateTicket(key: string, payload: Partial<TicketCreate>) {
  if (mock()?.updateTicket) {
    const t = await mock().updateTicket(key, payload);
    return mapTicketOut(t);
  }
  const { data } = await api.put(`/tickets/${key}`, mapTicketIn(payload));
  return mapTicketOut(data);
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

export async function createComment(
  key: string,
  content: string,
  parentId?: number
): Promise<TicketComment> {
  const { data } = await api.post(`/tickets/${key}/comments`, {
    body: content,
    parent_id: parentId,
  });
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

export async function logTime(ticketKey: string, hours: number, comment: string, date: string) {
  const { data } = await api.post(`/tickets/${ticketKey}/worklogs`, { hours, comment, date });
  return data;
}
