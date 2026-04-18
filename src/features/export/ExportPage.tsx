import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useFilterStore } from "@/store";
import {
  fetchFilters,
  downloadMonthlyReport,
  downloadFYReport,
} from "@/services/api";
import { QUERY_KEYS } from "@/config/queryKeys";
import { toMonthLabel } from "@/utils/formatters";
import type { ExportConfig, ReportType } from "@/types";
import styles from "./ExportPage.module.scss";

const QUICK_DATES = [
  {
    label: "This Month",
    from: () => {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-01`;
    },
    to: () => {
      const n = new Date();
      const last = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${last}`;
    },
  },
  {
    label: "Last Month",
    from: () => {
      const n = new Date(
        new Date().getFullYear(),
        new Date().getMonth() - 1,
        1,
      );
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-01`;
    },
    to: () => {
      const n = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${n.getDate()}`;
    },
  },
  {
    label: "This Quarter",
    from: () => {
      const m = Math.floor(new Date().getMonth() / 3) * 3;
      const n = new Date();
      return `${n.getFullYear()}-${String(m + 1).padStart(2, "0")}-01`;
    },
    to: () => {
      const m = Math.floor(new Date().getMonth() / 3) * 3 + 2;
      const n = new Date();
      const last = new Date(n.getFullYear(), m + 1, 0).getDate();
      return `${n.getFullYear()}-${String(m + 1).padStart(2, "0")}-${last}`;
    },
  },
];

