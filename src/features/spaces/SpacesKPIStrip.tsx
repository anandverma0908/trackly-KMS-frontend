import Skeleton from "@/components/ui/Skeleton";
import { formatNumber } from "@/utils/formatters";
import styles from "./SpacesKPIStrip.module.css";

import {
  RiFolderLine,
  RiRocketLine,
  RiTicketLine,
  RiTimeLine,
  RiForbid2Line,
} from "react-icons/ri";

interface SpacesKPIStripProps {
  stats: {
    total: number;
    withSprints: number;
    totalTickets: number;
    totalHours: number;
    blockedTickets: number;
  };
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
      style={
        {
          "--kc": kpi.color,
        } as React.CSSProperties
      }
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

export default function SpacesKPIStrip({
  stats,
  loading,
}: SpacesKPIStripProps) {
  if (loading) return <KPISkeleton />;

  const kpis = [
    {
      icon: <RiFolderLine />,
      label: "Total Pods",
      value: String(stats.total),
      sub: "Live project count",
      color: "var(--accent)",
    },
    {
      icon: <RiRocketLine />,
      label: "In Sprint",
      value: String(stats.withSprints),
      sub: "In active iteration",
      color: "var(--green)",
    },
    {
      icon: <RiTicketLine />,
      label: "Total Tickets",
      value: formatNumber(stats.totalTickets),
      sub: "Cumulative ticket volume",
      color: "var(--amber)",
    },
    {
      icon: <RiTimeLine />,
      label: "Hours Logged",
      value: `${formatNumber(stats.totalHours)}h`,
      sub: "Aggregated effort burn",
      color: "var(--purple)",
    },
    {
      icon: <RiForbid2Line />,
      label: "Blocked Tickets",
      value: formatNumber(stats.blockedTickets),
      sub: stats.blockedTickets > 0 ? "Critical path blockers" : "Zero blockers",
      color: "var(--red)",
    },
  ];

  return (
    <>
      {kpis.map((kpi, i) => (
        <KPICard key={kpi.label} kpi={kpi} delay={i + 1} />
      ))}
    </>
  );
}
