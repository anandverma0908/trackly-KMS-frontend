import type { ReactNode, CSSProperties } from "react";
import { LatticeGrid as LibGrid } from "@lattice-grid-lib/core";
import type { ColumnDef, GridTokens, LeafColumnDef } from "@lattice-grid-lib/core";

/* ─────────────────────────────────────────────────────────────────────────────
   Column definition — same interface callers already use
   ───────────────────────────────────────────────────────────────────────── */

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
  className?: string;  // "dim" | "mono" | "hours" | "summary"
  sticky?: boolean;
}

export interface LatticeGridProps<T extends Record<string, any>> {
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
  maxHeight?: number;
  virtualize?: boolean;
  rowHeight?: number;
  stickyHeader?: boolean;
  variant?: "default" | "compact";
  striped?: boolean;
  highlightCol?: string;
  className?: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Trackly design-token theme — references existing CSS variables
   ───────────────────────────────────────────────────────────────────────── */

const TRACKLY_THEME: GridTokens = {
  "--vg-bg":               "var(--surface)",
  "--vg-bg-header":        "var(--surface-2)",
  "--vg-bg-toolbar":       "var(--surface-2)",
  "--vg-bg-panel":         "var(--surface-2)",
  "--vg-bg-row-alt":       "rgba(255,255,255,0.018)",
  "--vg-bg-row-hover":     "var(--surface-2)",
  "--vg-bg-row-selected":  "var(--accent-glow)",
  "--vg-bg-pinned":        "var(--surface)",
  "--vg-text":             "var(--text-2)",
  "--vg-text-dim":         "var(--text-3)",
  "--vg-text-header":      "var(--text-3)",
  "--vg-text-placeholder": "var(--text-3)",
  "--vg-border":           "var(--border)",
  "--vg-border-strong":    "var(--border-2)",
  "--vg-border-focus":     "var(--accent)",
  "--vg-accent":           "var(--accent)",
  "--vg-accent-hover":     "var(--accent)",
  "--vg-accent-bg":        "var(--accent-glow)",
  "--vg-accent-text":      "var(--accent)",
  "--vg-radius":           "var(--r)",
  "--vg-radius-sm":        "4px",
  "--vg-font":             "var(--font-sans)",
  "--vg-font-mono":        "var(--font-mono)",
  "--vg-font-size":        "12.5px",
  "--vg-row-height":       "44px",
  "--vg-header-height":    "36px",
  "--vg-sort-icon":        "var(--border-2)",
  "--vg-sort-active":      "var(--accent)",
  "--vg-resize-hover":     "var(--accent)",
  "--vg-drag-indicator":   "var(--accent)",
  "--vg-scrollbar-track":  "var(--surface-2)",
  "--vg-scrollbar-thumb":  "var(--border-2)",
};

/* ─────────────────────────────────────────────────────────────────────────────
   className → cellStyle helpers (replicate the CSS class utilities)
   ───────────────────────────────────────────────────────────────────────── */

const CLASS_STYLES: Record<string, CSSProperties> = {
  dim:     { color: "var(--text-3)" },
  mono:    { fontFamily: "var(--font-mono)", fontSize: "11px" },
  hours:   { fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--green)" },
  summary: { fontWeight: 500, color: "var(--text)" },
};

/* ─────────────────────────────────────────────────────────────────────────────
   Map our Column<T> → library ColumnDef<T>
   ───────────────────────────────────────────────────────────────────────── */

function toLibColumn<T extends Record<string, any>>(col: Column<T>): ColumnDef<T> {
  const def: LeafColumnDef<T> = {
    id:         String(col.key),
    label:      typeof col.label === "string" ? col.label : String(col.key),
    field:      col.key as keyof T & string,
    width:      col.width ?? 150,
    minWidth:   col.minWidth,
    sortable:   col.sortable ?? false,
    resizable:  false,
    draggable:  false,
    hideable:   false,
    align:      col.align ?? "left",
    cellStyle:  col.className ? (CLASS_STYLES[col.className] ?? undefined) : undefined,
  };

  if (col.render) {
    const userRender = col.render;
    def.renderCell = (_value: unknown, row: T) => userRender(row, 0);
  }

  return def;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Wrapper component
   ───────────────────────────────────────────────────────────────────────── */

export default function LatticeGrid<T extends Record<string, any>>({
  columns,
  rows,
  rowKey,
  isLoading     = false,
  emptyIcon     = "📭",
  emptyTitle    = "No results",
  emptyDesc     = "Try adjusting your filters.",
  onRowClick,
  footerLeft,
  footerRight,
  maxHeight         = 480,
  virtualize:       _virtualize    = true,   // handled by library internally
  rowHeight         = 44,
  stickyHeader:     _stickyHeader  = false,  // library always has sticky header
  variant           = "default",
  striped           = false,
  highlightCol:     _highlightCol,           // not yet exposed by library
  className,
}: LatticeGridProps<T>) {
  const libColumns = columns.map((c) => toLibColumn<T>(c));
  const isCompact  = variant === "compact";
  const hasFooter  = !!(footerLeft || footerRight);

  const emptyState = (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", gap: 6,
      padding: "48px 24px",
    }}>
      <span style={{ fontSize: 28, lineHeight: 1 }}>{emptyIcon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)" }}>{emptyTitle}</span>
      <span style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center" }}>{emptyDesc}</span>
    </div>
  );

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        border: "1px solid var(--border-2)",
        borderTop: "2px solid var(--accent-border)",
        borderRadius: "var(--r)",
        overflow: "hidden",
        background: "var(--surface)",
      }}
    >
      <LibGrid<T>
        columns={libColumns}
        data={rows}
        getRowId={(row) => String(row[rowKey])}
        maxHeight={maxHeight}
        rowHeight={isCompact ? 36 : rowHeight}
        headerHeight={isCompact ? 30 : 36}
        theme={TRACKLY_THEME}
        loading={isLoading}
        onRowClick={onRowClick ? (row, _i) => onRowClick(row) : undefined}
        features={{
          sort:        true,
          resize:      false,
          reorder:     false,
          columnHide:  false,
          columnPin:   false,
          alternateRows: striped,
          toolbar:     false,
          footer:      false,
        }}
        slots={{ emptyState }}
      />

      {hasFooter && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          borderTop: "1px solid var(--border)",
          background: "var(--surface-2)",
          fontSize: 11,
          color: "var(--text-3)",
          flexShrink: 0,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {footerLeft}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {footerRight}
          </span>
        </div>
      )}
    </div>
  );
}
