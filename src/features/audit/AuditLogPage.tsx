import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAuditLogs } from "@/services/api";
import LatticeGrid, { Column } from "@/components/ui/LatticeGrid";
import { formatDate } from "@/utils/formatters";
import styles from "./AuditLogPage.module.css";
import { RiHistoryLine, RiFilter3Line } from "react-icons/ri";
import type { AuditLogEntry } from "@/types";

const ACTION_COLORS: Record<string, string> = {
  created: "var(--green)",
  nl_created: "var(--accent-2)",
  updated: "var(--amber)",
  status_changed: "var(--accent)",
  commented: "var(--text-2)",
  "deleted comment": "var(--red)",
  "attached file": "var(--violet)",
  "logged time": "var(--emerald)",
  deleted: "var(--red)",
};

export default function AuditLogPage() {
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", entityType, action, page],
    queryFn: () =>
      fetchAuditLogs({
        entity_type: entityType || undefined,
        action: action || undefined,
        limit,
        offset: page * limit,
      }),
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;

  const columns: Column<AuditLogEntry>[] = [
    {
      key: "created_at",
      label: "When",
      width: 160,
      render: (row) => (
        <span className={styles.time}>{formatDate(row.created_at, "MMM d, h:mm a")}</span>
      ),
    },
    {
      key: "user_name",
      label: "Who",
      width: 140,
      render: (row) => <span className={styles.actor}>{row.user_name}</span>,
    },
    {
      key: "action",
      label: "Action",
      width: 140,
      render: (row) => (
        <span
          className={styles.actionBadge}
          style={{ color: ACTION_COLORS[row.action] || "var(--text-2)" }}
        >
          {row.action}
        </span>
      ),
    },
    {
      key: "entity_type",
      label: "Entity",
      width: 120,
      render: (row) => <span className={styles.entity}>{row.entity_type}</span>,
    },
    {
      key: "diff",
      label: "Details",
      render: (row) => {
        const diff = row.diff;
        if (!diff || typeof diff !== "object") return <span className={styles.empty}>—</span>;
        const entries = Object.entries(diff).slice(0, 3);
        return (
          <div className={styles.diffList}>
            {entries.map(([k, v]) => (
              <span key={k} className={styles.diffItem}>
                <strong>{k}:</strong> {String(v).slice(0, 80)}
              </span>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <RiHistoryLine size={20} /> Audit Log
          </h1>
          <p className={styles.subtitle}>Who changed what, when — across your organisation</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          <RiFilter3Line size={14} />
          <input
            className={styles.filterInput}
            placeholder="Filter by action..."
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(0); }}
          />
          <input
            className={styles.filterInput}
            placeholder="Filter by entity type..."
            value={entityType}
            onChange={(e) => { setEntityType(e.target.value); setPage(0); }}
          />
        </div>
        <span className={styles.count}>{total} entries</span>
      </div>

      <div className={styles.card}>
        <LatticeGrid<AuditLogEntry>
          columns={columns}
          rows={logs}
          rowKey="id"
          virtualize={false}
          rowHeight={56}
          isLoading={isLoading}
          emptyIcon="📋"
          emptyTitle="No audit entries"
          emptyDesc="Activity will appear here when team members create or modify tickets."
        />
      </div>

      {total > limit && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </button>
          <span className={styles.pageInfo}>
            Page {page + 1} of {Math.ceil(total / limit)}
          </span>
          <button
            className={styles.pageBtn}
            disabled={(page + 1) * limit >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
