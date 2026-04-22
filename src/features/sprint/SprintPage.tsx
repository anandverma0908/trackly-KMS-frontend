import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  fetchSprints, fetchSprint, createSprint, startSprint, completeSprint,
  fetchTickets, addTicketToSprint, removeTicketFromSprint,
  fetchBurndown, fetchVelocity, generateSprintRetro,
  freezeSprintScope, extendSprint, beginEosReview,
  fetchSprintCapacity, fetchSprintBurnUp, fetchSprintForecast,
  fetchSprintDrift, fetchVelocityTrend, fetchSprintTimeline,
  fetchSprintTeam, fetchSprintBlockers,
} from "@/services/api";
import {
  Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, AreaChart, Area, ComposedChart,
} from "recharts";
import type { Sprint, Ticket, SprintCapacity, BurnUpPoint, SprintForecast, BurndownPoint, VelocityPoint, TimelineEvent } from "@/types";
import { IssueTypeBadge, StatusBadge } from "@/components/ui/Badge";
import { useAuthStore } from "@/features/auth/useAuthStore";
import {
  RiSparklingLine, RiAlertLine, RiCheckLine, RiTimerLine,
  RiCalendarLine, RiTeamLine, RiBarChartLine, RiLineChartLine,
  RiBrainLine, RiChat3Line, RiDashboardLine,
  RiArrowUpLine, RiPauseLine,
  RiPlayLine, RiFlagLine, RiCloseLine, RiAddLine, RiSubtractLine,
  RiErrorWarningLine,
  RiStackLine, RiMapPinLine, RiDatabase2Line,
} from "react-icons/ri";
import styles from "./SprintPage.module.css";
import SprintOverview from "./views/SprintOverview";
import SprintRisks from "./views/SprintRisks";
import SprintWhatIf from "./views/SprintWhatIf";
import SprintChat from "./views/SprintChat";

type View =
  | "overview" | "board" | "backlog" | "burndown" | "velocity"
  | "capacity" | "burnup" | "timeline" | "team" | "risks"
  | "whatif" | "chat";

