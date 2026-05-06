import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFilterStore } from "@/store";
import {
  fetchSummary,
  fetchOrgMembers,
  fetchUserActivity,
  novaQuery,
  fetchCognitiveLoad,
  fetchTeamChemistry,
  fetchMemoryGraph,
} from "@/services/api";
import type {
  ActivityEntry,
  CognitiveLoadMember,
  PodBalance,
  ExpertiseMember,
} from "@/services/api";
import ActivityEntryRow from "@/components/ui/ActivityEntryRow";
import drawerStyles from "@/components/ui/SideDrawer.module.css";
import { QUERY_KEYS } from "@/config/queryKeys";
import { initials, formatNumber, formatDate } from "@/utils/formatters";
import { useAuthStore } from "@/features/auth/useAuthStore";
import EmptyState from "@/components/ui/EmptyState";
import SideDrawer from "@/components/ui/SideDrawer";
import styles from "./TeamPage.module.css";
import type { OrgMember, SummaryByUser } from "@/types";
import {
  RiSparklingLine,
  RiTimeLine,
  RiTicketLine,
  RiUserLine,
  RiCalendarLine,
  RiEyeLine,
  RiAlertLine,
  RiCheckLine,
  RiSearchLine,
} from "react-icons/ri";

const AVATAR_COLORS = [
  "linear-gradient(135deg,#f59e0b,#fbbf24)",
  "linear-gradient(135deg,#34D399,#10B981)",
  "linear-gradient(135deg,#FBBF24,#F59E0B)",
  "linear-gradient(135deg,#F87171,#FCA5A5)",
  "linear-gradient(135deg,#A78BFA,#C4B5FD)",
  "linear-gradient(135deg,#22D3EE,#67E8F9)",
  "linear-gradient(135deg,#64748B,#94A3B8)",
];

