import styles from "./SideDrawer.module.css";

export interface ActivityEntryData {
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
  entry: ActivityEntryData;
}

export default function ActivityEntryRow({ entry }: Props) {
  const isTicket = entry.source === "ticket";

  return (
    <div className={styles.entryRow}>
      <span
        className={styles.sourceTag}
        style={{
          background: isTicket ? "rgba(245,158,11,0.12)" : "rgba(167,139,250,0.12)",
          color: isTicket ? "var(--accent)" : "#A78BFA",
        }}
      >
        {isTicket ? "⬡ Ticket" : "✦ Manual"}
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
  );
}
