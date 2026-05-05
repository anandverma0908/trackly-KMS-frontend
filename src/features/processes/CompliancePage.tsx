import { useState } from "react";
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
  RiArrowRightLine,
  RiTimeLine,
  RiUserLine,
} from "react-icons/ri";
import { fetchComplianceDashboard } from "@/services/api";
import type { ComplianceDashboard, Process } from "@/types";
import SideDrawer from "@/components/ui/SideDrawer";
import { ProcessDetailBody, categoryConfig, statusConfig } from "./ProcessesPage";
import styles from "./CompliancePage.module.css";

const STATUS_COLORS: Record<string, string> = {
  active:     "var(--green)",
  review:     "var(--amber)",
  draft:      "var(--text-3)",
  deprecated: "var(--red)",
};

const STATUS_CLASS: Record<string, string> = {
  active:     "statusActive",
  review:     "statusReview",
  draft:      "statusDraft",
  deprecated: "statusDeprecated",
};

interface Props {
  onBack?: () => void;
}

export default function CompliancePage({ onBack }: Props) {
  const [selected, setSelected] = useState<Process | null>(null);

  const { data, isLoading, isError } = useQuery<ComplianceDashboard>({
    queryKey: ["compliance-dashboard"],
    queryFn: fetchComplianceDashboard,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <RiShieldCheckLine size={28} className={styles.loadingIcon} />
          Loading compliance data…
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>
          <RiAlertLine size={20} />
          Failed to load compliance dashboard.
        </div>
      </div>
    );
  }

  const score = data.compliance_score ?? 0;
  const scoreColor = score >= 80 ? "var(--green)" : score >= 50 ? "var(--amber)" : "var(--red)";
  const scoreHex   = score >= 80 ? "#34d399"      : score >= 50 ? "#fbbf24"      : "#f87171";

  const byStatusData = Object.entries(data.by_status ?? {}).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    count,
    fill: STATUS_COLORS[status] ?? "var(--text-3)",
    fillHex: status === "active" ? "#34d399" : status === "review" ? "#fbbf24" : status === "deprecated" ? "#f87171" : "#94a3b8",
  }));

  const categoryData = Object.entries(data.category_breakdown ?? {}).map(([cat, count]) => ({
    name: cat.charAt(0).toUpperCase() + cat.slice(1),
    count,
  }));

  const kpis = [
    {
      label: "Total Processes",
      value: String(data.total_processes),
      sub: "Documented",
      icon: <RiFileListLine />,
    },
    {
      label: "Compliance Required",
      value: String(data.compliance_required),
      sub: "Marked for compliance",
      icon: <RiShieldCheckLine />,
    },
    {
      label: "Compliance Score",
      value: `${score}%`,
      sub: score >= 80 ? "All processes active" : score >= 50 ? "Needs attention" : "Critical",
      icon: <RiCheckboxCircleLine />,
      scoreColor,
    },
    {
      label: "Total Runs",
      value: String(data.total_runs),
      sub: "Executions logged",
      icon: <RiLoopLeftLine />,
    },
    {
      label: "At Risk",
      value: String(data.at_risk?.length ?? 0),
      sub: "Need attention",
      icon: <RiAlertLine />,
      warn: (data.at_risk?.length ?? 0) > 0,
    },
  ];

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {onBack && (
            <button className={styles.backBtn} onClick={onBack}>
              <RiArrowLeftLine size={15} />
              Processes
            </button>
          )}
          <div>
            <h1 className={styles.title}>Compliance Dashboard</h1>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {/* KPI strip */}
        <div className={styles.kpiRow}>
          {kpis.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              className={styles.kpiCard}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              style={kpi.scoreColor ? { borderTop: `2px solid ${kpi.scoreColor}` } : kpi.warn && kpi.value !== "0" ? { borderTop: "2px solid var(--red)" } : {}}
            >
              <div className={styles.kpiTopRow}>
                <div className={styles.kpiLabel}>{kpi.label}</div>
                <span className={styles.kpiIconWrap}>{kpi.icon}</span>
              </div>
              <div>
                <div
                  className={styles.kpiValue}
                  style={kpi.scoreColor ? { color: kpi.scoreColor } : kpi.warn && kpi.value !== "0" ? { color: "var(--red)" } : {}}
                >
                  {kpi.value}
                </div>
                <div className={styles.kpiSub}>{kpi.sub}</div>
              </div>
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
                width={150}
                height={150}
                cx={75}
                cy={75}
                innerRadius={50}
                outerRadius={68}
                startAngle={90}
                endAngle={-270}
                data={[{ value: score, fill: scoreHex }]}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar
                  dataKey="value"
                  cornerRadius={5}
                  background={{ fill: "var(--surface-2)" }}
                />
              </RadialBarChart>
              <div className={styles.scoreText} style={{ color: scoreColor }}>
                {score}%
              </div>
            </div>
            <p className={styles.scoreCaption}>
              {score >= 80
                ? "All compliance processes active and up to date."
                : score >= 50
                ? "Some compliance processes need attention."
                : "Critical: multiple processes inactive or in draft."}
            </p>
          </div>

          {/* By-status bar */}
          <div className={styles.chartCard} style={{ flex: 2 }}>
            <div className={styles.chartTitle}>Processes by Status</div>
            {byStatusData.length === 0 ? (
              <div className={styles.noData}>No compliance processes yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={byStatusData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-3)" }} allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border-2)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--text)",
                    }}
                    cursor={{ fill: "var(--surface-2)" }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {byStatusData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fillHex} />
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
              {categoryData.length === 0 ? (
                <div className={styles.noData}>No data</div>
              ) : (
                categoryData.map((cat) => (
                  <div key={cat.name} className={styles.categoryRow}>
                    <span className={styles.catName}>{cat.name}</span>
                    <div className={styles.catBarWrap}>
                      <div
                        className={styles.catBar}
                        style={{
                          width: `${data.total_processes > 0 ? Math.round((cat.count / data.total_processes) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <span className={styles.catCount}>{cat.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* At-risk section */}
        {(data.at_risk?.length ?? 0) > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <RiAlertLine size={14} style={{ color: "var(--amber)" }} />
              At Risk
              <span className={styles.sectionCount}>{data.at_risk.length}</span>
            </div>
            <div className={styles.processList}>
              {data.at_risk.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <ProcessRow process={p} statusClass={STATUS_CLASS[p.status] ?? "statusDraft"} onClick={() => setSelected(p)} active={selected?.id === p.id} />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Active compliance items */}
        {(data.active_items?.length ?? 0) > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <RiCheckboxCircleLine size={14} style={{ color: "var(--green)" }} />
              Active Compliance Processes
              <span className={styles.sectionCount}>{data.active_items.length}</span>
            </div>
            <div className={styles.processList}>
              {data.active_items.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <ProcessRow process={p} statusClass={STATUS_CLASS[p.status] ?? "statusDraft"} onClick={() => setSelected(p)} active={selected?.id === p.id} />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {data.compliance_required === 0 && (
          <div className={styles.empty}>
            <RiShieldCheckLine size={28} />
            <p>No compliance-required processes found.</p>
            <p className={styles.emptyHint}>
              Mark processes as "Compliance Required" in the Processes page to track them here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProcessRow({ process: p, statusClass, onClick, active }: { process: Process; statusClass: string; onClick?: () => void; active?: boolean }) {
  return (
    <div className={`${styles.processRow} ${active ? styles.processRowActive : ""}`} onClick={onClick} style={{ cursor: "pointer" }}>
      <div className={styles.rowLeft}>
        <span className={`${styles.statusBadge} ${styles[statusClass]}`}>
          {p.status}
        </span>
        {p.category && (
          <span className={styles.catBadge}>{p.category}</span>
        )}
      </div>

      <div className={styles.rowBody}>
        <div className={styles.rowTitleRow}>
          <span className={styles.rowTitle}>{p.title}</span>
        </div>
        <div className={styles.rowMeta}>
          {p.owner && (
            <>
              <RiUserLine size={11} />
              <span>{p.owner}</span>
              <span className={styles.metaDot}>·</span>
            </>
          )}
          <RiLoopLeftLine size={11} />
          <span>{p.runCount ?? 0} runs</span>
          {p.avgCompletionTime && (
            <>
              <span className={styles.metaDot}>·</span>
              <RiTimeLine size={11} />
              <span>{p.avgCompletionTime}</span>
            </>
          )}
        </div>
      </div>

      <RiArrowRightLine size={14} className={styles.rowArrow} />
    </div>
  );
}
