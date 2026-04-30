import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  RiShieldCheckLine,
  RiAlertLine,
  RiCheckboxCircleLine,
  RiLoopLeftLine,
  RiFileListLine,
  RiArrowLeftLine,
} from "react-icons/ri";
import { fetchComplianceDashboard } from "@/services/api";
import type { ComplianceDashboard, Process } from "@/types";
import styles from "./CompliancePage.module.css";

const STATUS_COLORS: Record<string, string> = {
  active:     "#22c55e",
  review:     "#f59e0b",
  draft:      "#94a3b8",
  deprecated: "#ef4444",
};

interface Props {
  onBack?: () => void;
}

export default function CompliancePage({ onBack }: Props) {
  const { data, isLoading, isError } = useQuery<ComplianceDashboard>({
    queryKey: ["compliance-dashboard"],
    queryFn: fetchComplianceDashboard,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <RiShieldCheckLine size={28} className={styles.loadingIcon} />
        Loading compliance data…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={styles.error}>
        <RiAlertLine size={20} />
        Failed to load compliance dashboard.
      </div>
    );
  }

  const score = data.compliance_score ?? 0;
  const scoreColor = score >= 80 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";

  const byStatusData = Object.entries(data.by_status ?? {}).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    count,
    fill: STATUS_COLORS[status] ?? "#94a3b8",
  }));

  const categoryData = Object.entries(data.category_breakdown ?? {}).map(([cat, count]) => ({
    name: cat.charAt(0).toUpperCase() + cat.slice(1),
    count,
  }));

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        {onBack && (
          <button className={styles.backBtn} onClick={onBack}>
            <RiArrowLeftLine size={16} />
            Processes
          </button>
        )}
        <div className={styles.titleRow}>
          <RiShieldCheckLine size={20} className={styles.titleIcon} />
          <h1 className={styles.title}>Compliance Dashboard</h1>
        </div>
        <p className={styles.subtitle}>
          Track compliance requirements and process adherence across your organisation.
        </p>
      </div>

      {/* KPI Strip */}
      <div className={styles.kpiStrip}>
        {[
          {
            label: "Total Processes",
            value: data.total_processes,
            icon: <RiFileListLine size={16} />,
            accent: false,
          },
          {
            label: "Compliance Required",
            value: data.compliance_required,
            icon: <RiShieldCheckLine size={16} />,
            accent: false,
          },
          {
            label: "Compliance Score",
            value: `${score}%`,
            icon: <RiCheckboxCircleLine size={16} />,
            accent: true,
            color: scoreColor,
          },
          {
            label: "Total Runs",
            value: data.total_runs,
            icon: <RiLoopLeftLine size={16} />,
            accent: false,
          },
          {
            label: "At Risk",
            value: data.at_risk?.length ?? 0,
            icon: <RiAlertLine size={16} />,
            accent: false,
            warn: (data.at_risk?.length ?? 0) > 0,
          },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            className={styles.kpiCard}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <div
              className={styles.kpiIcon}
              style={{ color: kpi.color ?? (kpi.warn ? "#ef4444" : "var(--accent)") }}
            >
              {kpi.icon}
            </div>
            <div
              className={styles.kpiValue}
              style={{ color: kpi.color ?? (kpi.warn ? "#ef4444" : undefined) }}
            >
              {kpi.value}
            </div>
            <div className={styles.kpiLabel}>{kpi.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className={styles.chartsRow}>
        {/* Score dial */}
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Compliance Score</div>
          <div className={styles.scoreDial}>
            <RadialBarChart
              width={160}
              height={160}
              cx={80}
              cy={80}
              innerRadius={55}
              outerRadius={75}
              startAngle={90}
              endAngle={-270}
              data={[{ value: score, fill: scoreColor }]}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar
                dataKey="value"
                cornerRadius={6}
                background={{ fill: "var(--surface-2)" }}
              />
            </RadialBarChart>
            <div className={styles.scoreText} style={{ color: scoreColor }}>
              {score}%
            </div>
          </div>
          <p className={styles.scoreCaption}>
            {score >= 80
              ? "All compliance processes are active and up to date."
              : score >= 50
              ? "Some compliance processes need attention."
              : "Critical: multiple compliance processes are inactive or in draft."}
          </p>
        </div>

        {/* By-status bar */}
        <div className={styles.chartCard} style={{ flex: 2 }}>
          <div className={styles.chartTitle}>Compliance Processes by Status</div>
          {byStatusData.length === 0 ? (
            <div className={styles.noData}>No compliance processes yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={byStatusData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-2)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-2)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-2)" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {byStatusData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category breakdown */}
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Category Breakdown</div>
          <div className={styles.categoryList}>
            {categoryData.map((cat) => (
              <div key={cat.name} className={styles.categoryRow}>
                <span className={styles.catName}>{cat.name}</span>
                <div className={styles.catBarWrap}>
                  <div
                    className={styles.catBar}
                    style={{
                      width: `${Math.round((cat.count / data.total_processes) * 100)}%`,
                    }}
                  />
                </div>
                <span className={styles.catCount}>{cat.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* At-risk section */}
      {(data.at_risk?.length ?? 0) > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <RiAlertLine size={15} color="#f59e0b" />
            At Risk ({data.at_risk.length})
          </div>
          <div className={styles.processList}>
            {data.at_risk.map((p) => (
              <ProcessRow key={p.id} process={p} />
            ))}
          </div>
        </div>
      )}

      {/* Active compliance items */}
      {(data.active_items?.length ?? 0) > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <RiCheckboxCircleLine size={15} color="#22c55e" />
            Active Compliance Processes
          </div>
          <div className={styles.processList}>
            {data.active_items.map((p) => (
              <ProcessRow key={p.id} process={p} />
            ))}
          </div>
        </div>
      )}

      {(data.compliance_required === 0) && (
        <div className={styles.empty}>
          <RiShieldCheckLine size={28} />
          <p>No compliance-required processes found.</p>
          <p className={styles.emptyHint}>
            Mark processes as "Compliance Required" in the Processes page to track them here.
          </p>
        </div>
      )}
    </div>
  );
}

function ProcessRow({ process: p }: { process: Process }) {
  const statusColor = STATUS_COLORS[p.status] ?? "#94a3b8";
  return (
    <div className={styles.processRow}>
      <div className={styles.processLeft}>
        <span className={styles.processStatus} style={{ background: `${statusColor}22`, color: statusColor }}>
          {p.status}
        </span>
        <span className={styles.processTitle}>{p.title}</span>
        {p.category && <span className={styles.processCat}>{p.category}</span>}
      </div>
      <div className={styles.processRight}>
        {p.owner && <span className={styles.processOwner}>{p.owner}</span>}
        <span className={styles.processRuns}>{p.runCount ?? 0} runs</span>
        {p.avgCompletionTime && (
          <span className={styles.processTime}>{p.avgCompletionTime}</span>
        )}
      </div>
    </div>
  );
}
