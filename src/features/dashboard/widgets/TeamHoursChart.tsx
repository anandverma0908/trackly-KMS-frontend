import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { fetchWorkload } from "@/services/api";
import Skeleton from "@/components/ui/Skeleton";
import styles from "./TeamHoursChart.module.css";
import { RiTeamFill } from "react-icons/ri";

const TARGET = 160; // hours per month target

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const over = d.total_hours >= TARGET;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipName}>{d.engineer}</div>
      <div className={styles.tooltipPod}>{d.pod}</div>
      <div className={styles.tooltipHours} style={{ color: over ? "var(--green)" : "var(--amber)" }}>
        {d.total_hours.toFixed(0)}h
        <span className={styles.tooltipVsTarget}> / {TARGET}h target</span>
      </div>
    </div>
  );
}

export default function TeamHoursChart() {
  const { data: workload = [], isLoading } = useQuery({
    queryKey: ["team-workload"],
    queryFn: fetchWorkload,
  });

  const sorted = [...workload].sort((a, b) => b.total_hours - a.total_hours).slice(0, 12);

  if (isLoading) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <span className="widget-icon" style={{ color: "var(--amber)", background: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.2)" }}>
            <RiTeamFill />
          </span>
          <span className="widget-title">Team Hours — This Month</span>
        </div>
        <div className={styles.skeletonList}>
          {[90, 78, 65, 55, 44, 35].map((w, i) => (
            <div key={i} className={styles.skeletonRow}>
              <Skeleton width={72} height={10} />
              <Skeleton width={`${w}%`} height={7} radius="100px" />
              <Skeleton width={36} height={10} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const maxH = Math.max(...sorted.map((d) => d.total_hours), TARGET);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.icon}><RiTeamFill /></span>
        <div className="card-title">Team Hours — This Month</div>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.legendLine} />
            {TARGET}h target
          </span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className={styles.empty}>No workload data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(160, sorted.length * 34)}>
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ top: 0, right: 52, left: 4, bottom: 0 }}
            barCategoryGap="28%"
          >
            <XAxis type="number" hide domain={[0, maxH * 1.1]} />
            <YAxis
              type="category"
              dataKey="engineer"
              width={80}
              tick={{ fill: "var(--text-2)", fontSize: 11, fontFamily: "var(--font-sans)", fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: string) => v.split(" ")[0]} // first name only
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <ReferenceLine
              x={TARGET}
              stroke="rgba(255,255,255,0.2)"
              strokeDasharray="4 3"
              strokeWidth={1.5}
            />
            <Bar dataKey="total_hours" radius={[0, 5, 5, 0]} label={{
              position: "right",
              formatter: (v: number) => `${v.toFixed(0)}h`,
              fill: "var(--text-3)",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
            }}>
              {sorted.map((entry) => (
                <Cell
                  key={entry.engineer}
                  fill={entry.total_hours >= TARGET ? "var(--green)" : "var(--amber)"}
                  fillOpacity={0.75}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
