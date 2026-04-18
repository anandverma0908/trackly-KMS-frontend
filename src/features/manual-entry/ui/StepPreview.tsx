import { useState } from "react";
import type { ParsedEntry, ManualEntryType } from "../model/types";
import { formatNumber } from "@/utils/formatters";
import styles from "../ManualEntryPage.module.scss";

const ENTRY_TYPES: ManualEntryType[] = [
  "Meeting",
  "Bugs",
  "Feature",
  "Program Management",
];

interface StepPreviewProps {
  rows: ParsedEntry[];
  totalHours: number;
  warnings: string[];
  pods: string[];
  clients: string[];
  onUpdate: (
    i: number,
    field: keyof ParsedEntry,
    val: string | number | null,
  ) => void;
  onDelete: (i: number) => void;
  onAddRow: () => void;
  onConfirm: () => void;
  onBack: () => void;
}

export default function StepPreview({
  rows,
  totalHours,
  warnings,
  pods,
  clients,
  onUpdate,
  onDelete,
  onAddRow,
  onConfirm,
  onBack,
}: StepPreviewProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null);

  function cellKey(row: number, field: string) {
    return `${row}-${field}`;
  }

  function EditableText({
    rowIdx,
    field,
    value,
    className,
  }: {
    rowIdx: number;
    field: keyof ParsedEntry;
    value: string;
    className?: string;
  }) {
    const key = cellKey(rowIdx, field as string);
    const isEditing = editingCell === key;
    if (isEditing) {
      return (
        <input
          className={styles.cellInput}
          defaultValue={value}
          autoFocus
          onBlur={(e) => {
            onUpdate(rowIdx, field, e.target.value);
            setEditingCell(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") {
              onUpdate(rowIdx, field, (e.target as HTMLInputElement).value);
              setEditingCell(null);
            }
          }}
        />
      );
    }
    return (
      <span
        className={className}
        onClick={() => setEditingCell(key)}
        style={{ cursor: "text" }}
      >
        {value || <span className={styles.cellEmpty}>click to edit</span>}
      </span>
    );
  }

  function EditableHours({ rowIdx, value }: { rowIdx: number; value: number }) {
    const key = cellKey(rowIdx, "hours");
    const isEditing = editingCell === key;
    if (isEditing) {
      return (
        <input
          className={`${styles.cellInput} ${styles.cellInputMono}`}
          defaultValue={String(value)}
          autoFocus
          style={{ width: 60 }}
          onBlur={(e) => {
            onUpdate(rowIdx, "hours", parseFloat(e.target.value) || 0);
            setEditingCell(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") {
              onUpdate(
                rowIdx,
                "hours",
                parseFloat((e.target as HTMLInputElement).value) || 0,
              );
              setEditingCell(null);
            }
          }}
        />
      );
    }
    return (
      <span
        className={styles.hoursCell}
        onClick={() => setEditingCell(key)}
        style={{ cursor: "text" }}
      >
        {value}h
      </span>
    );
  }

  return (
    <div className={styles.previewStep}>
      {/* Warnings */}
      {warnings.length > 0 && (
        <div className={styles.warningBar}>
          <span className={styles.warnIcon}>⚠</span>
          {warnings.join(" · ")}
        </div>
      )}

      {/* Table card */}
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <div className={styles.tableHeaderLeft}>
            <span className={styles.tableTitle}>Parsed entries</span>
            <span className={styles.entryCount}>{rows.length} rows</span>
            {rows.every((r) => r.confidence === "high") && (
              <span className={styles.confBadge}>
                <span className={styles.confDot} />
                High confidence
              </span>
            )}
          </div>
          <div className={styles.tableHeaderRight}>
            <span className={styles.totalHours}>
              {formatNumber(Math.round(totalHours * 4) / 4)}h total
            </span>
            <button className="btn btn-ghost btn-sm" onClick={onAddRow}>
              + Add row
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onBack}>
              ← Re-enter
            </button>
          </div>
        </div>

        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Activity</th>
                <th>Hours</th>
                <th>POD</th>
                <th>Client</th>
                <th>Type</th>
                <th>Notes</th>
                <th style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className={row.confidence === "low" ? styles.rowLowConf : ""}
                >
                  {/* Date */}
                  <td>
                    <input
                      className={`${styles.cellInput} ${styles.cellInputMono}`}
                      style={{ width: 100 }}
                      type="date"
                      value={row.date}
                      onChange={(e) => onUpdate(i, "date", e.target.value)}
                    />
                  </td>

                  {/* Activity */}
                  <td style={{ maxWidth: 220 }}>
                    <EditableText
                      rowIdx={i}
                      field="activity"
                      value={row.activity}
                      className={styles.activityCell}
                    />
                  </td>

                  {/* Hours */}
                  <td>
                    <EditableHours rowIdx={i} value={row.hours} />
                  </td>

                  {/* POD */}
                  <td>
                    <select
                      className={styles.cellSelect}
                      value={row.pod ?? ""}
                      onChange={(e) =>
                        onUpdate(i, "pod", e.target.value || null)
                      }
                    >
                      <option value="">—</option>
                      {pods.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </td>

                  {/* Client */}
                  <td>
                    <select
                      className={styles.cellSelect}
                      value={row.client ?? ""}
                      onChange={(e) =>
                        onUpdate(i, "client", e.target.value || null)
                      }
                    >
                      <option value="">—</option>
                      {clients.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </td>

                  {/* Type */}
                  <td>
                    <select
                      className={styles.cellSelect}
                      value={row.type}
                      onChange={(e) => onUpdate(i, "type", e.target.value)}
                    >
                      {ENTRY_TYPES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </td>

                  {/* Notes */}
                  <td>
                    <EditableText
                      rowIdx={i}
                      field="notes"
                      value={row.notes}
                      className={styles.notesCell}
                    />
                  </td>

                  {/* Actions */}
                  <td>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => onDelete(i)}
                      title="Delete row"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer action bar */}
      <div className={styles.actionBar}>
        <div className={styles.actionStats}>
          <div className={styles.actionStat}>
            <div className={styles.actionStatVal}>
              {formatNumber(Math.round(totalHours * 4) / 4)}h
            </div>
            <div className={styles.actionStatLbl}>Total Hours</div>
          </div>
          <div className={styles.actionStatDiv} />
          <div className={styles.actionStat}>
            <div className={styles.actionStatVal}>
              {new Set(rows.map((r) => r.date)).size}
            </div>
            <div className={styles.actionStatLbl}>Days</div>
          </div>
          <div className={styles.actionStatDiv} />
          <div className={styles.actionStat}>
            <div className={styles.actionStatVal}>{rows.length}</div>
            <div className={styles.actionStatLbl}>Activities</div>
          </div>
        </div>
        <div className={styles.actionNote}>
          Review and edit any row. Click any cell to edit inline.
        </div>
        <div className={styles.actionBtns}>
          <button className="btn btn-ghost" onClick={onBack}>
            Discard
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={
              rows.filter((r) => r.activity.trim() && r.hours > 0).length === 0
            }
            style={{
              background: "linear-gradient(135deg,#059669,#34D399)",
              boxShadow: "0 4px 16px rgba(52,211,153,0.25)",
            }}
          >
            ✓ Confirm &amp; Log {rows.length} entries
          </button>
        </div>
      </div>
    </div>
  );
}
