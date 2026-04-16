import { useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar,
} from "recharts";
import LinearProgress from "@mui/material/LinearProgress";
import type { Project, ProjectTask } from "../spacesData";
import styles from "./SummaryTab.module.css";

import { RiArrowUpLine, RiFlashlightLine, RiShieldCheckLine, RiLightbulbFlashLine } from "react-icons/ri";
import SummaryKPIStrip from "./SummaryKPIStrip";

/* ── Custom pie label ── */
const RADIAN = Math.PI / 180;
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null;
  const r  = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x  = cx + r * Math.cos(-midAngle * RADIAN);
  const y  = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
      fontSize={10} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function SummaryTab({ project }: { project: Project }) {
  const allTasks: ProjectTask[] = useMemo(
    () => project.sprints.flatMap(s => s.tasks),
    [project]
  );

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const total     = allTasks.length;
    const done      = allTasks.filter(t => t.status === "Done").length;
    const blocked   = allTasks.filter(t => t.status === "Blocked").length;
    const overdue   = allTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "Done").length;
    const updated   = allTasks.filter(t => t.updatedAt >= "2025-04-01").length;
    return { total, done, blocked, overdue, updated };
  }, [allTasks]);

  /* ── Status distribution ── */
  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    allTasks.forEach(t => { map[t.status] = (map[t.status] ?? 0) + 1; });
    const colors: Record<string, string> = {
      "To Do":       "#606060",
      "In Progress": "#FBBF24",
      "In Review":   "#A78BFA",
      "Blocked":     "#F87171",
      "Done":        "#34D399",
    };
    return Object.entries(map).map(([name, value]) => ({
      name, value, color: colors[name] ?? "#4F7EFF",
    }));
  }, [allTasks]);

  /* ── Priority distribution ── */
  const priorityData = useMemo(() => {
    const map: Record<string, number> = {};
    allTasks.forEach(t => { map[t.priority] = (map[t.priority] ?? 0) + 1; });
    const colors: Record<string, string> = {
      Critical: "#F87171",
      High:     "#FBBF24",
      Medium:   "#4F7EFF",
      Low:      "#606060",
    };
    return Object.entries(map).map(([name, value]) => ({
      name, value, color: colors[name] ?? "#4F7EFF",
    }));
  }, [allTasks]);

  /* ── Weekly activity (7 days from project) ── */
  const activityData = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return project.weeklyActivity.map((v, i) => ({ day: days[i], tasks: v }));
  }, [project]);

  /* ── Sprint progress ── */
  const sprintProgressData = useMemo(() => {
    return project.sprints.map(s => ({
      name:       s.name.split("—")[0].trim(),
      done:       s.donePoints,
      remaining:  s.totalPoints - s.donePoints,
      total:      s.totalPoints,
      pct:        Math.round((s.donePoints / Math.max(s.totalPoints, 1)) * 100),
    }));
  }, [project]);

  /* ── Type breakdown ── */
  const typeData = useMemo(() => {
    const map: Record<string, number> = {};
    allTasks.forEach(t => { map[t.type] = (map[t.type] ?? 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [allTasks]);

  /* ── Team workload ── */
  const workloadData = useMemo(() => {
    const map: Record<string, { done: number; inProgress: number; todo: number }> = {};
    allTasks.forEach(t => {
      const who = t.assignee || "—";
      if (!map[who]) map[who] = { done: 0, inProgress: 0, todo: 0 };
      if (t.status === "Done")         map[who].done++;
      else if (t.status === "In Progress") map[who].inProgress++;
      else                             map[who].todo++;
    });
    return Object.entries(map).map(([name, v]) => ({
      name: name.split(" ")[0],
      ...v,
      total: v.done + v.inProgress + v.todo,
    })).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [allTasks]);

  /* ── Health score ── */
  const healthScore = useMemo(() => {
    const doneRate   = allTasks.length > 0 ? kpis.done / allTasks.length : 0;
    const blockedRate = allTasks.length > 0 ? 1 - (kpis.blocked / allTasks.length) : 1;
    const overduePenalty = allTasks.length > 0 ? 1 - (kpis.overdue / allTasks.length) * 2 : 1;
    const velocityScore  = Math.min(project.progress / 100 + 0.1, 1);
    return {
      doneRate:     Math.round(doneRate * 100),
      blockedRate:  Math.round(blockedRate * 100),
      overdueRate:  Math.round(Math.max(overduePenalty, 0) * 100),
      velocity:     Math.round(velocityScore * 100),
    };
  }, [allTasks, kpis, project.progress]);

  /* ── Radar data (team health dimensions) ── */
  const radarData = [
    { metric: "Delivery",   score: healthScore.doneRate },
    { metric: "Velocity",   score: healthScore.velocity },
    { metric: "Clarity",    score: 72 },
    { metric: "Momentum",   score: Math.min(project.weeklyActivity.reduce((s,v)=>s+v,0) * 3, 100) },
    { metric: "Flow",       score: healthScore.blockedRate },
    { metric: "Quality",    score: Math.round((1 - allTasks.filter(t=>t.type==="Bug").length / Math.max(allTasks.length,1)) * 100) },
  ];

  const overallHealth = Math.round(
    radarData.reduce((s, d) => s + d.score, 0) / radarData.length
  );

  return (
    <div className={styles.tab}>
      {/* ── KPI Row ── */}
      <div className={styles.kpiRow}>
        <SummaryKPIStrip
          kpis={kpis}
          allTasksCount={allTasks.length}
          sprintsCount={project.sprints.length}
        />
      </div>

      {/* ── Row 2: Status Pie + Priority Pie + Activity ── */}
      <div className={styles.row2}>
        {/* Status pie */}
        <div className={styles.chartCard}>
          <div className={styles.cardTitle}>Status Overview</div>
          <div className={styles.pieWrap}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={40}
                  dataKey="value"
                  labelLine={false}
                  label={PieLabel}
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <ReTooltip
                  contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number, name: string) => [`${value} tasks`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.pieLegend}>
            {statusData.map((d) => (
              <div key={d.name} className={styles.legendRow}>
                <div className={styles.legendDot} style={{ background: d.color }} />
                <span className={styles.legendName}>{d.name}</span>
                <span className={styles.legendVal}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Priority pie */}
        <div className={styles.chartCard}>
          <div className={styles.cardTitle}>Priority Breakdown</div>
          <div className={styles.pieWrap}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={priorityData}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={40}
                  dataKey="value"
                  labelLine={false}
                  label={PieLabel}
                >
                  {priorityData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <ReTooltip
                  contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.pieLegend}>
            {priorityData.map((d) => (
              <div key={d.name} className={styles.legendRow}>
                <div className={styles.legendDot} style={{ background: d.color }} />
                <span className={styles.legendName}>{d.name}</span>
                <span className={styles.legendVal}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly activity area chart */}
        <div className={styles.chartCard}>
          <div className={styles.cardTitle}>Weekly Activity</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={project.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={project.color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--text-3)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} allowDecimals={false} />
              <ReTooltip
                contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: 8, fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="tasks"
                stroke={project.color}
                strokeWidth={2}
                fill="url(#actGrad)"
                dot={{ fill: project.color, strokeWidth: 0, r: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 3: Sprint progress + Team workload ── */}
      <div className={styles.row3}>
        {/* Sprint progress */}
        <div className={styles.chartCardWide}>
          <div className={styles.cardTitle}>Sprint Progress</div>
          {sprintProgressData.map((s) => (
            <div key={s.name} className={styles.sprintRow}>
              <div className={styles.sprintName}>{s.name}</div>
              <LinearProgress
                variant="determinate"
                value={s.pct}
                sx={{
                  flex: 1,
                  height: 8,
                  borderRadius: 100,
                  backgroundColor: "var(--surface-2)",
                  "& .MuiLinearProgress-bar": {
                    background: `linear-gradient(90deg, ${project.color}, ${project.color}aa)`,
                    borderRadius: 100,
                  },
                }}
              />
              <div className={styles.sprintPct} style={{ color: project.color }}>{s.pct}%</div>
              <div className={styles.sprintPts}>{s.done}/{s.total} pts</div>
            </div>
          ))}

          {/* Type distribution bar */}
          <div className={styles.cardTitle} style={{ marginTop: 20 }}>Issue Type Distribution</div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={typeData} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-3)" }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--text-2)" }} width={55} />
              <ReTooltip
                contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="value" fill={project.color} radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Team workload */}
        <div className={styles.chartCardWide}>
          <div className={styles.cardTitle}>Team Workload</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={workloadData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-3)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} allowDecimals={false} />
              <ReTooltip
                contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="done" fill="var(--green)" radius={[0,0,0,0]} stackId="a" maxBarSize={30} name="Done" />
              <Bar dataKey="inProgress" fill="var(--amber)" stackId="a" maxBarSize={30} name="In Progress" />
              <Bar dataKey="todo" fill="var(--surface-3)" stackId="a" radius={[3,3,0,0]} maxBarSize={30} name="To Do" />
            </BarChart>
          </ResponsiveContainer>

          {/* Member list */}
          <div className={styles.memberList}>
            {project.members.map((m) => {
              const mTasks = allTasks.filter(t => t.assignee === m.name);
              const mDone  = mTasks.filter(t => t.status === "Done").length;
              const mPct   = mTasks.length > 0 ? Math.round((mDone / mTasks.length) * 100) : 0;
              return (
                <div key={m.id} className={styles.memberRow}>
                  <div className={styles.memberAvatarSm} style={{ background: m.color }}>{m.initials}</div>
                  <div className={styles.memberInfo}>
                    <div className={styles.memberName}>{m.name}</div>
                    <div className={styles.memberRole}>{m.role}</div>
                  </div>
                  <div className={styles.memberPct} style={{ color: project.color }}>{mPct}%</div>
                  <div className={styles.memberTasks}>{mTasks.length} tasks</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Row 4: Health Radar + Insights + Risk Flags ── */}
      <div className={styles.row4}>
        {/* Project health radar */}
        <div className={styles.chartCard}>
          <div className={styles.cardTitleRow}>
            <div className={styles.cardTitle}>Project Health Score</div>
            <div
              className={styles.healthScore}
              style={{
                color: overallHealth >= 70 ? "var(--green)" : overallHealth >= 50 ? "var(--amber)" : "var(--red)",
              }}
            >
              {overallHealth}
              <span className={styles.healthScoreUnit}>/100</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border-2)" />
              <PolarAngleAxis
                dataKey="metric"
                tick={{ fontSize: 10, fill: "var(--text-2)" }}
              />
              <Radar
                dataKey="score"
                stroke={project.color}
                fill={project.color}
                fillOpacity={0.25}
                strokeWidth={2}
              />
              <ReTooltip
                contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [`${v}/100`, ""]}
              />
            </RadarChart>
          </ResponsiveContainer>
          <div className={styles.radarDimensions}>
            {radarData.map((d) => (
              <div key={d.metric} className={styles.radarDim}>
                <span className={styles.radarDimLabel}>{d.metric}</span>
                <div className={styles.radarDimBar}>
                  <div
                    className={styles.radarDimFill}
                    style={{
                      width: `${d.score}%`,
                      background: d.score >= 70 ? "var(--green)" : d.score >= 50 ? "var(--amber)" : "var(--red)",
                    }}
                  />
                </div>
                <span className={styles.radarDimVal}>{d.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI-powered insights */}
        <div className={styles.insightsCard}>
          <div className={styles.cardTitleRow}>
            <div className={styles.cardTitle}>
              <span style={{ fontSize: 16, color: "var(--accent)", display: "inline-flex" }}><RiLightbulbFlashLine /></span>
              AI Insights
            </div>
            <span className={styles.aiBadge}>EOS</span>
          </div>
          <div className={styles.insightsList}>
            {[
              {
                icon: <RiArrowUpLine size={14} />,
                color: "var(--green)",
                title: "Velocity on track",
                desc: `Sprint completion rate is ${healthScore.doneRate}% — ahead of historical average for this team.`,
              },
              {
                icon: <RiFlashlightLine size={14} />,
                color: "var(--amber)",
                title: "Scope creep risk",
                desc: `${allTasks.filter(t => t.type === "Bug").length} bugs detected this sprint. Consider a bug bash before next sprint planning.`,
              },
              {
                icon: <RiShieldCheckLine size={14} />,
                color: kpis.blocked > 2 ? "var(--red)" : "var(--green)",
                title: kpis.blocked > 2 ? "Blockers need attention" : "Low blocker count",
                desc: kpis.blocked > 2
                  ? `${kpis.blocked} tasks are currently blocked. Schedule a sync to resolve dependencies.`
                  : "Dependency health looks good. Team is unblocked and moving forward.",
              },
              {
                icon: <RiLightbulbFlashLine size={14} />,
                color: "var(--accent)",
                title: "Knowledge concentration",
                desc: `${workloadData[0]?.name ?? "Top member"} holds ${workloadData[0]?.total ?? 0} tasks — consider load balancing in next sprint.`,
              },
            ].map((insight, i) => (
              <div key={i} className={styles.insightItem}>
                <div className={styles.insightIcon} style={{ color: insight.color, background: `${insight.color}18` }}>
                  {insight.icon}
                </div>
                <div className={styles.insightContent}>
                  <div className={styles.insightTitle}>{insight.title}</div>
                  <div className={styles.insightDesc}>{insight.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk flags */}
        <div className={styles.riskCard}>
          <div className={styles.cardTitle}>Risk Indicators</div>
          <div className={styles.riskList}>
            {[
              {
                label: "Blocked Tasks",
                value: kpis.blocked,
                max: allTasks.length,
                risk: kpis.blocked > 3 ? "high" : kpis.blocked > 1 ? "medium" : "low",
              },
              {
                label: "Overdue Tasks",
                value: kpis.overdue,
                max: allTasks.length,
                risk: kpis.overdue > 2 ? "high" : kpis.overdue > 0 ? "medium" : "low",
              },
              {
                label: "Bug Rate",
                value: allTasks.filter(t => t.type === "Bug").length,
                max: allTasks.length,
                risk: allTasks.filter(t => t.type === "Bug").length > 3 ? "high" : "low",
              },
              {
                label: "Sprint Completion",
                value: project.sprints.filter(s => s.status === "active")[0]?.donePoints ?? 0,
                max: project.sprints.filter(s => s.status === "active")[0]?.totalPoints ?? 1,
                risk: "low",
              },
            ].map((r) => {
              const riskColor = r.risk === "high" ? "var(--red)" : r.risk === "medium" ? "var(--amber)" : "var(--green)";
              const pct = r.max > 0 ? Math.round((r.value / r.max) * 100) : 0;
              return (
                <div key={r.label} className={styles.riskItem}>
                  <div className={styles.riskHeader}>
                    <span className={styles.riskLabel}>{r.label}</span>
                    <span className={styles.riskBadge} style={{ color: riskColor, background: `${riskColor}18` }}>
                      {r.risk.toUpperCase()}
                    </span>
                  </div>
                  <div className={styles.riskBarWrap}>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{
                        flex: 1,
                        height: 6,
                        borderRadius: 100,
                        backgroundColor: "var(--surface-2)",
                        "& .MuiLinearProgress-bar": {
                          background: riskColor,
                          borderRadius: 100,
                        },
                      }}
                    />
                    <span className={styles.riskVal}>{r.value}/{r.max}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick stats grid */}
          <div className={styles.quickStats}>
            <div className={styles.qStat}>
              <div className={styles.qStatVal} style={{ color: "var(--green)" }}>
                {project.sprints.filter(s => s.status === "completed").length}
              </div>
              <div className={styles.qStatLbl}>Completed Sprints</div>
            </div>
            <div className={styles.qStat}>
              <div className={styles.qStatVal} style={{ color: "var(--amber)" }}>
                {project.sprints.filter(s => s.status === "active").length}
              </div>
              <div className={styles.qStatLbl}>Active Sprints</div>
            </div>
            <div className={styles.qStat}>
              <div className={styles.qStatVal}>{project.epics.length}</div>
              <div className={styles.qStatLbl}>Epics</div>
            </div>
            <div className={styles.qStat}>
              <div className={styles.qStatVal} style={{ color: "var(--purple)" }}>
                {allTasks.reduce((s,t)=>s+t.storyPoints,0)}
              </div>
              <div className={styles.qStatLbl}>Total SP</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
