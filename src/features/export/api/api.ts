import type { ExportConfig } from "@/shared/types";
import { api, mock } from "@/shared/api/client";
import { downloadBlob } from "@/shared/api/utils";

export async function downloadMonthlyReport(config: ExportConfig): Promise<void> {
  if (mock()) {
    mock().downloadMonthlyReport(config);
    return;
  }
  const p: Record<string, string> = {};
  if (config.dateFrom) p.date_from = config.dateFrom;
  if (config.dateTo) p.date_to = config.dateTo;
  if (config.monthLabel) p.month_label = config.monthLabel;
  if (config.pod) p.pod = config.pod;
  if (config.client) p.client = config.client;
  if (config.project) p.project = config.project;
  if (config.engineer) p.user = config.engineer;
  const { data } = await api.get("/export/monthly", { params: p, responseType: "blob" });
  downloadBlob(data, `timesheet_${config.monthLabel?.replace(" ", "_") ?? "report"}.xlsx`);
}

export async function downloadFYReport(config: ExportConfig): Promise<void> {
  if (mock()) {
    mock().downloadFYReport(config);
    return;
  }
  const p: Record<string, string> = {};
  if (config.dateFrom) p.date_from = config.dateFrom;
  if (config.dateTo) p.date_to = config.dateTo;
  if (config.fyLabel) p.fy_label = config.fyLabel;
  if (config.pod) p.pod = config.pod;
  if (config.client) p.client = config.client;
  if (config.project) p.project = config.project;
  if (config.engineer) p.user = config.engineer;
  const { data } = await api.get("/export/fy", { params: p, responseType: "blob" });
  downloadBlob(data, `engineering_FY_${config.fyLabel ?? "2024-2025"}.xlsx`);
}
