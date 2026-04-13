import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { fetchTickets, logTime } from "@/services/api";
import { useAuthStore } from "@/features/auth/useAuthStore";
import type { Ticket } from "@/types";
import styles from "./WeeklyTimeGrid.module.css";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function fmtDisplay(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type GridCell = string; // hours as string input (empty = 0)
type Grid = Record<string, Record<string, GridCell>>; // ticketKey → dayIdx → hours

export default function WeeklyTimeGrid() {
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [grid, setGrid]           = useState<Grid>({});
  const [saving, setSaving]       = useState(false);
  const [comment, setComment]     = useState("");
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const weekDates = DAYS.map((_, i) => addDays(weekStart, i));

  // Fetch sprint tickets assigned to the current user
  const { data, isLoading } = useQuery({
    queryKey: ["weekly-grid-tickets", user?.email],
    queryFn:  () => fetchTickets({ user: user?.name }),
    enabled:  !!user,
  });

  const tickets: Ticket[] = (data?.tickets ?? []).filter(
    (t) => !t.status.includes("Done")
  ).slice(0, 40);

  const logMut = useMutation({
    mutationFn: ({ key, date, hours, note }: { key: string; date: string; hours: number; note: string }) =>
      logTime(key, hours, note, date),
    onError: (e: Error) => toast.error(e.message),
  });

  function cellKey(ticketKey: string, dayIdx: number) {
    return `${ticketKey}__${dayIdx}`;
  }

  function setCell(ticketKey: string, dayIdx: number, value: string) {
    // only allow valid number-like inputs
    if (value !== "" && !/^\d*\.?\d*$/.test(value)) return;
    setGrid((prev) => ({
      ...prev,
      [ticketKey]: { ...(prev[ticketKey] ?? {}), [dayIdx]: value },
    }));
  }

  // Tab navigation: across days then to next row
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, ticketKey: string, dayIdx: number, rowIdx: number) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const nextDay = e.shiftKey ? dayIdx - 1 : dayIdx + 1;
        if (nextDay >= 0 && nextDay < DAYS.length) {
          cellRefs.current[cellKey(ticketKey, nextDay)]?.focus();
        } else if (!e.shiftKey && rowIdx < tickets.length - 1) {
          const nextKey = tickets[rowIdx + 1].key;
          cellRefs.current[cellKey(nextKey, 0)]?.focus();
        } else if (e.shiftKey && rowIdx > 0) {
          const prevKey = tickets[rowIdx - 1].key;
          cellRefs.current[cellKey(prevKey, DAYS.length - 1)]?.focus();
        }
      }
      if (e.key === "Enter") {
        const nextDay = dayIdx + 1;
        if (nextDay < DAYS.length) {
          cellRefs.current[cellKey(ticketKey, nextDay)]?.focus();
        }
      }
    },
    [tickets]
  );

  function rowTotal(ticketKey: string): number {
    return DAYS.reduce((sum, _, i) => {
      return sum + (parseFloat(grid[ticketKey]?.[i] ?? "0") || 0);
    }, 0);
  }

  function dayTotal(dayIdx: number): number {
    return tickets.reduce((sum, t) => {
      return sum + (parseFloat(grid[t.key]?.[dayIdx] ?? "0") || 0);
    }, 0);
  }

  function grandTotal(): number {
    return DAYS.reduce((s, _, i) => s + dayTotal(i), 0);
  }

  async function handleSave() {
    setSaving(true);
    const entries: { key: string; date: string; hours: number }[] = [];
    tickets.forEach((t) => {
      DAYS.forEach((_, i) => {
        const h = parseFloat(grid[t.key]?.[i] ?? "0") || 0;
        if (h > 0) entries.push({ key: t.key, date: fmtDate(weekDates[i]), hours: h });
      });
    });

    if (entries.length === 0) {
      toast.error("No hours entered");
      setSaving(false);
      return;
    }

    try {
      await Promise.all(
        entries.map((e) => logMut.mutateAsync({ key: e.key, date: e.date, hours: e.hours, note: comment }))
      );
      qc.invalidateQueries({ queryKey: ["weekly-grid-tickets"] });
      setGrid({});
      setComment("");
      toast.success(`Logged ${entries.length} entries (${grandTotal().toFixed(1)}h total)`);
    } catch {
      // individual errors already toasted
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Weekly Time Entry</h1>
          <p className={styles.subtitle}>
            Log hours across sprint tickets. Use <kbd>Tab</kbd> to move between cells.
          </p>
        </div>
        <div className={styles.weekNav}>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>← Prev</button>
          <span className={styles.weekLabel}>
            {fmtDisplay(weekStart)} – {fmtDisplay(addDays(weekStart, 4))}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next →</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekStart(getMondayOf(new Date()))}>Today</button>
        </div>
      </div>

      {/* Grid */}
      <div className={styles.gridWrap}>
        {isLoading ? (
          <div className={styles.loading}>Loading tickets…</div>
        ) : tickets.length === 0 ? (
          <div className={styles.empty}>No open tickets assigned to you.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thTicket}>Ticket</th>
                {DAYS.map((day, i) => (
                  <th key={day} className={styles.thDay}>
                    <div className={styles.dayName}>{day}</div>
                    <div className={styles.dayDate}>{fmtDisplay(weekDates[i])}</div>
                  </th>
                ))}
                <th className={styles.thTotal}>Total</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket, rowIdx) => (
                <tr key={ticket.key} className={styles.row}>
                  <td className={styles.tdTicket}>
                    <span className={styles.ticketKey}>{ticket.key}</span>
                    <span className={styles.ticketTitle}>{ticket.summary}</span>
                    <span className={`badge badge-gray ${styles.ticketStatus}`}>{ticket.status}</span>
                  </td>
                  {DAYS.map((_, dayIdx) => (
                    <td key={dayIdx} className={styles.tdCell}>
                      <input
                        ref={(el) => { cellRefs.current[cellKey(ticket.key, dayIdx)] = el; }}
                        className={styles.cellInput}
                        type="text"
                        inputMode="decimal"
                        placeholder="—"
                        value={grid[ticket.key]?.[dayIdx] ?? ""}
                        onChange={(e) => setCell(ticket.key, dayIdx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, ticket.key, dayIdx, rowIdx)}
                      />
                    </td>
                  ))}
                  <td className={styles.tdRowTotal}>
                    {rowTotal(ticket.key) > 0 ? `${rowTotal(ticket.key).toFixed(1)}h` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={styles.footerRow}>
                <td className={styles.tdFooterLabel}>Day total</td>
                {DAYS.map((_, i) => (
                  <td key={i} className={styles.tdDayTotal}>
                    {dayTotal(i) > 0 ? `${dayTotal(i).toFixed(1)}h` : "—"}
                  </td>
                ))}
                <td className={styles.tdGrandTotal}>{grandTotal().toFixed(1)}h</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Comment + save */}
      <div className={styles.footer}>
        <input
          className={`input ${styles.commentInput}`}
          placeholder="Comment for all entries (optional)…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || grandTotal() === 0}
        >
          {saving ? "Saving…" : `Log ${grandTotal().toFixed(1)}h`}
        </button>
      </div>
    </div>
  );
}
