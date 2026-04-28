import styles from "../MyWorkPage.module.css";
import type { SprintRisk } from "../useMyWork";

interface Props {
  risk: SprintRisk | null;
  loading: boolean;
}

export default function SprintRiskWidget({ risk, loading }: Props) {
  if (loading) {
    return (
      <div className={`${styles.riskCard} ${styles.cardLoading}`}>
        <div className={styles.skeletonCircle} />
      </div>
    );
  }

  if (!risk) {
    return (
      <div className={styles.riskCard}>
        <div className={styles.riskHeader}>
          <span>Sprint Risk</span>
        </div>
        <p className={styles.riskEmpty}>No active sprint</p>
      </div>
    );
  }

  const ringColor =
    risk.status === "on_track" ? "var(--green)"
    : risk.status === "at_risk" ? "var(--amber)"
    : "var(--red)";
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (risk.probability / 100) * circumference;

  return (
    <div className={styles.riskCard}>
      <div>
        <div className={styles.riskHeader}>
          <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
            <span>Sprint Risk</span>
          </div>
          <p className={styles.riskCoaching} style={{ color: ringColor }}>
            {risk.coaching}
          </p>
        </div>
      </div>
      <div className={styles.riskBody}>
        <div className={styles.riskRingWrap}>
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="32" fill="none" stroke="var(--surface-3)" strokeWidth="5" />
            <circle
              cx="36" cy="36" r="32" fill="none"
              stroke={ringColor} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset}
              transform="rotate(-90 36 36)"
              style={{ transition: "stroke-dashoffset 1s ease" }}
            />
          </svg>
          <span className={styles.riskPct} style={{ color: ringColor }}>
            {risk.probability}%
          </span>
        </div>
        <div className={styles.riskStats}>
          <div className={styles.riskStat}>
            <span className={styles.riskStatVal}>{risk.completed}</span>
            <span className={styles.riskStatLbl}>Done</span>
          </div>
          <div className={styles.riskStat}>
            <span className={styles.riskStatVal}>{risk.remaining}</span>
            <span className={styles.riskStatLbl}>Left</span>
          </div>
          <div className={styles.riskStat}>
            <span className={styles.riskStatVal}>{risk.daysLeft}d</span>
            <span className={styles.riskStatLbl}>Time</span>
          </div>
          <div className={styles.riskStat}>
            <span className={styles.riskStatVal}>{risk.wipCount}</span>
            <span className={styles.riskStatLbl}>WIP</span>
          </div>
        </div>
      </div>
    </div>
  );
}
