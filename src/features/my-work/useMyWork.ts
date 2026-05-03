import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/useAuthStore";
import {
  fetchMyWork,
  fetchKnowledgeGaps,
  fetchTicket,
} from "@/services/api";
import type {
  MyWorkResponse,
  MyWorkFlowAnalysis,
  MyWorkBlockerPrediction,
  MyWorkSprintRisk,
  MyWorkTimeEnergy,
} from "@/services/api";
import type { Ticket } from "@/types";

/* ── Re-export backend types for page components ── */
export type { MyWorkFlowAnalysis, MyWorkBlockerPrediction, MyWorkSprintRisk, MyWorkTimeEnergy };

/* ── Exported types ── */
export interface AITicket extends Ticket {
  aiRank:        number;
  aiScore:       number;
  aiReason:      string;
  aiAction:      string;
  aiUrgency:     "critical" | "high" | "medium" | "low";
  blockingCount: number;
  blockedBy?:    string;
  daysInStatus:  number;
  sprintName?:   string;
  deadlineRisk?: string;
  quickActions:  QuickAction[];
}

export interface QuickAction {
  id:    string;
  label: string;
  icon:  "ping" | "log" | "draft" | "move" | "review" | "escalate";
}

export interface SprintRisk {
  committed:   number;
  completed:   number;
  remaining:   number;
  probability: number;
  daysLeft:    number;
  wipCount:    number;
  status:      "on_track" | "at_risk" | "off_track";
  coaching:    string;
}

export interface Insight {
  id:           string;
  type:         "anomaly" | "pattern" | "risk" | "collab" | "urgency" | "focus";
  severity:     "info" | "warning" | "critical";
  title:        string;
  message:      string;
  actionLabel?: string;
  actionTarget?: string;
}

export interface FocusBlock {
  availableMinutes:   number;
  recommendedTicket?: AITicket;
  message:            string;
  submessage:         string;
}

export interface TimeEnergy {
  totalLogged:    number;
  totalEstimated: number;
  overrunCount:   number;
  daySparkline:   number[];
  peakHour:       string;
  focusScore:     number;
}

export interface VelocityPattern {
  day:       string;
  completed: number;
  estimated: number;
}

export interface CognitiveData {
  wipCount:       number;
  blockedCount:   number;
  staleCount:     number;
  loadScore:      number;
  recommendation: string;
}

export interface AmbientEvent {
  id:     string;
  key:    string;
  title:  string;
  change: string;
  time:   string;
  type:   "status" | "comment" | "assign" | "blocker";
}

/* ── Helpers ── */
function daysBetween(a: string, b: string): number {
  const ms = new Date(a).getTime() - new Date(b).getTime();
  return Math.round(ms / 86_400_000);
}

function computeQuickActions(t: AITicket): QuickAction[] {
  const actions: QuickAction[] = [];
  if (t.status.toLowerCase().includes("block")) {
    actions.push({ id: "draft-unblock", label: "Draft unblock msg", icon: "draft" });
    actions.push({ id: "ping-blocker",  label: "Ping blocker",      icon: "ping"  });
  }
  if (t.status === "In Review") {
    actions.push({ id: "ping-reviewer", label: "Ping reviewer", icon: "ping" });
    actions.push({ id: "approve",       label: "Approve & move", icon: "move" });
  }
  if (t.status === "In Progress" && t.hours_spent === 0) {
    actions.push({ id: "log-time", label: "Log time", icon: "log" });
  }
  if (t.daysInStatus > 5) {
    actions.push({ id: "escalate", label: "Escalate", icon: "escalate" });
  }
  actions.push({ id: "open", label: "Open ticket", icon: "review" });
  return actions.slice(0, 4);
}

function _mapTicketRaw(raw: any): Ticket {
  return {
    ...raw,
    key:     raw.key ?? raw.jira_key,
    summary: raw.summary ?? raw.title ?? "",
    created: raw.created ?? raw.created_at ?? "",
    updated: raw.updated ?? raw.jira_updated ?? "",
    hours_spent:              raw.hours_spent ?? 0,
    original_estimate_hours:  raw.original_estimate_hours ?? 0,
    remaining_estimate_hours: raw.remaining_estimate_hours ?? 0,
    worklogs: raw.worklogs ?? [],
  };
}

