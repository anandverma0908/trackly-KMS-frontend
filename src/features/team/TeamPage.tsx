import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFilterStore } from "@/store";
import { fetchSummary, fetchOrgMembers, novaQuery } from "@/services/api";
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
  RiArrowDownSLine,
  RiEyeLine,
  RiAlertLine,
  RiCheckLine,
} from "react-icons/ri";

const AVATAR_COLORS = [
  "linear-gradient(135deg,#4F7EFF,#818CF8)",
  "linear-gradient(135deg,#34D399,#10B981)",
  "linear-gradient(135deg,#FBBF24,#F59E0B)",
  "linear-gradient(135deg,#F87171,#FCA5A5)",
  "linear-gradient(135deg,#A78BFA,#C4B5FD)",
  "linear-gradient(135deg,#22D3EE,#67E8F9)",
  "linear-gradient(135deg,#64748B,#94A3B8)",
];

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
  if (hours >= 45) return { label: "Overloaded", color: "#F87171", bg: "rgba(248,113,113,0.12)" };
  if (hours >= 25) return { label: "Active", color: "#34D399", bg: "rgba(52,211,153,0.12)" };
  if (hours > 0) return { label: "Light", color: "#FBBF24", bg: "rgba(251,191,36,0.12)" };
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

  if (!member) return null;
  const displayMember = member;

  async function generateBrief() {
    setAiLoading(true);
    try {
      const prompt = `You are EOS, an engineering team lead reviewing a team member's timesheet.

Name: ${displayMember.name}
Role: ${displayMember.title || displayMember.role}
Period: ${formatDate(dateFrom, "MMM d")} – ${formatDate(dateTo, "MMM d, yyyy")}
Hours logged: ${summary?.hours ?? 0}
Tickets resolved: ${summary?.tickets ?? 0}

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
          <button className={styles.btnSecondary} onClick={onClose}>Close</button>
        </div>
      }
    >
      <div className={styles.drawerBody}>
        {/* Profile header */}
        <div className={styles.drawerProfile}>
          <div className={styles.drawerAvatar} style={{ background: getAvatarColor(displayMember?.name) }}>
            {initials(displayMember.name)}
          </div>
          <div>
            <div className={styles.drawerName}>{displayMember.name}</div>
            <div className={styles.drawerMeta}>{displayMember.title || ROLE_LABEL[displayMember.role] || displayMember.role} · {displayMember.pod || "-"}</div>
          </div>
          <span className={styles.statusPill} style={{ background: status.bg, color: status.color, marginLeft: "auto" }}>
            {status.label}
          </span>
        </div>

        {/* Stats */}
        <div className={styles.drawerStats}>
          <div className={styles.drawerStat}>
            <RiTimeLine size={16} color="var(--accent)" />
            <span className={styles.drawerStatVal}>{formatNumber(Math.round(summary?.hours ?? 0))}h</span>
            <span className={styles.drawerStatLbl}>Logged</span>
          </div>
          <div className={styles.drawerStat}>
            <RiTicketLine size={16} color="var(--accent)" />
            <span className={styles.drawerStatVal}>{summary?.tickets ?? 0}</span>
            <span className={styles.drawerStatLbl}>Tickets</span>
          </div>
          <div className={styles.drawerStat}>
            <RiCalendarLine size={16} color="var(--accent)" />
            <span className={styles.drawerStatVal}>{displayMember.pod || "-"}</span>
            <span className={styles.drawerStatLbl}>POD</span>
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
          {aiLoading && <div className={styles.aiBriefText} style={{ color: "var(--text-3)" }}>EOS is analysing…</div>}
          {aiBrief && <div className={styles.aiBriefText}>{aiBrief}</div>}
        </div>

        {/* Activity placeholder — in production this would fetch real activity */}
        <div className={styles.sectionTitle}>Activity</div>
        <div className={styles.activityNote}>
          <RiEyeLine size={14} color="var(--text-3)" />
          <span>Detailed ticket and manual-entry activity would appear here from the backend.</span>
        </div>
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
  const [selectedSummary, setSelectedSummary] = useState<SummaryByUser | null>(null);
  const [aiOpen, setAiOpen] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiBrief, setAiBrief] = useState<string | null>(null);

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

  const isLoading = summaryLoading || membersLoading;

  /* Filter team members by reporting hierarchy */
  const myTeam = useMemo(() => {
    if (!user || !orgMembers.length) return [];

    const isAdmin = user.role === "admin";
    if (isAdmin) return orgMembers.filter((m: OrgMember) => m.role !== "finance_viewer");

    const myProfile = orgMembers.find((m: OrgMember) => m.email === user.email);
    if (!myProfile) return [];

    // reporting_to could be emp_no, id, email, or name depending on backend
    const myIds = [myProfile.emp_no, myProfile.id, myProfile.email, myProfile.name].filter(Boolean);

    return orgMembers.filter(
      (m: OrgMember) =>
        m.reporting_to && myIds.includes(m.reporting_to) && m.role !== "finance_viewer"
    );
  }, [orgMembers, user]);

  const summaryMap = useMemo(() => {
    const map = new Map<string, SummaryByUser>();
    (summaryData?.by_user ?? []).forEach((u: SummaryByUser) => map.set(u.user, u));
    return map;
  }, [summaryData]);

  const teamWithStats = useMemo(() => {
    return myTeam.map((m: OrgMember) => ({
      member: m,
      summary: summaryMap.get(m.name) ?? { user: m.name, hours: 0, tickets: 0, clients: [] },
    }));
  }, [myTeam, summaryMap]);

  const filteredTeam = useMemo(() => {
    if (!search.trim()) return teamWithStats;
    const q = search.toLowerCase();
    return teamWithStats.filter(
      (t: { member: OrgMember; summary: SummaryByUser }) =>
        t.member.name.toLowerCase().includes(q) ||
        (t.member.title ?? "").toLowerCase().includes(q) ||
        (t.member.pod ?? "").toLowerCase().includes(q)
    );
  }, [teamWithStats, search]);

  const totalHours = teamWithStats.reduce((sum: number, t: { summary: SummaryByUser }) => sum + (t.summary.hours ?? 0), 0);
  const totalTickets = teamWithStats.reduce((sum: number, t: { summary: SummaryByUser }) => sum + (t.summary.tickets ?? 0), 0);
  const activeCount = teamWithStats.filter((t: { summary: SummaryByUser }) => (t.summary.hours ?? 0) >= 25).length;
  const idleCount = teamWithStats.filter((t: { summary: SummaryByUser }) => (t.summary.hours ?? 0) === 0).length;

  async function generateTeamBrief() {
    if (!filteredTeam.length) return;
    setAiLoading(true);
    try {
      const memberLines = filteredTeam
        .map((t: { member: OrgMember; summary: SummaryByUser }) => `- ${t.member.name}: ${t.summary.hours}h, ${t.summary.tickets} tickets`)
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
          <p className={styles.subtitle}>No team members found under your hierarchy.</p>
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
          <p className={styles.subtitle}>
            {myTeam.length} direct report{myTeam.length > 1 ? "s" : ""} · {formatDate(filters.dateFrom || "", "MMM d")} – {formatDate(filters.dateTo || "", "MMM d, yyyy")}
          </p>
        </div>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.searchInput}
            placeholder="Search by name, title, or POD…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.searchClear} onClick={() => setSearch("")}>✕</button>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div className={`${styles.statsStrip} fade-up-2`}>
        <div className={styles.statBox}>
          <RiUserLine size={18} color="var(--accent)" />
          <span className={styles.statBoxVal}>{myTeam.length}</span>
          <span className={styles.statBoxLbl}>Members</span>
        </div>
        <div className={styles.statBox}>
          <RiTimeLine size={18} color="var(--accent)" />
          <span className={styles.statBoxVal}>{formatNumber(Math.round(totalHours))}h</span>
          <span className={styles.statBoxLbl}>Total Hours</span>
        </div>
        <div className={styles.statBox}>
          <RiTicketLine size={18} color="var(--accent)" />
          <span className={styles.statBoxVal}>{totalTickets}</span>
          <span className={styles.statBoxLbl}>Tickets</span>
        </div>
        <div className={styles.statBox}>
          <RiCheckLine size={18} color="#34D399" />
          <span className={styles.statBoxVal} style={{ color: "#34D399" }}>{activeCount}</span>
          <span className={styles.statBoxLbl}>Active</span>
        </div>
        {idleCount > 0 && (
          <div className={styles.statBox}>
            <RiAlertLine size={18} color="#F87171" />
            <span className={styles.statBoxVal} style={{ color: "#F87171" }}>{idleCount}</span>
            <span className={styles.statBoxLbl}>Idle</span>
          </div>
        )}
      </div>

      {/* AI Team Brief */}
      <div className={`${styles.aiPanel} fade-up-2`}>
        <div className={styles.aiPanelHeader} onClick={() => setAiOpen((v) => !v)}>
          <div className={styles.aiPanelIcon}><RiSparklingLine size={14} /></div>
          <div className={styles.aiPanelTitle}>EOS Team Brief</div>
          <RiArrowDownSLine size={16} className={`${styles.aiPanelChevron} ${aiOpen ? styles.aiPanelChevronOpen : ""}`} />
          {!aiBrief && !aiLoading && (
            <button className={styles.aiPanelAction} onClick={(e) => { e.stopPropagation(); generateTeamBrief(); }}>
              Generate
            </button>
          )}
        </div>
        {aiOpen && (
          <div className={styles.aiPanelBody}>
            {aiLoading ? (
              <div className={styles.aiPanelLoading}>EOS is analysing your team…</div>
            ) : aiBrief ? (
              <div className={styles.aiPanelText}>{aiBrief}</div>
            ) : (
              <div className={styles.aiPanelHint}>
                Click <strong>Generate</strong> to get an AI-powered leadership brief on your team's current performance.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Team Grid */}
      {filteredTeam.length === 0 ? (
        <EmptyState icon="🔍" title="No matches" desc="Try a different search term." />
      ) : (
        <div className={`${styles.grid} fade-up-3`}>
          {filteredTeam.map((t: { member: OrgMember; summary: SummaryByUser }, i: number) => {
            const status = getStatus(t.summary.hours ?? 0);
            return (
              <div
                key={t.member.id}
                className={styles.card}
                style={{ animationDelay: `${Math.min(i * 0.04, 0.4)}s` }}
              >
                <div className={styles.cardTop}>
                  <div className={styles.avatar} style={{ background: getAvatarColor(t.member.name) }}>
                    {initials(t.member.name)}
                  </div>
                  <div className={styles.cardMeta}>
                    <div className={styles.name}>{t.member.name}</div>
                    <div className={styles.title}>{t.member.title || ROLE_LABEL[t.member.role] || t.member.role}</div>
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
                    <span className={styles.cardStatVal}>{formatNumber(Math.round(t.summary.hours ?? 0))}h</span>
                    <span className={styles.cardStatLbl}>Hours</span>
                  </div>
                  <div className={styles.cardStat}>
                    <span className={styles.cardStatVal}>{t.summary.tickets ?? 0}</span>
                    <span className={styles.cardStatLbl}>Tickets</span>
                  </div>
                  <div className={styles.cardStat}>
                    <span className={styles.cardStatVal}>{t.member.pod || "—"}</span>
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
          })}
        </div>
      )}

      {selectedMember && (
        <TimesheetDrawer
          member={selectedMember}
          summary={selectedSummary}
          dateFrom={filters.dateFrom ?? ""}
          dateTo={filters.dateTo ?? ""}
          open={!!selectedMember}
          onClose={() => { setSelectedMember(null); setSelectedSummary(null); }}
        />
      )}
    </div>
  );
}
