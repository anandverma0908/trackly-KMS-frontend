import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { fetchVelocity } from "@/services/api";
import Skeleton from "@/components/ui/Skeleton";
import styles from "./PodVelocity.module.scss";

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const pod = payload[0]?.payload?.pod;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipSprint}>{label}</div>
      {pod && <div className={styles.tooltipPod}>POD: {pod}</div>}
      {payload.map((p: any) => (
        <div key={p.dataKey} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: p.color }} />
          <span className={styles.tooltipLabel}>{p.name}</span>
          <span className={styles.tooltipVal} style={{ color: p.color }}>{p.value} pts</span>
        </div>
      ))}
    </div>
  );
}

export default function PodVelocity() {
  const { data: velocity = [], isLoading } = useQuery({
    queryKey: ["velocity"],
    queryFn: fetchVelocity,
  });

  const recent = velocity.slice(-6); // last 6 sprints
  const pods = [...new Set(recent.map((item: any) => item.pod).filter(Boolean))];
  const podLabel = pods.length === 1 ? pods[0] : pods.length > 1 ? `${pods.length} PODs` : "All PODs";

  if (isLoading) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <div className="card-title">POD Velocity</div>
        </div>
        <div style={{ height: 140 }}>
          <Skeleton width="100%" height="100%" />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className="card-title">POD Velocity</div>
        <span className={styles.sub}>{podLabel} · Story points · last 6 sprints</span>
      </div>

      {recent.length === 0 ? (
        <div className={styles.empty}>No velocity data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={recent} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barGap={3}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="sprint"
              tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-sans)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: string) => v.replace(/Sprint\s*/i, "S")}
            />
            <YAxis
              tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="committed" name="Committed" fill="var(--accent)" fillOpacity={0.45} radius={[4, 4, 0, 0]} />
            <Bar dataKey="completed" name="Completed"  fill="var(--green)"  fillOpacity={0.75} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendBox} style={{ background: "var(--accent)", opacity: 0.5 }} />
          Committed
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendBox} style={{ background: "var(--green)" }} />
          Completed
        </span>
      </div>
    </div>
  );
}
