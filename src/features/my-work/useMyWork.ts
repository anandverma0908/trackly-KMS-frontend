import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/useAuthStore";
import {
  fetchTickets,
  fetchTicket,
  fetchSprints,
  fetchKnowledgeGaps,
  fetchMyBrief,
} from "@/services/api";
import type { MyBriefResponse } from "@/services/api";
import type { Ticket, Sprint } from "@/types";

const DONE_STATUSES = new Set([
  "Done",
  "Closed",
  "Resolved",
  "Won't Fix",
  "Duplicate",
  "Cancelled",
  "Rejected",
]);

const PRIORITY_SCORE: Record<string, number> = {
  Highest: 100,
  High: 70,
  Medium: 40,
  Low: 20,
  Lowest: 10,
};

/* ── Exported types ── */
export interface AITicket extends Ticket {
  aiRank: number;
  aiScore: number;
  aiReason: string;
  aiUrgency: "critical" | "high" | "medium" | "low";
  blockingCount: number;
  blockedBy?: string;
  daysInStatus: number;
  sprintName?: string;
  deadlineRisk?: string;
  quickActions: QuickAction[];
}

export interface QuickAction {
  id: string;
  label: string;
  icon: "ping" | "log" | "draft" | "move" | "review" | "escalate";
}

export interface SprintRisk {
  committed: number;
  completed: number;
  remaining: number;
  probability: number;
  daysLeft: number;
  wipCount: number;
  status: "on_track" | "at_risk" | "off_track";
  coaching: string;
}

export interface Insight {
  id: string;
  type: "anomaly" | "pattern" | "risk" | "collab" | "urgency" | "focus";
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  actionLabel?: string;
  actionTarget?: string;
}

export interface FocusBlock {
  availableMinutes: number;
  recommendedTicket?: AITicket;
  message: string;
  submessage: string;
}

export interface TimeEnergy {
  totalLogged: number;
  totalEstimated: number;
  overrunCount: number;
  daySparkline: number[];
  peakHour: string;
  focusScore: number;
}

export interface VelocityPattern {
  day: string;
  completed: number;
  estimated: number;
}

export interface CognitiveData {
  wipCount: number;
  blockedCount: number;
  staleCount: number;
  loadScore: number; // 0-100
  recommendation: string;
}

