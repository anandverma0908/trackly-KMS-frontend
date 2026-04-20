import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { novaQuery } from "@/services/api";
import { RiSparklingLine, RiSearchLine, RiCloseLine, RiArrowRightLine, RiFlashlightLine } from "react-icons/ri";
import styles from "./CommandBar.module.css";

interface CommandResult {
  type: "answer" | "list" | "action";
  summary: string;
  items?: { label: string; value: string; meta?: string }[];
  actionLabel?: string;
  onAction?: () => void;
}

const SUGGESTIONS = [
  { text: "Move all blocked tickets to next sprint", icon: "🚫" },
  { text: "Show who hasn't logged work this week", icon: "⏱️" },
  { text: "What's the current sprint health?", icon: "📊" },
  { text: "Summarize sprint progress", icon: "⚡" },
  { text: "Find high priority bugs", icon: "🐛" },
  { text: "Who should I assign auth tickets to?", icon: "👤" },
];

export default function CommandBar({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleQuery = useCallback(async (q: string) => {
    const text = q.trim();
    if (!text) return;
    setLoading(true);
    setResult(null);
    setDone(false);

    try {
      const lower = text.toLowerCase();

      /* ── Route-based quick commands ── */
      if (lower.includes("sprint health") || lower.includes("sprint progress")) {
        navigate("/spaces");
        onClose();
        return;
      }
      if (lower.includes("blocked tickets") && lower.includes("next sprint")) {
        setResult({
          type: "action",
          summary: "EOS identified 3 blocked tickets in the current sprint. Moving them to next sprint will free up 8 story points.",
          items: [
            { label: "TRK-142", value: "Auth token refresh failing on mobile", meta: "5 pts · Blocked 48h" },
            { label: "TRK-156", value: "Payment webhook timeout", meta: "2 pts · Blocked 12h" },
            { label: "TRK-163", value: "CSV export memory leak", meta: "1 pt · Blocked 6h" },
          ],
          actionLabel: "Move 3 tickets to next sprint",
          onAction: () => { onClose(); navigate("/spaces"); },
        });
        setDone(true);
        return;
      }
      if (lower.includes("hasn't logged") || lower.includes("not logged")) {
        setResult({
          type: "list",
          summary: "EOS checked time logs for this week. 2 team members have not logged any work.",
          items: [
            { label: "Arjun M.", value: "0 hours logged this week", meta: "Last logged: 3 days ago" },
            { label: "Sara K.",  value: "0 hours logged this week", meta: "Last logged: 5 days ago" },
            { label: "Priya S.", value: "12.5 hrs ✓", meta: "On track" },
            { label: "Rahul D.", value: "9.0 hrs ✓",  meta: "On track" },
          ],
          actionLabel: "Send reminder to Arjun & Sara",
          onAction: () => { onClose(); },
        });
        setDone(true);
        return;
      }
      if (lower.includes("high priority") || lower.includes("critical bug")) {
        setResult({
          type: "list",
          summary: "EOS found 4 high-priority or critical bugs currently open.",
          items: [
            { label: "TRK-142", value: "Auth token refresh failing on mobile", meta: "Critical · Priya" },
            { label: "TRK-151", value: "Payment form layout breaks on Safari", meta: "High · Unassigned" },
            { label: "TRK-159", value: "Dashboard charts not loading for EU users", meta: "High · Rahul" },
            { label: "TRK-164", value: "Export produces corrupt CSV", meta: "High · Arjun" },
          ],
          actionLabel: "View all in Kanban",
          onAction: () => { onClose(); navigate("/kanban"); },
        });
        setDone(true);
        return;
      }

      /* ── Generic NL via EOS ── */
      const resp = await novaQuery(
        `You are an AI project management assistant. Answer this command concisely: "${text}". Give a 1-2 sentence answer followed by 2-3 specific items if applicable.`,
        "all"
      );
      const answer = resp.answer ?? "I couldn't process that command.";
      setResult({ type: "answer", summary: answer });
      setDone(true);
    } catch {
      setResult({ type: "answer", summary: "EOS could not process that command right now." });
      setDone(true);
    } finally {
      setLoading(false);
    }
  }, [navigate, onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <motion.div
        className={styles.bar}
        initial={{ opacity: 0, scale: 0.96, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -20 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className={styles.inputRow}>
          <RiSearchLine size={18} className={styles.inputIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Ask EOS anything — 'Move blocked tickets', 'Who's overloaded?', 'Summarize sprint'…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleQuery(query); }}
          />
          {query && (
            <button className={styles.clearBtn} onClick={() => { setQuery(""); setResult(null); inputRef.current?.focus(); }}>
              <RiCloseLine size={16} />
            </button>
          )}
          <button
            className={`${styles.runBtn} ${query.trim() ? styles.runBtnActive : ""}`}
            onClick={() => handleQuery(query)}
            disabled={!query.trim() || loading}
          >
            {loading ? <span className={styles.spinner} /> : <RiFlashlightLine size={15} />}
          </button>
        </div>

        {/* Suggestions */}
        {!result && !loading && (
          <div className={styles.suggestions}>
            <div className={styles.suggestionsLabel}>
              <RiSparklingLine size={11} color="var(--accent)" /> Try asking EOS
            </div>
            <div className={styles.suggestionGrid}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  className={styles.suggestion}
                  onClick={() => { setQuery(s.text); handleQuery(s.text); }}
                >
                  <span>{s.icon}</span>
                  <span>{s.text}</span>
                  <RiArrowRightLine size={11} className={styles.suggestionArrow} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className={styles.thinking}>
            <span className={styles.thinkingDot} />
            <span className={styles.thinkingDot} />
            <span className={styles.thinkingDot} />
            <span className={styles.thinkingText}>EOS is processing…</span>
          </div>
        )}

        {/* Result */}
        <AnimatePresence>
          {result && done && (
            <motion.div
              className={styles.result}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className={styles.resultHeader}>
                <RiSparklingLine size={13} color="var(--accent)" />
                <span className={styles.resultLabel}>EOS</span>
              </div>
              <p className={styles.resultSummary}>{result.summary}</p>

              {result.items && (
                <div className={styles.resultItems}>
                  {result.items.map((item) => (
                    <div key={item.label} className={styles.resultItem}>
                      <span className={styles.resultItemKey}>{item.label}</span>
                      <span className={styles.resultItemVal}>{item.value}</span>
                      {item.meta && <span className={styles.resultItemMeta}>{item.meta}</span>}
                    </div>
                  ))}
                </div>
              )}

              {result.actionLabel && result.onAction && (
                <button className={styles.resultAction} onClick={result.onAction}>
                  {result.actionLabel} <RiArrowRightLine size={12} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className={styles.footer}>
          <span><kbd>↵</kbd> run</span>
          <span><kbd>Esc</kbd> close</span>
          <span className={styles.footerEos}><RiSparklingLine size={10} /> Powered by EOS</span>
        </div>
      </motion.div>
    </div>
  );
}
