import Skeleton from "@/components/ui/Skeleton";
import styles from "./SummaryKPIStrip.module.css";

import {
  RiCheckboxCircleLine,
  RiAddCircleLine,
  RiHistoryLine,
  RiAlarmWarningLine,
  RiForbid2Line,
} from "react-icons/ri";

interface SummaryKPIStripProps {
  kpis: {
    total: number;
    done: number;
    blocked: number;
    overdue: number;
    updated: number;
  };
  allTasksCount: number;
  sprintsCount: number;
  loading?: boolean;
}

/* ── Single card ── */
function KPICard({
  kpi,
  delay,
}: {
  kpi: {
    icon: React.ReactNode;
    label: string;
    value: string;
    sub?: string;
    color: string;
  };
  delay: number;
}) {
  return (
    <div
      className={`${styles.card} fade-up-${delay}`}
      style={{ "--kc": kpi.color } as React.CSSProperties}
    >
      <div className={styles.topRow}>
        <div className={styles.label}>{kpi.label}</div>
        <span className={styles.iconWrap}>{kpi.icon}</span>
      </div>
      <div className={styles.bottomRow}>
        <div className={styles.value}>{kpi.value}</div>
      </div>
      {kpi.sub && <div className={styles.sub}>{kpi.sub}</div>}
    </div>
  );
}

/* ── Loading skeleton (5 cards) ── */
function KPISkeleton() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={styles.skeletonCard}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <Skeleton width={36} height={36} radius="10px" />
            <Skeleton width={52} height={22} radius="20px" />
          </div>
          <Skeleton width="55%" height={22} />
          <Skeleton width="70%" height={10} />
        </div>
      ))}
    </>
  );
}

export default function SummaryKPIStrip({
  kpis,
  allTasksCount,
  sprintsCount,
  loading,
}: SummaryKPIStripProps) {
  if (loading) return <KPISkeleton />;

  const doneRate =
    allTasksCount > 0 ? Math.round((kpis.done / allTasksCount) * 100) : 0;

  const cards = [
    {
      icon: <RiCheckboxCircleLine />,
      label: "Tasks Complete",
      value: String(kpis.done),
      sub: `${doneRate}% completion rate`,
      color: "var(--green)",
    },
    {
      icon: <RiAddCircleLine />,
      label: "Tasks Created",
      value: String(allTasksCount),
      sub: `Across ${sprintsCount} sprint${sprintsCount !== 1 ? "s" : ""}`,
      color: "var(--accent)",
    },
    {
      icon: <RiHistoryLine />,
      label: "Updated Recently",
      value: String(kpis.updated),
      sub: "Activity in last 30 days",
      color: "var(--purple)",
    },
    {
      icon: <RiAlarmWarningLine />,
      label: "Due / Overdue",
      value: String(kpis.overdue),
      sub: kpis.overdue > 0 ? "Past target date" : "On schedule",
      color: kpis.overdue > 0 ? "var(--red)" : "var(--green)",
    },
    {
      icon: <RiForbid2Line />,
      label: "Blocked",
      value: String(kpis.blocked),
      sub: kpis.blocked > 0 ? "Impediments flagged" : "No impediments",
      color: "var(--red)",
    },
  ];

  return (
    <>
      {cards.map((kpi, i) => (
        <KPICard key={kpi.label} kpi={kpi} delay={i + 1} />
      ))}
    </>
  );
}
