import { api } from "@/shared/api/client";

export async function fetchTeamMembers() {
  const { data } = await api.get("/team/members");
  return data ?? [];
}

export async function fetchEngineerDetails(id: string) {
  const { data } = await api.get(`/team/members/${id}`);
  return data;
}
