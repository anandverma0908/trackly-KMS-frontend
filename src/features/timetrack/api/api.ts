import { api } from "@/shared/api/client";

export async function fetchWeeklyTimesheet(weekStart: string) {
  const { data } = await api.get("/timesheets/weekly", { params: { week_start: weekStart } });
  return data ?? [];
}

export async function saveTimesheetEntry(entry: {
  ticket_key: string;
  date: string;
  hours: number;
  comment?: string;
}) {
  const { data } = await api.post("/timesheets/entries", entry);
  return data;
}
