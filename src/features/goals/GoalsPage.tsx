import { useState } from "react";
import { motion } from "framer-motion";
import {
  RiAddLine,
  RiBrainLine,
  RiArrowRightLine,
  RiCheckLine,
  RiAlertLine,
  RiBarChartLine,
  RiFocus3Line,
} from "react-icons/ri";
import styles from "./GoalsPage.module.css";

/* ── Types ─────────────────────────────────────────────────────────────────── */
type GoalStatus = "on_track" | "at_risk" | "behind" | "complete";

interface KeyResult {
  id: string;
  title: string;
  current: number;
  target: number;
  unit: string;
  linkedTickets: string[];
  status: GoalStatus;
}

interface Goal {
  id: string;
  quarter: string;
  title: string;
  description: string;
  owner: string;
  status: GoalStatus;
  overallProgress: number;
  keyResults: KeyResult[];
  novaInsight?: string;
  linkedSprints: string[];
}

/* ── Mock data ─────────────────────────────────────────────────────────────── */
const GOALS: Goal[] = [
  {
    id: "g1",
    quarter: "Q2 2025",
    title: "Reduce API latency by 40%",
    description:
      "Make Trackly feel instant. All API endpoints should respond under 200ms at p99.",
    owner: "Priya S.",
    status: "at_risk",
    overallProgress: 52,
    novaInsight:
      "At current velocity, you will miss this goal by ~2 weeks. TRK-142 (auth token refresh) is on the critical path — resolving it unlocks 3 downstream tickets worth ~8 points.",
    linkedSprints: ["Sprint 8", "Sprint 9"],
    keyResults: [
      {
        id: "kr1",
        title: "p99 latency < 200ms on /api/tickets",
        current: 280,
        target: 200,
        unit: "ms",
        linkedTickets: ["TRK-134", "TRK-141"],
        status: "at_risk",
      },
      {
        id: "kr2",
        title: "Database query time < 50ms avg",
        current: 48,
        target: 50,
        unit: "ms",
        linkedTickets: ["TRK-129"],
        status: "on_track",
      },
      {
        id: "kr3",
        title: "Nova query response < 3s p95",
        current: 2.1,
        target: 3,
        unit: "s",
        linkedTickets: ["TRK-156"],
        status: "on_track",
      },
    ],
  },
  {
    id: "g2",
    quarter: "Q2 2025",
    title: "Nova answers 80% of process questions accurately",
    description:
      "Nova should be the team's first stop for 'how do we do X' questions, not Slack.",
    owner: "Anand V.",
    status: "behind",
    overallProgress: 31,
    novaInsight:
      "Missing structured data is the blocker. Only 5 ADRs and 0 runbooks are currently indexed. Adding Decisions + Processes to the knowledge base would immediately improve accuracy.",
    linkedSprints: ["Sprint 9"],
    keyResults: [
      {
        id: "kr4",
        title: "30+ ADRs in Decisions log",
        current: 5,
        target: 30,
        unit: "records",
        linkedTickets: ["TRK-161"],
        status: "behind",
      },
      {
        id: "kr5",
        title: "10+ runbooks in Processes",
        current: 2,
        target: 10,
        unit: "runbooks",
        linkedTickets: ["TRK-163"],
        status: "behind",
      },
      {
        id: "kr6",
        title: "Nova accuracy score ≥ 80% (internal eval)",
        current: 61,
        target: 80,
        unit: "%",
        linkedTickets: [],
        status: "behind",
      },
    ],
  },
  {
    id: "g3",
    quarter: "Q2 2025",
    title: "Ship duplicate detection + smart routing to 100% of users",
    description:
      "The two biggest AI features that make Trackly feel magical in demos. Must be in production.",
    owner: "Rahul M.",
    status: "on_track",
    overallProgress: 78,
    novaInsight:
      "On track. Backend duplicate detection is complete. Frontend UI for routing is the last piece (TRK-156). At current velocity, this ships in Sprint 9.",
    linkedSprints: ["Sprint 8", "Sprint 9"],
    keyResults: [
      {
        id: "kr7",
        title: "Duplicate detection live banner in create drawer",
        current: 1,
        target: 1,
        unit: "shipped",
        linkedTickets: ["TRK-152"],
        status: "on_track",
      },
      {
        id: "kr8",
        title: "Smart routing UI with explanation",
        current: 0,
        target: 1,
        unit: "shipped",
        linkedTickets: ["TRK-156"],
        status: "at_risk",
      },
      {
        id: "kr9",
        title: "95% uptime for AI features",
        current: 99.1,
        target: 95,
        unit: "%",
        linkedTickets: [],
        status: "complete",
      },
    ],
  },
];

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const statusConfig: Record<GoalStatus, { label: string; className: string; icon: React.ReactNode }> = {
  on_track: { label: "On Track", className: styles.statusOnTrack, icon: <RiCheckLine size={11} /> },
  at_risk: { label: "At Risk", className: styles.statusAtRisk, icon: <RiAlertLine size={11} /> },
  behind: { label: "Behind", className: styles.statusBehind, icon: <RiAlertLine size={11} /> },
  complete: { label: "Complete", className: styles.statusComplete, icon: <RiCheckLine size={11} /> },
};

