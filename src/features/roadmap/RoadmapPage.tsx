import { useState } from "react";
import { motion } from "framer-motion";
import {
  RiMapLine,
  RiAddLine,
} from "react-icons/ri";
import styles from "./RoadmapPage.module.css";

/* ── Types ─────────────────────────────────────────────────────────────────── */
type RoadmapItemStatus = "complete" | "in_progress" | "planned" | "at_risk";

interface RoadmapItem {
  id: string;
  title: string;
  project: string;
  status: RoadmapItemStatus;
  startMonth: number; // 0-indexed from Jan 2025
  durationMonths: number;
  owner: string;
  tags: string[];
  linkedGoal?: string;
}

/* ── Mock data ─────────────────────────────────────────────────────────────── */
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const CURRENT_MONTH = 3; // April 2025 (0-indexed)

const ITEMS: RoadmapItem[] = [
  {
    id: "r1",
    title: "Auth system redesign",
    project: "Core Platform",
    status: "complete",
    startMonth: 0,
    durationMonths: 2,
    owner: "Priya S.",
    tags: ["auth", "backend"],
    linkedGoal: "Reduce API latency by 40%",
  },
  {
    id: "r2",
    title: "Nova AI foundation",
    project: "AI Features",
    status: "complete",
    startMonth: 1,
    durationMonths: 2,
    owner: "Anand V.",
    tags: ["ai", "nova"],
    linkedGoal: "Nova answers 80% of process questions",
  },
  {
    id: "r3",
    title: "Duplicate detection + smart routing",
    project: "AI Features",
    status: "in_progress",
    startMonth: 3,
    durationMonths: 1,
    owner: "Rahul M.",
    tags: ["ai", "tickets"],
    linkedGoal: "Ship duplicate detection to 100% of users",
  },
  {
    id: "r4",
    title: "Decisions + Processes pages",
    project: "Knowledge Base",
    status: "in_progress",
    startMonth: 3,
    durationMonths: 2,
    owner: "Rahul M.",
    tags: ["knowledge", "frontend"],
    linkedGoal: "Nova answers 80% of process questions",
  },
  {
    id: "r5",
    title: "API latency optimization",
    project: "Core Platform",
    status: "at_risk",
    startMonth: 2,
    durationMonths: 3,
    owner: "Priya S.",
    tags: ["performance", "backend"],
    linkedGoal: "Reduce API latency by 40%",
  },
  {
    id: "r6",
    title: "My Work + Goals pages",
    project: "AI Features",
    status: "in_progress",
    startMonth: 3,
    durationMonths: 1,
    owner: "Anand V.",
    tags: ["frontend", "ai"],
  },
  {
    id: "r7",
    title: "Sprint health predictor",
    project: "AI Features",
    status: "planned",
    startMonth: 5,
    durationMonths: 1,
    owner: "Anand V.",
    tags: ["ai", "sprint"],
    linkedGoal: "Nova answers 80% of process questions",
  },
  {
    id: "r8",
    title: "Voice-to-ticket (Gen 2)",
    project: "AI Features",
    status: "planned",
    startMonth: 7,
    durationMonths: 2,
    owner: "Arjun K.",
    tags: ["ai", "voice"],
  },
  {
    id: "r9",
    title: "KB usage analytics",
    project: "Knowledge Base",
    status: "planned",
    startMonth: 5,
    durationMonths: 1,
    owner: "Rahul M.",
    tags: ["analytics", "wiki"],
  },
  {
    id: "r10",
    title: "Team health monitor (Gen 2)",
    project: "AI Features",
    status: "planned",
    startMonth: 9,
    durationMonths: 2,
    owner: "Priya S.",
    tags: ["ai", "people"],
  },
];

const PROJECTS = ["All", "Core Platform", "AI Features", "Knowledge Base"];

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const statusConfig: Record<RoadmapItemStatus, { label: string; color: string; textClass: string }> = {
  complete: { label: "Complete", color: "var(--green)", textClass: styles.textGreen },
  in_progress: { label: "In Progress", color: "var(--accent)", textClass: styles.textAccent },
  planned: { label: "Planned", color: "var(--border-3)", textClass: styles.textMuted },
  at_risk: { label: "At Risk", color: "var(--amber)", textClass: styles.textAmber },
};

const projectColors: Record<string, string> = {
  "Core Platform": "var(--accent)",
  "AI Features": "var(--purple)",
  "Knowledge Base": "var(--green)",
};

