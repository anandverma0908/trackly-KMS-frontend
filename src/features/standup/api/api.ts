import type { Standup } from "@/shared/types";
import { api } from "@/shared/api/client";

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