export default function ExportPage() {
  const filters = useFilterStore();

  const [reportType, setReportType] = useState<ReportType>("monthly");
  const [dateFrom, setDateFrom] = useState(filters.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(filters.dateTo ?? "");
  const [monthLabel, setMonthLabel] = useState(() =>
    toMonthLabel(filters.dateFrom ?? new Date().toISOString()),
  );
  const [fyLabel, setFyLabel] = useState("2025-2026");
  const [activeQuick, setActiveQuick] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [sheets, setSheets] = useState({
    rawData: true,
    podSummary: true,
    breakdown: true,
    pivot: false,
  });

  const [pod, setPod] = useState<string | null>(null);
  const [client, setClient] = useState<string | null>(null);
  const [project, setProject] = useState<string | null>(null);
  const [engineer, setEngineer] = useState<string | null>(null);

  const { data: filtersData } = useQuery({
    queryKey: QUERY_KEYS.filters(),
    queryFn: fetchFilters,
  });

  function applyQuickDate(idx: number) {
    setActiveQuick(idx);
    const qd = QUICK_DATES[idx];
    const from = qd.from();
    const to = qd.to();
    setDateFrom(from);
    setDateTo(to);
    setMonthLabel(toMonthLabel(from));
  }

  function toggleSheet(key: keyof typeof sheets) {
    setSheets((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleDownload() {
    setIsDownloading(true);
    const config: ExportConfig = {
      reportType,
      monthLabel,
      fyLabel,
      dateFrom,
      dateTo,
      pod,
      client,
      project,
      engineer,
      sheets,
    };
    try {
      if (reportType === "monthly") await downloadMonthlyReport(config);
      else await downloadFYReport(config);
      toast.success(
        `${reportType === "monthly" ? `timesheet_${monthLabel.replace(" ", "_")}` : `engineering_FY_${fyLabel}`}.xlsx downloaded`,
      );
    } catch (err) {
      toast.error("Download failed. Is the backend running?");
    } finally {
      setIsDownloading(false);
    }
  }

  const sheetCount = Object.values(sheets).filter(Boolean).length;
  const activeSheetNames = [
    sheets.rawData && (reportType === "monthly" ? monthLabel : "All PODs"),
    sheets.podSummary && `Summary ${monthLabel}`,
    sheets.breakdown && "Breakdown",
    sheets.pivot && "Pivot",
  ].filter(Boolean) as string[];

  return (
    <div className={styles.page}>
      <div className={`${styles.header} fade-up`}>
        <div>
          <h1 className={styles.title}>Report Builder</h1>
          <p className={styles.subtitle}>
            Configure and download finance-ready Excel reports
          </p>
        </div>
      </div>

      <div className={styles.layout}>
        {/* Form */}
        <div className={`${styles.form} fade-up-1`}>
          {/* Report type */}
          <div className={styles.block}>
            <div className={styles.blockHeader}>
              <span className={styles.blockIcon}>📊</span>
              <span className={styles.blockTitle}>Report Type</span>
            </div>
            <div className={styles.blockBody}>
              <div className="toggle-row">
                <div
                  className={`toggle-option ${reportType === "monthly" ? "active" : ""}`}
                  onClick={() => setReportType("monthly")}
                >
                  Monthly Finance Sheet
                </div>
                <div
                  className={`toggle-option ${reportType === "fy" ? "active" : ""}`}
                  onClick={() => setReportType("fy")}
                >
                  Annual FY Engineering
                </div>
              </div>
            </div>
          </div>

          {/* Date range */}
          <div className={styles.block}>
            <div className={styles.blockHeader}>
              <span className={styles.blockIcon}>📅</span>
              <span className={styles.blockTitle}>Date Range</span>
            </div>
            <div className={styles.blockBody}>
              <div className={styles.quickDates}>
                {QUICK_DATES.map((q, i) => (
                  <button
                    key={q.label}
                    className={`${styles.qdBtn} ${activeQuick === i ? styles.qdActive : ""}`}
                    onClick={() => applyQuickDate(i)}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <div className={styles.formGrid}>
                <div className={styles.fg}>
                  <label className={styles.fl}>Month Label</label>
                  <input
                    className="input"
                    value={monthLabel}
                    onChange={(e) => setMonthLabel(e.target.value)}
                  />
                </div>
                <div className={styles.fg}>
                  <label className={styles.fl}>FY Label</label>
                  <input
                    className="input"
                    value={fyLabel}
                    onChange={(e) => setFyLabel(e.target.value)}
                  />
                </div>
                <div className={styles.fg}>
                  <label className={styles.fl}>Date From</label>
                  <input
                    className="input"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className={styles.fg}>
                  <label className={styles.fl}>Date To</label>
                  <input
                    className="input"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sheets */}
          <div className={styles.block}>
            <div className={styles.blockHeader}>
              <span className={styles.blockIcon}>📋</span>
              <span className={styles.blockTitle}>Include Sheets</span>
            </div>
            <div className={styles.blockBody}>
              <div className={styles.sheetGrid}>
                {(
                  [
                    { key: "rawData", label: "Raw Data" },
                    { key: "podSummary", label: "POD Summary" },
                    { key: "breakdown", label: "Breakdown" },
                    { key: "pivot", label: "Pivot Table" },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.key}
                    className={`${styles.sheetRow} ${sheets[s.key] ? styles.sheetOn : ""}`}
                    onClick={() => toggleSheet(s.key)}
                  >
                    <div className={styles.sheetCheck}>
                      {sheets[s.key] ? "✓" : ""}
                    </div>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className={styles.block}>
            <div className={styles.blockHeader}>
              <span className={styles.blockIcon}>🔍</span>
              <span className={styles.blockTitle}>Filter Data</span>
            </div>
            <div className={styles.blockBody}>
              <div className={styles.formGrid}>
                <div className={styles.fg}>
                  <label className={styles.fl}>Project</label>
                  <select
                    className="select"
                    value={project ?? ""}
                    onChange={(e) => setProject(e.target.value || null)}
                  >
                    <option value="">
                      All Projects ({filtersData?.projects.length ?? 0})
                    </option>
                    {filtersData?.projects.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.fg}>
                  <label className={styles.fl}>POD</label>
                  <select
                    className="select"
                    value={pod ?? ""}
                    onChange={(e) => setPod(e.target.value || null)}
                  >
                    <option value="">All PODs</option>
                    {filtersData?.pods.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.fg}>
                  <label className={styles.fl}>Client</label>
                  <select
                    className="select"
                    value={client ?? ""}
                    onChange={(e) => setClient(e.target.value || null)}
                  >
                    <option value="">
                      All Clients ({filtersData?.clients.length ?? 0})
                    </option>
                    {filtersData?.clients.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.fg}>
                  <label className={styles.fl}>Engineer</label>
                  <select
                    className="select"
                    value={engineer ?? ""}
                    onChange={(e) => setEngineer(e.target.value || null)}
                  >
                    <option value="">
                      All Engineers ({filtersData?.users.length ?? 0})
                    </option>
                    {filtersData?.users.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview panel */}
        <div className={`${styles.preview} fade-up-2`}>
          <div className={styles.pvHead}>
            <div className={styles.pvIcon}>📊</div>
            <div>
              <div className={styles.pvName}>
                {reportType === "monthly"
                  ? `timesheet_${monthLabel.replace(" ", "_")}.xlsx`
                  : `engineering_FY_${fyLabel}.xlsx`}
              </div>
              <div className={styles.pvMeta}>
                {reportType === "monthly"
                  ? "Monthly Finance"
                  : "Annual FY Engineering"}{" "}
                · {sheetCount} sheets
              </div>
            </div>
          </div>

          <div className={styles.pvSheets}>
            <div className={styles.pvSheetsLabel}>Sheets included</div>
            {activeSheetNames.map((name) => (
              <div key={name} className={styles.pvSheet}>
                <div className={styles.pvDot} />
                <div className={styles.pvSheetName}>{name}</div>
              </div>
            ))}
          </div>

          <div className={styles.pvStats}>
            <div className={styles.pvStat}>
              <div
                className={styles.pvStatVal}
                style={{ color: "var(--accent)" }}
              >
                —
              </div>
              <div className={styles.pvStatLabel}>Hours</div>
            </div>
            <div className={styles.pvStat}>
              <div
                className={styles.pvStatVal}
                style={{ color: "var(--green)" }}
              >
                —
              </div>
              <div className={styles.pvStatLabel}>Engineers</div>
            </div>
            <div className={styles.pvStat}>
              <div
                className={styles.pvStatVal}
                style={{ color: "var(--purple)" }}
              >
                —
              </div>
              <div className={styles.pvStatLabel}>Clients</div>
            </div>
          </div>

          <div className={styles.pvFoot}>
            <button
              className={styles.dlBtn}
              onClick={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? "⏳ Generating…" : "↓ Download Excel"}
            </button>
            <button
              className={styles.dlBtn2}
              onClick={() => (window.location.href = "/tickets")}
            >
              Preview in Table
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
