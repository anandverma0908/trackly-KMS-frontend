import { useMemo } from "react";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";
import { useQuery } from "@tanstack/react-query";
import { novaQuery } from "@/services/api";
import type { Project, ProjectEpic, ProjectSprint } from "../spacesData";
import styles from "./RoadmapTab.module.css";

import { RiCalendarLine, RiHistoryLine, RiSparklingLine, RiAlertLine } from "react-icons/ri";

type _ViewMode = "quarter" | "month";

function parseDate(s: string) { return new Date(s); }

function monthsBetween(start: Date, end: Date) {
  return (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) + 1;
}

function formatMonth(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function dateToPct(date: Date, start: Date, totalMs: number) {
  return ((date.getTime() - start.getTime()) / totalMs) * 100;
}

export default function RoadmapTab({ project }: { project: Project }) {
  const _viewMode: _ViewMode = "quarter"; void _viewMode;

  /* ── EOS: detect at-risk epics ── */
  const atRiskEpics = useMemo(() => {
    const now = new Date();
    return project.epics.filter((e) => {
      const end = parseDate(e.endDate);
      const start = parseDate(e.startDate);
      const totalDays = Math.max(1, (end.getTime() - start.getTime()) / 86_400_000);
      const elapsed = (now.getTime() - start.getTime()) / 86_400_000;
      const expectedProgress = Math.min(100, (elapsed / totalDays) * 100);
      return end > now && e.progress < expectedProgress - 15;
    });
  }, [project.epics]);

  const overdueEpics = useMemo(() =>
    project.epics.filter((e) => parseDate(e.endDate) < new Date() && e.progress < 100),
    [project.epics]
  );

  /* ── EOS narrative ── */
  const narrativePrompt = useMemo(() => {
    const completedSprints = project.sprints.filter((s) => s.status === "completed").length;
    const activeSprint = project.sprints.find((s) => s.status === "active");
    return `Give a one-sentence project timeline assessment for "${project.key}": ${project.progress}% overall, ${completedSprints} sprints done, ${atRiskEpics.length} epics at risk, ${overdueEpics.length} overdue. Active sprint: ${activeSprint?.name ?? "none"}. Start with ✦ EOS:`;
  }, [project, atRiskEpics.length, overdueEpics.length]);

  const narrative = useQuery({
    queryKey: ["roadmap-narrative", project.key],
    queryFn: () => novaQuery(narrativePrompt),
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });

  // Timeline bounds: project start → max(epic end, sprint end) + buffer
  const timeStart = useMemo(() => {
    const d = parseDate(project.startDate);
    d.setDate(1);
    return d;
  }, [project.startDate]);

  const timeEnd = useMemo(() => {
    const dates = [
      ...project.epics.map(e => parseDate(e.endDate)),
      ...project.sprints.map(s => parseDate(s.endDate)),
    ];
    const max = dates.reduce((a, b) => (a > b ? a : b), parseDate(project.startDate));
    max.setMonth(max.getMonth() + 2);
    max.setDate(1);
    return max;
  }, [project]);

  const totalMs    = timeEnd.getTime() - timeStart.getTime();
  const numMonths  = monthsBetween(timeStart, timeEnd);

  // Build month columns
  const months = useMemo(() => {
    const result: { date: Date; label: string }[] = [];
    const cur = new Date(timeStart);
    for (let i = 0; i < numMonths; i++) {
      result.push({ date: new Date(cur), label: formatMonth(cur) });
      cur.setMonth(cur.getMonth() + 1);
    }
    return result;
  }, [timeStart, numMonths]);

  // Today line position
  const todayPct = useMemo(() => {
    const now = new Date();
    if (now < timeStart) return 0;
    if (now > timeEnd)   return 100;
    return dateToPct(now, timeStart, totalMs);
  }, [timeStart, timeEnd, totalMs]);

  // Epic bar positions
  function epicBar(epic: ProjectEpic) {
    const s = Math.max(0, dateToPct(parseDate(epic.startDate), timeStart, totalMs));
    const e = Math.min(100, dateToPct(parseDate(epic.endDate), timeStart, totalMs));
    return { left: `${s}%`, width: `${Math.max(e - s, 1)}%` };
  }

  // Sprint bar positions
  function sprintBar(sprint: ProjectSprint) {
    const s = Math.max(0, dateToPct(parseDate(sprint.startDate), timeStart, totalMs));
    const e = Math.min(100, dateToPct(parseDate(sprint.endDate), timeStart, totalMs));
    return { left: `${s}%`, width: `${Math.max(e - s, 1)}%` };
  }

  const statusColors: Record<ProjectSprint["status"], string> = {
    planning:  "var(--amber)",
    active:    "var(--green)",
    completed: "var(--accent)",
  };

  return (
    <div className={styles.tab}>

      {/* ── EOS Narrative Bar ── */}
      <div className={styles.eosBar}>
        <RiSparklingLine size={13} color="var(--accent)" />
        {narrative.isPending && <span className={styles.eosBarText} style={{ color: "var(--text-3)" }}>EOS is analysing project timeline…</span>}
        {narrative.data && <span className={styles.eosBarText}>{narrative.data.answer.split("\n")[0]}</span>}
        {!narrative.isPending && !narrative.data && <span className={styles.eosBarText} style={{ color: "var(--text-3)" }}>EOS timeline intelligence</span>}
        <span className={styles.eosBadge}><RiSparklingLine size={9} /> EOS</span>
      </div>

      {/* ── EOS Risk Alerts ── */}
      {(atRiskEpics.length > 0 || overdueEpics.length > 0) && (
        <div className={styles.riskAlerts}>
          {overdueEpics.map((e) => (
            <div key={e.id} className={styles.riskAlert} style={{ borderLeftColor: "var(--red)" }}>
              <RiAlertLine size={13} color="var(--red)" />
              <span><strong>{e.title}</strong> is overdue ({e.progress}% complete) — deadline passed.</span>
            </div>
          ))}
          {atRiskEpics.map((e) => (
            <div key={e.id} className={styles.riskAlert} style={{ borderLeftColor: "var(--amber)" }}>
              <RiAlertLine size={13} color="var(--amber)" />
              <span><strong>{e.title}</strong> is behind schedule ({e.progress}% complete, expected further along).</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <RiHistoryLine size={16} color="var(--accent)" />
          <span className={styles.headerTitle}>Project Roadmap</span>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.legendItem}>
            <div className={styles.legendDot} style={{ background: "var(--accent)" }} />
            <span>Epic</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendDot} style={{ background: "var(--green)" }} />
            <span>Active Sprint</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendDot} style={{ background: "var(--amber)" }} />
            <span>Planned</span>
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className={styles.summaryRow}>
        <div className={styles.summaryCard}>
          <RiCalendarLine size={14} color="var(--accent)" />
          <div>
            <div className={styles.summaryVal}>
              {new Date(project.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
            <div className={styles.summaryLbl}>Start Date</div>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <span style={{ fontSize: 14 }}>🏁</span>
          <div>
            <div className={styles.summaryVal}>{project.epics.length}</div>
            <div className={styles.summaryLbl}>Epics</div>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <span style={{ fontSize: 14 }}>🔁</span>
          <div>
            <div className={styles.summaryVal}>{project.sprints.length}</div>
            <div className={styles.summaryLbl}>Sprints</div>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <span style={{ fontSize: 14 }}>📈</span>
          <div>
            <div className={styles.summaryVal}>{project.progress}%</div>
            <div className={styles.summaryLbl}>Overall Progress</div>
          </div>
        </div>
      </div>

      {/* ── Gantt chart ── */}
      <div className={styles.ganttWrap}>
        {/* Row labels column */}
        <div className={styles.labelsCol}>
          <div className={styles.labelsHeader}>Timeline</div>
          <div className={styles.labelSection}>
            <div className={styles.sectionLabel}>EPICS</div>
            {project.epics.map((epic) => (
              <div key={epic.id} className={styles.rowLabel}>
                <div className={styles.epicDot} style={{ background: epic.color }} />
                <span>{epic.title}</span>
              </div>
            ))}
          </div>
          <div className={styles.labelSection}>
            <div className={styles.sectionLabel}>SPRINTS</div>
            {project.sprints.map((sprint) => (
              <div key={sprint.id} className={styles.rowLabel}>
                <div className={styles.sprintDot} style={{ background: statusColors[sprint.status] }} />
                <span>{sprint.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart area */}
        <div className={styles.chartArea}>
          {/* Month headers */}
          <div className={styles.monthHeaders}>
            {months.map((m, i) => (
              <div
                key={i}
                className={styles.monthHeader}
                style={{ flex: 1 }}
              >
                {m.label}
              </div>
            ))}
          </div>

          {/* Grid + bars */}
          <div className={styles.chartBody}>
            {/* Vertical month grid lines */}
            {months.map((_, i) => (
              <div
                key={i}
                className={styles.gridLine}
                style={{ left: `${(i / numMonths) * 100}%` }}
              />
            ))}

            {/* Today line */}
            <div
              className={styles.todayLine}
              style={{ left: `${todayPct}%` }}
            >
              <div className={styles.todayLabel}>Today</div>
            </div>

            {/* Epics section */}
            <div className={styles.chartSection}>
              <div className={styles.chartSectionLabel}>EPICS</div>
              {project.epics.map((epic) => {
                const bar = epicBar(epic);
                return (
                  <div key={epic.id} className={styles.chartRow}>
                    <Tooltip
                      title={
                        <div>
                          <b>{epic.title}</b><br />
                          {epic.startDate} → {epic.endDate}<br />
                          {epic.completed}/{epic.tasks} tasks · {epic.progress}% done
                        </div>
                      }
                      arrow
                    >
                      <div
                        className={styles.epicBar}
                        style={{
                          left: bar.left,
                          width: bar.width,
                          background: epic.color,
                        }}
                      >
                        <div
                          className={styles.epicBarFill}
                          style={{
                            width: `${epic.progress}%`,
                            background: `${epic.color}cc`,
                          }}
                        />
                        <span className={styles.barLabel}>{epic.title}</span>
                      </div>
                    </Tooltip>
                  </div>
                );
              })}
            </div>

            {/* Sprints section */}
            <div className={styles.chartSection}>
              <div className={styles.chartSectionLabel}>SPRINTS</div>
              {project.sprints.map((sprint) => {
                const bar = sprintBar(sprint);
                const sprintColor = statusColors[sprint.status];
                const pct = sprint.totalPoints > 0
                  ? Math.round((sprint.donePoints / sprint.totalPoints) * 100)
                  : 0;
                return (
                  <div key={sprint.id} className={styles.chartRow}>
                    <Tooltip
                      title={
                        <div>
                          <b>{sprint.name}</b><br />
                          {sprint.startDate} → {sprint.endDate}<br />
                          {sprint.donePoints}/{sprint.totalPoints} pts · {pct}% done<br />
                          Goal: {sprint.goal}
                        </div>
                      }
                      arrow
                    >
                      <div
                        className={styles.sprintBar}
                        style={{
                          left: bar.left,
                          width: bar.width,
                          borderColor: sprintColor,
                        }}
                      >
                        <div
                          className={styles.sprintBarFill}
                          style={{
                            width: `${pct}%`,
                            background: `${sprintColor}55`,
                          }}
                        />
                        <span className={styles.barLabel}>{sprint.name}</span>
                      </div>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Epic detail cards ── */}
      <div className={styles.epicCards}>
        <div className={styles.epicCardsTitle}>Epic Breakdown</div>
        <div className={styles.epicCardGrid}>
          {project.epics.map((epic) => {
            const isOverdue = overdueEpics.some((e) => e.id === epic.id);
            const isAtRisk  = atRiskEpics.some((e) => e.id === epic.id);
            return (
            <div key={epic.id} className={`${styles.epicCard} ${isOverdue ? styles.epicCardOverdue : isAtRisk ? styles.epicCardAtRisk : ""}`}>
              <div className={styles.epicCardTop}>
                <div className={styles.epicColorBar} style={{ background: epic.color }} />
                <div className={styles.epicCardInfo}>
                  <div className={styles.epicCardTitle}>
                    {epic.title}
                    {isOverdue && <span className={styles.epicRiskBadge} style={{ color: "var(--red)", borderColor: "var(--red)", background: "var(--red-glow, rgba(248,113,113,0.1))" }}>Overdue</span>}
                    {!isOverdue && isAtRisk && <span className={styles.epicRiskBadge} style={{ color: "var(--amber)", borderColor: "var(--amber)", background: "rgba(251,191,36,0.1)" }}>At Risk</span>}
                  </div>
                  <div className={styles.epicCardDates}>
                    {epic.startDate} → {epic.endDate}
                  </div>
                </div>
                <div className={styles.epicCardPct} style={{ color: epic.color }}>
                  {epic.progress}%
                </div>
              </div>
              <LinearProgress
                variant="determinate"
                value={epic.progress}
                sx={{
                  height: 4,
                  borderRadius: 100,
                  backgroundColor: "var(--surface-2)",
                  "& .MuiLinearProgress-bar": {
                    background: epic.color,
                    borderRadius: 100,
                  },
                }}
              />
              <div className={styles.epicCardStats}>
                <span>{epic.completed}/{epic.tasks} tasks done</span>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
