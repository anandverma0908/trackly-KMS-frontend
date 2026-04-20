import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  fetchSprints, fetchSprint, createSprint, startSprint, completeSprint,
  fetchTickets, addTicketToSprint, removeTicketFromSprint,
  fetchBurndown, fetchVelocity, generateSprintRetro,
} from "@/services/api";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { Sprint, Ticket } from "@/types";
import { IssueTypeBadge, StatusBadge } from "@/components/ui/Badge";
import { useAuthStore } from "@/features/auth/useAuthStore";
import { RiSparklingLine, RiAlertLine, RiCheckLine } from "react-icons/ri";
import styles from "./SprintPage.module.css";

type View = "board" | "backlog" | "burndown" | "velocity";

export default function SprintPage() {
  const qc = useQueryClient();
  const [view, setView]               = useState<View>("backlog");
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);
  const [showNewSprint, setShowNewSprint] = useState(false);
  const [retroText, setRetroText]     = useState("");
  const [loadingRetro, setLoadingRetro] = useState(false);
  const scopedPod = useAuthStore((s) => s.getScopedPod());
  const [newSprint, setNewSprint] = useState({ name: "", goal: "", start_date: "", end_date: "", project_id: scopedPod ?? "" });

  const { data: rawSprints = [] } = useQuery({
    queryKey: ["sprints"],
    queryFn: fetchSprints,
  });
  const sprints: Sprint[] = rawSprints as Sprint[];

  // Auto-select first sprint
  if (sprints.length > 0 && !activeSprint) {
    setActiveSprint(sprints[0]);
  }

  const { data: sprintDetail } = useQuery({
    queryKey: ["sprint", activeSprint?.id],
    queryFn:  () => fetchSprint(activeSprint!.id),
    enabled:  !!activeSprint,
  });

  const { data: backlogData } = useQuery({
    queryKey: ["backlog"],
    queryFn: () => fetchTickets({}),
  });

  const { data: burndownData = [] } = useQuery({
    queryKey: ["burndown", activeSprint?.id],
    queryFn:  () => fetchBurndown(activeSprint!.id),
    enabled:  !!activeSprint && view === "burndown",
  });

  const { data: velocityData = [] } = useQuery({
    queryKey: ["velocity"],
    queryFn:  fetchVelocity,
    enabled:  view === "velocity",
  });

  const createMut = useMutation({
    mutationFn: (payload: { name: string; goal?: string; start_date: string; end_date: string; project_id: string }) => createSprint(payload),
    onSuccess: (sprint) => {
      qc.invalidateQueries({ queryKey: ["sprints"] });
      setActiveSprint(sprint);
      setShowNewSprint(false);
      toast.success("Sprint created!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startMut = useMutation({
    mutationFn: (id: string) => startSprint(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sprints"] }); toast.success("Sprint started!"); },
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => completeSprint(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sprints"] }); toast.success("Sprint completed!"); },
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

  const allBacklog = (backlogData?.tickets ?? []).filter((t) => !t.status.includes("Done"));
  const sprintTickets = sprintDetail?.tickets ?? [];
  const sprintTicketKeys = new Set(sprintTickets.map((t) => t.key));
  const backlogOnly = allBacklog.filter((t) => !sprintTicketKeys.has(t.key));

  // Capacity bar
  const totalPoints = sprintTickets.reduce((sum, t) => sum + (t.story_points || 0), 0);
  const CAPACITY = 40;

  // Sprint Health computation
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
    const moveToBacklog = sprintTickets
      .filter(t => t.status !== "Done" && t.status !== "Closed" && !t.status.toLowerCase().includes("progress") && !t.status.toLowerCase().includes("review"))
      .slice(0, 2);
    let recommendation = "";
    if (probability >= 80) recommendation = `On pace — ${Math.round(pace * 7)}pts/week. Sprint looks healthy.`;
    else if (probability >= 50) recommendation = `At risk. Burning ${pace.toFixed(1)} pts/day, need ${neededPace.toFixed(1)}. Consider de-scoping ${Math.ceil(remaining - pace * daysLeft)} pts.`;
    else recommendation = `Behind pace. ${daysLeft}d left, ${remaining} pts remaining. EOS recommends moving ${moveToBacklog.length} backlog tickets out.`;
    return { probability, daysLeft, committed, done, remaining, pace, blockedCount, atRiskTickets, moveToBacklog, recommendation };
  }, [activeSprint, sprintTickets, totalPoints]);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Sprints</h1>
          <p className={styles.subtitle}>Manage sprints, backlog, and velocity</p>
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
            </button>
          ))}
        </div>
      )}

      {/* View switcher */}
      <div className={styles.viewTabs}>
        {(["backlog", "burndown", "velocity"] as View[]).map((v) => (
          <button
            key={v}
            className={`${styles.viewTab} ${view === v ? styles.viewTabActive : ""}`}
            onClick={() => setView(v)}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* Active Sprint Info */}
      {activeSprint && (
        <div className={styles.sprintInfo}>
          <div className={styles.sprintMeta}>
            <span className={styles.sprintName}>{activeSprint.name}</span>
            <span className={`badge ${activeSprint.status === "active" ? "badge-green" : activeSprint.status === "completed" ? "badge-gray" : "badge-amber"}`}>
              {activeSprint.status}
            </span>
            {activeSprint.goal && <span className={styles.sprintGoal}>"{activeSprint.goal}"</span>}
          </div>
          <div className={styles.sprintActions}>
            {activeSprint.status === "planning" && (
              <button className="btn btn-primary btn-sm" onClick={() => startMut.mutate(activeSprint.id)}>
                Start Sprint
              </button>
            )}
            {activeSprint.status === "active" && (
              <>
                <button className="btn btn-ghost btn-sm" onClick={handleGenerateRetro} disabled={loadingRetro}>
                  {loadingRetro ? "Generating…" : "✦ Generate Retro"}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => completeMut.mutate(activeSprint.id)}>
                  Complete Sprint
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── EOS Sprint Health Predictor ── */}
      {sprintHealth && (
        <div className={styles.healthCard}>
          <div className={styles.healthHeader}>
            <RiSparklingLine size={14} className={styles.healthEosIcon} />
            <span className={styles.healthTitle}>Sprint Health Predictor</span>
            <span className={styles.eosBadge}><RiSparklingLine size={9} /> EOS</span>
          </div>

          <div className={styles.healthBody}>
            {/* Probability meter */}
            <div className={styles.healthMeter}>
              <div className={styles.healthProbRow}>
                <span className={styles.healthProbVal} style={{ color: sprintHealth.probability >= 80 ? "var(--green)" : sprintHealth.probability >= 50 ? "var(--amber)" : "var(--red)" }}>
                  {sprintHealth.probability}%
                </span>
                <span className={styles.healthProbLbl}>completion probability</span>
                <span className={styles.healthStatusChip} style={{ color: sprintHealth.probability >= 80 ? "var(--green)" : sprintHealth.probability >= 50 ? "var(--amber)" : "var(--red)", borderColor: sprintHealth.probability >= 80 ? "rgba(52,211,153,0.3)" : sprintHealth.probability >= 50 ? "rgba(251,191,36,0.3)" : "rgba(248,113,113,0.3)" }}>
                  {sprintHealth.probability >= 80 ? "On Track" : sprintHealth.probability >= 50 ? "At Risk" : "Behind Pace"}
                </span>
              </div>
              <div className={styles.healthProbBar}>
                <div className={styles.healthProbFill} style={{ width: `${sprintHealth.probability}%`, background: sprintHealth.probability >= 80 ? "var(--green)" : sprintHealth.probability >= 50 ? "var(--amber)" : "var(--red)" }} />
              </div>
            </div>

            {/* Stats */}
            <div className={styles.healthStats}>
              {[
                { val: sprintHealth.done, lbl: "pts done", color: "var(--green)" },
                { val: sprintHealth.remaining, lbl: "pts left", color: "var(--text)" },
                { val: `${sprintHealth.daysLeft}d`, lbl: "remaining", color: "var(--text)" },
                { val: sprintHealth.blockedCount, lbl: "blocked", color: sprintHealth.blockedCount > 0 ? "var(--red)" : "var(--text-3)" },
              ].map(s => (
                <div key={s.lbl} className={styles.healthStat}>
                  <span className={styles.healthStatVal} style={{ color: s.color }}>{s.val}</span>
                  <span className={styles.healthStatLbl}>{s.lbl}</span>
                </div>
              ))}
            </div>

            {/* EOS Recommendation */}
            <div className={styles.healthRec}>
              <span className={styles.healthRecLabel}>EOS Recommends</span>
              <p className={styles.healthRecText}>{sprintHealth.recommendation}</p>
            </div>

            {/* At-risk tickets */}
            {sprintHealth.atRiskTickets.length > 0 && (
              <div className={styles.healthRisks}>
                <span className={styles.healthRisksLabel}>
                  <RiAlertLine size={11} /> {sprintHealth.atRiskTickets.length} ticket{sprintHealth.atRiskTickets.length > 1 ? "s" : ""} at risk
                </span>
                {sprintHealth.atRiskTickets.slice(0, 3).map(t => (
                  <div key={t.key} className={styles.healthRiskItem}>
                    <span className={styles.healthRiskKey}>{t.key}</span>
                    <span className={styles.healthRiskSummary}>{t.summary.slice(0, 48)}…</span>
                    <span className={styles.healthRiskStatus}>{t.status}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Move-to-backlog suggestion */}
            {sprintHealth.probability < 60 && sprintHealth.moveToBacklog.length > 0 && (
              <div className={styles.healthSuggest}>
                <RiCheckLine size={11} />
                <span>Consider moving <strong>{sprintHealth.moveToBacklog.map(t => t.key).join(", ")}</strong> to backlog to protect sprint commitment.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NOVA Retro */}
      {retroText && (
        <div className={styles.retroPanel}>
          <div className={styles.novaBadge}>
            <span className={styles.novaGlow} />
            EOS Sprint Retrospective
          </div>
          <pre className={styles.retroText}>{retroText}</pre>
        </div>
      )}

      {/* Backlog View */}
      {view === "backlog" && (
        <div className={styles.backlogView}>
          {/* Sprint Side */}
          <div className={styles.backlogPanel}>
            <div className={styles.panelHeader}>
              <span>{activeSprint?.name ?? "Sprint"}</span>
              <span className={styles.panelCount}>{sprintTickets.length} tickets</span>
              {/* Capacity bar */}
              <div className={styles.capacityBar}>
                <div className={styles.capacityFill} style={{ width: `${Math.min((totalPoints / CAPACITY) * 100, 100)}%` }} />
              </div>
            </div>
            <div className={styles.ticketList}>
              {sprintTickets.map((t) => (
                <BacklogTicketRow
                  key={t.key}
                  ticket={t}
                  action="remove"
                  onAction={() => activeSprint && removeFromSprintMut.mutate({ sprintId: activeSprint.id, ticketKey: t.key })}
                />
              ))}
              {sprintTickets.length === 0 && (
                <p className={styles.emptyList}>No tickets in this sprint yet. Drag from backlog.</p>
              )}
            </div>
          </div>

          {/* Backlog Side */}
          <div className={styles.backlogPanel}>
            <div className={styles.panelHeader}>
              <span>Backlog</span>
              <span className={styles.panelCount}>{backlogOnly.length} tickets</span>
            </div>
            <div className={styles.ticketList}>
              {backlogOnly.map((t) => (
                <BacklogTicketRow
                  key={t.key}
                  ticket={t}
                  action="add"
                  onAction={() => activeSprint && addToSprintMut.mutate({ sprintId: activeSprint.id, ticketKey: t.key })}
                />
              ))}
              {backlogOnly.length === 0 && (
                <p className={styles.emptyList}>Backlog is empty!</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Burndown Chart */}
      {view === "burndown" && (
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Burndown Chart</div>
          {burndownData.length === 0 ? (
            <p className={styles.emptyList}>No burndown data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={burndownData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-2)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-2)" }} />
                <Tooltip
                  contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: 8 }}
                  labelStyle={{ color: "var(--text-2)" }}
                />
                <Legend wrapperStyle={{ fontSize: "0.8rem" }} />
                <Line type="monotone" dataKey="ideal"  stroke="var(--text-3)"  strokeDasharray="5 5" dot={false} name="Ideal" />
                <Line type="monotone" dataKey="actual" stroke="var(--accent)"  strokeWidth={2}       dot={{ r: 3 }} name="Actual" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Velocity Chart */}
      {view === "velocity" && (
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Velocity Chart</div>
          {velocityData.length === 0 ? (
            <p className={styles.emptyList}>No velocity data available yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={velocityData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="sprint" tick={{ fontSize: 11, fill: "var(--text-2)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-2)" }} />
                <Tooltip
                  contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: "0.8rem" }} />
                <Bar dataKey="committed" fill="var(--text-3)" name="Committed" radius={[4,4,0,0]} />
                <Bar dataKey="completed" fill="var(--accent)" name="Completed" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
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
              <button
                className="btn btn-primary"
                disabled={!newSprint.name || createMut.isPending}
                onClick={() => createMut.mutate(newSprint)}
              >
                {createMut.isPending ? "Creating…" : "Create Sprint"}
              </button>
            </div>
          </div>
        </div>
      )}
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
      <button
        className={`${styles.actionBtn} ${action === "add" ? styles.actionBtnAdd : styles.actionBtnRemove}`}
        onClick={onAction}
      >
        {action === "add" ? "→" : "←"}
      </button>
    </div>
  );
}
