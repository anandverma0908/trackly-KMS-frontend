import type { SearchResult, NovaQueryResponse } from "@/shared/types";
import { api } from "@/shared/api/client";
import { normalizeSearchResult } from "@/shared/api/utils";

export async function semanticSearch(
  query: string,
  scope?: "all" | "tickets" | "wiki"
): Promise<SearchResult[]> {
  const { data } = await api.post("/search", { query, scope: scope ?? "all" });
  return (data?.results ?? data ?? []).map(normalizeSearchResult);
}

export async function novaQuery(
  query: string,
  scope?: "all" | "wiki"
): Promise<NovaQueryResponse> {
  const { data } = await api.post("/nova/query", { query, scope });
  return {
    answer: data?.answer ?? "",
    query: data?.query ?? query,
    citations: (data?.citations ?? data?.sources ?? []).map(normalizeSearchResult),
  };
}
