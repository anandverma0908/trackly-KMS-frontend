import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  fetchBurndownReport,
  fetchVelocityReport,
  fetchCfdReport,
} from "@/services/api";
import styles from "./ReportsTab.module.css";

export default function ReportsTab({ pod }: { pod: string }) {
  const { data: burndown } = useQuery({
    queryKey: ["reports-burndown", pod],
    queryFn: () => fetchBurndownReport(pod),
  });
  const { data: velocity } = useQuery({
    queryKey: ["reports-velocity", pod],
    queryFn: () => fetchVelocityReport(pod),
  });
  const { data: cfd } = useQuery({
    queryKey: ["reports-cfd", pod],
    queryFn: () => fetchCfdReport(pod),
  });

  const sprintName = burndown?.sprint?.name ?? "Active Sprint";

  return (
    <div className={styles.tab}>
      {/* ── Burndown ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Burndown</h3>
          <span className={styles.cardSubtitle}>{sprintName}</span>
        </div>
        <div className={styles.chartWrap}>
          {burndown && burndown.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={burndown.data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="burndownRemaining" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-3)" }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} allowDecimals={false} />
                <ReTooltip
                  contentStyle={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border-2)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="remaining" stroke="var(--accent)" strokeWidth={2} fill="url(#burndownRemaining)" name="Remaining" dot={{ fill: "var(--accent)", strokeWidth: 0, r: 3 }} />
                <Area type="monotone" dataKey="ideal" stroke="var(--text-3)" strokeWidth={1.5} strokeDasharray="4 4" fill="none" name="Ideal" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.empty}>No active sprint data available.</div>
          )}
        </div>
      </div>

      {/* ── Velocity ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Velocity</h3>
          <span className={styles.cardSubtitle}>Last {velocity?.length ?? 0} sprints</span>
        </div>
        <div className={styles.chartWrap}>
          {velocity && velocity.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={velocity} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="sprint" tick={{ fontSize: 10, fill: "var(--text-3)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} allowDecimals={false} />
                <ReTooltip
                  contentStyle={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border-2)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="committed" fill="var(--surface-3)" maxBarSize={28} name="Committed" radius={[3, 3, 0, 0]} />
                <Bar dataKey="completed" fill="var(--green)" maxBarSize={28} name="Completed" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.empty}>No completed sprint data yet.</div>
          )}
        </div>
      </div>

      {/* ── CFD ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Cumulative Flow</h3>
          <span className={styles.cardSubtitle}>Last 30 days</span>
        </div>
        <div className={styles.chartWrap}>
          {cfd && cfd.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={cfd} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} stackOffset="expand">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-3)" }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} allowDecimals={false} />
                <ReTooltip
                  contentStyle={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border-2)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="To Do" stackId="1" stroke="var(--text-3)" fill="var(--surface-3)" />
                <Area type="monotone" dataKey="In Progress" stackId="1" stroke="var(--amber)" fill="var(--amber)" />
                <Area type="monotone" dataKey="In Review" stackId="1" stroke="var(--purple)" fill="var(--purple)" />
                <Area type="monotone" dataKey="Blocked" stackId="1" stroke="var(--red)" fill="var(--red)" />
                <Area type="monotone" dataKey="Done" stackId="1" stroke="var(--green)" fill="var(--green)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.empty}>No flow data available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
