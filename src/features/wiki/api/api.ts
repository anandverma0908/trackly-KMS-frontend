import type { WikiSpace, WikiPage, WikiVersion, RelatedDoc } from "@/shared/types";
import { api } from "@/shared/api/client";

export async function fetchWikiSpaces(): Promise<WikiSpace[]> {
  const { data } = await api.get("/wiki/spaces");
  return data;
}

export async function createWikiSpace(payload: {
  name: string;
  description: string;
}): Promise<WikiSpace> {
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

export async function createWikiPage(payload: {
  space_id: string;
  title: string;
  content: string;
  parent_id?: string;
}): Promise<WikiPage> {
  const { data } = await api.post("/wiki/pages", { ...payload, content_md: payload.content });
  return data;
}

export async function updateWikiPage(
  id: string,
  payload: { title?: string; content?: string }
): Promise<WikiPage> {
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

export async function fetchRelatedDocs(type: "ticket" | "wiki", id: string | number): Promise<RelatedDoc[]> {
  const path = type === "ticket" ? `/tickets/${id}/related` : `/wiki/pages/${id}/related`;
  const { data } = await api.get(path);
  return data;
}

export async function extractMeetingActions(content: string) {
  const { data } = await api.post("/wiki/ai/meeting-notes", { content });
  return data;
}
