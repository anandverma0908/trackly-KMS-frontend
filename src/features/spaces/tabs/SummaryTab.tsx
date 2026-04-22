import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSpaceHealth, fetchSpacesBrief, fetchPodSummary } from "@/services/api";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, LineChart, Line,
  Tooltip as ReTooltip, ResponsiveContainer,
} from "recharts";
import LinearProgress from "@mui/material/LinearProgress";
import {
  RiSparklingLine, RiAlertLine, RiCheckLine,
  RiCloseLine, RiRefreshLine, RiBarChartBoxLine,
  RiTimeLine, RiTeamLine, RiLightbulbLine,
  RiArrowUpLine, RiArrowDownLine,
  RiCalendarLine, RiUserLine,
} from "react-icons/ri";
import type { Project, ProjectTask } from "../spacesData";
import SummaryKPIStrip from "./SummaryKPIStrip";
import styles from "./SummaryTab.module.css";

function EOSBadge() {
  return (
    <span className={styles.eosBadge}>
      <RiSparklingLine size={9} /> EOS
    </span>
  );
}

export default function SummaryTab({ project }: { project: Project }) {
  const qc = useQueryClient();
  const [briefDismissed, setBriefDismissed] = useState(false);

  const allTasks: ProjectTask[] = useMemo(
    () => project.sprints.flatMap((s) => s.tasks),
    [project]
  );

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const total   = allTasks.length;
    const done    = allTasks.filter((t) => t.status === "Done").length;
    const blocked = allTasks.filter((t) => t.status === "Blocked").length;
    const overdue = allTasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "Done").length;
    const updated = allTasks.filter((t) => t.updatedAt >= "2025-04-01").length;
    return { total, done, blocked, overdue, updated };
  }, [allTasks]);

  /* ── Health score & radar — from unified backend algorithm ── */
  const healthQuery = useQuery({
    queryKey: ["space-health", project.key],
    queryFn: () => fetchSpaceHealth(project.key),
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });

  const radarData = useMemo(() => {
    if (!healthQuery.data) return [];
    const r = healthQuery.data.radar;
    return [
      { metric: "Delivery",  score: r.delivery },
      { metric: "Velocity",  score: r.velocity },
      { metric: "Clarity",   score: r.clarity },
      { metric: "Momentum",  score: r.momentum },
      { metric: "Flow",      score: r.flow },
      { metric: "Quality",   score: r.quality },
      { metric: "On-Time",   score: r.on_time },
    ];
  }, [healthQuery.data]);

  const healthScore = healthQuery.data?.health_score ?? 0;
  const healthColor = healthScore >= 70 ? "var(--green)" : healthScore >= 50 ? "var(--amber)" : "var(--red)";

  /* ── Weekly activity ── */
  const activityData = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return project.weeklyActivity.map((v, i) => ({ day: days[i], tasks: v }));
  }, [project]);

  /* ── Team workload ── */
  const workloadData = useMemo(() => {
    const map: Record<string, { done: number; inProgress: number; todo: number }> = {};
    allTasks.forEach((t) => {
      const who = t.assignee || "—";
      if (!map[who]) map[who] = { done: 0, inProgress: 0, todo: 0 };
      if (t.status === "Done") map[who].done++;
      else if (t.status === "In Progress") map[who].inProgress++;
      else map[who].todo++;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name: name.split(" ")[0], ...v, total: v.done + v.inProgress + v.todo }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [allTasks]);

  /* ── EOS Project Brief + 3 insight signals — single backend call ── */
  const spacesBrief = useQuery({
    queryKey: ["spaces-brief", project.key],
    queryFn: () => fetchSpacesBrief(project.key),
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });

  const parsedInsights = useMemo(() => {
    if (!spacesBrief.data) return null;
    return {
      velocity: spacesBrief.data.velocity_signal,
      risk:     spacesBrief.data.risk_signal,
      rec:      spacesBrief.data.recommendation,
    };
  }, [spacesBrief.data]);

  /* ── Cross-project comparison ── */
  const podSummaryQuery = useQuery({
    queryKey: ["pod-summary"],
    queryFn: fetchPodSummary,
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });

  const { avgHealth, healthDiff, totalPods } = useMemo(() => {
    const all = podSummaryQuery.data ?? [];
    if (all.length < 2) return { avgHealth: null, healthDiff: null, totalPods: 0 };
    const scores = all.filter(p => p.health_score != null).map(p => p.health_score);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    return { avgHealth: avg, healthDiff: healthScore - avg, totalPods: all.length };
  }, [podSummaryQuery.data, healthScore]);

  /* ── Health trend (last 4 sprints — delivery score proxy) ── */
  const trendData = useMemo(() => {
    const last4 = [...project.sprints].slice(-4);
    return last4.map(s => ({
      name: s.name.replace(/Sprint\s*/i, "S"),
      score: s.totalPoints > 0 ? Math.round((s.donePoints / s.totalPoints) * 100) : 0,
    }));
  }, [project.sprints]);

  /* ── Delivery prediction ── */
  const deliveryWeeks = useMemo(() => {
    const completed = project.sprints.filter(s => s.status === "completed" && s.totalPoints > 0);
    if (completed.length === 0) return null;
    const avgDone = completed.reduce((a, s) => a + s.donePoints, 0) / completed.length;
    if (avgDone <= 0) return null;
    const remaining = project.sprints
      .filter(s => s.status !== "completed")
      .reduce((a, s) => a + Math.max(0, s.totalPoints - s.donePoints), 0);
    return Math.max(1, Math.round((remaining / avgDone) * 2));
  }, [project.sprints]);

  /* ── Bottleneck member ── */
  const bottleneckMember = useMemo(() => {
    const inProgressByMember = project.members.map(m => ({
      name: m.name,
      inProgress: allTasks.filter(t => t.assignee === m.name && t.status === "In Progress").length,
    }));
    const sorted = inProgressByMember.sort((a, b) => b.inProgress - a.inProgress);
    const avg = inProgressByMember.reduce((a, m) => a + m.inProgress, 0) / Math.max(inProgressByMember.length, 1);
    return sorted[0]?.inProgress > avg * 1.5 && sorted[0].inProgress > 1 ? sorted[0].name : null;
  }, [project.members, allTasks]);

  /* ── Risk flags ── */
  const riskFlags = useMemo(() => {
    const bugCount = allTasks.filter((t) => t.type === "Bug").length;
    return [
      { label: "Blocked Tasks",  value: kpis.blocked, max: allTasks.length, risk: kpis.blocked > 3 ? "high" : kpis.blocked > 1 ? "medium" : "low" as const },
      { label: "Overdue Tasks",  value: kpis.overdue, max: allTasks.length, risk: kpis.overdue > 2 ? "high" : kpis.overdue > 0 ? "medium" : "low" as const },
      { label: "Bug Rate",       value: bugCount,      max: allTasks.length, risk: bugCount > 3 ? "high" : bugCount > 1 ? "medium" : "low" as const },
    ];
  }, [allTasks, kpis]);

  return (
    <div className={styles.tab}>

      {/* ── EOS Project Brief ── */}
      {!briefDismissed && (
        <div className={styles.briefBar}>
          <div className={styles.briefGlow} />
          <div className={styles.briefContent}>
            <RiSparklingLine size={14} color="var(--accent)" className={styles.briefIcon} />
            <div className={styles.briefText}>
              {spacesBrief.isPending && <span className={styles.briefLoading}>EOS is analysing {project.key}…</span>}
              {spacesBrief.data && <span>{spacesBrief.data.brief}</span>}
              {spacesBrief.isError && <span className={styles.briefLoading}>Could not load EOS brief.</span>}
            </div>
            <EOSBadge />
            <button className={styles.briefClose} onClick={() => setBriefDismissed(true)}>
              <RiCloseLine size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Health Score + 3 Insight Cards ── */}
      <div className={styles.aiRow}>
        {/* Health score */}
        <div className={styles.healthCard}>
          <div className={styles.healthCardHeader}>
            <span className={styles.cardLabel}>Project Health</span>
            <EOSBadge />
          </div>
          <div className={styles.healthScoreBig} style={{ color: healthColor }}>{healthScore}</div>
          <div className={styles.healthScoreSub}>/100</div>
          <div className={styles.healthProbBar}>
            <div className={styles.healthProbFill} style={{ width: `${healthScore}%`, background: healthColor }} />
          </div>
          <div className={styles.healthDims}>
            {radarData.map((d) => (
              <div key={d.metric} className={styles.healthDimRow}>
                <span className={styles.healthDimLabel}>{d.metric}</span>
                <div className={styles.healthDimBar}>
                  <div className={styles.healthDimFill} style={{ width: `${d.score}%`, background: d.score >= 70 ? "var(--green)" : d.score >= 50 ? "var(--amber)" : "var(--red)" }} />
                </div>
                <span className={styles.healthDimVal}>{d.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Velocity signal */}
        <div className={styles.insightCard}>
          <div className={styles.insightCardHeader}>
            <div className={styles.insightIcon} style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}>
              <RiBarChartBoxLine size={16} color="var(--accent)" />
            </div>
            <div>
              <div className={styles.insightCardTitle}>Velocity Signal</div>
              <EOSBadge />
            </div>
          </div>
          <p className={styles.insightCardBody}>
            {spacesBrief.isPending ? <span className={styles.insightLoading}>EOS analysing…</span>
              : parsedInsights?.velocity ?? `${project.progress}% complete across ${project.sprints.length} sprints.`}
          </p>
          <div className={styles.insightStat}>
            <span className={styles.insightStatVal} style={{ color: project.color }}>
              {project.sprints.filter((s) => s.status === "completed").length}
            </span>
            <span className={styles.insightStatLbl}>sprints completed</span>
          </div>
        </div>

        {/* Risk signal */}
        <div className={styles.insightCard} style={{ borderLeft: `3px solid ${kpis.blocked > 0 || kpis.overdue > 0 ? "var(--red)" : "var(--green)"}` }}>
          <div className={styles.insightCardHeader}>
            <div className={styles.insightIcon} style={{ background: kpis.blocked > 0 ? "rgba(248,113,113,0.12)" : "rgba(52,211,153,0.12)" }}>
              {kpis.blocked > 0 ? <RiAlertLine size={16} color="var(--red)" /> : <RiCheckLine size={16} color="var(--green)" />}
            </div>
            <div>
              <div className={styles.insightCardTitle}>Risk Signal</div>
              <EOSBadge />
            </div>
          </div>
          <p className={styles.insightCardBody}>
            {spacesBrief.isPending ? <span className={styles.insightLoading}>EOS analysing…</span>
              : parsedInsights?.risk ?? (kpis.blocked > 0 ? `${kpis.blocked} tickets blocked, ${kpis.overdue} overdue.` : "No critical blockers detected.")}
          </p>
          <div className={styles.insightStat}>
            <span className={styles.insightStatVal} style={{ color: kpis.blocked > 0 ? "var(--red)" : "var(--green)" }}>{kpis.blocked}</span>
            <span className={styles.insightStatLbl}>blocked now</span>
          </div>
        </div>

        {/* Recommendation */}
        <div className={styles.insightCard} style={{ borderLeft: "3px solid var(--accent)" }}>
          <div className={styles.insightCardHeader}>
            <div className={styles.insightIcon} style={{ background: "var(--accent-glow)" }}>
              <RiLightbulbLine size={16} color="var(--accent)" />
            </div>
            <div>
              <div className={styles.insightCardTitle}>Recommendation</div>
              <EOSBadge />
            </div>
          </div>
          <p className={styles.insightCardBody}>
            {spacesBrief.isPending ? <span className={styles.insightLoading}>EOS analysing…</span>
              : parsedInsights?.rec ?? "Keep momentum — protect team focus and avoid mid-sprint scope changes."}
          </p>
          <button
            className={styles.insightRefresh}
            onClick={() => qc.invalidateQueries({ queryKey: ["spaces-brief", project.key] })}
            title="Refresh EOS insights"
          >
            <RiRefreshLine size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Metrics Row: trend + delivery forecast + cross-project comparison ── */}
      <div className={styles.metricsRow}>

        {/* Health trend */}
        <div className={styles.metricCard}>
          <div className={styles.metricCardHeader}>
            <span className={styles.cardLabel}>Delivery Trend</span>
            <span className={styles.metricSub}>last {trendData.length} sprints</span>
          </div>
          <ResponsiveContainer width="100%" height={72}>
            <LineChart data={trendData} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--text-3)" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "var(--text-3)" }} />
              <ReTooltip
                contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: 6, fontSize: 11 }}
                formatter={(v: number) => [`${v}%`, "Delivery"]}
              />
              <Line type="monotone" dataKey="score" stroke={project.color} strokeWidth={2} dot={{ r: 3, fill: project.color }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Delivery forecast */}
        <div className={styles.metricCard}>
          <div className={styles.metricCardHeader}>
            <span className={styles.cardLabel}>Delivery Forecast</span>
            <RiCalendarLine size={13} color="var(--text-3)" />
          </div>
          {deliveryWeeks != null ? (
            <>
              <div className={styles.forecastNumber} style={{ color: deliveryWeeks <= 4 ? "var(--green)" : deliveryWeeks <= 8 ? "var(--amber)" : "var(--red)" }}>
                ~{deliveryWeeks}w
              </div>
              <div className={styles.forecastLabel}>at current sprint pace</div>
              <div className={styles.forecastSub}>
                {project.sprints.filter(s => s.status === "completed").length} sprints done ·{" "}
                {project.sprints.filter(s => s.status !== "completed").length} remaining
              </div>
            </>
          ) : (
            <div className={styles.forecastLabel} style={{ color: "var(--text-3)", marginTop: 8 }}>Not enough sprint data</div>
          )}
        </div>

        {/* Cross-project comparison */}
        <div className={styles.metricCard}>
          <div className={styles.metricCardHeader}>
            <span className={styles.cardLabel}>vs All Spaces</span>
            <EOSBadge />
          </div>
          {healthDiff != null ? (
            <>
              <div className={styles.comparisonScore}>
                <span className={styles.comparisonVal} style={{ color: healthDiff >= 0 ? "var(--green)" : "var(--red)" }}>
                  {healthDiff >= 0 ? <RiArrowUpLine size={14} /> : <RiArrowDownLine size={14} />}
                  {Math.abs(healthDiff)} pts
                </span>
                <span className={styles.comparisonLbl}>{healthDiff >= 0 ? "above" : "below"} avg</span>
              </div>
              <div className={styles.forecastSub}>
                Avg health across {totalPods} spaces: <strong>{avgHealth}</strong>
              </div>
              <div className={styles.comparisonBar}>
                <div className={styles.comparisonBarFill} style={{ width: `${avgHealth}%`, background: "var(--surface-3)" }} />
                <div className={styles.comparisonBarThis} style={{ width: `${healthScore}%`, background: project.color }} />
              </div>
              <div className={styles.comparisonBarLabels}>
                <span>avg {avgHealth}</span>
                <span style={{ color: project.color }}>this {healthScore}</span>
              </div>
            </>
          ) : (
            <div className={styles.forecastLabel} style={{ color: "var(--text-3)", marginTop: 8 }}>
              {podSummaryQuery.isPending ? "Loading…" : "Only one space"}
            </div>
          )}
        </div>

      </div>

      {/* ── KPI Pills ── */}
      <SummaryKPIStrip kpis={kpis} allTasksCount={allTasks.length} sprintsCount={project.sprints.length} />

      {/* ── Charts row: Activity + Workload ── */}
      <div className={styles.chartsRow}>
        <div className={styles.chartCard}>
          <div className={styles.chartCardHeader}>
            <span className={styles.cardLabel}>Weekly Activity</span>
            <RiTimeLine size={13} color="var(--text-3)" />
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={activityData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`actGrad-${project.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={project.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={project.color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--text-3)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} allowDecimals={false} />
              <ReTooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="tasks" stroke={project.color} strokeWidth={2} fill={`url(#actGrad-${project.key})`} dot={{ fill: project.color, strokeWidth: 0, r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartCardHeader}>
            <span className={styles.cardLabel}>Team Workload</span>
            <RiTeamLine size={13} color="var(--text-3)" />
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={workloadData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-3)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} allowDecimals={false} />
              <ReTooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="done" fill="var(--green)" stackId="a" maxBarSize={28} name="Done" />
              <Bar dataKey="inProgress" fill="var(--amber)" stackId="a" maxBarSize={28} name="In Progress" />
              <Bar dataKey="todo" fill="var(--surface-3)" stackId="a" radius={[3,3,0,0]} maxBarSize={28} name="To Do" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Risk indicators */}
        <div className={styles.chartCard}>
          <div className={styles.chartCardHeader}>
            <span className={styles.cardLabel}>Risk Indicators</span>
            <EOSBadge />
          </div>
          <div className={styles.riskList}>
            {riskFlags.map((r) => {
              const c = r.risk === "high" ? "var(--red)" : r.risk === "medium" ? "var(--amber)" : "var(--green)";
              const pct = r.max > 0 ? Math.round((r.value / r.max) * 100) : 0;
              return (
                <div key={r.label} className={styles.riskItem}>
                  <div className={styles.riskItemHeader}>
                    <span className={styles.riskItemLabel}>{r.label}</span>
                    <span className={styles.riskItemBadge} style={{ color: c, background: `${c}18` }}>{r.risk.toUpperCase()}</span>
                  </div>
                  <LinearProgress variant="determinate" value={pct} sx={{ height: 5, borderRadius: 100, backgroundColor: "var(--surface-2)", "& .MuiLinearProgress-bar": { background: c, borderRadius: 100 } }} />
                  <span className={styles.riskItemVal}>{r.value} / {r.max}</span>
                </div>
              );
            })}
          </div>
          {/* Member breakdown */}
          <div className={styles.memberList}>
            {project.members
              .map(m => {
                const mTasks      = allTasks.filter(t => t.assignee === m.name);
                const mDone       = mTasks.filter(t => t.status === "Done").length;
                const mInProgress = mTasks.filter(t => t.status === "In Progress").length;
                const mPct        = mTasks.length > 0 ? Math.round((mDone / mTasks.length) * 100) : 0;
                return { m, mTasks, mDone, mInProgress, mPct };
              })
              .sort((a, b) => b.mInProgress - a.mInProgress)
              .slice(0, 4)
              .map(({ m, mTasks, mInProgress, mPct }) => {
                const isBottleneck = bottleneckMember === m.name;
                const avgLoad = allTasks.length / Math.max(project.members.length, 1);
                const overloaded = mTasks.length > avgLoad * 1.4;
                return (
                  <div key={m.id} className={styles.memberRow}>
                    <div className={styles.memberAvatar} style={{ background: m.color }}>{m.initials}</div>
                    <div className={styles.memberInfo}>
                      <span className={styles.memberName}>{m.name.split(" ")[0]}</span>
                      {isBottleneck && (
                        <span className={styles.bottleneckBadge}><RiUserLine size={9} /> Bottleneck</span>
                      )}
                      {!isBottleneck && overloaded && (
                        <span className={styles.overloadedBadge}><RiAlertLine size={9} /> Overloaded</span>
                      )}
                    </div>
                    <span className={styles.memberInProgress}>{mInProgress} WIP</span>
                    <span className={styles.memberPct} style={{ color: project.color }}>{mPct}%</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* ── Sprint progress ── */}
      <div className={styles.sprintProgressCard}>
        <div className={styles.chartCardHeader}>
          <span className={styles.cardLabel}>Sprint Progress</span>
          <span style={{ fontSize: "0.76rem", color: "var(--text-3)" }}>{project.sprints.length} sprints</span>
        </div>
        {project.sprints.map((s) => {
          const pct = s.totalPoints > 0 ? Math.round((s.donePoints / s.totalPoints) * 100) : 0;
          return (
            <div key={s.id} className={styles.sprintRow}>
              <div className={styles.sprintRowLeft}>
                <span className={styles.sprintStatusDot} style={{ background: s.status === "active" ? "var(--accent)" : s.status === "completed" ? "var(--green)" : "var(--amber)" }} />
                <span className={styles.sprintName}>{s.name}</span>
              </div>
              <LinearProgress variant="determinate" value={pct} sx={{ flex: 1, height: 6, borderRadius: 100, backgroundColor: "var(--surface-2)", "& .MuiLinearProgress-bar": { background: `linear-gradient(90deg, ${project.color}, ${project.color}aa)`, borderRadius: 100 } }} />
              <span className={styles.sprintPct} style={{ color: project.color }}>{pct}%</span>
              <span className={styles.sprintPts}>{s.donePoints}/{s.totalPoints}pts</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