function stripMd(text: string): string {
  return text
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function AiText({ text, className }: { text: string; className?: string }) {
  const clean = stripMd(text);
  const blocks = clean.split(/\n\n+/);
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
        const isBulletBlock = lines.every(l => /^[-•*]\s/.test(l));
        if (isBulletBlock) {
          return (
            <ul key={bi} style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
              {lines.map((line, li) => (
                <li key={li} style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
                  {line.replace(/^[-•*]\s+/, "")}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} style={{ margin: 0, fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
            {lines.join(" ")}
          </p>
        );
      })}
    </div>
  );
}

function getAvatarColor(name: string | undefined | null) {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  engineering_manager: "Eng. Manager",
  tech_lead: "Tech Lead",
  team_member: "Engineer",
  finance_viewer: "Finance",
};

function getStatus(hours: number) {
  if (hours >= 45)
    return {
      label: "Overloaded",
      color: "#F87171",
      bg: "rgba(248,113,113,0.12)",
    };
  if (hours >= 25)
    return { label: "Active", color: "#34D399", bg: "rgba(52,211,153,0.12)" };
  if (hours > 0)
    return { label: "Light", color: "#FBBF24", bg: "rgba(251,191,36,0.12)" };
  return { label: "Idle", color: "#94A3B8", bg: "rgba(148,163,184,0.12)" };
}

/* ── Timesheet Drawer ── */

function TimesheetDrawer({
  member,
  summary,
  dateFrom,
  dateTo,
  open,
  onClose,
}: {
  member: OrgMember | null;
  summary: SummaryByUser | null;
  dateFrom: string;
  dateTo: string;
  open: boolean;
  onClose: () => void;
}) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiBrief, setAiBrief] = useState<string | null>(null);

  const { data: activityData = [], isLoading: activityLoading } = useQuery<ActivityEntry[]>({
    queryKey: ["user-activity", member?.name, dateFrom, dateTo],
    queryFn: () => fetchUserActivity({ user: member!.name, dateFrom, dateTo }),
    enabled: open && !!member?.name,
    staleTime: 2 * 60_000,
  });

  const groupedByDate = useMemo(() => {
    const map = new Map<string, ActivityEntry[]>();
    for (const entry of activityData) {
      const list = map.get(entry.date) ?? [];
      list.push(entry);
      map.set(entry.date, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [activityData]);

  const ticketCount = activityData.filter((e) => e.source === "ticket").length;
  const manualCount = activityData.filter((e) => e.source === "manual").length;
  const activeDays = groupedByDate.length;
  const totalHours = activityData.reduce((s, e) => s + e.hours, 0);

  if (!member) return null;
  const displayMember = member;

  async function generateBrief() {
    setAiLoading(true);
    try {
      const top5 = activityData.slice(0, 5).map((e) =>
        `- ${e.date}: ${e.activity} (${e.hours}h${e.ticket_key ? `, ${e.ticket_key}` : ""})`
      ).join("\n");
      const prompt = `You are EOS, an engineering team lead reviewing a team member's timesheet.

Name: ${displayMember.name}
Role: ${displayMember.title || displayMember.role}
Period: ${formatDate(dateFrom, "MMM d")} – ${formatDate(dateTo, "MMM d, yyyy")}
Hours logged: ${totalHours.toFixed(1)}
Ticket logs: ${ticketCount}, Manual entries: ${manualCount}, Active days: ${activeDays}

Recent activity:
${top5 || "No entries found."}

Write a concise 2-sentence performance brief. One sentence on productivity, one on any concern or praise. Keep it friendly and constructive.`;
      const res = await novaQuery(prompt);
      setAiBrief(res.answer?.trim() ?? null);
    } catch {
      setAiBrief("Unable to generate brief.");
    } finally {
      setAiLoading(false);
    }
  }

  const status = getStatus(summary?.hours ?? 0);

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      size="md"
      title={`${displayMember?.name}'s Timesheet`}
      subtitle={`${formatDate(dateFrom, "MMM d")} – ${formatDate(dateTo, "MMM d, yyyy")}`}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className={styles.btnSecondary} onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className={styles.drawerBody}>
        {/* Profile header */}
        <div className={styles.drawerProfile}>
          <div
            className={styles.drawerAvatar}
            style={{ background: getAvatarColor(displayMember?.name) }}
          >
            {initials(displayMember.name)}
          </div>
          <div>
            <div className={styles.drawerName}>{displayMember.name}</div>
            <div className={styles.drawerMeta}>
              {displayMember.title ||
                ROLE_LABEL[displayMember.role] ||
                displayMember.role}{" "}
              · {displayMember.pod || "-"}
            </div>
          </div>
          <span
            className={styles.statusPill}
            style={{
              background: status.bg,
              color: status.color,
              marginLeft: "auto",
            }}
          >
            {status.label}
          </span>
        </div>

        {/* Stats */}
        <div className={styles.drawerStats}>
          <div className={styles.drawerStat}>
            <RiTimeLine size={16} color="var(--accent)" />
            <span className={styles.drawerStatVal}>
              {totalHours > 0 ? `${totalHours.toFixed(1)}h` : `${formatNumber(Math.round(summary?.hours ?? 0))}h`}
            </span>
            <span className={styles.drawerStatLbl}>Logged</span>
          </div>
          <div className={styles.drawerStat}>
            <RiTicketLine size={16} color="var(--accent)" />
            <span className={styles.drawerStatVal}>{ticketCount}</span>
            <span className={styles.drawerStatLbl}>Ticket Logs</span>
          </div>
          <div className={styles.drawerStat}>
            <RiCalendarLine size={16} color="var(--accent)" />
            <span className={styles.drawerStatVal}>{activeDays}</span>
            <span className={styles.drawerStatLbl}>Active Days</span>
          </div>
          <div className={styles.drawerStat}>
            <RiEyeLine size={16} color="var(--accent)" />
            <span className={styles.drawerStatVal}>{manualCount}</span>
            <span className={styles.drawerStatLbl}>Manual</span>
          </div>
        </div>

        {/* AI Brief */}
        <div className={styles.aiBriefCard}>
          <div className={styles.aiBriefHeader}>
            <RiSparklingLine size={14} color="var(--accent)" />
            <span className={styles.aiBriefTitle}>EOS Performance Brief</span>
            {!aiBrief && !aiLoading && (
              <button className={styles.aiBriefBtn} onClick={generateBrief}>
                Generate
              </button>
            )}
          </div>
          {aiLoading && (
            <div
              className={styles.aiBriefText}
              style={{ color: "var(--text-3)" }}
            >
              EOS is analysing…
            </div>
          )}
          {aiBrief && <div className={styles.aiBriefText}>{aiBrief}</div>}
        </div>

        {/* Activity Feed */}
        <div className={styles.sectionTitle}>Activity</div>

        {activityLoading && (
          <div className={styles.activityNote}>
            <span style={{ color: "var(--text-3)", fontSize: 13 }}>Loading entries…</span>
          </div>
        )}

        {!activityLoading && activityData.length === 0 && (
          <div className={styles.activityNote}>
            <RiEyeLine size={14} color="var(--text-3)" />
            <span>No time entries found for this period.</span>
          </div>
        )}

        {!activityLoading && groupedByDate.map(([date, entries]) => {
          const dayTotal = entries.reduce((s, e) => s + e.hours, 0);
          return (
            <div key={date} style={{ marginBottom: 16 }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
                paddingBottom: 4,
                borderBottom: "1px solid var(--border)",
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
                  {formatDate(date, "EEE, MMM d")}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                  {dayTotal.toFixed(1)}h
                </span>
              </div>
              <div className={drawerStyles.entryList}>
                {entries.map((entry) => (
                  <ActivityEntryRow key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </SideDrawer>
  );
}

/* ── Main Page ── */
export default function TeamPage() {
  const filters = useFilterStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<OrgMember | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<SummaryByUser | null>(
    null,
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiBrief, setAiBrief] = useState<string | null>(null);
  const hasBriefedRef = useRef(false);

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: QUERY_KEYS.summary({
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    }),
    queryFn: () =>
      fetchSummary({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      }),
  });

  const { data: orgMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ["org-members"],
    queryFn: fetchOrgMembers,
    staleTime: 5 * 60_000,
  });

  const { data: cogLoadData } = useQuery({
    queryKey: ["cognitive-load"],
    queryFn: fetchCognitiveLoad,
    staleTime: 5 * 60_000,
  });

  const { data: chemistryData } = useQuery({
    queryKey: ["team-chemistry"],
    queryFn: fetchTeamChemistry,
    staleTime: 5 * 60_000,
  });

  const { data: memoryData } = useQuery({
    queryKey: ["memory-graph"],
    queryFn: fetchMemoryGraph,
    staleTime: 5 * 60_000,
  });

  const isLoading = summaryLoading || membersLoading;

  /* Filter team members by reporting hierarchy */
  const myTeam = useMemo(() => {
    if (!user || !orgMembers.length) return [];

    const isAdmin = user.role === "admin";
    if (isAdmin)
      return orgMembers.filter((m: OrgMember) => m.role !== "finance_viewer");

    const myProfile = orgMembers.find((m: OrgMember) => m.email === user.email);
    if (!myProfile) return [];

    // reporting_to could be emp_no, id, email, or name depending on backend
    const myIds = [
      myProfile.emp_no,
      myProfile.id,
      myProfile.email,
      myProfile.name,
    ].filter(Boolean);

    return orgMembers.filter(
      (m: OrgMember) =>
        m.reporting_to &&
        myIds.includes(m.reporting_to) &&
        m.role !== "finance_viewer",
    );
  }, [orgMembers, user]);

  const summaryMap = useMemo(() => {
    const map = new Map<string, SummaryByUser>();
    (summaryData?.by_user ?? []).forEach((u: SummaryByUser) =>
      map.set(u.user, u),
    );
    return map;
  }, [summaryData]);

  const teamWithStats = useMemo(() => {
    return myTeam.map((m: OrgMember) => ({
      member: m,
      summary: summaryMap.get(m.name) ?? {
        user: m.name,
        hours: 0,
        tickets: 0,
        clients: [],
      },
    }));
  }, [myTeam, summaryMap]);

  const filteredTeam = useMemo(() => {
    if (!search.trim()) return teamWithStats;
    const q = search.toLowerCase();
    return teamWithStats.filter(
      (t: { member: OrgMember; summary: SummaryByUser }) =>
        t.member.name.toLowerCase().includes(q) ||
        (t.member.title ?? "").toLowerCase().includes(q) ||
        (t.member.pod ?? "").toLowerCase().includes(q),
    );
  }, [teamWithStats, search]);

  const totalHours = teamWithStats.reduce(
    (sum: number, t: { summary: SummaryByUser }) =>
      sum + (t.summary.hours ?? 0),
    0,
  );
  const totalTickets = teamWithStats.reduce(
    (sum: number, t: { summary: SummaryByUser }) =>
      sum + (t.summary.tickets ?? 0),
    0,
  );
  const activeCount = teamWithStats.filter(
    (t: { summary: SummaryByUser }) => (t.summary.hours ?? 0) >= 25,
  ).length;
  const idleCount = teamWithStats.filter(
    (t: { summary: SummaryByUser }) => (t.summary.hours ?? 0) === 0,
  ).length;

  useEffect(() => {
    if (filteredTeam.length > 0 && !hasBriefedRef.current) {
      hasBriefedRef.current = true;
      generateTeamBrief();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTeam.length]);

  async function generateTeamBrief() {
    if (!filteredTeam.length) return;
    setAiLoading(true);
    try {
      const memberLines = filteredTeam
        .map(
          (t: { member: OrgMember; summary: SummaryByUser }) =>
            `- ${t.member.name}: ${t.summary.hours}h, ${t.summary.tickets} tickets`,
        )
        .join("\n");
      const prompt = `You are EOS, an engineering leadership coach.

Here is my team's performance for ${formatDate(filters.dateFrom || "", "MMM d")} – ${formatDate(filters.dateTo || "", "MMM d, yyyy")}:
${memberLines}

Total team hours: ${totalHours}
Total tickets: ${totalTickets}
Active members (25h+): ${activeCount}
Idle members (0h): ${idleCount}

Write a concise 3-sentence leadership brief:
1. Overall team health
2. Who needs attention
3. One actionable recommendation
Keep it direct and actionable.`;
      const res = await novaQuery(prompt);
      setAiBrief(res.answer?.trim() ?? null);
    } catch {
      setAiBrief("Unable to generate team brief.");
    } finally {
      setAiLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>My Team</h1>
          <p className={styles.subtitle}>Loading team data…</p>
        </div>
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.cardSkeleton} />
          ))}
        </div>
      </div>
    );
  }

  if (!myTeam.length) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>My Team</h1>
          <p className={styles.subtitle}>
            No team members found under your hierarchy.
          </p>
        </div>
        <EmptyState
          icon="👤"
          title="No direct reports"
          desc="You don't have any team members reporting to you right now."
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={`${styles.header} fade-up`}>
        <div>
          <h1 className={styles.title}>My Team</h1>
          {/* <p className={styles.subtitle}>
            {myTeam.length} direct report{myTeam.length > 1 ? "s" : ""} ·{" "}
            {formatDate(filters.dateFrom || "", "MMM d")} –{" "}
            {formatDate(filters.dateTo || "", "MMM d, yyyy")}
          </p> */}
        </div>
      </div>

      {/* Stats strip */}
      <div className={`${styles.statsStrip} fade-up-2`}>
        <div className={styles.statBox}>
          <div className={styles.statBoxTop}>
            <span className={styles.statBoxLbl}>Members</span>
            <span className={styles.statBoxIcon}>
              <RiUserLine />
            </span>
          </div>
          <div className={styles.statBoxBottom}>
            <span className={styles.statBoxVal}>{myTeam.length}</span>
          </div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statBoxTop}>
            <span className={styles.statBoxLbl}>Total Hours</span>
            <span className={styles.statBoxIcon}>
              <RiTimeLine />
            </span>
          </div>
          <div className={styles.statBoxBottom}>
            <span className={styles.statBoxVal}>
              {formatNumber(Math.round(totalHours))}h
            </span>
          </div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statBoxTop}>
            <span className={styles.statBoxLbl}>Tickets</span>
            <span className={styles.statBoxIcon}>
              <RiTicketLine />
            </span>
          </div>
          <div className={styles.statBoxBottom}>
            <span className={styles.statBoxVal}>{totalTickets}</span>
          </div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statBoxTop}>
            <span className={styles.statBoxLbl}>Active</span>
            <span className={styles.statBoxIcon}>
              <RiCheckLine />
            </span>
          </div>
          <div className={styles.statBoxBottom}>
            <span className={styles.statBoxVal}>{activeCount}</span>
          </div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statBoxTop}>
            <span className={styles.statBoxLbl}>Idle</span>
            <span className={styles.statBoxIcon}>
              <RiAlertLine />
            </span>
          </div>
          <div className={styles.statBoxBottom}>
            <span className={styles.statBoxVal}>{idleCount}</span>
          </div>
        </div>
      </div>

      <div className={`${styles.searchHeader} fade-up-3`}>
        <div className={styles.searchWrap}>
          <RiSearchLine size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
          <input
            className={styles.searchInput}
            placeholder="Search by name, title, or POD…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className={styles.searchClear}
              onClick={() => setSearch("")}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className={styles.teamContent}>
        {/* ── EOS Team Brief (auto-generated, briefBar style) ── */}
        <div className={`${styles.briefBar} fade-up-2`}>
          <div className={styles.briefGlow} />
          <div className={styles.briefContent}>
            <RiSparklingLine
              size={14}
              color="var(--accent)"
              style={{ flexShrink: 0 }}
            />
            <div className={styles.briefText}>
              {aiLoading ? (
                <span className={styles.briefLoading}>
                  EOS is analysing your team…
                </span>
              ) : aiBrief ? (
                <AiText text={aiBrief} />
              ) : (
                <span className={styles.briefLoading}>
                  Preparing team brief…
                </span>
              )}
            </div>
            <span className={styles.eosBadge}>
              <RiSparklingLine size={9} /> EOS
            </span>
          </div>
        </div>

        {/* ── Institutional Memory Map (full width, goalCard style) ── */}
        <div className={`${styles.insightCard} fade-up-3`}>
          <div className={styles.insightCardHeader}>
            <span className={styles.insightCardTitle}>
              Institutional Memory Map
            </span>
          </div>
          <div className={styles.insightCardBody}>
            {!memoryData ? (
              <span className={styles.aiPanelHint}>Loading memory graph…</span>
            ) : (
              <>
                {memoryData.ai_summary && (
                  <AiText text={memoryData.ai_summary} />
                )}
                {memoryData.bus_factor_risks.filter(
                  (r: { pod: string; contributors: number; risk: string }) =>
                    r.risk === "High",
                ).length > 0 && (
                  <div className={styles.memoryRiskBanner}>
                    <RiAlertLine size={12} color="var(--amber)" />
                    <span>
                      Bus factor risk:{" "}
                      {memoryData.bus_factor_risks
                        .filter(
                          (r: {
                            pod: string;
                            contributors: number;
                            risk: string;
                          }) => r.risk === "High",
                        )
                        .map((r: { pod: string }) => r.pod)
                        .join(", ")}{" "}
                      — only 1 contributor
                    </span>
                  </div>
                )}
                <div className={styles.expertiseList}>
                  {memoryData.expertise_map
                    .slice(0, 6)
                    .map((m: ExpertiseMember) => (
                      <div key={m.name} className={styles.expertiseRow}>
                        <div className={styles.expertiseAvatar}>
                          {m.name
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className={styles.expertiseInfo}>
                          <span className={styles.expertiseName}>{m.name}</span>
                          <div className={styles.expertisePods}>
                            {m.pods.slice(0, 3).map((pod: string) => (
                              <span
                                key={pod}
                                className={styles.expertisePodTag}
                              >
                                {pod}
                              </span>
                            ))}
                            {m.pods.length > 3 && (
                              <span className={styles.expertisePodTag}>
                                +{m.pods.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={styles.expertiseCount}>
                          {m.ticket_count} tickets
                        </span>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Cognitive Load + Chemistry in one row ── */}
        <div className={`${styles.insightRow} fade-up-3`}>
          {/* Cognitive Load Score */}
          <div className={styles.insightCard}>
            <div className={styles.insightCardHeader}>
              <span className={styles.insightCardTitle}>
                Cognitive Load Score
              </span>
            </div>
            <div className={styles.insightCardBody}>
              {!cogLoadData ? (
                <span className={styles.aiPanelHint}>
                  Loading cognitive load data…
                </span>
              ) : cogLoadData.members.length === 0 ? (
                <span className={styles.aiPanelHint}>
                  No active ticket assignments found.
                </span>
              ) : (
                <>
                  {cogLoadData.ai_summary && (
                    <AiText text={cogLoadData.ai_summary} />
                  )}
                  <div className={styles.cogLoadList}>
                    {cogLoadData.members
                      .slice(0, 8)
                      .map((m: CognitiveLoadMember) => {
                        const color =
                          m.level === "Overloaded"
                            ? "var(--red)"
                            : m.level === "High"
                              ? "var(--amber)"
                              : m.level === "Moderate"
                                ? "var(--accent)"
                                : "var(--green)";
                        return (
                          <div key={m.name} className={styles.cogLoadRow}>
                            <span className={styles.cogLoadName}>{m.name}</span>
                            <div className={styles.cogLoadBar}>
                              <div
                                className={styles.cogLoadBarFill}
                                style={{
                                  width: `${m.load_score}%`,
                                  background: color,
                                }}
                              />
                            </div>
                            <span
                              className={styles.cogLoadScore}
                              style={{ color }}
                            >
                              {m.load_score}
                            </span>
                            <span
                              className={styles.cogLoadLevel}
                              style={{
                                color,
                                background: `${color}15`,
                                borderColor: `${color}30`,
                              }}
                            >
                              {m.level}
                            </span>
                            <span className={styles.cogLoadMeta}>
                              {m.wip_count} WIP · {m.overdue_count} overdue
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Team Chemistry Analyser */}
          <div className={styles.insightCard}>
            <div className={styles.insightCardHeader}>
              <span className={styles.insightCardTitle}>
                Team Chemistry Analyser
              </span>
            </div>
            <div className={styles.insightCardBody}>
              {!chemistryData ? (
                <span className={styles.aiPanelHint}>
                  Loading chemistry analysis…
                </span>
              ) : chemistryData.pod_count === 0 ? (
                <span className={styles.aiPanelHint}>
                  No multi-member pod data found.
                </span>
              ) : (
                <>
                  {chemistryData.ai_analysis && (
                    <AiText text={chemistryData.ai_analysis} />
                  )}
                  <div className={styles.chemistryList}>
                    {chemistryData.pod_balance
                      .slice(0, 5)
                      .map((p: PodBalance) => {
                        const imbalColor =
                          p.imbalance_pct >= 60
                            ? "var(--red)"
                            : p.imbalance_pct >= 35
                              ? "var(--amber)"
                              : "var(--green)";
                        return (
                          <div key={p.pod} className={styles.chemistryRow}>
                            <span className={styles.chemistryPod}>{p.pod}</span>
                            <span className={styles.chemistryMembers}>
                              {p.members} members
                            </span>
                            <div className={styles.chemistryBar}>
                              <div
                                className={styles.chemistryBarFill}
                                style={{
                                  width: `${Math.min(100, p.imbalance_pct)}%`,
                                  background: imbalColor,
                                }}
                              />
                            </div>
                            <span
                              className={styles.chemistryImbal}
                              style={{ color: imbalColor }}
                            >
                              {p.imbalance_pct}% imbalance
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

      <div className={styles.teamHeader}>
        <h1 className={styles.title}>Teams</h1>
      </div>

        {/* Team Grid */}
        {filteredTeam.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="No matches"
            desc="Try a different search term."
          />
        ) : (
          <div className={`${styles.grid} fade-up-3`}>
            {filteredTeam.map(
              (t: { member: OrgMember; summary: SummaryByUser }, i: number) => {
                const status = getStatus(t.summary.hours ?? 0);
                return (
                  <div
                    key={t.member.id}
                    className={styles.card}
                    style={{ animationDelay: `${Math.min(i * 0.04, 0.4)}s` }}
                  >
                    <div className={styles.cardTop}>
                      <div
                        className={styles.avatar}
                        style={{ background: getAvatarColor(t.member.name) }}
                      >
                        {initials(t.member.name)}
                      </div>
                      <div className={styles.cardMeta}>
                        <div className={styles.name}>{t.member.name}</div>
                        <div className={styles.title}>
                          {t.member.title ||
                            ROLE_LABEL[t.member.role] ||
                            t.member.role}
                        </div>
                      </div>
                      <span
                        className={styles.statusBadge}
                        style={{ background: status.bg, color: status.color }}
                      >
                        {status.label}
                      </span>
                    </div>

                    <div className={styles.cardStats}>
                      <div className={styles.cardStat}>
                        <span className={styles.cardStatVal}>
                          {formatNumber(Math.round(t.summary.hours ?? 0))}h
                        </span>
                        <span className={styles.cardStatLbl}>Hours</span>
                      </div>
                      <div className={styles.cardStat}>
                        <span className={styles.cardStatVal}>
                          {t.summary.tickets ?? 0}
                        </span>
                        <span className={styles.cardStatLbl}>Tickets</span>
                      </div>
                      <div className={styles.cardStat}>
                        <span className={styles.cardStatVal}>
                          {t.member.pod || "—"}
                        </span>
                        <span className={styles.cardStatLbl}>POD</span>
                      </div>
                    </div>

                    <div className={styles.cardBar}>
                      <div
                        className={styles.cardBarFill}
                        style={{
                          width: `${Math.min(((t.summary.hours ?? 0) / 45) * 100, 100)}%`,
                          background:
                            (t.summary.hours ?? 0) >= 45
                              ? "#F87171"
                              : (t.summary.hours ?? 0) >= 25
                                ? "#34D399"
                                : (t.summary.hours ?? 0) > 0
                                  ? "#FBBF24"
                                  : "#94A3B8",
                        }}
                      />
                    </div>

                    <button
                      className={styles.cardAction}
                      onClick={() => {
                        setSelectedMember(t.member);
                        setSelectedSummary(t.summary);
                      }}
                    >
                      <RiEyeLine size={14} />
                      View Timesheet
                    </button>
                  </div>
                );
              },
            )}
          </div>
        )}
      </div>

      {selectedMember && (
        <TimesheetDrawer
          member={selectedMember}
          summary={selectedSummary}
          dateFrom={filters.dateFrom ?? ""}
          dateTo={filters.dateTo ?? ""}
          open={!!selectedMember}
          onClose={() => {
            setSelectedMember(null);
            setSelectedSummary(null);
          }}
        />
      )}
    </div>
  );
}
