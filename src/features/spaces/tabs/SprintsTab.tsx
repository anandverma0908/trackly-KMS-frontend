import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { RiSparklingLine, RiAlertLine, RiCheckLine, RiCalendarLine, RiFlashlightLine, RiTeamLine, RiArrowRightLine } from "react-icons/ri";
import type { Project, ProjectSprint } from "../spacesData";
import styles from "./SprintsTab.module.css";

const STATUS_COLOR: Record<string, string> = {
  active:    "var(--accent)",
  planning:  "var(--amber)",
  completed: "var(--green)",
};

export default function SprintsTab({ project }: { project: Project }) {
  const activeSprint    = project.sprints.find((s) => s.status === "active") ?? null;
  const completedSprints = project.sprints.filter((s) => s.status === "completed");

  /* ── Sprint Health Predictor ── */
  const sprintHealth = useMemo(() => {
    if (!activeSprint) return null;
    const now        = new Date();
    const start      = new Date(activeSprint.startDate);
    const end        = new Date(activeSprint.endDate);
    const totalDays  = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
    const daysElapsed = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 86_400_000));
    const daysLeft   = Math.max(0, totalDays - daysElapsed);
    const done       = activeSprint.donePoints;
    const committed  = activeSprint.totalPoints;
    const remaining  = committed - done;
    const pace       = done / daysElapsed;
    const neededPace = daysLeft > 0 ? remaining / daysLeft : remaining > 0 ? 0 : pace;
    const probability = Math.min(100, Math.round((neededPace > 0 ? pace / neededPace : 1) * 100));
    const blockedCount = activeSprint.tasks.filter((t) => t.status === "Blocked").length;
    const atRiskTickets = activeSprint.tasks.filter(
      (t) => t.status === "Blocked" || (t.dueDate && new Date(t.dueDate) < now && t.status !== "Done")
    );
    const recommendation =
      probability >= 80
        ? "Sprint is on track. Protect the team from scope additions."
        : probability >= 50
        ? `Sprint is at risk. ${blockedCount > 0 ? `Unblock ${blockedCount} ticket${blockedCount > 1 ? "s" : ""} immediately.` : "Consider moving low-priority items to backlog."}`
        : "Sprint is unlikely to complete. Escalate blockers and negotiate scope now.";
    return { probability, daysLeft, committed, done, remaining, blockedCount, atRiskTickets, recommendation };
  }, [activeSprint]);

  const healthColor = !sprintHealth ? "var(--text-3)"
    : sprintHealth.probability >= 80 ? "var(--green)"
    : sprintHealth.probability >= 50 ? "var(--amber)"
    : "var(--red)";

  /* ── Velocity chart ── */
  const velocityData = completedSprints.map((s) => ({
    sprint:    s.name.replace("Sprint ", "S"),
    committed: s.totalPoints,
    completed: s.donePoints,
  }));

  /* ── Avg velocity ── */
  const avgVelocity = completedSprints.length
    ? Math.round(completedSprints.reduce((s, sp) => s + sp.donePoints, 0) / completedSprints.length)
    : 0;

  /* ── Smart Sprint Planning ── */
  const planningSprint = project.sprints.find((s) => s.status === "planning") ?? null;
  const [planningDismissed, setPlanningDismissed] = useState(false);

  const planningInsights = useMemo(() => {
    if (!planningSprint) return null;
    const memberCount = project.members.length;
    const sprintDays = 10; // 2-week sprint default
    const hoursPerDay = 6;
    const totalCapacityHrs = memberCount * sprintDays * hoursPerDay;
    const capacityPts = Math.round(totalCapacityHrs / 4); // ~4h per point
    const recommended = Math.min(capacityPts, Math.round(avgVelocity * 0.9));
    const currentPts = planningSprint.totalPoints;
    const overCommitted = currentPts > recommended * 1.15;
    const underCommitted = currentPts < recommended * 0.7;
    return { memberCount, totalCapacityHrs, recommended, currentPts, overCommitted, underCommitted, sprintDays };
  }, [planningSprint, project.members.length, avgVelocity]);

  return (
    <div className={styles.tab}>

      {/* ── Smart Sprint Planning Assistant ── */}
      {planningSprint && planningInsights && !planningDismissed && (
        <div className={styles.planningCard}>
          <div className={styles.planningHeader}>
            <RiSparklingLine size={13} color="var(--accent)" />
            <span className={styles.planningTitle}>EOS Sprint Planning Assistant — {planningSprint.name}</span>
            <span className={styles.eosBadge}><RiSparklingLine size={9} /> EOS</span>
            <button className={styles.planningDismiss} onClick={() => setPlanningDismissed(true)}>✕</button>
          </div>

          <div className={styles.planningGrid}>
            <div className={styles.planningMetric}>
              <span className={styles.planningMetricVal}>{planningInsights.memberCount}</span>
              <span className={styles.planningMetricLbl}>members</span>
            </div>
            <div className={styles.planningMetric}>
              <span className={styles.planningMetricVal}>{planningInsights.totalCapacityHrs}h</span>
              <span className={styles.planningMetricLbl}>total capacity</span>
            </div>
            <div className={styles.planningMetric}>
              <span className={styles.planningMetricVal} style={{ color: "var(--accent)" }}>{planningInsights.recommended} pts</span>
              <span className={styles.planningMetricLbl}>EOS recommended</span>
            </div>
            <div className={styles.planningMetric}>
              <span
                className={styles.planningMetricVal}
                style={{ color: planningInsights.overCommitted ? "var(--red)" : planningInsights.underCommitted ? "var(--amber)" : "var(--green)" }}
              >
                {planningInsights.currentPts} pts
              </span>
              <span className={styles.planningMetricLbl}>currently planned</span>
            </div>
          </div>

          <div className={styles.planningRec}>
            {planningInsights.overCommitted ? (
              <><RiAlertLine size={12} color="var(--red)" />
              <span>Sprint is over-committed by ~{planningInsights.currentPts - planningInsights.recommended} pts. Based on historical velocity ({avgVelocity} pts/sprint) and team capacity, EOS recommends moving lower-priority items to backlog.</span></>
            ) : planningInsights.underCommitted ? (
              <><RiTeamLine size={12} color="var(--amber)" />
              <span>Sprint has capacity for ~{planningInsights.recommended - planningInsights.currentPts} more points. Pull in backlog items to fully utilize team capacity of {planningInsights.totalCapacityHrs}h.</span></>
            ) : (
              <><RiCheckLine size={12} color="var(--green)" />
              <span>Sprint scope looks healthy. {planningInsights.currentPts} pts aligns with historical velocity and team capacity. Ready to activate.</span></>
            )}
          </div>

          <div className={styles.planningActions}>
            <button className={styles.planningBtn}>
              <RiArrowRightLine size={12} /> View Backlog to adjust
            </button>
          </div>
        </div>
      )}

      {/* ── Active Sprint Health ── */}
      {activeSprint && sprintHealth ? (
        <div className={styles.healthCard}>
          <div className={styles.healthHeader}>
            <div className={styles.healthHeaderLeft}>
              <RiFlashlightLine size={14} color={healthColor} />
              <span className={styles.healthTitle}>{activeSprint.name}</span>
              <span className={styles.statusDot} style={{ background: "var(--accent)" }} />
              <span className={styles.activeLabel}>Active</span>
              <span className={styles.eosBadge}><RiSparklingLine size={9} /> EOS</span>
            </div>
            <span className={styles.sprintDates}>
              <RiCalendarLine size={12} />
              {activeSprint.startDate} → {activeSprint.endDate}
            </span>
          </div>

          <div className={styles.healthBody}>
            <div className={styles.healthMeter}>
              <div className={styles.healthProbRow}>
                <span className={styles.healthProbVal} style={{ color: healthColor }}>{sprintHealth.probability}%</span>
                <span className={styles.healthProbLbl}>completion probability</span>
                <span className={styles.healthStatusChip} style={{ color: healthColor, borderColor: healthColor, background: `${healthColor}18` }}>
                  {sprintHealth.probability >= 80 ? "On Track" : sprintHealth.probability >= 50 ? "At Risk" : "Behind"}
                </span>
              </div>
              <div className={styles.healthProbBar}>
                <div className={styles.healthProbFill} style={{ width: `${sprintHealth.probability}%`, background: healthColor }} />
              </div>
            </div>
            <div className={styles.healthStats}>
              {[
                { val: `${sprintHealth.done} pts`, lbl: "Done" },
                { val: `${sprintHealth.remaining} pts`, lbl: "Remaining" },
                { val: `${sprintHealth.daysLeft}d`, lbl: "Days Left" },
                { val: sprintHealth.blockedCount, lbl: "Blocked" },
              ].map(({ val, lbl }) => (
                <div key={lbl} className={styles.healthStat}>
                  <span className={styles.healthStatVal}>{val}</span>
                  <span className={styles.healthStatLbl}>{lbl}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.healthRec}>
            {sprintHealth.probability >= 80 ? <RiCheckLine size={13} color="var(--green)" /> : <RiAlertLine size={13} color="var(--amber)" />}
            <span>{sprintHealth.recommendation}</span>
          </div>

          {sprintHealth.atRiskTickets.length > 0 && (
            <div className={styles.atRiskList}>
              <span className={styles.atRiskLabel}>At-risk tickets</span>
              {sprintHealth.atRiskTickets.slice(0, 4).map((t) => (
                <div key={t.id} className={styles.atRiskItem}>
                  <span className={styles.atRiskKey}>{t.key}</span>
                  <span className={styles.atRiskTitle}>{t.title}</span>
                  <span className={styles.atRiskStatus} style={{ color: t.status === "Blocked" ? "var(--red)" : "var(--amber)" }}>{t.status}</span>
                </div>
              ))}
            </div>
          )}

          <div className={styles.sprintGoalRow}>
            <span className={styles.sprintGoalLabel}>Goal:</span>
            <span className={styles.sprintGoalText}>{activeSprint.goal}</span>
          </div>
        </div>
      ) : (
        <div className={styles.noActive}>
          <RiFlashlightLine size={18} color="var(--text-3)" />
          <span>No active sprint — start one from the Backlog tab.</span>
        </div>
      )}

      {/* ── Velocity Chart ── */}
      {completedSprints.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Velocity History</span>
            <span className={styles.cardMeta}>Avg: <strong style={{ color: project.color }}>{avgVelocity} pts/sprint</strong></span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={velocityData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="sprint" tick={{ fontSize: 11, fill: "var(--text-3)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-3)" }} />
              <Tooltip
                contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: 8 }}
                formatter={(v: number, name: string) => [v + " pts", name === "completed" ? "Completed" : "Committed"]}
              />
              <Bar dataKey="committed" fill="var(--surface-2)" stroke="var(--border-2)" strokeWidth={1} radius={[4,4,0,0]} name="committed" />
              <Bar dataKey="completed" fill={project.color} radius={[4,4,0,0]} name="completed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── All Sprints List ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>All Sprints</span>
          <span className={styles.cardMeta}>{project.sprints.length} total · {completedSprints.length} completed</span>
        </div>
        <div className={styles.sprintList}>
          {[...project.sprints].reverse().map((sprint) => (
            <SprintRow key={sprint.id} sprint={sprint} projectColor={project.color} />
          ))}
          {project.sprints.length === 0 && <div className={styles.empty}>No sprints created yet.</div>}
        </div>
      </div>
    </div>
  );
}

function SprintRow({ sprint, projectColor }: { sprint: ProjectSprint; projectColor: string }) {
  const pct   = sprint.totalPoints > 0 ? Math.round((sprint.donePoints / sprint.totalPoints) * 100) : 0;
  const color = STATUS_COLOR[sprint.status];
  return (
    <div className={styles.sprintRow}>
      <div className={styles.sprintRowLeft}>
        <span className={styles.sprintStatusDot} style={{ background: color }} />
        <div>
          <div className={styles.sprintRowName}>{sprint.name}</div>
          <div className={styles.sprintRowMeta}>
            <span>{sprint.startDate} → {sprint.endDate}</span>
            <span>·</span>
            <span>{sprint.tasks.length} tasks</span>
            {sprint.goal && <><span>·</span><span className={styles.sprintRowGoal}>{sprint.goal}</span></>}
          </div>
        </div>
      </div>
      <div className={styles.sprintRowRight}>
        <span className={styles.sprintStatusBadge} style={{ color, background: `${color}18`, borderColor: `${color}40` }}>
          {sprint.status.charAt(0).toUpperCase() + sprint.status.slice(1)}
        </span>
        <div className={styles.sprintPts}>
          <span style={{ color: projectColor, fontWeight: 700 }}>{sprint.donePoints}</span>
          <span className={styles.sprintPtsSep}>/</span>
          <span>{sprint.totalPoints} pts</span>
        </div>
        <div className={styles.miniBar}>
          <div className={styles.miniBarFill} style={{ width: `${pct}%`, background: projectColor }} />
        </div>
        <span className={styles.sprintPct}>{pct}%</span>
      </div>
    </div>
  );
}
