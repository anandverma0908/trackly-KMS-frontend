import { useState } from "react";
import type { ParsedEntry, ManualEntryType } from "./types";
import { formatNumber } from "@/utils/formatters";
import styles from "./ManualEntryPage.module.css";
import { RiTimeLine, RiDeleteBin6Line, RiAddLine } from "react-icons/ri";
import { PiStarFourFill } from "react-icons/pi";

const ENTRY_TYPES: ManualEntryType[] = [
  "Meeting", "Bugs", "Feature", "Program Management",
  "1:1", "Planning", "Review", "Interview", "Reporting", "Training",
];

const TYPE_COLOR: Record<string, string> = {
  Meeting: "var(--accent)",
  Bugs: "var(--red)",
  Feature: "var(--green)",
  "1:1": "#a78bfa",
  Planning: "var(--amber)",
  Review: "#34d399",
  Interview: "#f97316",
  Reporting: "#06b6d4",
  Training: "#ec4899",
  "Program Management": "var(--accent)",
};

function fmtDate(d: string): string {
  if (!d) return "";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "short", day: "numeric",
    });
  } catch { return d; }
}

interface StepPreviewProps {
  rows: ParsedEntry[];
  totalHours: number;
  warnings: string[];
  pods: string[];
  clients: string[];
  onUpdate: (i: number, field: keyof ParsedEntry, val: string | number | null) => void;
  onDelete: (i: number) => void;
  onAddRow: () => void;
  onConfirm: () => void;
  onBack: () => void;
}

