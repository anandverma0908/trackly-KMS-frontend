import { useQuery } from "@tanstack/react-query";
import { fetchTickets, fetchSprints } from "@/services/api";
import { useAuthStore } from "@/features/auth/useAuthStore";
import { useDashboard } from "../useDashboard";
import Skeleton from "@/components/ui/Skeleton";
import { formatNumber } from "@/utils/formatters";
import styles from "./DashboardKPIStrip.module.css";

import {
  RiTicketLine,
  RiTimeLine,
  RiFlashlightLine,
  RiGroupLine,
  RiFileList3Line,
  RiBarChartBoxLine,
} from "react-icons/ri";

/* ── Trend indicator ── */
function Trend({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const cls =
    pct > 0 ? styles.trendUp : pct < 0 ? styles.trendDown : styles.trendFlat;
  const arrow = pct > 0 ? "↑" : pct < 0 ? "↓" : "→";
  return (
    <span className={`${styles.trend} ${cls}`}>
      {arrow} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

interface KPI {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
  // glow: string;
  trend?: number | null;
}

/* ── Single card ── */
function KPICard({ kpi, delay }: { kpi: KPI; delay: number }) {
  return (
    <div
      className={`${styles.card} fade-up-${delay}`}
      // style={{ "--kc": kpi.color, "--kg": kpi.glow } as React.CSSProperties}
    >
      <div className={styles.topRow}>
        <div className={styles.label}>{kpi.label}</div>

        <span className={styles.iconWrap}>{kpi.icon}</span>
        <Trend pct={kpi.trend ?? null} />
      </div>
      <div className={styles.value}>{kpi.value}</div>
      {kpi.sub && <div className={styles.sub}>{kpi.sub}</div>}
    </div>
  );
}

/* ── Loading skeleton (4 cards) ── */
function KPISkeleton() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
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

export default function DashboardKPIStrip() {
  const user = useAuthStore((s) => s.user);
  const can = useAuthStore((s) => s.can);
  const isOwn = can("view:own");
  const { summary, isLoading, totalHours } = useDashboard();

  const { data: myTicketsData } = useQuery({
    queryKey: ["my-kpi-tickets", user?.name],
    queryFn: () =>
      fetchTickets({
        user: user?.name ?? undefined,
        dateFrom: null,
        dateTo: null,
      }),
    enabled: !!user,
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ["sprints"],
    queryFn: fetchSprints,
  });

  if (isLoading) return <KPISkeleton />;

  const myTickets = myTicketsData?.tickets ?? [];
  const DONE_STATUSES = [
    "Done",
    "Closed",
    "Resolved",
    "Won't Fix",
    "Duplicate",
    "Cancelled",
  ];
  const openTickets = myTickets.filter(
    (t) => !DONE_STATUSES.includes(t.status),
  );
  const inReview = myTickets.filter((t) => t.status === "In Review");
  const blocked = myTickets.filter((t) =>
    t.status.toLowerCase().includes("block"),
  );

  const activeSprint = sprints.find((s) => s.status === "active");
  const sprintPct =
    activeSprint && activeSprint.total_points > 0
      ? Math.round((activeSprint.done_points / activeSprint.total_points) * 100)
      : null;
  const daysLeft = activeSprint
    ? Math.max(
        0,
        Math.ceil(
          (new Date(activeSprint.end_date).getTime() - Date.now()) / 86_400_000,
        ),
      )
    : null;

  const engineers = [...new Set(summary?.by_user.map((u) => u.user) ?? [])]
    .length;
  const pods = [...new Set(summary?.by_pod.map((p) => p.pod) ?? [])].length;
  const clients = [...new Set(summary?.by_client.map((c) => c.client) ?? [])]
    .length;

  const kpis: KPI[] = isOwn
    ? [
        {
          icon: <RiTicketLine />,
          label: "Open Tickets",
          value: String(openTickets.length),
          sub: `${blocked.length > 0 ? `${blocked.length} blocked · ` : ""}assigned to me`,
          color: "var(--accent)",
          // glow: "var(--accent-glow)",
          trend: null,
        },
        {
          icon: <RiTimeLine />,
          label: "Hours This Month",
          value: `${formatNumber(Math.round(totalHours))}h`,
          sub: "My logged hours",
          color: "var(--green)",
          // glow: "var(--green-glow)",
          trend: null,
        },
        {
          icon: <RiFlashlightLine />,
          label: "Sprint Progress",
          value: sprintPct !== null ? `${sprintPct}%` : "—",
          sub:
            daysLeft !== null
              ? `${daysLeft} days remaining`
              : "No active sprint",
          color: "var(--amber)",
          // glow: "var(--amber-glow)",
          trend: null,
        },
        {
          icon: <RiFileList3Line />,
          label: "In Review",
          value: String(inReview.length),
          sub: "Awaiting review",
          color: "var(--purple)",
          // glow: "var(--purple-glow)",
          trend: null,
        },
      ]
    : [
        {
          icon: <RiTimeLine />,
          label: "Total Hours",
          value: `${formatNumber(Math.round(totalHours))}h`,
          sub: "This period",
          color: "var(--accent)",
          // glow: "var(--accent-glow)",
          trend: null,
        },
        {
          icon: <RiTicketLine />,
          label: "Open Tickets",
          value: formatNumber(summary?.total_tickets ?? 0),
          sub: "Open + active",
          color: "var(--green)",
          // glow: "var(--green-glow)",
          trend: null,
        },
        {
          icon: <RiGroupLine />,
          label: "Engineers",
          value: formatNumber(engineers),
          sub: `${pods} PODs · ${clients} clients`,
          color: "var(--amber)",
          // glow: "var(--amber-glow)",
          trend: null,
        },
        {
          icon: <RiBarChartBoxLine />,
          label: "Sprint Progress",
          value: sprintPct !== null ? `${sprintPct}%` : "—",
          sub:
            daysLeft !== null ? `${daysLeft}d remaining` : "No active sprint",
          color: "var(--purple)",
          // glow: "var(--purple-glow)",
          trend: null,
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
