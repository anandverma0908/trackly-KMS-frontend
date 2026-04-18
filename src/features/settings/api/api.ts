import type { ClientBudget, BurnRateAlert, OrgMember } from "@/shared/types";
import { api } from "@/shared/api/client";

export async function fetchBurnRates(): Promise<ClientBudget[]> {
  const { data } = await api.get("/clients/burn-rate");
  return Array.isArray(data) ? data : data?.clients ?? [];
}

export async function setClientBudget(client: string, budgetHours: number) {
  const now = new Date();
  const { data } = await api.post("/clients/budget", {
    client,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    budget_hours: budgetHours,
  });
  return data;
}

export async function fetchBurnRateAlerts(): Promise<BurnRateAlert[]> {
  const { data } = await api.get("/clients/burn-rate/alerts");
  return Array.isArray(data) ? data : data?.alerts ?? [];
}

export async function fetchOrgMembers(): Promise<OrgMember[]> {
  const { data } = await api.get("/users/members");
  return data as OrgMember[];
}
