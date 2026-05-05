import { useState, useMemo } from "react";
import type { ReactNode } from "react";
import styles from "./DataGrid.module.css";

/* ── Public types (same shape as old LatticeGrid so callers need zero changes) ── */

export interface Column<T> {
  key: keyof T | string;
  label: ReactNode;
  width?: number;
  minWidth?: number;
  flex?: number;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  headerAlign?: "left" | "center" | "right";
  render?: (row: T, rowIndex: number) => ReactNode;
  className?: string;
  sticky?: boolean;
}

export interface DataGridProps<T extends Record<string, any>> {
  columns: Column<T>[];
  rows: T[];
  rowKey: keyof T;
  isLoading?: boolean;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyDesc?: string;
  onRowClick?: (row: T) => void;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
  /** Maximum height of the scrollable body in px. Omit to fill container. */
  maxHeight?: number;
  rowHeight?: number;
  variant?: "default" | "compact";
  striped?: boolean;
  className?: string;
  // kept for API compat, not used internally
  virtualize?: boolean;
  stickyHeader?: boolean;
  highlightCol?: string;
}

const CELL_CLASS: Record<string, string> = {
  dim: styles.dim,
  mono: styles.mono,
  hours: styles.hours,
  summary: styles.summary,
};

export default function DataGrid<T extends Record<string, any>>({
  columns,
  rows,
  rowKey,
  isLoading = false,
  emptyIcon = "📭",
  emptyTitle = "No results",
  emptyDesc = "Try adjusting your filters.",
  onRowClick,
  footerLeft,
  footerRight,
  maxHeight,
  rowHeight = 44,
  variant = "default",
  striped = false,
  className,
}: DataGridProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const compact = variant === "compact";
  const rh = compact ? 36 : rowHeight;
  const hh = compact ? 30 : 36;

  function handleSort(key: string, sortable?: boolean) {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const hasFooter = !!(footerLeft || footerRight);

  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      {/* ── Scrollable region ── */}
      <div
        className={styles.scroll}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className={styles.table}>
          {/* ── Header ── */}
          <thead className={styles.thead}>
            <tr>
              {columns.map((col) => {
                const key = String(col.key);
                const isActive = sortKey === key;
                return (
                  <th
                    key={key}
                    className={`${styles.th} ${col.sortable ? styles.sortable : ""}`}
                    style={{
                      width: col.width,
                      minWidth: col.minWidth ?? col.width ?? 60,
                      height: hh,
                      textAlign: col.headerAlign ?? col.align ?? "left",
                    }}
                    onClick={() => handleSort(key, col.sortable)}
                  >
                    <span className={styles.thInner}>
                      {col.label}
                      {col.sortable && (
                        <span
                          className={`${styles.sortIcon} ${isActive ? styles.sortIconActive : ""}`}
                        >
                          {isActive ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody>
            {isLoading
              ? Array.from({ length: 9 }).map((_, i) => (
                  <tr key={i} className={styles.skeletonRow}>
                    {columns.map((col) => (
                      <td
                        key={String(col.key)}
                        className={styles.td}
                        style={{ height: rh }}
                      >
                        <span
                          className={styles.skeleton}
                          style={{
                            width: `${40 + ((i * 13 + (col.width ?? 100)) % 45)}%`,
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : sorted.map((row, i) => (
                  <tr
                    key={String(row[rowKey])}
                    className={[
                      styles.row,
                      striped && i % 2 === 1 ? styles.rowAlt : "",
                      onRowClick ? styles.rowClickable : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col) => {
                      const key = String(col.key);
                      const raw = row[col.key as keyof T];
                      return (
                        <td
                          key={key}
                          className={`${styles.td} ${col.className ? (CELL_CLASS[col.className] ?? "") : ""}`}
                          style={{
                            height: rh,
                            width: col.width,
                            minWidth: col.minWidth ?? col.width ?? 60,
                            textAlign: col.align ?? "left",
                          }}
                        >
                          {col.render
                            ? col.render(row, i)
                            : raw == null
                              ? "—"
                              : String(raw)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
          </tbody>
        </table>

        {/* Empty state */}
        {!isLoading && sorted.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>{emptyIcon}</span>
            <span className={styles.emptyTitle}>{emptyTitle}</span>
            <span className={styles.emptyDesc}>{emptyDesc}</span>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      {hasFooter && (
        <div className={styles.footer}>
          <span>{footerLeft}</span>
          <span>{footerRight}</span>
        </div>
      )}
    </div>
  );
}
