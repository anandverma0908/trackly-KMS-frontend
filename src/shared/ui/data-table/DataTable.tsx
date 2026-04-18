import { useState, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import styles from "./DataTable.module.scss";

/* ── Types ── */
export interface Column<T> {
  key: keyof T | string;
  label: string;
  width: number;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode; // custom cell renderer
  className?: string; // extra td class
}

interface DataTableProps<T extends Record<string, any>> {
  columns: Column<T>[];
  rows: T[];
  rowKey: keyof T;
  isLoading?: boolean;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyDesc?: string;
  onRowClick?: (row: T) => void;
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;
  maxHeight?: number;
  virtualize?: boolean;
  rowHeight?: number;
  stickyHeader?: boolean;
}

export default function DataTable<T extends Record<string, any>>({
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
  maxHeight = 480,
  virtualize = true,
  rowHeight = 44,
  stickyHeader = false,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const parentRef = useRef<HTMLDivElement>(null);

  /* ── Sort ── */
  function handleSort(col: Column<T>) {
    if (!col.sortable) return;
    const k = String(col.key);
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = a[sortKey] ?? "";
        const bv = b[sortKey] ?? "";
        const cmp = String(av).localeCompare(String(bv), undefined, {
          numeric: true,
        });
        return sortDir === "asc" ? cmp : -cmp;
      })
    : rows;

  /* ── Virtualiser ── */
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
    enabled: virtualize,
  });

  const totalCols = columns.reduce((s, c) => s + c.width, 0);

  /* ── Skeleton rows ── */
  if (isLoading) {
    return (
      <div className={styles.tableCard}>
        <div className={styles.tableHead} style={{ minWidth: totalCols }}>
          {columns.map((col) => (
            <div
              key={String(col.key)}
              className={styles.th}
              style={{ width: col.width, minWidth: col.width }}
            >
              {col.label}
            </div>
          ))}
        </div>
        <div className={styles.skeletonWrap}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={styles.skeletonRow}
              style={{ animationDelay: `${i * 0.07}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  /* ── Empty ── */
  if (sorted.length === 0) {
    return (
      <div className={styles.tableCard}>
        <div className={styles.tableHead} style={{ minWidth: totalCols }}>
          {columns.map((col) => (
            <div
              key={String(col.key)}
              className={styles.th}
              style={{ width: col.width, minWidth: col.width }}
            >
              {col.label}
            </div>
          ))}
        </div>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>{emptyIcon}</div>
          <div className={styles.emptyTitle}>{emptyTitle}</div>
          <div className={styles.emptyDesc}>{emptyDesc}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tableCard}>
      {/* Head */}
      <div
        className={`${styles.tableHead} ${stickyHeader ? styles.stickyHead : ""}`}
        style={{ minWidth: totalCols }}
      >
        {columns.map((col) => {
          const k = String(col.key);
          const isSorted = sortKey === k;
          return (
            <div
              key={k}
              className={`${styles.th} ${col.sortable ? styles.thSortable : ""} ${isSorted ? styles.thSorted : ""}`}
              style={{ width: col.width, minWidth: col.width }}
              onClick={() => handleSort(col)}
            >
              {col.label}
              {col.sortable && (
                <span className={styles.thArr}>
                  {isSorted ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Body */}
      {virtualize ? (
        <div
          ref={parentRef}
          className={styles.tableBody}
          style={{
            height: Math.min(sorted.length * rowHeight, maxHeight),
            overflowY: "auto",
          }}
        >
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative" }}
          >
            {virtualizer.getVirtualItems().map((vRow) => {
              const row = sorted[vRow.index];
              return (
                <div
                  key={String(row[rowKey])}
                  className={`${styles.row} ${onRowClick ? styles.rowClickable : ""}`}
                  style={{
                    position: "absolute",
                    top: vRow.start,
                    left: 0,
                    right: 0,
                    height: vRow.size,
                  }}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <div
                      key={String(col.key)}
                      className={`${styles.td} ${col.className ? (styles[col.className] ?? "") : ""}`}
                      style={{ width: col.width, minWidth: col.width }}
                    >
                      {col.render
                        ? col.render(row)
                        : (row[col.key as keyof T] ?? "—")}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Non-virtualised — for drawers with smaller data sets */
        <div
          className={styles.tableBodyScroll}
          style={{ maxHeight, overflowY: "auto" }}
        >
          {sorted.map((row) => (
            <div
              key={String(row[rowKey])}
              className={`${styles.row} ${onRowClick ? styles.rowClickable : ""}`}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <div
                  key={String(col.key)}
                  className={`${styles.td} ${col.className ? (styles[col.className] ?? "") : ""}`}
                  style={{ width: col.width, minWidth: col.width }}
                >
                  {col.render
                    ? col.render(row)
                    : (row[col.key as keyof T] ?? "—")}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {(footerLeft || footerRight) && (
        <div className={styles.footer}>
          <span className={styles.footerLeft}>{footerLeft}</span>
          <span className={styles.footerRight}>{footerRight}</span>
        </div>
      )}
    </div>
  );
}
