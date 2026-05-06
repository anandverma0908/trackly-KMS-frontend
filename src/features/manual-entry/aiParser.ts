import type { ParsedEntry, ManualEntryType, AIParseResponse } from "./types";
import { format } from "date-fns";

const API = import.meta.env.VITE_API_URL || "";

function getAuthHeader(): Record<string, string> {
  // Import inline to avoid circular deps
  const stored = localStorage.getItem("eap-auth");
  if (!stored) return {};
  try {
    const { state } = JSON.parse(stored);
    return state?.token ? { Authorization: `Bearer ${state.token}` } : {};
  } catch {
    return {};
  }
}

/* ── Call backend which calls Anthropic ── */
export async function parseTimeEntries(
  text: string,
  pods: string[],
  clients: string[],
): Promise<AIParseResponse> {
  const today = format(new Date(), "yyyy-MM-dd");

  const response = await fetch(`${API}/api/ai/parse-entries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ text, pods, clients }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `AI API error: ${response.status}`);
  }

  const parsed = await response.json();

  const entries: ParsedEntry[] = (parsed.entries ?? []).map((e: any) => ({
    date:       e.date       ?? today,
    activity:   e.activity   ?? "Unknown activity",
    hours:      Number(e.hours) || 0,
    pod:        e.pod        ?? null,
    client:     e.client     ?? null,
    type:       (e.type as ManualEntryType) ?? "Meeting",
    notes:      e.notes      ?? "",
    confidence: e.confidence ?? "medium",
  }));

  return {
    entries,
    totalHours: entries.reduce((sum, e) => sum + e.hours, 0),
    warnings:   parsed.warnings ?? [],
  };
}

/* ── Fallback local parser (mock mode / AI unavailable) ── */
export function localParseEntries(
  text: string,
  pods: string[],
  clients: string[],
  today: string = format(new Date(), "yyyy-MM-dd"),
): AIParseResponse {
  const lines = text
    .split(/[,\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const entries: ParsedEntry[] = [];

  for (const line of lines) {
    const hoursMatch =
      line.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)/i) ??
      line.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)/i);

    if (!hoursMatch) continue;

    const rawHours = parseFloat(hoursMatch[1]);
    const isMin = /m|min/i.test(
      line.slice(
        hoursMatch.index! + hoursMatch[0].length,
        hoursMatch.index! + hoursMatch[0].length + 5,
      ),
    );
    const hours = isMin ? rawHours / 60 : rawHours;

    const podMatch    = pods.find((p) => line.toLowerCase().includes(p.toLowerCase()));
    const clientMatch = clients.find((c) => line.toLowerCase().includes(c.toLowerCase()));

    const typeMap: Record<string, ManualEntryType> = {
      "1:1": "1:1", "one on one": "1:1",
      planning: "Planning", review: "Review",
      interview: "Interview", standup: "Meeting",
      meeting: "Meeting", call: "Meeting",
      report: "Reporting", training: "Training",
    };
    const type =
      Object.entries(typeMap).find(([k]) => line.toLowerCase().includes(k))?.[1] ?? "Meeting";

    entries.push({
      date: today,
      activity:
        line
          .replace(/\d+(?:\.\d+)?\s*(?:h|hr|hrs|hours?|m|min|mins|minutes?)/gi, "")
          .trim()
          .slice(0, 60) || "Activity",
      hours:      Math.round(hours * 4) / 4,
      pod:        podMatch    ?? null,
      client:     clientMatch ?? null,
      type,
      notes:      "",
      confidence: podMatch || clientMatch ? "high" : "medium",
    });
  }

  return {
    entries,
    totalHours: entries.reduce((s, e) => s + e.hours, 0),
    warnings:
      entries.length === 0
        ? ['Could not parse any entries. Try: "sprint planning 2h DPAI, 1:1s 1h"']
        : [],
  };
}