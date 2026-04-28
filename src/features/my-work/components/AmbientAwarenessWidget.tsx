import styles from "../MyWorkPage.module.css";
import type { AmbientEvent } from "../useMyWork";

interface Props {
  ambientEvents: AmbientEvent[];
}

const TYPE_COLOR: Record<AmbientEvent["type"], string> = {
  status:  "var(--accent)",
  comment: "var(--amber)",
  assign:  "var(--green)",
  blocker: "var(--red)",
};

export default function AmbientAwarenessWidget({ ambientEvents }: Props) {
  return (
    <div className={styles.ambientCard}>
      <div className={styles.ambientHeader}>
        <span>Ambient Work Awareness</span>
        <span className={styles.ambientLive}>Live</span>
      </div>
      <div className={styles.ambientFeed}>
        {ambientEvents.length === 0 ? (
          <p className={styles.ambientEmpty}>No recent activity.</p>
        ) : (
          ambientEvents.map((ev) => (
            <div key={ev.id} className={styles.ambientItem}>
              <div className={styles.ambientDot} style={{ background: TYPE_COLOR[ev.type] }} />
              <div className={styles.ambientItemBody}>
                <span className={styles.ambientItemText}>
                  <strong>{ev.key}</strong> {ev.change} —{" "}
                  {ev.title.slice(0, 48)}{ev.title.length > 48 ? "…" : ""}
                </span>
                <span className={styles.ambientItemTime}>{ev.time}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
