import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { novaQuery } from "@/services/api";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, Tooltip as ReTooltip, ResponsiveContainer,
} from "recharts";
import LinearProgress from "@mui/material/LinearProgress";
import {
  RiSparklingLine, RiAlertLine, RiCheckLine,
  RiCloseLine, RiRefreshLine, RiBarChartBoxLine,
  RiTimeLine, RiTeamLine, RiLightbulbLine,
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

  /* ── Health score & radar ── */
  const radarData = useMemo(() => {
    const bugCount    = allTasks.filter((t) => t.type === "Bug").length;
    const doneRate    = allTasks.length > 0 ? Math.round((kpis.done / allTasks.length) * 100) : 0;
    const blockedRate = allTasks.length > 0 ? Math.round((1 - kpis.blocked / allTasks.length) * 100) : 100;
    const overduePen  = allTasks.length > 0 ? Math.max(0, Math.round((1 - (kpis.overdue / allTasks.length) * 2) * 100)) : 100;
    const velocity    = Math.min(100, Math.round(project.progress + 10));
    const momentum    = Math.min(100, project.weeklyActivity.reduce((s, v) => s + v, 0) * 3);
    const quality     = Math.round((1 - bugCount / Math.max(allTasks.length, 1)) * 100);
    return [
      { metric: "Delivery",  score: doneRate },
      { metric: "Velocity",  score: velocity },
      { metric: "Clarity",   score: 72 },
      { metric: "Momentum",  score: momentum },
      { metric: "Flow",      score: blockedRate },
      { metric: "Quality",   score: quality },
      { metric: "On-Time",   score: overduePen },
    ];
  }, [allTasks, kpis, project]);

  const healthScore = Math.round(radarData.reduce((s, d) => s + d.score, 0) / radarData.length);
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

  /* ── EOS Project Brief (streaming-style via novaQuery) ── */
  const briefPrompt = useMemo(() => {
    const activeSprint = project.sprints.find((s) => s.status === "active");
    const bugCount = allTasks.filter((t) => t.type === "Bug").length;
    return `Write a 2-sentence executive brief for project "${project.key}": Health score ${healthScore}/100, ${kpis.done}/${kpis.total} tasks done, ${kpis.blocked} blocked, ${kpis.overdue} overdue, ${bugCount} bugs, ${project.progress}% overall progress. Active sprint: ${activeSprint?.name ?? "none"}. Be direct and specific. Start with the most important signal.`;
  }, [project, kpis, allTasks, healthScore]);

  const brief = useQuery({
    queryKey: ["eos-brief", project.key],
    queryFn: () => novaQuery(briefPrompt),
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });

  /* ── EOS Insight Cards (3 fixed types) ── */
  const insightPrompt = useMemo(() => {
    const top = [...workloadData].sort((a, b) => b.total - a.total)[0];
    const bugCount = allTasks.filter((t) => t.type === "Bug").length;
    return `Analyze project "${project.key}" and give exactly 3 insights — one velocity signal, one risk signal, one recommendation.
Stats: ${kpis.total} tasks, ${kpis.done} done, ${kpis.blocked} blocked, ${kpis.overdue} overdue, ${bugCount} bugs, ${project.progress}% progress.
Top engineer: ${top?.name ?? "N/A"} (${top?.total ?? 0} tasks).
Format: each line starts with "VELOCITY:", "RISK:", or "REC:" then a space then the insight (max 90 chars each).`;
  }, [project, kpis, allTasks, workloadData]);

  const insights = useQuery({
    queryKey: ["eos-insights", project.key],
    queryFn: () => novaQuery(insightPrompt),
    staleTime: 1000 * 60 * 20,
    retry: 1,
  });

  const parsedInsights = useMemo(() => {
    if (!insights.data) return null;
    const lines = insights.data.answer.split("\n").map((l) => l.trim()).filter(Boolean);
    const get = (prefix: string) => lines.find((l) => l.startsWith(prefix))?.replace(prefix, "").trim() ?? null;
    return {
      velocity: get("VELOCITY:"),
      risk:     get("RISK:"),
      rec:      get("REC:"),
    };
  }, [insights.data]);

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
              {brief.isPending && <span className={styles.briefLoading}>EOS is analysing {project.key}…</span>}
              {brief.data && <span>{brief.data.answer.split("\n").slice(0, 2).join(" ")}</span>}
              {brief.isError && <span className={styles.briefLoading}>Could not load EOS brief.</span>}
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
            {insights.isPending ? <span className={styles.insightLoading}>EOS analysing…</span>
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
            {insights.isPending ? <span className={styles.insightLoading}>EOS analysing…</span>
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
            {insights.isPending ? <span className={styles.insightLoading}>EOS analysing…</span>
              : parsedInsights?.rec ?? "Keep momentum — protect team focus and avoid mid-sprint scope changes."}
          </p>
          <button
            className={styles.insightRefresh}
            onClick={() => qc.invalidateQueries({ queryKey: ["eos-insights", project.key] })}
            title="Refresh EOS insights"
          >
            <RiRefreshLine size={12} /> Refresh
          </button>
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
            {project.members.slice(0, 4).map((m) => {
              const mTasks = allTasks.filter((t) => t.assignee === m.name);
              const mDone  = mTasks.filter((t) => t.status === "Done").length;
              const mPct   = mTasks.length > 0 ? Math.round((mDone / mTasks.length) * 100) : 0;
              const overloaded = mTasks.length > (allTasks.length / Math.max(project.members.length, 1)) * 1.4;
              return (
                <div key={m.id} className={styles.memberRow}>
                  <div className={styles.memberAvatar} style={{ background: m.color }}>{m.initials}</div>
                  <div className={styles.memberInfo}>
                    <span className={styles.memberName}>{m.name.split(" ")[0]}</span>
                    {overloaded && <span className={styles.overloadedBadge}><RiAlertLine size={9} /> Overloaded</span>}
                  </div>
                  <span className={styles.memberPct} style={{ color: project.color }}>{mPct}%</span>
                  <span className={styles.memberTasks}>{mTasks.length}t</span>
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
