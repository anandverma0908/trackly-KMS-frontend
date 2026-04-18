import { api } from "@/shared/api/client";

export async function parseTimeEntry(text: string) {
  const { data } = await api.post("/manual-entry/parse", { text });
  return data;
}

export async function submitTimeEntries(entries: any[]) {
  const { data } = await api.post("/manual-entry/bulk", { entries });
  return data;
}

export async function fetchMyTimesheets() {
  const { data } = await api.get("/manual-entry/timesheets");
  return data ?? [];
}
