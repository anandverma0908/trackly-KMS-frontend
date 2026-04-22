/* ── TanStack Query keys — single source of truth ── */
export const QUERY_KEYS = {
  tickets: (params: Record<string, string | string[] | null | undefined>) =>
    ["tickets", params] as const,
  summary: (params: Record<string, string | string[] | null | undefined>) =>
    ["summary", params] as const,
  filters: () => ["filters"] as const,
  goals: (quarter?: string) => ["goals", quarter] as const,
  goal: (id: string) => ["goal", id] as const,
} as const;

/* ── Date presets ── */
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfQuarter,
  endOfQuarter,
} from "date-fns";

export type DatePreset =
  | "today"
  | "thisMonth"
  | "lastMonth"
  | "thisQuarter"
  | "thisFY"
  | "custom";

export function getPresetDates(preset: DatePreset): {
  from: string;
  to: string;
} {
  const now = new Date();
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");

  switch (preset) {
    case "today":
      return { from: fmt(now), to: fmt(now) };
    case "thisMonth":
      return { from: fmt(startOfMonth(now)), to: fmt(endOfMonth(now)) };
    case "lastMonth": {
      const last = subMonths(now, 1);
      return { from: fmt(startOfMonth(last)), to: fmt(endOfMonth(last)) };
    }
    case "thisQuarter":
      return { from: fmt(startOfQuarter(now)), to: fmt(endOfQuarter(now)) };
    case "thisFY": {
      const year =
        now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      return { from: `${year}-04-01`, to: `${year + 1}-03-31` };
    }
    default:
      return { from: fmt(startOfMonth(now)), to: fmt(endOfMonth(now)) };
  }
}
