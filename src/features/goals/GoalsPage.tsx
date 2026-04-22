import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RiAddLine,
  RiBrainLine,
  RiArrowRightLine,
  RiCheckLine,
  RiAlertLine,
  RiBarChartLine,
  RiFocus3Line,
  RiEditLine,
  RiDeleteBinLine,
  RiRefreshLine,
  RiSparklingLine,
} from "react-icons/ri";
import toast from "react-hot-toast";
import { useGoals, useDeleteGoal } from "./useGoals";
import { fetchGoalNovaInsight } from "@/services/api";
import GoalDrawer from "./GoalDrawer";
import type { Goal, GoalStatus, KeyResult } from "@/types";
import styles from "./GoalsPage.module.css";

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const statusConfig: Record<
  GoalStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  on_track: {
    label: "On Track",
    className: styles.statusOnTrack,
    icon: <RiCheckLine size={11} />,
  },
  at_risk: {
    label: "At Risk",
    className: styles.statusAtRisk,
    icon: <RiAlertLine size={11} />,
  },
  behind: {
    label: "Behind",
    className: styles.statusBehind,
    icon: <RiAlertLine size={11} />,
  },
  complete: {
    label: "Complete",
    className: styles.statusComplete,
    icon: <RiCheckLine size={11} />,
  },
};

function getStatusConfig(status: string) {
  return statusConfig[status as GoalStatus] ?? {
    label: status,
    className: styles.statusOnTrack,
    icon: <RiCheckLine size={11} />,
  };
}