function buildAITickets(
  rawTickets: any[],
  priorityQueue: MyWorkResponse["priority_queue"],
): AITicket[] {
  const rankMap = new Map(priorityQueue.map((r) => [r.key, r]));

  const aiTickets = rawTickets.map((raw): AITicket => {
    const ticket     = _mapTicketRaw(raw);
    const aiData     = rankMap.get(ticket.key);
    const daysInStatus = Math.max(
      0,
      daysBetween(new Date().toISOString(), ticket.updated || new Date().toISOString()),
    );

    let deadlineRisk: string | undefined;
    if (ticket.due_date) {
      const daysLeft    = daysBetween(ticket.due_date, new Date().toISOString());
      const remaining   = ticket.remaining_estimate_hours || ticket.original_estimate_hours || 4;
      const neededDays  = remaining / 2.5;
      if (daysLeft < 0)            deadlineRisk = `Overdue by ${Math.abs(daysLeft)} days`;
      else if (neededDays > daysLeft) deadlineRisk = `Will miss by ${Math.ceil(neededDays - daysLeft)} days`;
      else if (daysLeft <= 2)      deadlineRisk = "Due soon — tight";
    }

    const aiTicket: AITicket = {
      ...ticket,
      aiRank:       aiData?.rank    ?? 999,
      aiScore:      aiData?.score   ?? 0,
      aiReason:     aiData?.reason  ?? `${ticket.priority ?? "Medium"} priority · ${ticket.status}`,
      aiAction:     aiData?.action  ?? "Review and update status",
      aiUrgency:    aiData?.urgency ?? "low",
      blockingCount: 0,
      daysInStatus,
      deadlineRisk,
      quickActions: [],
    };
    aiTicket.quickActions = computeQuickActions(aiTicket);
    return aiTicket;
  });

  return aiTickets.sort((a, b) => a.aiRank - b.aiRank);
}

