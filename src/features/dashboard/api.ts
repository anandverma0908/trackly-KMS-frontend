import type { SummaryResponse, FiltersResponse, WorkloadEntry } from "@/shared/types";
import { api, mock } from "@/shared/api/client";
import { buildParams, MultiFilters } from "@/shared/api/utils";

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

export interface PodSummary {
  pod: string;
  statuses: Record<string, number>;
  total_hours: number;
}

export async function fetchPodSummary(): Promise<PodSummary[]> {
  if (mock()?.fetchPodSummary) return mock().fetchPodSummary();
  const { data } = await api.get<PodSummary[]>("/analytics/pod-summary");
  return data ?? [];
}

export async function fetchWorkload(): Promise<WorkloadEntry[]> {
  const { data } = await api.get("/analytics/workload");
  return data?.data ?? data ?? [];
}