/* ── Row ─────────────────────────────────────────────────────────────────── */
function RoadmapRow({ item, totalMonths, delay }: { item: RoadmapItem; totalMonths: number; delay: number }) {
  const leftPct = (item.startMonth / totalMonths) * 100;
  const widthPct = (item.durationMonths / totalMonths) * 100;
  const color = statusConfig[item.status].color;
  const isNow = item.startMonth <= CURRENT_MONTH && item.startMonth + item.durationMonths > CURRENT_MONTH;

  return (
    <motion.div
      className={styles.row}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
    >
      <div className={styles.rowLabel}>
        <div className={styles.rowLabelInner}>
          <span
            className={styles.projectDot}
            style={{ background: projectColors[item.project] ?? "var(--accent)" }}
          />
          <span className={styles.rowTitle}>{item.title}</span>
        </div>
        <span className={styles.rowOwner}>{item.owner}</span>
      </div>

      <div className={styles.rowBar}>
        {/* Current month marker */}
        <div
          className={styles.nowLine}
          style={{ left: `${(CURRENT_MONTH / totalMonths) * 100}%` }}
        />

        <motion.div
          className={`${styles.barItem} ${isNow ? styles.barNow : ""}`}
          style={{
            left: `${leftPct}%`,
            width: `${widthPct}%`,
            background:
              item.status === "complete"
                ? "var(--green)"
                : item.status === "at_risk"
                ? "var(--amber)"
                : item.status === "planned"
                ? "var(--surface-3)"
                : "var(--accent)",
            borderColor:
              item.status === "planned" ? "var(--border-2)" : color,
          }}
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: delay + 0.1, duration: 0.5 }}
        >
          <span className={styles.barLabel}>{item.title}</span>
          {item.status === "in_progress" && (
            <span className={styles.barPulse} />
          )}
        </motion.div>
      </div>

      <div className={styles.rowStatus}>
        <span className={`${styles.statusText} ${statusConfig[item.status].textClass}`}>
          {statusConfig[item.status].label}
        </span>
      </div>
    </motion.div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function RoadmapPage() {
  const [filterProject, setFilterProject] = useState("All");
  const [filterStatus, setFilterStatus] = useState("all");
  const totalMonths = 12;

  const filtered = ITEMS.filter((item) => {
    const matchProject = filterProject === "All" || item.project === filterProject;
    const matchStatus = filterStatus === "all" || item.status === filterStatus;
    return matchProject && matchStatus;
  });

  // Group by project
  const grouped = PROJECTS.slice(1).reduce<Record<string, RoadmapItem[]>>((acc, proj) => {
    const items = filtered.filter((i) => i.project === proj);
    if (items.length > 0) acc[proj] = items;
    return acc;
  }, {});

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <RiMapLine size={20} className={styles.headerIcon} />
          <div>
            <h1 className={styles.title}>Roadmap</h1>
            <p className={styles.subtitle}>Global timeline · 2025</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.legend}>
            {(["complete", "in_progress", "at_risk", "planned"] as RoadmapItemStatus[]).map((s) => (
              <button
                key={s}
                className={`${styles.legendItem} ${filterStatus === s ? styles.legendActive : ""}`}
                onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
              >
                <span
                  className={styles.legendDot}
                  style={{ background: statusConfig[s].color }}
                />
                {statusConfig[s].label}
              </button>
            ))}
          </div>
          <button className={styles.addBtn}>
            <RiAddLine size={15} /> Add Item
          </button>
        </div>
      </div>

      {/* Project filter */}
      <div className={styles.projectFilter}>
        {PROJECTS.map((p) => (
          <button
            key={p}
            className={`${styles.projChip} ${filterProject === p ? styles.projChipActive : ""}`}
            onClick={() => setFilterProject(p)}
          >
            {p !== "All" && (
              <span
                className={styles.projDot}
                style={{ background: projectColors[p] ?? "var(--accent)" }}
              />
            )}
            {p}
          </button>
        ))}
      </div>

      {/* Timeline grid */}
      <div className={styles.timeline}>
        {/* Month headers */}
        <div className={styles.timelineHeader}>
          <div className={styles.labelCol} />
          <div className={styles.monthsHeader}>
            {MONTHS.map((m, i) => (
              <div
                key={m}
                className={`${styles.monthCol} ${i === CURRENT_MONTH ? styles.monthNow : ""}`}
              >
                {m}
                {i === CURRENT_MONTH && <span className={styles.nowBadge}>Now</span>}
              </div>
            ))}
          </div>
          <div className={styles.statusCol} />
        </div>

        {/* Rows grouped by project */}
        {Object.entries(grouped).map(([project, items]) => (
          <div key={project} className={styles.projectGroup}>
            <div className={styles.projectGroupHeader}>
              <span
                className={styles.projectGroupDot}
                style={{ background: projectColors[project] ?? "var(--accent)" }}
              />
              <span className={styles.projectGroupName}>{project}</span>
            </div>
            {items.map((item, i) => (
              <RoadmapRow
                key={item.id}
                item={item}
                totalMonths={totalMonths}
                delay={i * 0.05}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