function KRProgress({ kr }: { kr: KeyResult }) {
  const pct = Math.min(100, Math.round((kr.current / kr.target) * 100));
  const overAchieve = kr.current > kr.target;

  return (
    <div className={styles.krRow}>
      <div className={styles.krHeader}>
        <span className={styles.krTitle}>{kr.title}</span>
        <span
          className={`${styles.krStatus} ${getStatusConfig(kr.status).className}`}
        >
          {getStatusConfig(kr.status).icon}
          {getStatusConfig(kr.status).label}
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
      {kr.linked_tickets.length > 0 && (
        <div className={styles.krTickets}>
          {kr.linked_tickets.map((t) => (
            <span key={t} className={styles.ticketRef}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function NovaInsightBlock({ goal }: { goal: Goal }) {
  const [insight, setInsight] = useState(goal.nova_insight || "");
  const [fetching, setFetching] = useState(false);

  // Sync with prop when goal changes (e.g. after query refetch)
  useEffect(() => {
    setInsight(goal.nova_insight || "");
  }, [goal.id, goal.nova_insight]);

  async function refreshInsight() {
    setFetching(true);
    try {
      const newInsight = await fetchGoalNovaInsight(goal.id);
      setInsight(newInsight);
      toast.success("Nova insight refreshed");
    } catch (e: any) {
      toast.error(e.message || "Failed to fetch insight");
    } finally {
      setFetching(false);
    }
  }

  if (!insight) return null;

  return (
    <div className={styles.novaInsight}>
      <div className={styles.novaInsightHeader}>
        <RiBrainLine size={13} className={styles.novaIcon} />
        <span className={styles.novaLabel}>Nova Insight</span>
        <button
          className={styles.novaRefresh}
          onClick={refreshInsight}
          disabled={fetching}
          title="Refresh AI insight"
        >
          {fetching ? (
            <svg
              className={styles.spinner}
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <RiRefreshLine size={12} />
          )}
        </button>
      </div>
      <p className={styles.novaText}>{insight}</p>
    </div>
  );
}

function GoalCard({
  goal,
  delay,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  delay: number;
  onEdit: (g: Goal) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      className={`${styles.goalCard} ${styles[`goalCard_${goal.status}`] || styles.goalCard_on_track}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      {/* Goal header */}
      <div
        className={styles.goalHeader}
        onClick={() => setExpanded(!expanded)}
      >
        <div className={styles.goalLeft}>
          <span className={styles.goalQuarter}>{goal.quarter}</span>
          <h3 className={styles.goalTitle}>{goal.title}</h3>
          <p className={styles.goalDesc}>{goal.description}</p>
        </div>
        <div className={styles.goalRight}>
          <div className={styles.circleProgress}>
            <svg width="56" height="56" viewBox="0 0 56 56">
              <circle
                cx="28"
                cy="28"
                r="22"
                fill="none"
                stroke="var(--surface-3)"
                strokeWidth="5"
              />
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
                      : goal.status === "behind"
                        ? "var(--red)"
                        : "var(--green)"
                }
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 22}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 22 }}
                animate={{
                  strokeDashoffset:
                    2 * Math.PI * 22 * (1 - goal.overall_progress / 100),
                }}
                transition={{ duration: 0.8, delay: delay + 0.2 }}
                style={{
                  transformOrigin: "center",
                  transform: "rotate(-90deg)",
                }}
              />
            </svg>
            <span className={styles.circleLabel}>
              {goal.overall_progress}%
            </span>
          </div>
          <span
            className={`${styles.statusBadge} ${getStatusConfig(goal.status).className}`}
          >
            {getStatusConfig(goal.status).icon}
            {getStatusConfig(goal.status).label}
          </span>
        </div>
      </div>

      {/* Nova insight */}
      <NovaInsightBlock goal={goal} />

      {/* Key results toggle */}
      <button
        className={styles.expandBtn}
        onClick={() => setExpanded(!expanded)}
      >
        <RiBarChartLine size={13} />
        {goal.key_results.length} key results
        <RiArrowRightLine
          size={12}
          style={{
            transform: expanded ? "rotate(90deg)" : "none",
            transition: "0.15s",
          }}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className={styles.krList}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {goal.key_results.map((kr) => (
              <KRProgress key={kr.id} kr={kr} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className={styles.goalFooter}>
        <span className={styles.goalOwner}>{goal.owner}</span>
        <div className={styles.goalActions}>
          <div className={styles.linkedSprints}>
            {goal.linked_sprints.map((s) => (
              <span key={s} className={styles.sprintChip}>
                {s}
              </span>
            ))}
          </div>
          <button
            className={styles.actionBtn}
            onClick={() => onEdit(goal)}
            title="Edit goal"
          >
            <RiEditLine size={14} />
          </button>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            onClick={() => onDelete(goal.id)}
            title="Delete goal"
          >
            <RiDeleteBinLine size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function GoalsPage() {
  const [quarter, setQuarter] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);

  const { data, isLoading, error, refetch } = useGoals(quarter || undefined);
  const deleteMut = useDeleteGoal();

  const goals = data?.goals ?? [];
  const quarters = data?.quarters ?? [];
  const activeQuarter = quarter || quarters[0] || "Q2 2025";

  const filtered = goals.filter((g) => g.quarter === activeQuarter);
  const onTrack = filtered.filter((g) => g.status === "on_track").length;
  const atRisk = filtered.filter((g) => g.status === "at_risk").length;
  const behind = filtered.filter((g) => g.status === "behind").length;

  function handleEdit(g: Goal) {
    setEditGoal(g);
    setDrawerOpen(true);
  }

  function handleDelete(id: string) {
    if (confirm("Delete this goal?")) {
      deleteMut.mutate(id);
    }
  }

  function handleCloseDrawer() {
    setDrawerOpen(false);
    setEditGoal(null);
  }

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <RiFocus3Line size={22} className={styles.headerIcon} />
            <div>
              <h1 className={styles.title}>Goals</h1>
              <p className={styles.subtitle}>OKRs · Strategy to sprint</p>
            </div>
          </div>
        </div>
        <div className={styles.skeletonList}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <RiAlertLine size={32} color="var(--red)" />
          <p>Failed to load goals</p>
          <button
            className={styles.addBtn}
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <RiFocus3Line size={22} className={styles.headerIcon} />
          <div>
            <h1 className={styles.title}>Goals</h1>
            <p className={styles.subtitle}>
              OKRs · Strategy to sprint · AI-tracked progress
            </p>
          </div>
        </div>
        <div className={styles.headerRight}>
          {quarters.length > 0 && (
            <div className={styles.quarterPicker}>
              {quarters.map((q) => (
                <button
                  key={q}
                  className={`${styles.qBtn} ${activeQuarter === q ? styles.qBtnActive : ""}`}
                  onClick={() => setQuarter(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          <button
            className={styles.refreshBtn}
            onClick={() => refetch()}
            title="Refresh goals"
          >
            <RiRefreshLine size={15} />
          </button>
          <button
            className={styles.addBtn}
            onClick={() => {
              setEditGoal(null);
              setDrawerOpen(true);
            }}
          >
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
          <span className={`${styles.summaryNum} ${styles.numGreen}`}>
            {onTrack}
          </span>
          <span className={styles.summaryLabel}>on track</span>
        </div>
        <div className={styles.summaryBox}>
          <span className={`${styles.summaryNum} ${styles.numAmber}`}>
            {atRisk}
          </span>
          <span className={styles.summaryLabel}>at risk</span>
        </div>
        <div className={styles.summaryBox}>
          <span className={`${styles.summaryNum} ${styles.numRed}`}>
            {behind}
          </span>
          <span className={styles.summaryLabel}>behind</span>
        </div>
        <div className={styles.summaryBox}>
          <div className={styles.novaChip}>
            <RiSparklingLine size={12} />
            Nova tracking active
          </div>
        </div>
      </div>

      {/* Goals list */}
      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <RiFocus3Line size={40} color="var(--text-3)" />
          <p>No goals for {activeQuarter}</p>
          <button
            className={styles.addBtn}
            onClick={() => {
              setEditGoal(null);
              setDrawerOpen(true);
            }}
          >
            <RiAddLine size={15} /> Create your first goal
          </button>
        </div>
      ) : (
        <div className={styles.goalsList}>
          {filtered.map((g, i) => (
            <GoalCard
              key={g.id}
              goal={g}
              delay={i * 0.1}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <GoalDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        editGoal={editGoal}
      />
    </div>
  );
}
