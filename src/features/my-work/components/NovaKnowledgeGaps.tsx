import { RiBookOpenLine, RiSparklingLine } from "react-icons/ri";
import styles from "../MyWorkPage.module.css";
import type { KnowledgeGap } from "@/types";

function getGapAction(topic: string, count: number): string {
  const t = topic.toLowerCase();
  if (t.includes("auth") || t.includes("security"))
    return "Review security runbook + schedule training session";
  if (t.includes("test") || t.includes("qa"))
    return "Write test patterns wiki for the team";
  if (t.includes("perf") || t.includes("optim"))
    return "Pair with infra team on a profiling session";
  if (t.includes("api") || t.includes("integr"))
    return "Document integration patterns in the wiki";
  if (t.includes("deploy") || t.includes("infra"))
    return "Schedule infra knowledge transfer with the team";
  if (count >= 5) return `High frequency — create a runbook for "${topic}"`;
  if (count >= 3) return `Recurring pattern — schedule pair programming on this`;
  return `Capture learnings in the wiki under "${topic}"`;
}

interface Props {
  gaps: KnowledgeGap[];
  loading: boolean;
}

export default function NovaKnowledgeGaps({ gaps, loading }: Props) {
  if (loading) {
    return (
      <div className={`${styles.kgCard} fade-up-4`}>
        <div className={styles.kgHeader}>
          <RiBookOpenLine size={14} />
          <span>Knowledge Gaps</span>
        </div>
        <div className={styles.kgSkeleton}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.kgSkeletonRow} />
          ))}
        </div>
      </div>
    );
  }

  const sorted = [...gaps].sort((a, b) => b.ticket_count - a.ticket_count).slice(0, 5);

  return (
    <div className={`${styles.kgCard} fade-up-4`}>
      <div className={styles.kgHeader}>
        <RiBookOpenLine size={14} />
        <span>Knowledge Gaps</span>
        {sorted.length > 0 && (
          <span className={styles.kgCount}>{sorted.length} detected by EOS</span>
        )}
      </div>
      {sorted.length === 0 ? (
        <p className={styles.cardEmpty}>No record found</p>
      ) : null}
      <div className={styles.kgGrid}>
        {sorted.map((gap) => {
          const severity =
            gap.ticket_count >= 5 ? "high" : gap.ticket_count >= 2 ? "medium" : "low";
          const action = getGapAction(gap.topic, gap.ticket_count);
          const sevColor =
            severity === "high" ? "var(--red)"
            : severity === "medium" ? "var(--amber)"
            : "var(--text-3)";
          return (
            <div key={gap.id} className={styles.kgItem}>
              <div className={styles.kgItemTop}>
                <span className={styles.kgTopic}>{gap.topic}</span>
                <span className={styles.kgTicketCount} style={{ color: sevColor }}>
                  {gap.ticket_count} tickets
                </span>
              </div>
              {gap.suggestion && <p className={styles.kgDesc}>{gap.suggestion}</p>}
              <div className={styles.kgAction}>
                <RiSparklingLine size={10} />
                <span>{action}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
