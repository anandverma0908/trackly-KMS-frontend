import { useQuery } from "@tanstack/react-query";
import { fetchKnowledgeGaps } from "@/services/api";
import Skeleton from "@/components/ui/Skeleton";
import styles from "./KnowledgeGapsWidget.module.css";
import { TbBrain } from "react-icons/tb";
import { MdWarning } from "react-icons/md";

export default function KnowledgeGapsWidget() {
  const { data: gaps = [], isLoading } = useQuery({
    queryKey: ["knowledge-gaps"],
    queryFn: fetchKnowledgeGaps,
  });

  const sorted = [...gaps].sort((a, b) => b.ticket_count - a.ticket_count).slice(0, 6);

  if (isLoading) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.icon}><TbBrain /></span>
          <div className="card-title">Knowledge Gaps</div>
          <span className={styles.badge}>EOS</span>
        </div>
        <div className={styles.list}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonItem}>
              <Skeleton width="60%" height={12} />
              <Skeleton width="85%" height={9} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.icon}><TbBrain /></span>
        <div className="card-title">Knowledge Gaps</div>
        <span className={styles.badge}>EOS</span>
        {sorted.length > 0 && (
          <span className={styles.count}>{gaps.length} detected</span>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className={styles.empty}>
          <span>✅</span>
          <span>No knowledge gaps detected — great documentation!</span>
        </div>
      ) : (
        <div className={styles.list}>
          {sorted.map((g) => {
            const severity = g.ticket_count >= 5 ? "high" : g.ticket_count >= 2 ? "medium" : "low";
            return (
              <div key={g.id} className={`${styles.item} ${styles[severity]}`}>
                <div className={styles.itemHeader}>
                  <MdWarning
                    className={styles.warnIcon}
                    style={{
                      color: severity === "high" ? "var(--red)" : severity === "medium" ? "var(--amber)" : "var(--text-3)",
                    }}
                  />
                  <span className={styles.topic}>{g.topic}</span>
                  <span
                    className={styles.ticketCount}
                    style={{
                      color: severity === "high" ? "var(--red)" : severity === "medium" ? "var(--amber)" : "var(--text-3)",
                    }}
                  >
                    {g.ticket_count} tickets
                  </span>
                </div>
                <div className={styles.description}>{g.description}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
