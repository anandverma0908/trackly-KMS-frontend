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
  const day = d.getDay();
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

function todayStr(): string {
  return fmtDate(new Date());
}

type GridCell = string;
type Grid = Record<string, Record<string, GridCell>>;

/* ── Weekly tab ─────────────────────────────────────────────────────────── */
function WeeklyTab() {
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [grid, setGrid]           = useState<Grid>({});
  const [saving, setSaving]       = useState(false);
  const [comment, setComment]     = useState("");
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const weekDates = DAYS.map((_, i) => addDays(weekStart, i));

  const { data, isLoading } = useQuery({
    queryKey: ["weekly-grid-tickets", user?.email],
    queryFn:  () => fetchTickets({ user: user?.name }),
    enabled:  !!user,
  });

  const tickets: Ticket[] = (data?.tickets ?? [])
    .filter((t) => !t.status.includes("Done"))
    .slice(0, 40);

  const logMut = useMutation({
    mutationFn: ({ key, date, hours, note }: { key: string; date: string; hours: number; note: string }) =>
      logTime(key, hours, note, date),
    onError: (e: Error) => toast.error(e.message),
  });

  function cellKey(ticketKey: string, dayIdx: number) {
    return `${ticketKey}__${dayIdx}`;
  }

  function setCell(ticketKey: string, dayIdx: number, value: string) {
    if (value !== "" && !/^\d*\.?\d*$/.test(value)) return;
    setGrid((prev) => ({
      ...prev,
      [ticketKey]: { ...(prev[ticketKey] ?? {}), [dayIdx]: value },
    }));
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, ticketKey: string, dayIdx: number, rowIdx: number) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const nextDay = e.shiftKey ? dayIdx - 1 : dayIdx + 1;
        if (nextDay >= 0 && nextDay < DAYS.length) {
          cellRefs.current[cellKey(ticketKey, nextDay)]?.focus();
        } else if (!e.shiftKey && rowIdx < tickets.length - 1) {
          cellRefs.current[cellKey(tickets[rowIdx + 1].key, 0)]?.focus();
        } else if (e.shiftKey && rowIdx > 0) {
          cellRefs.current[cellKey(tickets[rowIdx - 1].key, DAYS.length - 1)]?.focus();
        }
      }
      if (e.key === "Enter") {
        const nextDay = dayIdx + 1;
        if (nextDay < DAYS.length) cellRefs.current[cellKey(ticketKey, nextDay)]?.focus();
      }
    },
    [tickets]
  );

  function rowTotal(ticketKey: string): number {
    return DAYS.reduce((sum, _, i) => sum + (parseFloat(grid[ticketKey]?.[i] ?? "0") || 0), 0);
  }

  function dayTotal(dayIdx: number): number {
    return tickets.reduce((sum, t) => sum + (parseFloat(grid[t.key]?.[dayIdx] ?? "0") || 0), 0);
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
    <>
      <div className={styles.weekNav}>
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>← Prev</button>
        <span className={styles.weekLabel}>
          {fmtDisplay(weekStart)} – {fmtDisplay(addDays(weekStart, 4))}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next →</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekStart(getMondayOf(new Date()))}>Today</button>
      </div>

      <div className={styles.gridWrap}>
        {isLoading ? (
          <div className={styles.empty}>Loading tickets…</div>
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
    </>
  );
}

/* ── Manual entry tab ───────────────────────────────────────────────────── */
type ManualEntry = {
  ticketKey: string;
  date: string;
  hours: string;
  note: string;
};

