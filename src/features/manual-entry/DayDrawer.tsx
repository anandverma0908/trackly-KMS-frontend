import { format } from "date-fns";
import SideDrawer from "@/components/ui/SideDrawer";
import ActivityEntryRow from "@/components/ui/ActivityEntryRow";
import type { ActivityEntryData } from "@/components/ui/ActivityEntryRow";
import styles from "@/components/ui/SideDrawer.module.css";

type ActivityItem = ActivityEntryData;

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
            <ActivityEntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </SideDrawer>
  );
}
