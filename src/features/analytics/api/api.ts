import type { KnowledgeGap } from "@/shared/types";
import { api, mock } from "@/shared/api/client";

export async function fetchKnowledgeGaps(): Promise<KnowledgeGap[]> {
  const { data } = await api.get("/nova/knowledge-gaps");
  return data?.gaps ?? data ?? [];
}

export async function detectKnowledgeGaps() {
  const { data } = await api.post("/nova/knowledge-gaps/detect");
  return data;
}

export async function fetchNovaStatus() {
  const { data } = await api.get("/nova/status");
  return data;
}
