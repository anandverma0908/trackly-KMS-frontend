import { useState } from "react";
import { RiCloseLine } from "react-icons/ri";
import styles from "../MyWorkPage.module.css";
import type { Insight } from "../useMyWork";

interface Props {
  insights: Insight[];
  loading: boolean;
  onTicketClick: (key: string) => void;
  onNavigate: (path: string) => void;
}

export default function NovaInsightFeed({
  insights,
  loading,
  onTicketClick,
  onNavigate,
}: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (loading) {
    return (
      <div className={`${styles.insightCard} fade-up-1`}>
        <div className={styles.insightHeader}>
          <span>EOS Insights</span>
        </div>
        <div className={styles.insightSkeleton}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.insightSkeletonRow} />
          ))}
        </div>
      </div>
    );
  }

  const visible = insights.filter((i) => !dismissed.has(i.id));
  if (visible.length === 0) return null;

  return (
    <div className={`${styles.insightCard} fade-up-1`}>
      <div className={styles.insightHeader}>
        <span>EOS Insights</span>
        <span className={styles.insightCount}>{visible.length} new</span>
      </div>
      <div className={styles.insightList}>
        {visible.map((insight) => (
          <div
            key={insight.id}
            className={`${styles.insightItem} ${styles[`insight${insight.severity}`]}`}
          >
            <div className={styles.insightDot} />
            <div className={styles.insightBody}>
              <div className={styles.insightTop}>
                <span className={styles.insightTitle}>{insight.title}</span>
                {insight.severity === "critical" && (
                  <span className={styles.insightTagCritical}>Critical</span>
                )}
                {insight.severity === "warning" && (
                  <span className={styles.insightTagWarning}>Warning</span>
                )}
              </div>
              <p className={styles.insightMessage}>{insight.message}</p>
              <div className={styles.insightActions}>
                {insight.actionLabel && (
                  <button
                    className={styles.insightActionBtn}
                    onClick={() => {
                      if (insight.actionTarget) {
                        onTicketClick(insight.actionTarget);
                      } else if (insight.actionLabel === "Draft wiki") {
                        onNavigate("/wiki");
                      }
                    }}
                  >
                    {insight.actionLabel}
                  </button>
                )}
              </div>
            </div>
            <button
              className={styles.insightDismiss}
              onClick={() =>
                setDismissed((prev) => new Set([...prev, insight.id]))
              }
              title="Dismiss"
            >
              <RiCloseLine size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