/* ── Hook ── */
export function useMyWork() {
  const user = useAuthStore((s) => s.user);

  const { data: myWorkData, isLoading: loadingMyWork } = useQuery<MyWorkResponse>({
    queryKey: ["my-work", user?.name],
    queryFn:  fetchMyWork,
    enabled:  !!user,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });

  const { data: knowledgeGaps = [], isLoading: loadingGaps } = useQuery({
    queryKey: ["knowledge-gaps"],
    queryFn:  fetchKnowledgeGaps,
    enabled:  !!user,
  });

  /* AI-ranked tickets — merged from backend tickets + priority_queue */
  const aiTickets = useMemo((): AITicket[] => {
    if (!myWorkData?.tickets) return [];
    return buildAITickets(myWorkData.tickets, myWorkData.priority_queue ?? []);
  }, [myWorkData]);

  /* Sprint Risk — mapped from backend shape to frontend SprintRisk */
  const sprintRisk: SprintRisk | null = useMemo(() => {
    const sr = myWorkData?.sprint_risk;
    if (!sr) return null;
    return {
      committed:   sr.committed,
      completed:   sr.completed,
      remaining:   sr.remaining,
      probability: sr.probability,
      daysLeft:    sr.days_left,
      wipCount:    sr.wip_count,
      status:      sr.status,
      coaching:    sr.coaching,
    };
  }, [myWorkData]);

  /* Time & Energy — mapped from backend */
  const timeEnergy: TimeEnergy = useMemo(() => {
    const te = myWorkData?.time_energy;
    if (!te) {
      return { totalLogged: 0, totalEstimated: 0, overrunCount: 0,
               daySparkline: [0, 0, 0, 0, 0], peakHour: "9am — 12pm", focusScore: 70 };
    }
    return {
      totalLogged:    te.total_logged,
      totalEstimated: te.total_estimated,
      overrunCount:   te.overrun_count,
      daySparkline:   te.velocity_by_day,
      peakHour:       te.peak_window,
      focusScore:     te.focus_score,
    };
  }, [myWorkData]);

  /* Insights — derived from aiTickets + sprintRisk (frontend logic, no extra API call) */
  const insights: Insight[] = useMemo(() => {
    const list: Insight[] = [];

    const longestBlocked = aiTickets
      .filter((t) => t.status.toLowerCase().includes("block"))
      .sort((a, b) => b.daysInStatus - a.daysInStatus)[0];
    if (longestBlocked && longestBlocked.daysInStatus > 2) {
      list.push({
        id: "blocker-anomaly", type: "anomaly", severity: "critical",
        title: "Blocker alert",
        message: `${longestBlocked.key} blocked for ${longestBlocked.daysInStatus} days — longest in your queue.`,
        actionLabel: "Ping blocker", actionTarget: longestBlocked.key,
      });
    }

    if (sprintRisk && sprintRisk.status !== "on_track") {
      list.push({
        id: "sprint-risk", type: "risk",
        severity: sprintRisk.status === "off_track" ? "critical" : "warning",
        title: "Sprint at risk",
        message: `Completion probability: ${sprintRisk.probability}%. ${sprintRisk.coaching.split(" ·")[0]}`,
      });
    }

    const overrunTicket = aiTickets.find(
      (t) => t.original_estimate_hours > 0 && t.hours_spent > t.original_estimate_hours * 1.5,
    );
    if (overrunTicket) {
      const ratio = (overrunTicket.hours_spent / overrunTicket.original_estimate_hours).toFixed(1);
      list.push({
        id: "estimate-anomaly", type: "anomaly", severity: "warning",
        title: "Estimate off",
        message: `${overrunTicket.key} is ${ratio}× over estimate (${overrunTicket.hours_spent}h / ${overrunTicket.original_estimate_hours}h).`,
      });
    }

    const typeCounts: Record<string, number> = {};
    aiTickets.forEach((t) => { typeCounts[t.issue_type] = (typeCounts[t.issue_type] || 0) + 1; });
    const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    if (topType && topType[1] >= 3) {
      list.push({
        id: "type-pattern", type: "pattern", severity: "info",
        title: "Pattern detected",
        message: `${topType[1]} ${topType[0]} tickets in your queue. Consider creating a runbook.`,
        actionLabel: "Draft wiki",
      });
    }

    const overdue = aiTickets.find((t) => t.due_date && new Date(t.due_date) < new Date());
    if (overdue) {
      list.push({
        id: "overdue", type: "urgency", severity: "critical",
        title: "Overdue ticket",
        message: `${overdue.key} was due ${overdue.due_date}. Needs immediate attention.`,
        actionLabel: "Open ticket", actionTarget: overdue.key,
      });
    }

    const wip = aiTickets.filter((t) => t.status === "In Progress").length;
    if (wip > 3) {
      list.push({
        id: "context-switch", type: "focus", severity: "warning",
        title: "Focus risk",
        message: `${wip} tickets in progress. EOS recommends focusing on top 2.`,
      });
    }

    const inReview = aiTickets.filter((t) => t.status === "In Review");
    if (inReview.length > 0) {
      const oldest = inReview.sort((a, b) => b.daysInStatus - a.daysInStatus)[0];
      list.push({
        id: "review-waiting", type: "collab", severity: "info",
        title: "Reviews waiting",
        message: `${inReview.length} ticket${inReview.length > 1 ? "s" : ""} in review. ${oldest.key} waiting ${oldest.daysInStatus} days.`,
      });
    }

    return list.slice(0, 6);
  }, [aiTickets, sprintRisk]);

  /* Smart Focus Block */
  const focusBlock: FocusBlock | null = useMemo(() => {
    const top = aiTickets[0];
    if (!top) return null;
    const hour = new Date().getHours();
    const availableMinutes = hour < 10 ? 120 : hour < 12 ? 90 : hour < 14 ? 60 : 120;
    const remainingWork    = top.remaining_estimate_hours || top.original_estimate_hours || 2;
    const fits             = remainingWork * 60 <= availableMinutes;
    return {
      availableMinutes,
      recommendedTicket: top,
      message: fits
        ? `You have ~${Math.floor(availableMinutes / 60)}h ${availableMinutes % 60}m of uninterrupted time.`
        : `You have ~${Math.floor(availableMinutes / 60)}h ${availableMinutes % 60}m before your next meeting.`,
      submessage: fits
        ? `${top.key} needs ~${remainingWork}h. Perfect fit for a focus block.`
        : `${top.key} needs ~${remainingWork}h. Start now and continue after standup.`,
    };
  }, [aiTickets]);

  /* Morning brief + chips — from backend NOVA */
  const morningBrief = useMemo(() => {
    if (myWorkData?.brief) return myWorkData.brief;
    const topTicket = aiTickets[0];
    const parts: string[] = [`Good morning, ${user?.name?.split(" ")[0] ?? "there"}.`];
    if (topTicket) parts.push(`Start with **${topTicket.key}** — ${topTicket.aiReason.split(" · ")[0]}.`);
    if (sprintRisk && sprintRisk.status !== "on_track") {
      parts.push(`Sprint is **${sprintRisk.status}** (${sprintRisk.probability}%).`);
    }
    return parts.join(" ");
  }, [myWorkData, aiTickets, sprintRisk, user]);

  const briefChips = useMemo(() => {
    if (myWorkData?.brief_chips?.length) return myWorkData.brief_chips;
    const chips: Array<{ label: string; type: "critical" | "warning" | "info" | "action" }> = [];
    const blocked = aiTickets.filter((t) => t.status.toLowerCase().includes("block"));
    if (blocked.length) chips.push({ label: `${blocked.length} blocked`, type: "critical" });
    if (sprintRisk && sprintRisk.status !== "on_track")
      chips.push({ label: sprintRisk.status === "off_track" ? "Sprint off track" : "Sprint at risk", type: "warning" });
    const overdue = aiTickets.filter((t) => t.due_date && new Date(t.due_date) < new Date());
    if (overdue.length) chips.push({ label: `${overdue.length} overdue`, type: "warning" });
    if (aiTickets[0]) chips.push({ label: `Start: ${aiTickets[0].key}`, type: "action" });
    return chips;
  }, [myWorkData, aiTickets, sprintRisk]);

  /* Velocity patterns — from backend worklog data */
  const velocityPatterns: VelocityPattern[] = useMemo(() => {
    const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const vbd  = myWorkData?.time_energy?.velocity_by_day ?? [];
    return DAYS.map((day, i) => {
      const completed = vbd[i] ?? 0;
      const estimated = Math.round((completed + 1.5) * 10) / 10;
      return { day, completed, estimated };
    });
  }, [myWorkData]);

  /* Cognitive load — derived from ticket state */
  const cognitiveData: CognitiveData = useMemo(() => {
    const wipCount     = aiTickets.filter((t) => t.status === "In Progress").length;
    const blockedCount = aiTickets.filter((t) => t.status.toLowerCase().includes("block")).length;
    const staleCount   = aiTickets.filter((t) => t.daysInStatus > 5).length;
    const loadScore    = Math.min(100, wipCount * 15 + blockedCount * 20 + staleCount * 10);
    let recommendation = "Cognitive load looks healthy. Focus on top-priority items.";
    if (loadScore > 70)
      recommendation = `High load — ${wipCount} WIP, ${blockedCount} blocked. Reduce context switching now.`;
    else if (loadScore > 40)
      recommendation = `Moderate load — ${wipCount} in progress. Close one before starting another.`;
    return { wipCount, blockedCount, staleCount, loadScore, recommendation };
  }, [aiTickets]);

  /* Ambient events — from backend recent_activity, fallback to ticket state */
  const ambientEvents: AmbientEvent[] = useMemo(() => {
    if (myWorkData?.recent_activity?.length) {
      return myWorkData.recent_activity.map((ev, i) => ({
        id:     ev.key + i,
        key:    ev.key,
        title:  ev.summary,
        change: ev.change,
        time:   ev.time,
        type:   ev.type,
      }));
    }
    return aiTickets.slice(0, 6).map((t, i): AmbientEvent => {
      const types: AmbientEvent["type"][] = ["status", "comment", "assign", "blocker"];
      const type = t.status.toLowerCase().includes("block") ? "blocker"
        : t.status === "In Review" ? "comment"
        : types[i % types.length];
      const changes: Record<AmbientEvent["type"], string> = {
        status:  `moved to ${t.status}`,
        comment: "left a review comment",
        assign:  `assigned to ${t.assignee ?? "you"}`,
        blocker: "marked as blocked",
      };
      const mins = (i + 1) * 17;
      return {
        id: t.key, key: t.key, title: t.summary,
        change: changes[type],
        time:   mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`,
        type,
      };
    });
  }, [myWorkData, aiTickets]);

  /* Flow analysis from backend */
  const flowAnalysis: MyWorkFlowAnalysis = useMemo(() => {
    return myWorkData?.flow_analysis ?? {
      context_switches: aiTickets.filter((t) => t.status === "In Progress").length,
      flow_state:       "focused",
      recommendation:   "Focus on top-priority items.",
      focus_on:         [],
    };
  }, [myWorkData, aiTickets]);

  /* Blocker predictions from backend */
  const blockerPredictions: MyWorkBlockerPrediction[] = useMemo(() => {
    return myWorkData?.blocker_predictions ?? [];
  }, [myWorkData]);

  return {
    user,
    aiTickets,
    sprintRisk,
    insights,
    focusBlock,
    timeEnergy,
    morningBrief,
    briefChips,
    velocityPatterns,
    cognitiveData,
    ambientEvents,
    flowAnalysis,
    blockerPredictions,
    knowledgeGaps,
    loading:     loadingMyWork,
    loadingGaps,
  };
}

export { fetchTicket };
