import { format } from "date-fns";
import SideDrawer from "@/components/ui/SideDrawer";
import styles from "@/components/ui/SideDrawer.module.scss";

interface ActivityItem {
  id: string;
  source: "ticket" | "manual";
  date: string;
  activity: string;
  hours: number;
  pod: string | null;
  client: string | null;
  entry_type: string | null;
  ticket_key: string | null;
  notes: string | null;
}

interface Props {
  date: Date;
  entries: ActivityItem[];
  onClose: () => void;
}

export default function DayDrawer({ date, entries, onClose }: Props) {
  const total = entries.reduce((s, e) => s + e.hours, 0);

  return (
    <SideDrawer
      open={true}
      onClose={onClose}
      size="sm"
      title={format(date, "EEEE, MMMM d")}
      badge={
        <div className={styles.headerMeta}>
          <span
            className={styles.badge}
            style={{
              background:
                total >= 8
                  ? "rgba(52,211,153,0.15)"
                  : total > 0
                    ? "rgba(251,191,36,0.15)"
                    : "var(--surface-2)",
              color:
                total >= 8
                  ? "var(--green)"
                  : total > 0
                    ? "#F59E0B"
                    : "var(--text-3)",
            }}
          >
            {total.toFixed(1)}h logged
          </span>
          {total > 0 && total < 8 && (
            <span className={styles.shortfall}>
              {(8 - total).toFixed(1)}h short
            </span>
          )}
          {total === 0 && (
            <span className={styles.shortfall}>Nothing logged</span>
          )}
        </div>
      }
      footer={
        <>
          <div className={styles.footerBar}>
            <div
              className={styles.footerBarFill}
              style={{
                width: `${Math.min((total / 8) * 100, 100)}%`,
                background:
                  total >= 8
                    ? "var(--green)"
                    : total > 0
                      ? "#F59E0B"
                      : "var(--border-2)",
              }}
            />
          </div>
          <div className={styles.footerLabel}>
            {total >= 8
              ? `✓ Full day — ${total.toFixed(1)}h`
              : `${total.toFixed(1)} / 8h target`}
          </div>
        </>
      }
    >
      {entries.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📭</div>
          <div>No entries for this day</div>
        </div>
      ) : (
        <div className={styles.entryList}>
          {entries.map((entry) => (
            <div key={entry.id} className={styles.entryRow}>
              <span
                className={styles.sourceTag}
                style={{
                  background:
                    entry.source === "ticket"
                      ? "rgba(79,126,255,0.12)"
                      : "rgba(167,139,250,0.12)",
                  color: entry.source === "ticket" ? "var(--accent)" : "#A78BFA",
                }}
              >
                {entry.source === "ticket" ? "⬡ Ticket" : "✦ Manual"}
              </span>

              <div className={styles.entryMain}>
                <div className={styles.entryTitle}>{entry.activity}</div>
                <div className={styles.entryMeta}>
                  {entry.ticket_key && (
                    <span className={styles.chipAccent}>{entry.ticket_key}</span>
                  )}
                  {entry.pod && (
                    <span className={styles.chip}>{entry.pod}</span>
                  )}
                  {entry.client && (
                    <span className={styles.chip}>{entry.client}</span>
                  )}
                  {entry.entry_type && (
                    <span className={styles.chip}>{entry.entry_type}</span>
                  )}
                  {entry.notes && (
                    <span className={styles.note}>{entry.notes}</span>
                  )}
                </div>
              </div>

              <div className={styles.entryHours}>{entry.hours.toFixed(1)}h</div>
            </div>
          ))}
        </div>
      )}
    </SideDrawer>
  );
}
