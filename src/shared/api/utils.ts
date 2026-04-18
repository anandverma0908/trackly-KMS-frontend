import type { FilterState, SearchResult } from "@/shared/types";

export interface MultiFilters extends Partial<FilterState> {
  pods?: string[];
  clients?: string[];
}

export function buildParams(
  filters: Partial<FilterState>,
  pods?: string[],
  clients?: string[]
): Record<string, string> {
  const p: Record<string, string> = {};

  if (filters.dateFrom) p.date_from = filters.dateFrom;
  if (filters.dateTo) p.date_to = filters.dateTo;
  if (filters.user) p.user = filters.user;
  if (filters.project) p.project = filters.project;

  const podList = pods?.length ? pods : filters.pod ? [filters.pod] : [];
  if (podList.length > 0) p.pod = podList.join(",");

  const clientList = clients?.length
    ? clients
    : filters.client
    ? [filters.client]
    : [];
  if (clientList.length > 0) p.client = clientList.join(",");

  return p;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function normalizeSearchResult(raw: any): SearchResult {
  const type = raw.type ?? raw.source_type ?? "wiki";
  const id = raw.id ?? raw.key ?? "";
  const key = raw.key ?? undefined;
  const score =
    typeof raw.score === "number"
      ? raw.score
      : typeof raw.similarity === "number"
      ? raw.similarity
      : 0;

  const url =
    raw.url ??
    (type === "ticket" && key
      ? `/tickets?key=${encodeURIComponent(String(key))}`
      : type === "wiki" && id
      ? `/wiki?page=${encodeURIComponent(String(id))}`
      : undefined);

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