function KRProgress({ kr }: { kr: KeyResult }) {
  const pct = Math.min(100, Math.round((kr.current / kr.target) * 100));
  const overAchieve = kr.current > kr.target;

  return (
    <div className={styles.krRow}>
      <div className={styles.krHeader}>
        <span className={styles.krTitle}>{kr.title}</span>
        <span className={`${styles.krStatus} ${statusConfig[kr.status].className}`}>
          {statusConfig[kr.status].icon}
          {statusConfig[kr.status].label}
        </span>
      </div>
      <div className={styles.krProgress}>
        <div className={styles.krBar}>
          <motion.div
            className={`${styles.krFill} ${overAchieve ? styles.krFillOver : ""}`}
            style={{
              background:
                kr.status === "on_track" || kr.status === "complete"
                  ? "var(--green)"
                  : kr.status === "at_risk"
                  ? "var(--amber)"
                  : "var(--red)",
            }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(pct, 100)}%` }}
            transition={{ duration: 0.7, delay: 0.2 }}
          />
        </div>
        <span className={styles.krPct}>
          {kr.current}
          {kr.unit} / {kr.target}
          {kr.unit}
        </span>
      </div>
      {kr.linkedTickets.length > 0 && (
        <div className={styles.krTickets}>
          {kr.linkedTickets.map((t) => (
            <span key={t} className={styles.ticketRef}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal, delay }: { goal: Goal; delay: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      className={`${styles.goalCard} ${styles[`goalCard_${goal.status}`]}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      {/* Goal header */}
      <div className={styles.goalHeader} onClick={() => setExpanded(!expanded)}>
        <div className={styles.goalLeft}>
          <span className={styles.goalQuarter}>{goal.quarter}</span>
          <h3 className={styles.goalTitle}>{goal.title}</h3>
          <p className={styles.goalDesc}>{goal.description}</p>
        </div>
        <div className={styles.goalRight}>
          <div className={styles.circleProgress}>
            <svg width="56" height="56" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="22" fill="none" stroke="var(--surface-3)" strokeWidth="5" />
              <motion.circle
                cx="28"
                cy="28"
                r="22"
                fill="none"
                stroke={
                  goal.status === "on_track" || goal.status === "complete"
                    ? "var(--green)"
                    : goal.status === "at_risk"
                    ? "var(--amber)"
                    : "var(--red)"
                }
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 22}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 22 }}
                animate={{
                  strokeDashoffset:
                    2 * Math.PI * 22 * (1 - goal.overallProgress / 100),
                }}
                transition={{ duration: 0.8, delay: delay + 0.2 }}
                style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
              />
            </svg>
            <span className={styles.circleLabel}>{goal.overallProgress}%</span>
          </div>
          <span
            className={`${styles.statusBadge} ${statusConfig[goal.status].className}`}
          >
            {statusConfig[goal.status].icon}
            {statusConfig[goal.status].label}
          </span>
        </div>
      </div>

      {/* Nova insight */}
      {goal.novaInsight && (
        <div className={styles.novaInsight}>
          <RiBrainLine size={13} className={styles.novaIcon} />
          <p>{goal.novaInsight}</p>
        </div>
      )}

      {/* Key results */}
      <button
        className={styles.expandBtn}
        onClick={() => setExpanded(!expanded)}
      >
        <RiBarChartLine size={13} />
        {goal.keyResults.length} key results
        <RiArrowRightLine
          size={12}
          style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "0.15s" }}
        />
      </button>

      {expanded && (
        <motion.div
          className={styles.krList}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          {goal.keyResults.map((kr) => (
            <KRProgress key={kr.id} kr={kr} />
          ))}
        </motion.div>
      )}

      <div className={styles.goalFooter}>
        <span className={styles.goalOwner}>{goal.owner}</span>
        <div className={styles.linkedSprints}>
          {goal.linkedSprints.map((s) => (
            <span key={s} className={styles.sprintChip}>{s}</span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function GoalsPage() {
  const [quarter, setQuarter] = useState("Q2 2025");
  const quarters = ["Q1 2025", "Q2 2025", "Q3 2025"];

  const filtered = GOALS.filter((g) => g.quarter === quarter);
  const onTrack = filtered.filter((g) => g.status === "on_track").length;
  const atRisk = filtered.filter((g) => g.status === "at_risk").length;
  const behind = filtered.filter((g) => g.status === "behind").length;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <RiFocus3Line size={22} className={styles.headerIcon} />
          <div>
            <h1 className={styles.title}>Goals</h1>
            <p className={styles.subtitle}>OKRs · Strategy to sprint · AI-tracked progress</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.quarterPicker}>
            {quarters.map((q) => (
              <button
                key={q}
                className={`${styles.qBtn} ${quarter === q ? styles.qBtnActive : ""}`}
                onClick={() => setQuarter(q)}
              >
                {q}
              </button>
            ))}
          </div>
          <button className={styles.addBtn}>
            <RiAddLine size={15} /> Add Goal
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className={styles.summaryStrip}>
        <div className={styles.summaryBox}>
          <span className={styles.summaryNum}>{filtered.length}</span>
          <span className={styles.summaryLabel}>total goals</span>
        </div>
        <div className={styles.summaryBox}>
          <span className={`${styles.summaryNum} ${styles.numGreen}`}>{onTrack}</span>
          <span className={styles.summaryLabel}>on track</span>
        </div>
        <div className={styles.summaryBox}>
          <span className={`${styles.summaryNum} ${styles.numAmber}`}>{atRisk}</span>
          <span className={styles.summaryLabel}>at risk</span>
        </div>
        <div className={styles.summaryBox}>
          <span className={`${styles.summaryNum} ${styles.numRed}`}>{behind}</span>
          <span className={styles.summaryLabel}>behind</span>
        </div>
        <div className={styles.summaryBox}>
          <div className={styles.novaChip}>
            <RiBrainLine size={12} />
            Nova tracking active
          </div>
        </div>
      </div>

      {/* Goals */}
      <div className={styles.goalsList}>
        {filtered.map((g, i) => (
          <GoalCard key={g.id} goal={g} delay={i * 0.1} />
        ))}
      </div>
    </div>
  );
}