function ManualTab() {
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const [form, setForm] = useState<ManualEntry>({
    ticketKey: "",
    date: todayStr(),
    hours: "",
    note: "",
  });
  const [search, setSearch]   = useState("");
  const [saving, setSaving]   = useState(false);
  const [open, setOpen]       = useState(false);
  const [log, setLog]         = useState<(ManualEntry & { id: number })[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["manual-tickets", user?.email],
    queryFn:  () => fetchTickets({ user: user?.name }),
    enabled:  !!user,
  });

  const allTickets: Ticket[] = (data?.tickets ?? []).filter((t) => !t.status.includes("Done"));

  const filtered = search.trim()
    ? allTickets.filter(
        (t) =>
          t.key.toLowerCase().includes(search.toLowerCase()) ||
          t.summary.toLowerCase().includes(search.toLowerCase())
      )
    : allTickets.slice(0, 8);

  const selectedTicket = allTickets.find((t) => t.key === form.ticketKey);

  const logMut = useMutation({
    mutationFn: () =>
      logTime(form.ticketKey, parseFloat(form.hours), form.note, form.date),
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const hours = parseFloat(form.hours);
    if (!form.ticketKey) return toast.error("Select a ticket");
    if (!hours || hours <= 0 || hours > 24) return toast.error("Enter valid hours (0–24)");

    setSaving(true);
    try {
      await logMut.mutateAsync();
      qc.invalidateQueries({ queryKey: ["manual-tickets"] });
      setLog((prev) => [{ ...form, id: Date.now() }, ...prev].slice(0, 10));
      toast.success(`Logged ${hours}h on ${form.ticketKey}`);
      setForm({ ticketKey: "", date: todayStr(), hours: "", note: "" });
      setSearch("");
    } catch {
      // already toasted
    } finally {
      setSaving(false);
    }
  }

  function selectTicket(t: Ticket) {
    setForm((f) => ({ ...f, ticketKey: t.key }));
    setSearch(t.key);
    setOpen(false);
  }

  return (
    <div className={styles.manualWrap}>
      <div className={styles.manualCard}>
        <h2 className={styles.manualCardTitle}>Log Time Entry</h2>
        <p className={styles.manualCardSub}>Quickly log hours against a single ticket.</p>

        <form className={styles.manualForm} onSubmit={handleSubmit}>
          {/* Ticket picker */}
          <div className={styles.manualField}>
            <label className={styles.manualLabel}>Ticket</label>
            <div className={styles.ticketPicker}>
              <input
                className={`input ${styles.manualInput}`}
                placeholder="Search by key or title…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setOpen(true); setForm((f) => ({ ...f, ticketKey: "" })); }}
                onFocus={() => setOpen(true)}
                autoComplete="off"
              />
              {open && (
                <div className={styles.tickerDropdown}>
                  {isLoading ? (
                    <div className={styles.tickerDropItem} style={{ color: "var(--text-3)" }}>Loading…</div>
                  ) : filtered.length === 0 ? (
                    <div className={styles.tickerDropItem} style={{ color: "var(--text-3)" }}>No tickets found</div>
                  ) : (
                    filtered.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        className={`${styles.tickerDropItem} ${form.ticketKey === t.key ? styles.tickerDropItemActive : ""}`}
                        onMouseDown={() => selectTicket(t)}
                      >
                        <span className={styles.tickerDropKey}>{t.key}</span>
                        <span className={styles.tickerDropTitle}>{t.summary}</span>
                        <span className={`badge badge-gray ${styles.tickerDropStatus}`}>{t.status}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {selectedTicket && (
              <div className={styles.selectedTicketBadge}>
                <span className={styles.ticketKey}>{selectedTicket.key}</span>
                <span className={styles.ticketTitle}>{selectedTicket.summary}</span>
              </div>
            )}
          </div>

          <div className={styles.manualRow}>
            {/* Date */}
            <div className={styles.manualField}>
              <label className={styles.manualLabel}>Date</label>
              <input
                className={`input ${styles.manualInput}`}
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                max={todayStr()}
                required
              />
            </div>

            {/* Hours */}
            <div className={styles.manualField}>
              <label className={styles.manualLabel}>Hours</label>
              <input
                className={`input ${styles.manualInput}`}
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                placeholder="e.g. 2.5"
                value={form.hours}
                onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Note */}
          <div className={styles.manualField}>
            <label className={styles.manualLabel}>Note <span className={styles.optional}>(optional)</span></label>
            <input
              className={`input ${styles.manualInput}`}
              placeholder="What did you work on?"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !form.ticketKey || !form.hours}
          >
            {saving ? "Saving…" : "Log Entry"}
          </button>
        </form>
      </div>

      {/* Recent entries */}
      {log.length > 0 && (
        <div className={styles.recentLog}>
          <h3 className={styles.recentLogTitle}>Recently Logged</h3>
          <div className={styles.recentLogList}>
            {log.map((entry) => (
              <div key={entry.id} className={styles.recentLogItem}>
                <span className={styles.ticketKey}>{entry.ticketKey}</span>
                <span className={styles.recentLogHours}>{parseFloat(entry.hours).toFixed(1)}h</span>
                <span className={styles.recentLogDate}>{entry.date}</span>
                {entry.note && <span className={styles.recentLogNote}>{entry.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Page shell with tabs ───────────────────────────────────────────────── */
type Tab = "weekly" | "manual";

export default function WeeklyTimeGrid() {
  const [tab, setTab] = useState<Tab>("weekly");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Timesheets</h1>
          <p className={styles.subtitle}>
            {tab === "weekly"
              ? <>Log hours across sprint tickets. Use <kbd>Tab</kbd> to move between cells.</>
              : "Quickly log a single time entry against any ticket."}
          </p>
        </div>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === "weekly" ? styles.tabActive : ""}`}
            onClick={() => setTab("weekly")}
          >
            Weekly
          </button>
          <button
            className={`${styles.tab} ${tab === "manual" ? styles.tabActive : ""}`}
            onClick={() => setTab("manual")}
          >
            Manual Entry
          </button>
        </div>
      </div>

      {tab === "weekly" ? <WeeklyTab /> : <ManualTab />}
    </div>
  );
}
