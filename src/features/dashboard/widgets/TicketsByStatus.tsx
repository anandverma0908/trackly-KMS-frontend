import { useDashboard } from "../useDashboard";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import styles from "./TicketsByStatus.module.css";
import { HiOutlineChartBar } from "react-icons/hi";

const STATUS_MAP: Record<string, { color: string; order: number }> = {
  "To Do":       { color: "var(--text-3)",  order: 0 },
  "In Progress": { color: "var(--accent)",  order: 1 },
  "In Review":   { color: "var(--amber)",   order: 2 },
  "Blocked":     { color: "var(--red)",     order: 3 },
  "Done":        { color: "var(--green)",   order: 4 },
  "Closed":      { color: "var(--green)",   order: 5 },
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  const color = STATUS_MAP[label]?.color ?? "var(--text-2)";
  return (
    <div className={styles.tooltip}>
      <span style={{ color, fontWeight: 700 }}>{label}</span>
      <span className={styles.tooltipVal}>{d.value} tickets</span>
    </div>
  );
}

export default function TicketsByStatus() {
  const { summary, isLoading } = useDashboard();

  // Build a "status distribution" using common ticket statuses estimated from summary
  // In production this would come from a dedicated /api/tickets/status-summary endpoint
  // In production this would come from a dedicated /api/tickets/status-summary endpoint
  const total = summary?.total_tickets ?? 0;
  const mockDist = total > 0 ? [
    { status: "To Do",       count: Math.round(total * 0.25) },
    { status: "In Progress", count: Math.round(total * 0.35) },
    { status: "In Review",   count: Math.round(total * 0.20) },
    { status: "Blocked",     count: Math.round(total * 0.05) },
    { status: "Done",        count: Math.round(total * 0.15) },
  ] : [];

  const chartData = mockDist
    .filter((d) => d.count > 0)
    .sort((a, b) => (STATUS_MAP[a.status]?.order ?? 99) - (STATUS_MAP[b.status]?.order ?? 99));

  if (isLoading) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <div className="card-title">Tickets by Status</div>
        </div>
        <div style={{ height: 140, background: "var(--surface-2)", borderRadius: 8 }} />
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className="card-title">Tickets by Status</div>
        <span className={styles.total}>{total} total</span>
      </div>

      {chartData.length === 0 ? (
        <div className={styles.empty}>No ticket data</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -28, bottom: 0 }} barCategoryGap="30%">
              <XAxis
                dataKey="status"
                tick={{ fill: "var(--text-3)", fontSize: 9, fontFamily: "var(--font-sans)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "var(--text-3)", fontSize: 9, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={STATUS_MAP[entry.status]?.color ?? "var(--text-3)"}
                    fillOpacity={0.7}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className={styles.chips}>
            {chartData.map((d) => (
              <div key={d.status} className={styles.chip}>
                <span
                  className={styles.chipDot}
                  style={{ background: STATUS_MAP[d.status]?.color ?? "var(--text-3)" }}
                />
                <span className={styles.chipLabel}>{d.status}</span>
                <span className={styles.chipCount}>{d.count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
