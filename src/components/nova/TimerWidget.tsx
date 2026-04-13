import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useTimerStore } from "@/store";
import { logTime, fetchTickets } from "@/services/api";
import type { Ticket } from "@/types";
import styles from "./TimerWidget.module.css";

export default function TimerWidget() {
  const { running, elapsed, startedAt, ticketKey, ticketTitle, start, stop, reset } = useTimerStore();
  const [display, setDisplay]   = useState("00:00:00");
  const [showLog, setShowLog]   = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [comment, setComment]   = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  // Update display
  useEffect(() => {
    function update() {
      const total = running && startedAt ? elapsed + (Date.now() - startedAt) : elapsed;
      const secs  = Math.floor(total / 1000);
      const h     = Math.floor(secs / 3600).toString().padStart(2, "0");
      const m     = Math.floor((secs % 3600) / 60).toString().padStart(2, "0");
      const s     = (secs % 60).toString().padStart(2, "0");
      setDisplay(`${h}:${m}:${s}`);
    }
    update();
    if (running) {
      intervalRef.current = setInterval(update, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, elapsed, startedAt]);

  const logMut = useMutation({
    mutationFn: () => {
      if (!ticketKey) throw new Error("No ticket selected");
      const totalMs   = running && startedAt ? elapsed + (Date.now() - startedAt) : elapsed;
      const hours     = Math.max(totalMs / 1000 / 3600, 0.01);
      const today     = new Date().toISOString().slice(0, 10);
      return logTime(ticketKey, hours, comment || "Tracked via timer", today);
    },
    onSuccess: () => {
      reset();
      setShowLog(false);
      setComment("");
      toast.success("Time logged!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleStop() {
    stop();
    setShowLog(true);
  }

  const totalMs = running && startedAt ? elapsed + (Date.now() - startedAt) : elapsed;
  const hasTime = totalMs > 0;

  if (!hasTime && !running) {
    return (
      <button className={styles.startBtn} onClick={() => setShowPicker(true)} title="Start timer">
        ⏱ Start Timer
        {showPicker && <TicketPicker onPick={(key, title) => { start(key, title); setShowPicker(false); }} onClose={() => setShowPicker(false)} />}
      </button>
    );
  }

  return (
    <div className={styles.widget}>
      {/* Display */}
      <div className={`${styles.display} ${running ? styles.displayRunning : ""}`}>
        {ticketKey && <span className={styles.ticketKey}>{ticketKey}</span>}
        <span className={styles.time}>{display}</span>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        {running ? (
          <button className={styles.stopBtn} onClick={handleStop} title="Stop & Log">
            ⏹
          </button>
        ) : (
          <>
            <button className={styles.resumeBtn} onClick={() => start(ticketKey, ticketTitle)} title="Resume">
              ▶
            </button>
            <button className={styles.logBtn} onClick={() => setShowLog(true)} title="Log time">
              💾
            </button>
            <button className={styles.resetBtn} onClick={reset} title="Discard">
              ✕
            </button>
          </>
        )}
      </div>

      {/* Log Modal */}
      {showLog && (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && setShowLog(false)}>
          <div className={styles.logModal}>
            <h3 className={styles.logTitle}>Log Time</h3>
            {ticketKey && <div className={styles.logTicket}>{ticketKey} · {ticketTitle}</div>}
            <div className={styles.logTime}>
              <span className={styles.logTimeVal}>{display}</span>
              <span className={styles.logTimeLabel}>tracked</span>
            </div>
            <div className={styles.logField}>
              <label>Comment (optional)</label>
              <textarea
                className="input"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What did you work on?"
              />
            </div>
            <div className={styles.logActions}>
              <button className="btn btn-ghost" onClick={() => setShowLog(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => logMut.mutate()}
                disabled={logMut.isPending}
              >
                {logMut.isPending ? "Logging…" : "Log Time"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TicketPicker({ onPick, onClose }: { onPick: (key: string, title: string) => void; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const delay = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetchTickets({});
        if (!cancelled) setTickets(res.tickets.slice(0, 50));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);
    return () => { cancelled = true; clearTimeout(delay); };
  }, []);

  const filtered = tickets.filter((t) =>
    !search || t.key.toLowerCase().includes(search.toLowerCase()) ||
    t.summary.toLowerCase().includes(search.toLowerCase()),
  );

  // Stop click propagation so the parent overlay doesn't close
  return (
    <div className={styles.overlay} onClick={(e) => { e.stopPropagation(); e.target === e.currentTarget && onClose(); }}>
      <div className={styles.pickerModal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.pickerTitle}>Select Ticket</h3>
        <input
          className="input"
          placeholder="Search tickets…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className={styles.pickerList}>
          {loading && <p className={styles.pickerEmpty}>Loading…</p>}
          {!loading && filtered.length === 0 && <p className={styles.pickerEmpty}>No tickets found</p>}
          {filtered.map((t) => (
            <button key={t.key} className={styles.pickerItem} onClick={() => onPick(t.key, t.summary)}>
              <span className={styles.pickerKey}>{t.key}</span>
              <span className={styles.pickerTitle}>{t.summary}</span>
            </button>
          ))}
        </div>
        <button className={styles.pickerCancel} onClick={onClose}>
          Start without ticket
        </button>
      </div>
    </div>
  );
}
