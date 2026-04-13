import { useState } from "react";
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
import styles from "./SprintPage.module.css";

type View = "board" | "backlog" | "burndown" | "velocity";

export default function SprintPage() {
  const qc = useQueryClient();
  const [view, setView]               = useState<View>("backlog");
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);
  const [showNewSprint, setShowNewSprint] = useState(false);
  const [retroText, setRetroText]     = useState("");
  const [loadingRetro, setLoadingRetro] = useState(false);
  const [newSprint, setNewSprint] = useState({ name: "", goal: "", start_date: "", end_date: "" });

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
    mutationFn: (id: number) => startSprint(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sprints"] }); toast.success("Sprint started!"); },
  });

  const completeMut = useMutation({
    mutationFn: (id: number) => completeSprint(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sprints"] }); toast.success("Sprint completed!"); },
  });

  const addToSprintMut = useMutation({
    mutationFn: ({ sprintId, ticketKey }: { sprintId: number; ticketKey: string }) =>
      addTicketToSprint(sprintId, ticketKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sprint", activeSprint?.id] }),
  });

  const removeFromSprintMut = useMutation({
    mutationFn: ({ sprintId, ticketKey }: { sprintId: number; ticketKey: string }) =>
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
  const totalPoints = sprintTickets.length; // proxy for capacity
  const CAPACITY = 40;

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

      {/* NOVA Retro */}
      {retroText && (
        <div className={styles.retroPanel}>
          <div className={styles.novaBadge}>
            <span className={styles.novaGlow} />
            NOVA Sprint Retrospective
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
