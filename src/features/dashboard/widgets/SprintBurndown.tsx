import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { fetchSprints, fetchBurndown } from "@/services/api";
import Skeleton from "@/components/ui/Skeleton";
import styles from "./SprintBurndown.module.css";
// import { TbChartLine } from "react-icons/tb";

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipDate}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: p.color }} />
          <span className={styles.tooltipLabel}>{p.name}</span>
          <span className={styles.tooltipVal} style={{ color: p.color }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function SprintBurndown() {
  const { data: sprints = [] } = useQuery({
    queryKey: ["sprints"],
    queryFn: fetchSprints,
  });

  const activeSprint = sprints.find((s) => s.status === "active");

  const { data: burndown = [], isLoading } = useQuery({
    queryKey: ["burndown", activeSprint?.id],
    queryFn: () => fetchBurndown(activeSprint!.id),
    enabled: !!activeSprint,
  });

  const daysLeft = activeSprint
    ? Math.max(0, Math.ceil((new Date(activeSprint.end_date).getTime() - Date.now()) / 86_400_000))
    : null;

  if (isLoading || (!activeSprint && sprints.length === 0)) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <div className="card-title">Sprint Burndown</div>
        </div>
        <div style={{ height: 140 }}>
          <Skeleton width="100%" height="100%" />
        </div>
      </div>
    );
  }

  if (!activeSprint) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>

          <div className="card-title">Sprint Burndown</div>
        </div>
        <div className={styles.empty}>No active sprint</div>
      </div>
    );
  }

  const pctDone = activeSprint.total_points > 0
    ? Math.round((activeSprint.done_points / activeSprint.total_points) * 100)
    : 0;

  const chartData = burndown.map((p) => ({
    ...p,
    date: new Date(p.date).toLocaleDateString("en-AU", { month: "short", day: "numeric" }),
  }));

  return (
    <div className={styles.card}>
      <div className={styles.header}>

        <div className="card-title">Sprint Burndown</div>
        <div className={styles.meta}>
          {daysLeft !== null && (
            <span className={`${styles.chip} ${daysLeft <= 2 ? styles.chipRed : ""}`}>
              {daysLeft}d left
            </span>
          )}
          <span className={styles.chip}>{pctDone}% done</span>
        </div>
      </div>

      <div className={styles.sprintName}>{activeSprint.name}</div>

      {chartData.length === 0 ? (
        <div className={styles.empty}>No burndown data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--text-3)", fontSize: 9, fontFamily: "var(--font-sans)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: "var(--text-3)", fontSize: 9, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="ideal"
              name="Ideal"
              stroke="var(--text-3)"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ fill: "var(--accent)", r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDash} />
          Ideal
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendLine} />
          Actual
        </span>
      </div>
    </div>
  );
}