export default function StepPreview({
  rows, totalHours, warnings, pods, clients,
  onUpdate, onDelete, onAddRow, onConfirm, onBack,
}: StepPreviewProps) {
  const [editCell, setEditCell] = useState<string | null>(null);

  const ck = (i: number, f: string) => `${i}-${f}`;

  /* Group rows by date */
  const dates = [...new Set(rows.map(r => r.date))].sort();
  const byDate = dates.reduce<Record<string, { row: ParsedEntry; idx: number }[]>>((acc, d) => {
    acc[d] = rows.map((r, i) => ({ row: r, idx: i })).filter(({ row }) => row.date === d);
    return acc;
  }, {});

  function EditText({ i, field, value, mono }: { i: number; field: keyof ParsedEntry; value: string; mono?: boolean }) {
    const key = ck(i, field as string);
    if (editCell === key) {
      return (
        <input
          className={`${styles.pvInlineInput} ${mono ? styles.pvMono : ""}`}
          defaultValue={value}
          autoFocus
          onBlur={e => { onUpdate(i, field, e.target.value); setEditCell(null); }}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === "Escape") {
              onUpdate(i, field, (e.target as HTMLInputElement).value);
              setEditCell(null);
            }
          }}
        />
      );
    }
    return (
      <span
        className={`${styles.pvEditableText} ${mono ? styles.pvMono : ""}`}
        onClick={() => setEditCell(key)}
      >
        {value || <span className={styles.pvPlaceholder}>click to edit</span>}
      </span>
    );
  }

  function EditHours({ i, value }: { i: number; value: number }) {
    const key = ck(i, "hours");
    if (editCell === key) {
      return (
        <input
          className={`${styles.pvHoursInput}`}
          defaultValue={String(value)}
          autoFocus
          style={{ width: 48 }}
          onBlur={e => { onUpdate(i, "hours", parseFloat(e.target.value) || 0); setEditCell(null); }}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === "Escape") {
              onUpdate(i, "hours", parseFloat((e.target as HTMLInputElement).value) || 0);
              setEditCell(null);
            }
          }}
        />
      );
    }
    return (
      <button className={styles.pvHoursPill} onClick={() => setEditCell(key)}>
        <RiTimeLine size={11} />
        {value}h
      </button>
    );
  }

  return (
    <div className={styles.previewV2}>
      {/* ── Stats header ── */}
      <div className={styles.pvHeader}>
        <div className={styles.pvHeaderLeft}>
          <div className={styles.pvHeaderIcon}>
            <PiStarFourFill size={14} />
          </div>
          <div>
            <div className={styles.pvHeaderTitle}>
              {rows.length} entries extracted
            </div>
            <div className={styles.pvHeaderSub}>
              Review and edit before logging
            </div>
          </div>
        </div>
        <div className={styles.pvStats}>
          <div className={styles.pvStat}>
            <span className={styles.pvStatVal}>{formatNumber(Math.round(totalHours * 4) / 4)}h</span>
            <span className={styles.pvStatLbl}>Total</span>
          </div>
          <div className={styles.pvStatDiv} />
          <div className={styles.pvStat}>
            <span className={styles.pvStatVal}>{dates.length}</span>
            <span className={styles.pvStatLbl}>Days</span>
          </div>
          <div className={styles.pvStatDiv} />
          <div className={styles.pvStat}>
            <span className={styles.pvStatVal}>{rows.length}</span>
            <span className={styles.pvStatLbl}>Activities</span>
          </div>
        </div>
      </div>

      {/* ── Warning ── */}
      {warnings.length > 0 && (
        <div className={styles.pvWarning}>
          <span>⚠</span>
          {warnings.join(" · ")}
        </div>
      )}

      {/* ── Date-grouped entries ── */}
      <div className={styles.pvEntries}>
        {dates.map(date => (
          <div key={date} className={styles.pvDateGroup}>
            <div className={styles.pvDateLabel}>{fmtDate(date)}</div>
            <div className={styles.pvDateRows}>
              {byDate[date].map(({ row, idx }) => (
                <div
                  key={idx}
                  className={`${styles.pvRow} ${row.confidence === "low" ? styles.pvRowLow : ""}`}
                >
                  {/* Activity */}
                  <div className={styles.pvRowMain}>
                    <div
                      className={styles.pvTypeStripe}
                      style={{ background: TYPE_COLOR[row.type] ?? "var(--accent)" }}
                    />
                    <div className={styles.pvRowContent}>
                      <EditText i={idx} field="activity" value={row.activity} />
                      {row.notes && (
                        <EditText i={idx} field="notes" value={row.notes} />
                      )}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className={styles.pvRowMeta}>
                    <EditHours i={idx} value={row.hours} />

                    {/* POD */}
                    <select
                      className={styles.pvSelect}
                      value={row.pod ?? ""}
                      onChange={e => onUpdate(idx, "pod", e.target.value || null)}
                    >
                      <option value="">POD —</option>
                      {pods.map(p => <option key={p}>{p}</option>)}
                    </select>

                    {/* Client */}
                    <select
                      className={styles.pvSelect}
                      value={row.client ?? ""}
                      onChange={e => onUpdate(idx, "client", e.target.value || null)}
                    >
                      <option value="">Client —</option>
                      {clients.map(c => <option key={c}>{c}</option>)}
                    </select>

                    {/* Type */}
                    <select
                      className={styles.pvSelect}
                      value={row.type}
                      onChange={e => onUpdate(idx, "type", e.target.value)}
                      style={{ color: TYPE_COLOR[row.type] ?? "var(--accent)" }}
                    >
                      {ENTRY_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>

                    <button
                      className={styles.pvDeleteBtn}
                      onClick={() => onDelete(idx)}
                    >
                      <RiDeleteBin6Line size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Add row */}
        <button className={styles.pvAddRow} onClick={onAddRow}>
          <RiAddLine size={14} />
          Add entry
        </button>
      </div>

      {/* ── Footer ── */}
      <div className={styles.pvFooter}>
        <button className={styles.pvDiscardBtn} onClick={onBack}>
          Discard
        </button>
        <button
          className={styles.pvConfirmBtn}
          onClick={onConfirm}
          disabled={rows.filter(r => r.activity.trim() && r.hours > 0).length === 0}
        >
          <PiStarFourFill size={13} />
          Log {rows.length} entries · {formatNumber(Math.round(totalHours * 4) / 4)}h
        </button>
      </div>
    </div>
  );
}