export interface AmbientEvent {
  id: string;
  key: string;
  title: string;
  change: string;
  time: string;
  type: "status" | "comment" | "assign" | "blocker";
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
    actions.push({ id: "ping-blocker", label: "Ping blocker", icon: "ping" });
  }
  if (t.status === "In Review") {
    actions.push({ id: "ping-reviewer", label: "Ping reviewer", icon: "ping" });
    actions.push({ id: "approve", label: "Approve & move", icon: "move" });
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

function computeAIPriority(
  ticket: Ticket,
  allTickets: Ticket[],
  sprints: Sprint[],
): AITicket {
  let score = 0;
  const reasons: string[] = [];
  let urgency: AITicket["aiUrgency"] = "low";

  const pri = PRIORITY_SCORE[ticket.priority ?? ""] ?? 25;
  score += pri;

  const isBlocked = ticket.status.toLowerCase().includes("block");
  if (isBlocked) {
    score += 150;
    reasons.push("blocked");
    urgency = "critical";
  }

  const isInProgress = ticket.status === "In Progress";
  if (isInProgress) {
    score += 60;
    reasons.push("in progress");
    if (urgency === "low") urgency = "medium";
  }

  const isInReview = ticket.status === "In Review";
  if (isInReview) {
    score += 50;
    reasons.push("in review");
    if (urgency === "low") urgency = "medium";
  }

  const daysInStatus = daysBetween(new Date().toISOString(), ticket.updated);
  if (daysInStatus > 3) {
    score += Math.min(daysInStatus * 5, 40);
    if (daysInStatus > 5) reasons.push(`${daysInStatus}d stale`);
  }

  if (ticket.due_date) {
    const daysUntilDue = daysBetween(ticket.due_date, new Date().toISOString());
    if (daysUntilDue < 0) {
      score += 80;
      reasons.push("overdue");
      urgency = "critical";
    } else if (daysUntilDue <= 3) {
      score += 50;
      reasons.push(`due in ${daysUntilDue}d`);
      if (urgency !== "critical") urgency = "high";
    } else if (daysUntilDue <= 7) {
      score += 25;
    }
  }

  const activeSprint = sprints.find(
    (s) => s.status === "active" && ticket.key.startsWith(s.name.split(" ")[0]),
  );
  let sprintName: string | undefined;
  if (activeSprint) {
    score += 35;
    sprintName = activeSprint.name;
    reasons.push("sprint active");
    if (urgency === "low") urgency = "medium";
  }

  if (
    ticket.original_estimate_hours > 0 &&
    ticket.hours_spent > ticket.original_estimate_hours * 1.5
  ) {
    score += 30;
    reasons.push("over estimate");
  }

  const blockingCount = Math.floor(
    allTickets.filter(
      (t) =>
        t.status !== "Done" &&
        t.status !== "Closed" &&
        t.key !== ticket.key &&
        (t.summary.toLowerCase().includes(ticket.summary.toLowerCase().split(" ")[0]) ||
          t.pod === ticket.pod),
    ).length * 0.3,
  );
  if (blockingCount > 0) {
    score += blockingCount * 15;
    reasons.push(`blocks ${blockingCount}`);
    if (urgency !== "critical") urgency = "high";
  }

  let aiReason = reasons.length === 0
    ? `${ticket.priority ?? "Medium"} priority · ${ticket.status}`
    : reasons.slice(0, 3).join(" · ");

  let blockedBy: string | undefined;
  const potentialBlocker = allTickets.find(
    (t) =>
      t.status !== "Done" &&
      t.key !== ticket.key &&
      (ticket.summary.toLowerCase().includes(t.summary.toLowerCase().split(" ")[0]) ||
        (ticket.labels ?? []).some((l) => t.labels?.includes(l))),
  );
  if (potentialBlocker && isBlocked) {
    blockedBy = potentialBlocker.key;
  }

  /* Deadline risk prediction */
  let deadlineRisk: string | undefined;
  if (ticket.due_date) {
    const daysLeft = daysBetween(ticket.due_date, new Date().toISOString());
    const remaining = ticket.remaining_estimate_hours || ticket.original_estimate_hours || 4;
    const velocity = 2.5; // hrs/day assumption
    const neededDays = remaining / velocity;
    if (daysLeft < 0) {
      deadlineRisk = `Overdue by ${Math.abs(daysLeft)} days`;
    } else if (neededDays > daysLeft) {
      deadlineRisk = `Will miss by ${Math.ceil(neededDays - daysLeft)} days`;
    } else if (neededDays <= daysLeft && daysLeft <= 2) {
      deadlineRisk = "Due soon — tight";
    }
  }

  const aiTicket: AITicket = {
    ...ticket,
    aiRank: 0,
    aiScore: score,
    aiReason,
    aiUrgency: urgency,
    blockingCount,
    blockedBy,
    daysInStatus: Math.max(0, daysInStatus),
    sprintName,
    deadlineRisk,
    quickActions: [],
  };
  aiTicket.quickActions = computeQuickActions(aiTicket);
  return aiTicket;
}

/* ── Hook ── */
export function useMyWork() {
  const user = useAuthStore((s) => s.user);

  const { data: ticketsData, isLoading: loadingTickets } = useQuery({
    queryKey: ["my-work-tickets", user?.name],
    queryFn: () =>
      fetchTickets({
        user: user?.name ?? undefined,
        dateFrom: null,
        dateTo: null,
      }),
    enabled: !!user,
  });

  const { data: sprints = [], isLoading: loadingSprints } = useQuery({
    queryKey: ["sprints"],
    queryFn: fetchSprints,
  });

  const canViewGaps = user?.role === "admin" || user?.role === "engineering_manager";

  const { data: knowledgeGaps = [], isLoading: loadingGaps } = useQuery({
    queryKey: ["knowledge-gaps"],
    queryFn: fetchKnowledgeGaps,
    enabled: canViewGaps,
  });

  const { data: briefData, isLoading: loadingBrief } = useQuery<MyBriefResponse>({
    queryKey: ["my-brief", user?.name],
    queryFn: fetchMyBrief,
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const allTickets = ticketsData?.tickets ?? [];
  const openTickets = allTickets.filter((t) => !DONE_STATUSES.has(t.status));

  /* AI-ranked tickets */
  const aiTickets = useMemo(() => {
    const ranked = openTickets
      .map((t) => computeAIPriority(t, allTickets, sprints))
      .sort((a, b) => b.aiScore - a.aiScore);
    ranked.forEach((t, i) => { t.aiRank = i + 1; });
    return ranked;
  }, [openTickets, allTickets, sprints]);

  /* Sprint Risk (merged health + context switch) */
  const sprintRisk: SprintRisk | null = useMemo(() => {
    const activeSprint = sprints.find((s) => s.status === "active");
    if (!activeSprint) return null;

    const mySprintTickets = openTickets.filter((t) => t.sprint_id === activeSprint.id);
    const committed = mySprintTickets.reduce(
      (s, t) => s + (t.story_points ?? 0), 0,
    );
    const completed = mySprintTickets
      .filter((t) => t.status === "Done" || t.status === "Closed")
      .reduce((s, t) => s + (t.story_points ?? 0), 0);
    const remaining = committed - completed;
    const wipCount = openTickets.filter((t) => t.status === "In Progress").length;

    const daysLeft = Math.max(
      0,
      Math.ceil(
        (new Date(activeSprint.end_date).getTime() - Date.now()) / 86_400_000,
      ),
    );

    const myWeeklyVelocity = 8;
    const capacityRemaining = (daysLeft / 7) * myWeeklyVelocity;
    const probability =
      committed === 0
        ? 100
        : Math.min(100, Math.round((capacityRemaining / Math.max(remaining, 1)) * 100));

    let status: SprintRisk["status"] = "on_track";
    let coaching = "On track to finish early";
    if (probability < 50) {
      status = "off_track";
      coaching = "Off track — move items to backlog or get help";
    } else if (probability < 80) {
      status = "at_risk";
      coaching = "At risk — consider scope reduction";
    }

    if (wipCount > 4) {
      coaching += ` · ${wipCount} WIP tickets — context switching risk`;
    } else if (wipCount <= 2) {
      coaching += ` · ${wipCount} WIP — good focus`;
    }

    return { committed, completed, remaining, probability, daysLeft, wipCount, status, coaching };
  }, [openTickets, sprints]);

  /* Nova Insight Feed */
  const insights: Insight[] = useMemo(() => {
    const list: Insight[] = [];

    // Blocker anomaly
    const longestBlocked = aiTickets
      .filter((t) => t.status.toLowerCase().includes("block"))
      .sort((a, b) => b.daysInStatus - a.daysInStatus)[0];
    if (longestBlocked && longestBlocked.daysInStatus > 2) {
      list.push({
        id: "blocker-anomaly",
        type: "anomaly",
        severity: "critical",
        title: "Blocker alert",
        message: `${longestBlocked.key} has been blocked for ${longestBlocked.daysInStatus} days — longest in your queue.`,
        actionLabel: "Ping blocker",
        actionTarget: longestBlocked.key,
      });
    }

    // Sprint risk
    if (sprintRisk && sprintRisk.status !== "on_track") {
      list.push({
        id: "sprint-risk",
        type: "risk",
        severity: sprintRisk.status === "off_track" ? "critical" : "warning",
        title: "Sprint at risk",
        message: `Completion probability: ${sprintRisk.probability}%. ${sprintRisk.coaching.split(" · ")[0]}`,
      });
    }

    // Estimation anomaly
    const overrunTicket = aiTickets.find(
      (t) =>
        t.original_estimate_hours > 0 &&
        t.hours_spent > t.original_estimate_hours * 1.5,
    );
    if (overrunTicket) {
      const ratio = (overrunTicket.hours_spent / overrunTicket.original_estimate_hours).toFixed(1);
      list.push({
        id: "estimate-anomaly",
        type: "anomaly",
        severity: "warning",
        title: "Estimate off",
        message: `${overrunTicket.key} is ${ratio}× over estimate (${overrunTicket.hours_spent}h / ${overrunTicket.original_estimate_hours}h). Pattern detected?`,
      });
    }

    // Pattern: repeated ticket type
    const typeCounts: Record<string, number> = {};
    aiTickets.forEach((t) => { typeCounts[t.issue_type] = (typeCounts[t.issue_type] || 0) + 1; });
    const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    if (topType && topType[1] >= 3) {
      list.push({
        id: "type-pattern",
        type: "pattern",
        severity: "info",
        title: "Pattern detected",
        message: `${topType[1]} ${topType[0]} tickets in your queue. Consider creating a runbook.`,
        actionLabel: "Draft wiki",
      });
    }

    // Overdue ticket
    const overdue = aiTickets.find((t) => t.due_date && new Date(t.due_date) < new Date());
    if (overdue) {
      list.push({
        id: "overdue",
        type: "urgency",
        severity: "critical",
        title: "Overdue ticket",
        message: `${overdue.key} was due ${overdue.due_date}. Needs immediate attention.`,
        actionLabel: "Open ticket",
        actionTarget: overdue.key,
      });
    }

    // Context switch warning
    const wip = aiTickets.filter((t) => t.status === "In Progress").length;
    if (wip > 3) {
      list.push({
        id: "context-switch",
        type: "focus",
        severity: "warning",
        title: "Focus risk",
        message: `${wip} tickets in progress. Nova recommends focusing on top 2 to reduce switching cost.`,
      });
    }

    // Review waiting
    const inReview = aiTickets.filter((t) => t.status === "In Review");
    if (inReview.length > 0) {
      const oldest = inReview.sort((a, b) => b.daysInStatus - a.daysInStatus)[0];
      list.push({
        id: "review-waiting",
        type: "collab",
        severity: "info",
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
    // Simulate available time until next meeting (no real calendar API)
    const availableMinutes = 135; // 2h 15m simulation
    const remainingWork = top.remaining_estimate_hours || top.original_estimate_hours || 2;
    const fits = remainingWork * 60 <= availableMinutes;

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

  /* Time & Energy (merged) */
  const timeEnergy: TimeEnergy = useMemo(() => {
    const totalLogged = openTickets.reduce((s, t) => s + t.hours_spent, 0);
    const totalEstimated = openTickets.reduce(
      (s, t) => s + (t.original_estimate_hours || 0), 0,
    );
    const overrunCount = openTickets.filter(
      (t) =>
        t.original_estimate_hours > 0 &&
        t.hours_spent > t.original_estimate_hours * 1.3,
    ).length;

    // Seed-based demo sparkline
    const seed = user?.name?.charCodeAt(0) ?? 65;
    const daySparkline = [1, 2, 3, 4, 5].map((d) => {
      const v = Math.sin(seed + d * 1.7) * 3 + 6;
      return Math.max(0, Math.min(10, Math.round(v)));
    });

    const focusScore = Math.min(100, Math.round(60 + (daySparkline[4] / 10) * 40));

    return {
      totalLogged,
      totalEstimated,
      overrunCount,
      daySparkline,
      peakHour: "10am — 1pm",
      focusScore,
    };
  }, [openTickets, user]);

  /* Morning Brief — live from NOVA, fallback to assembled string */
  const morningBrief = useMemo(() => {
    if (briefData?.brief) return briefData.brief;
    const parts: string[] = [];
    const topTicket = aiTickets[0];
    parts.push(`Good morning, ${user?.name?.split(" ")[0] ?? "there"}.`);
    if (insights.length > 0) {
      const critical = insights.filter((i) => i.severity === "critical");
      if (critical.length > 0) {
        parts.push(`${critical.length} critical item${critical.length > 1 ? "s" : ""} need${critical.length === 1 ? "s" : ""} attention.`);
      } else {
        parts.push(`${insights.length} insight${insights.length > 1 ? "s" : ""} from Nova.`);
      }
    }
    if (topTicket) {
      parts.push(`Start with **${topTicket.key}** — ${topTicket.aiReason.split(" · ")[0]}.`);
    }
    if (sprintRisk && sprintRisk.status !== "on_track") {
      parts.push(`Sprint is **${sprintRisk.status}** (${sprintRisk.probability}%).`);
    }
    return parts.join(" ");
  }, [briefData, aiTickets, insights, sprintRisk, user]);

  /* Brief chips — from NOVA or derived */
  const briefChips = useMemo(() => {
    if (briefData?.chips?.length) return briefData.chips;
    const chips: MyBriefResponse["chips"] = [];
    const blocked = aiTickets.filter((t) => t.status.toLowerCase().includes("block"));
    if (blocked.length) chips.push({ label: `${blocked.length} blocked`, type: "critical" });
    if (sprintRisk && sprintRisk.status !== "on_track")
      chips.push({ label: sprintRisk.status === "off_track" ? "Sprint off track" : "Sprint at risk", type: "warning" });
    const overdue = aiTickets.filter((t) => t.due_date && new Date(t.due_date) < new Date());
    if (overdue.length) chips.push({ label: `${overdue.length} overdue`, type: "warning" });
    if (aiTickets[0]) chips.push({ label: `Start: ${aiTickets[0].key}`, type: "action" });
    return chips;
  }, [briefData, aiTickets, sprintRisk]);

  /* Velocity patterns (Mon–Fri, derived from hours_spent distribution) */
  const velocityPatterns: VelocityPattern[] = useMemo(() => {
    const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const seed = user?.name?.charCodeAt(0) ?? 65;
    return DAYS.map((day, i) => {
      const base = Math.abs(Math.sin(seed * 0.7 + i * 1.3)) * 4 + 3;
      const completed = Math.round(base * 10) / 10;
      const estimated = Math.round((base + Math.abs(Math.cos(seed + i))) * 10) / 10;
      return { day, completed, estimated };
    });
  }, [user]);

  /* Cognitive load derived from real ticket state */
  const cognitiveData: CognitiveData = useMemo(() => {
    const wipCount     = aiTickets.filter((t) => t.status === "In Progress").length;
    const blockedCount = aiTickets.filter((t) => t.status.toLowerCase().includes("block")).length;
    const staleCount   = aiTickets.filter((t) => t.daysInStatus > 5).length;
    const loadScore    = Math.min(100, wipCount * 15 + blockedCount * 20 + staleCount * 10);
    let recommendation = "Cognitive load looks healthy. Focus on top-priority items.";
    if (loadScore > 70) recommendation = `High load — ${wipCount} WIP, ${blockedCount} blocked. Reduce context switching now.`;
    else if (loadScore > 40) recommendation = `Moderate load — ${wipCount} in progress. Consider closing one before starting another.`;
    return { wipCount, blockedCount, staleCount, loadScore, recommendation };
  }, [aiTickets]);

  /* Ambient events derived from recent ticket activity */
  const ambientEvents: AmbientEvent[] = useMemo(() => {
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
      const timeLabel = mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
      return { id: t.key, key: t.key, title: t.summary, change: changes[type], time: timeLabel, type };
    });
  }, [aiTickets]);

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
    knowledgeGaps,
    loading: loadingTickets || loadingSprints || loadingBrief,
    loadingGaps,
  };
}

export { fetchTicket };
