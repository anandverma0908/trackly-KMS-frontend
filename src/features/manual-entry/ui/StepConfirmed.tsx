import type { ManualEntry } from "../model/types";
import { formatNumber } from "@/utils/formatters";
import LatticeGrid, { Column } from "@/components/ui/LatticeGrid";

import styles from "../ManualEntryPage.module.scss";

interface StepConfirmedProps {
  entries: ManualEntry[];
  totalHours: number;
  onAddMore: () => void;
}

const COLUMNS: Column<ManualEntry>[] = [
  {
    key: "date",
    label: "Date",
    width: 100,
    sortable: true,
    render: (e) => (
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text-2)",
        }}
      >
        {e.date}
      </span>
    ),
  },
  {
    key: "activity",
    label: "Activity",
    width: 340,
    render: (e) => (
      <span
        style={{ color: "var(--text)", fontWeight: 500 }}
        title={e.activity}
      >
        {e.activity}
      </span>
    ),
  },
  {
    key: "hours",
    label: "Hours",
    width: 70,
    sortable: true,
    render: (e) => (
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          color: "var(--green)",
        }}
      >
        {e.hours}h
      </span>
    ),
  },
  {
    key: "pod",
    label: "POD",
    width: 90,
    render: (e) =>
      e.pod ? (
        <span className="badge badge-blue">{e.pod}</span>
      ) : (
        <span style={{ color: "var(--text-3)" }}>—</span>
      ),
  },
  {
    key: "client",
    label: "Client",
    width: 110,
    render: (e) =>
      e.client ? (
        <span className="badge badge-amber">{e.client}</span>
      ) : (
        <span style={{ color: "var(--text-3)" }}>—</span>
      ),
  },
  {
    key: "type",
    label: "Type",
    width: 130,
    render: (e) => <span className="badge badge-purple">{e.type}</span>,
  },
  {
    key: "notes",
    label: "Notes",
    width: 180,
    render: (e) =>
      e.notes ? (
        <span
          style={{ fontSize: 11, color: "var(--text-2)", fontStyle: "italic" }}
        >
          {e.notes}
        </span>
      ) : (
        <span style={{ color: "var(--text-3)" }}>—</span>
      ),
  },
];

export default function StepConfirmed({
  entries,
  totalHours,
  onAddMore,
}: StepConfirmedProps) {
  const days = [...new Set(entries.map((e) => e.date))];

  return (
    <div className={styles.confirmedStep}>
      {/* Success card */}
      <div className={styles.successCard}>
        <div className={styles.successIcon}>✓</div>
        <div className={styles.successTitle}>
          {entries.length} entries logged
        </div>
        <div className={styles.successDesc}>
          {formatNumber(Math.round(totalHours * 4) / 4)} hours saved for{" "}
          <strong>{entries[0]?.person}</strong> across {days.length} day
          {days.length !== 1 ? "s" : ""}.
        </div>
        <div className={styles.successActions}>
          <button className="btn btn-ghost" onClick={onAddMore}>
            + Add more entries
          </button>
        </div>
      </div>

      {/* Table */}
      <LatticeGrid<ManualEntry>
        columns={COLUMNS}
        rows={entries}
        rowKey="id"
        virtualize={false}
        maxHeight={420}
        footerLeft={`${entries.length} activities`}
        footerRight={`${formatNumber(Math.round(totalHours * 4) / 4)}h total`}
        emptyIcon="📭"
        emptyTitle="No entries"
        emptyDesc=""
      />
    </div>
  );
}