const VIEW_TABS: { key: View; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Overview", icon: <RiDashboardLine size={14} /> },
  { key: "board",    label: "Board",    icon: <RiStackLine size={14} /> },
  { key: "backlog",  label: "Backlog",  icon: <RiDatabase2Line size={14} /> },
  { key: "burndown", label: "Burndown", icon: <RiLineChartLine size={14} /> },
  { key: "velocity", label: "Velocity", icon: <RiBarChartLine size={14} /> },
  { key: "capacity", label: "Capacity", icon: <RiTeamLine size={14} /> },
  { key: "burnup",   label: "Burn-Up",  icon: <RiArrowUpLine size={14} /> },
  { key: "timeline", label: "Timeline", icon: <RiCalendarLine size={14} /> },
  { key: "team",     label: "Team",     icon: <RiMapPinLine size={14} /> },
  { key: "risks",    label: "Risks",    icon: <RiErrorWarningLine size={14} /> },
  { key: "whatif",   label: "What-If",  icon: <RiBrainLine size={14} /> },
  { key: "chat",     label: "Chat",     icon: <RiChat3Line size={14} /> },
];

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════ */
export default function SprintPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>("overview");
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);
  const [showNewSprint, setShowNewSprint] = useState(false);
  const [retroText, setRetroText] = useState("");
  const [loadingRetro, setLoadingRetro] = useState(false);
  const scopedPod = useAuthStore((s) => s.getScopedPod());
  const [newSprint, setNewSprint] = useState({
    name: "", goal: "", start_date: "", end_date: "", project_id: scopedPod ?? "",
  });

  /* ── Queries ── */
  const { data: rawSprints = [] } = useQuery({
    queryKey: ["sprints"],
    queryFn: fetchSprints,
  });
  const sprints: Sprint[] = rawSprints as Sprint[];

  // Auto-select active sprint, or first sprint
  useEffect(() => {
    if (!activeSprint && sprints.length > 0) {
      const active = sprints.find((s) => s.status === "active");
      setActiveSprint(active ?? sprints[0]);
    }
  }, [sprints, activeSprint]);

  const { data: sprintDetail } = useQuery({
    queryKey: ["sprint", activeSprint?.id],
    queryFn: () => fetchSprint(activeSprint!.id),
    enabled: !!activeSprint,
  });

  const { data: backlogData } = useQuery({
    queryKey: ["backlog"],
    queryFn: () => fetchTickets({}),
  });

  const { data: burndownData = [] } = useQuery({
    queryKey: ["burndown", activeSprint?.id],
    queryFn: () => fetchBurndown(activeSprint!.id),
    enabled: !!activeSprint && (view === "burndown" || view === "overview"),
  });

  const { data: driftData } = useQuery({
    queryKey: ["sprint-drift", activeSprint?.id],
    queryFn: () => fetchSprintDrift(activeSprint!.id),
    enabled: !!activeSprint && view === "burndown",
  });

  const { data: velocityData = [] } = useQuery({
    queryKey: ["velocity"],
    queryFn: fetchVelocity,
    enabled: view === "velocity" || view === "overview",
  });

  const { data: velocityTrend = [] } = useQuery({
    queryKey: ["velocity-trend", scopedPod],
    queryFn: () => fetchVelocityTrend(scopedPod ?? undefined),
    enabled: view === "velocity",
  });

  const { data: capacityData } = useQuery({
    queryKey: ["sprint-capacity", activeSprint?.id],
    queryFn: () => fetchSprintCapacity(activeSprint!.id),
    enabled: !!activeSprint && (view === "capacity" || view === "overview" || view === "burnup"),
  });

  const { data: burnUpData = [] } = useQuery({
    queryKey: ["sprint-burnup", activeSprint?.id],
    queryFn: () => fetchSprintBurnUp(activeSprint!.id),
    enabled: !!activeSprint && view === "burnup",
  });

  const { data: forecastData } = useQuery({
    queryKey: ["sprint-forecast", activeSprint?.id],
    queryFn: () => fetchSprintForecast(activeSprint!.id),
    enabled: !!activeSprint && (view === "overview" || view === "burndown"),
  });

  const { data: timelineData = [] } = useQuery({
    queryKey: ["sprint-timeline", activeSprint?.id],
    queryFn: () => fetchSprintTimeline(activeSprint!.id),
    enabled: !!activeSprint && view === "timeline",
  });

  const { data: teamData } = useQuery({
    queryKey: ["sprint-team", activeSprint?.id],
    queryFn: () => fetchSprintTeam(activeSprint!.id),
    enabled: !!activeSprint && view === "team",
  });

  const { data: blockersData = [] } = useQuery({
    queryKey: ["sprint-blockers", activeSprint?.id],
    queryFn: () => fetchSprintBlockers(activeSprint!.id),
    enabled: !!activeSprint && (view === "risks" || view === "overview"),
  });

  /* ── Mutations ── */
  const createMut = useMutation({
    mutationFn: createSprint,
    onSuccess: (sprint) => {
      qc.invalidateQueries({ queryKey: ["sprints"] });
      setActiveSprint(sprint);
      setShowNewSprint(false);
      toast.success("Sprint created!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startMut = useMutation({
    mutationFn: startSprint,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sprints"] }); toast.success("Sprint started!"); },
  });

  const completeMut = useMutation({
    mutationFn: completeSprint,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sprints"] }); toast.success("Sprint completed!"); },
  });

  const freezeMut = useMutation({
    mutationFn: freezeSprintScope,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sprint", activeSprint?.id] }); toast.success("Scope frozen!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const extendMut = useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) => extendSprint(id, days),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sprint", activeSprint?.id] }); toast.success("Sprint extended!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const eosMut = useMutation({
    mutationFn: beginEosReview,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sprint", activeSprint?.id] }); toast.success("EOS review started!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addToSprintMut = useMutation({
    mutationFn: ({ sprintId, ticketKey }: { sprintId: string; ticketKey: string }) =>
      addTicketToSprint(sprintId, ticketKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sprint", activeSprint?.id] }),
  });

  const removeFromSprintMut = useMutation({
    mutationFn: ({ sprintId, ticketKey }: { sprintId: string; ticketKey: string }) =>
      removeTicketFromSprint(sprintId, ticketKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sprint", activeSprint?.id] }),
  });

  async function handleGenerateRetro() {
    if (!activeSprint) return;
    setLoadingRetro(true);
    try {
      const result = await generateSprintRetro(activeSprint.id);
      setRetroText(result.retro ?? result.content ?? JSON.stringify(result));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingRetro(false);
    }
  }

  /* ── Computed data ── */
  const allBacklog = (backlogData?.tickets ?? []).filter((t) => !t.status.includes("Done"));
  const sprintTickets = sprintDetail?.tickets ?? [];
  const sprintTicketKeys = new Set(sprintTickets.map((t) => t.key));
  const backlogOnly = allBacklog.filter((t) => !sprintTicketKeys.has(t.key));

  const totalPoints = sprintTickets.reduce((sum, t) => sum + (t.story_points || 0), 0);
  const capacityTotal = capacityData?.total_capacity_hours ?? 0;
  const capacityUsed = capacityData?.allocated_hours ?? totalPoints * 4;
  const capacityPct = capacityTotal > 0 ? Math.round((capacityUsed / capacityTotal) * 100) : 0;

  // Sprint Health (enhanced with forecast)
  const sprintHealth = useMemo(() => {
    if (!activeSprint || activeSprint.status !== "active") return null;
    const daysLeft = Math.max(0, Math.ceil((new Date(activeSprint.end_date).getTime() - Date.now()) / 86_400_000));
    const totalDays = Math.max(1, Math.ceil((new Date(activeSprint.end_date).getTime() - new Date(activeSprint.start_date).getTime()) / 86_400_000));
    const daysElapsed = Math.max(1, totalDays - daysLeft);
    const committed = activeSprint.total_points ?? totalPoints;
    const done = activeSprint.done_points ?? sprintTickets.filter(t => t.status === "Done" || t.status === "Closed").reduce((s, t) => s + (t.story_points ?? 0), 0);
    const remaining = Math.max(0, committed - done);
    const pace = done / daysElapsed;
    const neededPace = daysLeft > 0 ? remaining / daysLeft : Infinity;
    const probability = committed === 0 ? 100 : Math.min(100, Math.round((pace / Math.max(neededPace, 0.01)) * 100));
    const blockedCount = sprintTickets.filter(t => t.status.toLowerCase().includes("block")).length;
    const atRiskTickets = sprintTickets.filter(t => {
      if (t.status === "Done" || t.status === "Closed") return false;
      if (t.status.toLowerCase().includes("block")) return true;
      if (t.due_date && new Date(t.due_date) < new Date(activeSprint.end_date) && new Date(t.due_date) < new Date()) return true;
      return false;
    });
    const wipCount = sprintTickets.filter(t => t.status.toLowerCase().includes("progress")).length;
    const reviewCount = sprintTickets.filter(t => t.status.toLowerCase().includes("review")).length;
    const moveToBacklog = sprintTickets
      .filter(t => t.status !== "Done" && t.status !== "Closed" && !t.status.toLowerCase().includes("progress") && !t.status.toLowerCase().includes("review"))
      .slice(0, 2);

    let recommendation = "";
    if (probability >= 80) recommendation = `On pace — ${Math.round(pace * 7)} pts/week. Sprint looks healthy.`;
    else if (probability >= 50) recommendation = `At risk. Burning ${pace.toFixed(1)} pts/day, need ${neededPace.toFixed(1)}. Consider de-scoping ${Math.ceil(remaining - pace * daysLeft)} pts.`;
    else recommendation = `Behind pace. ${daysLeft}d left, ${remaining} pts remaining. EOS recommends moving ${moveToBacklog.length} backlog tickets out.`;

    // Incorporate AI forecast if available
    if (forecastData) {
      const aiProb = forecastData.current_probability;
      const aiTrend = forecastData.trend_probability;
      if (aiProb < probability - 15) {
        recommendation = `AI forecast (${aiProb}%) is lower than current pace. ${forecastData.nova_summary}`;
      } else if (aiTrend < aiProb) {
        recommendation = `Trending downward. ${forecastData.nova_summary}`;
      } else if (forecastData.nova_summary) {
        recommendation = forecastData.nova_summary;
      }
    }

    return { probability, daysLeft, committed, done, remaining, pace, neededPace, blockedCount, atRiskTickets, moveToBacklog, recommendation, wipCount, reviewCount, totalDays, daysElapsed };
  }, [activeSprint, sprintTickets, totalPoints, forecastData]);

  const statusFlow: Sprint["status"][] = ["planning", "active", "scope_freeze", "eos_review", "completed"];
  const currentStatusIndex = activeSprint ? statusFlow.indexOf(activeSprint.status) : -1;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Sprints</h1>
          <p className={styles.subtitle}>AI-powered sprint planning, tracking, and intelligence</p>
        </div>
        <div className={styles.actions}>
          <button className="btn btn-ghost" onClick={() => setShowNewSprint(true)}>
            + New Sprint
          </button>
        </div>
      </div>

      {/* Sprint tabs */}
      {sprints.length > 0 && (
        <div className={styles.sprintTabs}>
          {sprints.map((s: Sprint) => (
            <button
              key={s.id}
              className={`${styles.sprintTab} ${activeSprint?.id === s.id ? styles.sprintTabActive : ""}`}
              onClick={() => setActiveSprint(s)}
            >
              <span className={`${styles.sprintStatus} ${styles[`status_${s.status}`]}`} />
              {s.name}
              {s.status === "active" && <span className={styles.sprintTabLive}>LIVE</span>}
            </button>
          ))}
        </div>
      )}

      {/* View switcher */}
      <div className={styles.viewTabs}>
        {VIEW_TABS.map((v) => (
          <button
            key={v.key}
            className={`${styles.viewTab} ${view === v.key ? styles.viewTabActive : ""}`}
            onClick={() => setView(v.key)}
          >
            {v.icon}
            {v.label}
          </button>
        ))}
      </div>

      {/* Active Sprint Info Bar */}
      {activeSprint && (
        <div className={styles.sprintInfo}>
          <div className={styles.sprintMeta}>
            <span className={styles.sprintName}>{activeSprint.name}</span>
            <span className={`badge ${activeSprint.status === "active" ? "badge-green" : activeSprint.status === "completed" ? "badge-gray" : "badge-amber"}`}>
              {activeSprint.status.replace("_", " ")}
            </span>
            {activeSprint.goal && <span className={styles.sprintGoal}>"{activeSprint.goal}"</span>}
            {/* Status lifecycle flow */}
            <div className={styles.statusFlow}>
              {statusFlow.map((st, idx) => (
                <span key={st} className={`${styles.statusFlowStep} ${idx <= currentStatusIndex ? styles.statusFlowDone : ""} ${idx === currentStatusIndex ? styles.statusFlowCurrent : ""}`}>
                  {st.replace("_", " ")}
                </span>
              ))}
            </div>
          </div>
          <div className={styles.sprintActions}>
            {activeSprint.status === "planning" && (
              <>
                <button className="btn btn-primary btn-sm" onClick={() => startMut.mutate(activeSprint.id)}>
                  <RiPlayLine size={13} /> Start Sprint
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => freezeMut.mutate(activeSprint.id)}>
                  <RiPauseLine size={13} /> Freeze Scope
                </button>
              </>
            )}
            {activeSprint.status === "active" && (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => freezeMut.mutate(activeSprint.id)}>
                  <RiPauseLine size={13} /> Freeze Scope
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => eosMut.mutate(activeSprint.id)}>
                  <RiFlagLine size={13} /> EOS Review
                </button>
                <button className="btn btn-ghost btn-sm" onClick={handleGenerateRetro} disabled={loadingRetro}>
                  <RiSparklingLine size={13} /> {loadingRetro ? "Generating…" : "Retro"}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => completeMut.mutate(activeSprint.id)}>
                  <RiCheckLine size={13} /> Complete
                </button>
              </>
            )}
            {activeSprint.status === "scope_freeze" && (
              <>
                <button className="btn btn-primary btn-sm" onClick={() => eosMut.mutate(activeSprint.id)}>
                  <RiFlagLine size={13} /> EOS Review
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => extendMut.mutate({ id: activeSprint.id, days: 2 })}>
                  <RiCalendarLine size={13} /> +2 Days
                </button>
              </>
            )}
            {activeSprint.status === "eos_review" && (
              <>
                <button className="btn btn-ghost btn-sm" onClick={handleGenerateRetro} disabled={loadingRetro}>
                  <RiSparklingLine size={13} /> {loadingRetro ? "Generating…" : "Retro"}
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => completeMut.mutate(activeSprint.id)}>
                  <RiCheckLine size={13} /> Complete Sprint
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Capacity vs Load Mini Bar */}
      {activeSprint && capacityData && (
        <div className={styles.capacityLoadBar}>
          <div className={styles.capacityLoadInfo}>
            <RiTimerLine size={12} />
            <span>Capacity: <strong>{capacityUsed}h</strong> / {capacityTotal}h</span>
            <span className={capacityPct > 90 ? styles.loadOver : capacityPct > 75 ? styles.loadHigh : styles.loadNormal}>
              {capacityPct}% utilized
            </span>
            {capacityData.recommendation && (
              <span className={styles.capacityAiRec}><RiSparklingLine size={10} /> {capacityData.recommendation}</span>
            )}
          </div>
          <div className={styles.capacityLoadTrack}>
            <div className={`${styles.capacityLoadFill} ${capacityPct > 90 ? styles.capacityLoadOver : capacityPct > 75 ? styles.capacityLoadHigh : ""}`} style={{ width: `${Math.min(capacityPct, 100)}%` }} />
            {capacityPct > 100 && (
              <div className={styles.capacityLoadOverflow} style={{ width: `${Math.min(capacityPct - 100, 20)}%` }} />
            )}
          </div>
        </div>
      )}

      {/* NOVA Retro */}
      {retroText && (
        <div className={styles.retroPanel}>
          <div className={styles.retroHeader}>
            <div className={styles.novaBadge}>
              <span className={styles.novaGlow} />
              EOS Sprint Retrospective
            </div>
            <button className={styles.retroClose} onClick={() => setRetroText("")}><RiCloseLine size={14} /></button>
          </div>
          <pre className={styles.retroText}>{retroText}</pre>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          VIEW RENDERING
          ═══════════════════════════════════════════════ */}

      {/* ── OVERVIEW ── */}
      {view === "overview" && activeSprint && (
        <SprintOverview
          sprint={activeSprint}
          sprintDetail={sprintDetail}
          sprintHealth={sprintHealth}
          capacityData={capacityData}
          forecastData={forecastData}
          blockers={blockersData}
          burndown={burndownData}
          velocity={velocityData}
          onTicketClick={(_key) => { /* could open drawer */ }}
        />
      )}

      {/* ── BOARD ── */}
      {view === "board" && activeSprint && (
        <SprintBoardView tickets={sprintTickets} />
      )}

      {/* ── BACKLOG ── */}
      {view === "backlog" && (
        <SprintBacklogView
          activeSprint={activeSprint}
          sprintTickets={sprintTickets}
          backlogOnly={backlogOnly}
          totalPoints={totalPoints}
          capacityTotal={capacityTotal}
          capacityPct={capacityPct}
          onAdd={(key) => activeSprint && addToSprintMut.mutate({ sprintId: activeSprint.id, ticketKey: key })}
          onRemove={(key) => activeSprint && removeFromSprintMut.mutate({ sprintId: activeSprint.id, ticketKey: key })}
        />
      )}

      {/* ── BURNDOWN ── */}
      {view === "burndown" && (
        <SprintBurndownView
          burndown={burndownData}
          drift={driftData}
          forecast={forecastData}
        />
      )}

      {/* ── VELOCITY ── */}
      {view === "velocity" && (
        <SprintVelocityView
          velocity={velocityData}
          trend={velocityTrend}
        />
      )}

      {/* ── CAPACITY ── */}
      {view === "capacity" && (
        <SprintCapacityView
          capacity={capacityData}
          sprintTickets={sprintTickets}
        />
      )}

      {/* ── BURN-UP ── */}
      {view === "burnup" && (
        <SprintBurnUpView burnUp={burnUpData} />
      )}

      {/* ── TIMELINE ── */}
      {view === "timeline" && (
        <SprintTimelineView events={timelineData} activeSprint={activeSprint} />
      )}

      {/* ── TEAM ── */}
      {view === "team" && (
        <SprintTeamView team={teamData} sprintTickets={sprintTickets} />
      )}

      {/* ── RISKS ── */}
      {view === "risks" && activeSprint && (
        <SprintRisks sprintId={activeSprint.id} sprintStatus={activeSprint.status} />
      )}

      {/* ── WHAT-IF ── */}
      {view === "whatif" && activeSprint && (
        <SprintWhatIf sprintId={activeSprint.id} sprintTickets={sprintTickets} />
      )}

      {/* ── CHAT ── */}
      {view === "chat" && activeSprint && (
        <SprintChat sprintId={activeSprint.id} sprintName={activeSprint.name} />
      )}

      {/* New Sprint Modal */}
      {showNewSprint && (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && setShowNewSprint(false)}>
          <div className={styles.sprintModal}>
            <h3 className={styles.modalTitle}>Create Sprint</h3>
            <div className={styles.modalField}>
              <label>Name</label>
              <input className="input" value={newSprint.name} onChange={(e) => setNewSprint(p => ({ ...p, name: e.target.value }))} placeholder="Sprint 1" />
            </div>
            <div className={styles.modalField}>
              <label>Goal</label>
              <input className="input" value={newSprint.goal} onChange={(e) => setNewSprint(p => ({ ...p, goal: e.target.value }))} placeholder="Sprint goal…" />
            </div>
            <div className={styles.modalRow}>
              <div className={styles.modalField}>
                <label>Start Date</label>
                <input type="date" className="input" value={newSprint.start_date} onChange={(e) => setNewSprint(p => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div className={styles.modalField}>
                <label>End Date</label>
                <input type="date" className="input" value={newSprint.end_date} onChange={(e) => setNewSprint(p => ({ ...p, end_date: e.target.value }))} />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className="btn btn-ghost" onClick={() => setShowNewSprint(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!newSprint.name || createMut.isPending} onClick={() => createMut.mutate(newSprint)}>
                {createMut.isPending ? "Creating…" : "Create Sprint"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SUB-VIEW COMPONENTS
   ══════════════════════════════════════════════════════════ */

/* ── BOARD ── */
function SprintBoardView({ tickets }: { tickets: any[] }) {
  const columns = ["To Do", "In Progress", "In Review", "Done", "Blocked"];
  const [, setDragging] = useState<string | null>(null);

  const ticketsByStatus = useMemo(() => {
    const map: Record<string, any[]> = {};
    columns.forEach((c) => (map[c] = []));
    tickets.forEach((t) => {
      const col = t.status === "Done" || t.status === "Closed" ? "Done"
        : t.status.toLowerCase().includes("block") ? "Blocked"
        : t.status.toLowerCase().includes("review") ? "In Review"
        : t.status.toLowerCase().includes("progress") ? "In Progress"
        : "To Do";
      (map[col] ??= []).push(t);
    });
    return map;
  }, [tickets]);

  return (
    <div className={styles.boardView}>
      {columns.map((col) => (
        <div key={col} className={styles.boardColumn}>
          <div className={styles.boardColHeader}>
            <span>{col}</span>
            <span className={styles.boardColCount}>{ticketsByStatus[col]?.length ?? 0}</span>
          </div>
          <div className={styles.boardColBody}>
            {(ticketsByStatus[col] ?? []).map((t) => (
              <div key={t.key} className={styles.boardCard} draggable onDragStart={() => setDragging(t.key)}>
                <div className={styles.boardCardTop}>
                  <span className={styles.boardCardKey}>{t.key}</span>
                  <IssueTypeBadge type={t.issue_type} />
                </div>
                <div className={styles.boardCardTitle}>{t.summary}</div>
                <div className={styles.boardCardMeta}>
                  {t.assignee && <span className={styles.boardCardAssignee}>{t.assignee}</span>}
                  {t.story_points && <span className={styles.boardCardPoints}>{t.story_points} pts</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── BACKLOG ── */
function SprintBacklogView({
  activeSprint, sprintTickets, backlogOnly, totalPoints, capacityTotal, capacityPct,
  onAdd, onRemove,
}: {
  activeSprint: Sprint | null;
  sprintTickets: any[];
  backlogOnly: Ticket[];
  totalPoints: number;
  capacityTotal: number;
  capacityPct: number;
  onAdd: (key: string) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <div className={styles.backlogView}>
      <div className={styles.backlogPanel}>
        <div className={styles.panelHeader}>
          <span>{activeSprint?.name ?? "Sprint"}</span>
          <span className={styles.panelCount}>{sprintTickets.length} tickets · {totalPoints} pts</span>
          <div className={styles.capacityBarWrap}>
            <div className={styles.capacityBar}>
              <div className={`${styles.capacityFill} ${capacityPct > 90 ? styles.capacityFillOver : capacityPct > 75 ? styles.capacityFillHigh : ""}`} style={{ width: `${Math.min((totalPoints / Math.max(capacityTotal / 4, 40)) * 100, 100)}%` }} />
            </div>
            <span className={styles.capacityLabel}>{totalPoints} / {Math.round(capacityTotal / 4)} pts</span>
          </div>
        </div>
        <div className={styles.ticketList}>
          {sprintTickets.map((t) => (
            <BacklogTicketRow key={t.key} ticket={t} action="remove" onAction={() => onRemove(t.key)} />
          ))}
          {sprintTickets.length === 0 && <p className={styles.emptyList}>No tickets in this sprint yet.</p>}
        </div>
      </div>
      <div className={styles.backlogPanel}>
        <div className={styles.panelHeader}>
          <span>Backlog</span>
          <span className={styles.panelCount}>{backlogOnly.length} tickets</span>
        </div>
        <div className={styles.ticketList}>
          {backlogOnly.map((t) => (
            <BacklogTicketRow key={t.key} ticket={t} action="add" onAction={() => onAdd(t.key)} />
          ))}
          {backlogOnly.length === 0 && <p className={styles.emptyList}>Backlog is empty!</p>}
        </div>
      </div>
    </div>
  );
}

function BacklogTicketRow({ ticket, action, onAction }: { ticket: Ticket; action: "add" | "remove"; onAction: () => void }) {
  return (
    <div className={styles.backlogRow}>
      <span className={styles.backlogKey}>{ticket.key}</span>
      <span className={styles.backlogTitle}>{ticket.summary}</span>
      <IssueTypeBadge type={ticket.issue_type} />
      <StatusBadge status={ticket.status} />
      <button className={`${styles.actionBtn} ${action === "add" ? styles.actionBtnAdd : styles.actionBtnRemove}`} onClick={onAction}>
        {action === "add" ? <RiAddLine size={14} /> : <RiSubtractLine size={14} />}
      </button>
    </div>
  );
}

/* ── BURNDOWN ── */
function SprintBurndownView({
  burndown, drift, forecast,
}: {
  burndown: BurndownPoint[];
  drift?: { drift_points: BurndownPoint[]; anomalies: any[]; nova_summary: string } | null;
  forecast?: SprintForecast | null;
}) {
  const hasData = burndown.length > 0;
  const combined = useMemo(() => {
    if (!drift?.drift_points?.length) return burndown;
    const driftMap = new Map(drift.drift_points.map((d) => [d.date, d]));
    return burndown.map((b) => {
      const d = driftMap.get(b.date);
      return d ? { ...b, trend: d.trend, drift: d.drift, anomaly: d.anomaly } : b;
    });
  }, [burndown, drift]);

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div className={styles.chartTitle}><RiLineChartLine size={14} /> Burndown Chart</div>
        {drift?.nova_summary && (
          <div className={styles.chartAiInsight}><RiSparklingLine size={11} /> {drift.nova_summary}</div>
        )}
      </div>
      {!hasData ? (
        <p className={styles.emptyList}>No burndown data available.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={combined} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-2)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-2)" }} />
              <Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: 8 }} labelStyle={{ color: "var(--text-2)" }} />
              <Legend wrapperStyle={{ fontSize: "0.8rem" }} />
              <Line type="monotone" dataKey="ideal" stroke="var(--text-3)" strokeDasharray="5 5" dot={false} name="Ideal" />
              <Line type="monotone" dataKey="actual" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} name="Actual" />
              {combined.some((d) => d.trend !== undefined) && (
                <Line type="monotone" dataKey="trend" stroke="var(--green)" strokeDasharray="3 3" dot={false} name="Trend" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          {/* Anomaly alerts */}
          {drift?.anomalies && drift.anomalies.length > 0 && (
            <div className={styles.anomalyList}>
              {drift.anomalies.map((a, i) => (
                <div key={i} className={`${styles.anomalyItem} ${styles[`anomaly_${a.severity}`]}`}>
                  <RiAlertLine size={12} />
                  <span><strong>{a.date}:</strong> {a.description}</span>
                  <span className={styles.anomalyTag}>{a.type}</span>
                </div>
              ))}
            </div>
          )}
          {/* Forecast overlay */}
          {forecast && (
            <div className={styles.forecastOverlay}>
              <div className={styles.forecastRow}>
                <span>AI Predicted completion:</span>
                <strong>{forecast.predicted_completion_date ?? "—"}</strong>
                <span className={styles.forecastProb}>{forecast.current_probability}% confidence</span>
              </div>
              {forecast.risk_factors.length > 0 && (
                <div className={styles.forecastRisks}>
                  {forecast.risk_factors.map((r, i) => (
                    <span key={i} className={`${styles.forecastRiskTag} ${styles[`risk_${r.severity}`]}`}>{r.factor}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── VELOCITY ── */
function SprintVelocityView({ velocity, trend }: { velocity: VelocityPoint[]; trend: VelocityPoint[] }) {
  const hasData = velocity.length > 0;
  const merged = useMemo(() => {
    if (!trend.length) return velocity;
    const trendMap = new Map(trend.map((t) => [t.sprint, t]));
    return velocity.map((v) => {
      const t = trendMap.get(v.sprint);
      return t ? { ...v, predicted: t.predicted, lower_bound: t.lower_bound, upper_bound: t.upper_bound } : v;
    });
  }, [velocity, trend]);

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div className={styles.chartTitle}><RiBarChartLine size={14} /> Velocity</div>
        {trend.length > 0 && <div className={styles.chartAiInsight}><RiSparklingLine size={11} /> Prediction cone enabled</div>}
      </div>
      {!hasData ? (
        <p className={styles.emptyList}>No velocity data available yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={merged} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="sprint" tick={{ fontSize: 11, fill: "var(--text-2)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--text-2)" }} />
            <Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: "0.8rem" }} />
            <Bar dataKey="committed" fill="var(--text-3)" name="Committed" radius={[4, 4, 0, 0]} />
            <Bar dataKey="completed" fill="var(--accent)" name="Completed" radius={[4, 4, 0, 0]} />
            {merged.some((d) => d.predicted !== undefined) && (
              <>
                <Line type="monotone" dataKey="predicted" stroke="var(--green)" strokeDasharray="4 4" dot={false} name="Predicted" />
                <Line type="monotone" dataKey="lower_bound" stroke="rgba(52,211,153,0.3)" strokeDasharray="2 2" dot={false} name="Lower" />
                <Line type="monotone" dataKey="upper_bound" stroke="rgba(52,211,153,0.3)" strokeDasharray="2 2" dot={false} name="Upper" />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/* ── CAPACITY ── */
function SprintCapacityView({ capacity }: { capacity?: SprintCapacity | null; sprintTickets?: any[] }) {
  if (!capacity) return <p className={styles.emptyList}>Loading capacity data…</p>;

  // const avgPointsPerHour = capacity.allocated_hours > 0 ? (sprintTickets.reduce((s, t) => s + (t.story_points ?? 0), 0) / capacity.allocated_hours) : 0;

  return (
    <div className={styles.capacityView}>
      {/* Summary cards */}
      <div className={styles.capacitySummary}>
        <div className={styles.capacityCard}>
          <span className={styles.capacityCardVal}>{capacity.total_capacity_hours}h</span>
          <span className={styles.capacityCardLbl}>Total Capacity</span>
        </div>
        <div className={styles.capacityCard}>
          <span className={styles.capacityCardVal}>{capacity.allocated_hours}h</span>
          <span className={styles.capacityCardLbl}>Allocated</span>
        </div>
        <div className={styles.capacityCard}>
          <span className={styles.capacityCardVal} style={{ color: capacity.available_hours < 0 ? "var(--red)" : "var(--green)" }}>
            {capacity.available_hours}h
          </span>
          <span className={styles.capacityCardLbl}>Available</span>
        </div>
        <div className={styles.capacityCard}>
          <span className={styles.capacityCardVal}>{capacity.utilization_pct}%</span>
          <span className={styles.capacityCardLbl}>Utilized</span>
        </div>
      </div>

      {/* Member table */}
      <div className={styles.capacityTableWrap}>
        <table className={styles.capacityTable}>
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Total</th>
              <th>Allocated</th>
              <th>Available</th>
              <th>PTO</th>
              <th>Skill Match</th>
              <th>Tickets</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {capacity.members.map((m) => (
              <tr key={m.user_id} className={m.overloaded ? styles.capacityRowOver : ""}>
                <td>
                  <div className={styles.capacityMember}>
                    {m.avatar ? <img src={m.avatar} alt="" className={styles.capacityAvatar} /> : <div className={styles.capacityAvatarFallback}>{m.name[0]}</div>}
                    <span>{m.name}</span>
                  </div>
                </td>
                <td>{m.role}</td>
                <td>{m.total_hours}h</td>
                <td>{m.allocated_hours}h</td>
                <td style={{ color: m.available_hours < 0 ? "var(--red)" : "inherit" }}>{m.available_hours}h</td>
                <td>{m.pto_days}d</td>
                <td>
                  <div className={styles.skillBar}>
                    <div className={styles.skillFill} style={{ width: `${m.skill_match_pct}%` }} />
                    <span>{m.skill_match_pct}%</span>
                  </div>
                </td>
                <td>{m.tickets.length}</td>
                <td>
                  {m.overloaded ? <span className={styles.capacityOverBadge}>Overloaded</span> : <span className={styles.capacityOkBadge}>OK</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {capacity.recommendation && (
        <div className={styles.capacityAiRecBox}>
          <RiSparklingLine size={14} className={styles.capacityAiRecIcon} />
          <span>{capacity.recommendation}</span>
        </div>
      )}
    </div>
  );
}

/* ── BURN-UP ── */
function SprintBurnUpView({ burnUp }: { burnUp: BurnUpPoint[] }) {
  if (!burnUp.length) return <p className={styles.emptyList}>No burn-up data available.</p>;

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div className={styles.chartTitle}><RiArrowUpLine size={14} /> Capacity Burn-Up</div>
        <div className={styles.chartSubtitle}>Planned vs completed vs capacity over time</div>
      </div>
      <ResponsiveContainer width="100%" height={340}>
        <AreaChart data={burnUp} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-2)" }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--text-2)" }} />
          <Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: "0.8rem" }} />
          <Area type="monotone" dataKey="capacity" stroke="var(--text-3)" fill="rgba(148,163,184,0.08)" name="Capacity" />
          <Area type="monotone" dataKey="planned" stroke="var(--accent)" fill="rgba(79,126,255,0.12)" name="Planned" />
          <Area type="monotone" dataKey="completed" stroke="var(--green)" fill="rgba(52,211,153,0.15)" name="Completed" />
          <Line type="monotone" dataKey="scope_changes" stroke="var(--amber)" strokeWidth={2} dot={{ r: 3 }} name="Scope Changes" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── TIMELINE ── */
function SprintTimelineView({ events, activeSprint }: { events: TimelineEvent[]; activeSprint?: Sprint | null }) {
  if (!events.length) return <p className={styles.emptyList}>No timeline data available.</p>;

  const start = activeSprint ? new Date(activeSprint.start_date).getTime() : Date.now();
  const end = activeSprint ? new Date(activeSprint.end_date).getTime() : Date.now() + 7 * 86400000;
  const total = end - start;

  return (
    <div className={styles.timelineView}>
      <div className={styles.timelineHeader}>
        <div className={styles.timelineDates}>
          <span>{activeSprint ? new Date(activeSprint.start_date).toLocaleDateString() : "—"}</span>
          <span className={styles.timelineArrow}>→</span>
          <span>{activeSprint ? new Date(activeSprint.end_date).toLocaleDateString() : "—"}</span>
        </div>
      </div>
      <div className={styles.timelineGrid}>
        {events.map((ev) => {
          const evStart = new Date(ev.start).getTime();
          const evEnd = new Date(ev.end).getTime();
          const left = total > 0 ? ((evStart - start) / total) * 100 : 0;
          const width = total > 0 ? Math.max(2, ((evEnd - evStart) / total) * 100) : 2;
          return (
            <div key={ev.key} className={styles.timelineRow}>
              <div className={styles.timelineRowLabel}>
                <span className={styles.timelineKey}>{ev.key}</span>
                <span className={styles.timelineSummary}>{ev.summary}</span>
                <span className={styles.timelineAssignee}>{ev.assignee}</span>
              </div>
              <div className={styles.timelineTrack}>
                <div
                  className={`${styles.timelineBar} ${ev.critical_path ? styles.timelineBarCritical : ""}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${ev.start} → ${ev.end} (${ev.progress_pct}%)`}
                >
                  <div className={styles.timelineProgress} style={{ width: `${ev.progress_pct}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── TEAM ── */
function SprintTeamView({ team, sprintTickets }: { team?: { members: any[]; roster: any[] } | null; sprintTickets: any[] }) {
  if (!team) return <p className={styles.emptyList}>Loading team data…</p>;

  const ticketMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    sprintTickets.forEach((t) => {
      const assignee = t.assignee ?? "Unassigned";
      (map[assignee] ??= []).push(t);
    });
    return map;
  }, [sprintTickets]);

  return (
    <div className={styles.teamView}>
      <div className={styles.teamGrid}>
        {team.roster.map((member) => {
          const memberTickets = ticketMap[member.name] ?? [];
          const points = memberTickets.reduce((s: number, t: any) => s + (t.story_points ?? 0), 0);
          return (
            <div key={member.user_id} className={styles.teamCard}>
              <div className={styles.teamCardHeader}>
                {member.avatar ? <img src={member.avatar} alt="" className={styles.teamAvatar} /> : <div className={styles.teamAvatarFallback}>{member.name[0]}</div>}
                <div className={styles.teamCardInfo}>
                  <div className={styles.teamCardName}>{member.name}</div>
                  <div className={styles.teamCardRole}>{member.role}</div>
                </div>
              </div>
              <div className={styles.teamCardStats}>
                <div><strong>{member.ticket_count}</strong> <span>tickets</span></div>
                <div><strong>{points}</strong> <span>pts</span></div>
                <div><strong>{member.capacity_hours}h</strong> <span>capacity</span></div>
              </div>
              <div className={styles.teamCardTickets}>
                {memberTickets.slice(0, 4).map((t: any) => (
                  <div key={t.key} className={styles.teamTicketChip}>
                    <span>{t.key}</span>
                    <StatusBadge status={t.status} />
                  </div>
                ))}
                {memberTickets.length > 4 && <span className={styles.teamTicketMore}>+{memberTickets.length - 4} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
