import { useState } from "react";
import {
  RiSparklingLine,
  RiCheckLine,
  RiArrowRightLine,
  RiAlertLine,
  RiSendPlaneLine,
  RiTimeLine,
  RiMessage2Line,
  RiEyeLine,
  RiArrowUpLine,
  RiFlashlightLine,
} from "react-icons/ri";
import styles from "../MyWorkPage.module.css";
import { statusToMeta } from "@/utils/ticketHelpers";
import type { AITicket } from "../useMyWork";

interface Props {
  tickets: AITicket[];
  loading: boolean;
  onQuickAction: (actionId: string, ticket: AITicket) => void;
}

function QuickActionIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "ping":    return <RiSendPlaneLine size={12} />;
    case "log":     return <RiTimeLine size={12} />;
    case "draft":   return <RiMessage2Line size={12} />;
    case "move":    return <RiArrowRightLine size={12} />;
    case "review":  return <RiEyeLine size={12} />;
    case "escalate":return <RiArrowUpLine size={12} />;
    default:        return <RiFlashlightLine size={12} />;
  }
}

function QueueStatusBadge({ status }: { status: string }) {
  const meta = statusToMeta(status);
  return (
    <span
      className={styles.queueBadge}
      style={{ color: meta.color, background: meta.bg }}
    >
      {meta.label}
    </span>
  );
}

export default function AIPriorityQueue({ tickets, loading, onQuickAction }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  function toggleExpand(key: string) {
    setExpandedKey((k) => (k === key ? null : key));
  }

  if (loading) {
    return (
      <div className={styles.queueCard}>
        <div className={styles.queueHeader}>
          <RiSparklingLine size={16} />
          <span>AI Priority Queue</span>
        </div>
        <div className={styles.queueSkeleton}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.queueSkeletonRow} />
          ))}
        </div>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className={styles.queueCard}>
        <div className={styles.queueHeader}>
          <RiSparklingLine size={16} />
          <span>AI Priority Queue</span>
        </div>
        <div className={styles.queueEmpty}>
          <RiCheckLine size={32} color="var(--green)" />
          <span>All clear — no open tickets!</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.queueCard}>
      <div className={styles.queueHeader}>
        <RiSparklingLine size={16} />
        <span>AI Priority Queue</span>
        <span className={styles.queueCount}>{tickets.length} tickets</span>
      </div>
      <div className={styles.queueList}>
        {tickets.map((t) => {
          const isExpanded = expandedKey === t.key;
          const priorityIcon =
            t.priority === "Highest" ? "⬆⬆"
            : t.priority === "High"  ? "⬆"
            : t.priority === "Medium"? "▶"
            : "⬇";
          const priorityColor =
            t.priority === "Highest" || t.priority === "High"
              ? "var(--red)"
              : "var(--text-3)";

          return (
            <div
              key={t.key}
              className={`${styles.queueItem} ${isExpanded ? styles.queueItemExpanded : ""} ${styles[`queueUrgency${t.aiUrgency}`]}`}
            >
              <button className={styles.queueRow} onClick={() => toggleExpand(t.key)}>
                <span
                  className={styles.queueRank}
                  style={{
                    color:
                      t.aiUrgency === "critical" ? "var(--red)"
                      : t.aiUrgency === "high"   ? "var(--amber)"
                      : "var(--text-3)",
                  }}
                >
                  #{t.aiRank}
                </span>
                <div className={styles.queueBody}>
                  <div className={styles.queueTop}>
                    <span className={styles.queueKey}>{t.key}</span>
                    <QueueStatusBadge status={t.status} />
                    {t.deadlineRisk && (
                      <span className={styles.queueRiskBadge}>{t.deadlineRisk}</span>
                    )}
                    {t.priority && (
                      <span className={styles.queuePriority} style={{ color: priorityColor }}>
                        {priorityIcon}
                      </span>
                    )}
                  </div>
                  <span className={styles.queueSummary}>{t.summary}</span>
                  <span className={styles.queueReason}>{t.aiReason}</span>
                </div>
                <RiArrowRightLine
                  size={14}
                  className={`${styles.queueArrow} ${isExpanded ? styles.queueArrowOpen : ""}`}
                />
              </button>

              {isExpanded && (
                <div className={styles.queueDetail}>
                  <div className={styles.detailSection}>
                    <span className={styles.detailLabel}>EOS Analysis</span>
                    <p className={styles.detailText}>
                      Ranked #{t.aiRank} because: {t.aiReason}.
                      {t.blockingCount > 0 &&
                        ` This ticket is blocking ${t.blockingCount} other ticket${t.blockingCount > 1 ? "s" : ""}.`}
                      {t.daysInStatus > 3 &&
                        ` It has been in ${t.status} for ${t.daysInStatus} days.`}
                      {t.sprintName && ` Part of active sprint: ${t.sprintName}.`}
                    </p>
                  </div>

                  <div className={styles.detailMetaRow}>
                    {t.original_estimate_hours > 0 && (
                      <div className={styles.detailMeta}>
                        <span className={styles.detailMetaLabel}>Est.</span>
                        <span className={styles.detailMetaVal}>{t.original_estimate_hours}h</span>
                      </div>
                    )}
                    {t.hours_spent > 0 && (
                      <div className={styles.detailMeta}>
                        <span className={styles.detailMetaLabel}>Logged</span>
                        <span
                          className={styles.detailMetaVal}
                          style={{
                            color:
                              t.hours_spent > (t.original_estimate_hours || 0) * 1.3
                                ? "var(--amber)"
                                : "var(--green)",
                          }}
                        >
                          {t.hours_spent.toFixed(1)}h
                        </span>
                      </div>
                    )}
                    {t.story_points !== undefined && (
                      <div className={styles.detailMeta}>
                        <span className={styles.detailMetaLabel}>Points</span>
                        <span className={styles.detailMetaVal}>{t.story_points}</span>
                      </div>
                    )}
                    {t.due_date && (
                      <div className={styles.detailMeta}>
                        <span className={styles.detailMetaLabel}>Due</span>
                        <span
                          className={styles.detailMetaVal}
                          style={{
                            color: new Date(t.due_date) < new Date() ? "var(--red)" : "var(--text-2)",
                          }}
                        >
                          {t.due_date}
                        </span>
                      </div>
                    )}
                    {t.client && (
                      <div className={styles.detailMeta}>
                        <span className={styles.detailMetaLabel}>Client</span>
                        <span className={styles.detailMetaVal}>{t.client}</span>
                      </div>
                    )}
                    {t.pod && (
                      <div className={styles.detailMeta}>
                        <span className={styles.detailMetaLabel}>POD</span>
                        <span className={styles.detailMetaVal}>{t.pod}</span>
                      </div>
                    )}
                  </div>

                  {t.blockedBy && (
                    <div className={styles.detailAlert}>
                      <RiAlertLine size={12} color="var(--red)" />
                      <span>Blocked by {t.blockedBy}</span>
                    </div>
                  )}

                  {t.quickActions.length > 0 && (
                    <div className={styles.quickActions}>
                      <span className={styles.quickActionsLabel}>Quick Actions</span>
                      <div className={styles.quickActionsRow}>
                        {t.quickActions.map((qa) => (
                          <button
                            key={qa.id}
                            className={styles.quickActionBtn}
                            onClick={() => onQuickAction(qa.id, t)}
                          >
                            <QuickActionIcon icon={qa.icon} />
                            {qa.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
