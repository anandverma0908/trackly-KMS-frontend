import styles from "../MyWorkPage.module.css";
import type { TimeEnergy } from "../useMyWork";

interface Props {
  energy: TimeEnergy;
  loading: boolean;
}

export default function TimeEnergyWidget({ energy, loading }: Props) {
  if (loading) {
    return (
      <div className={`${styles.energyCard} ${styles.cardLoading}`}>
        <div className={styles.skeletonBar} />
      </div>
    );
  }

  const maxSpark = Math.max(...energy.daySparkline, 1);

  return (
    <div className={styles.energyCard}>
      <div className={styles.energyHeader}>
        <span>Time & Energy</span>
      </div>

      <div className={styles.energyScoreRow}>
        <div className={styles.energyScore}>
          <span className={styles.energyScoreVal}>{energy.focusScore}</span>
          <span className={styles.energyScoreLbl}>Focus Score</span>
        </div>
        <div className={styles.energyPeak}>
          <span className={styles.energyPeakLbl}>Peak window</span>
          <span className={styles.energyPeakVal}>{energy.peakHour}</span>
        </div>
      </div>

      <div className={styles.energySparkline}>
        {["M", "T", "W", "T", "F"].map((day, i) => (
          <div key={day + i} className={styles.sparkDay}>
            <div className={styles.sparkBarWrap}>
              <div
                className={styles.sparkBar}
                style={{
                  height: `${(energy.daySparkline[i] / maxSpark) * 100}%`,
                  background:
                    energy.daySparkline[i] >= 8 ? "var(--green)"
                    : energy.daySparkline[i] >= 5 ? "var(--accent)"
                    : "var(--amber)",
                }}
              />
            </div>
            <span className={styles.sparkLabel}>{day}</span>
          </div>
        ))}
      </div>

      <div className={styles.energyMeta}>
        <div className={styles.energyMetaItem}>
          <span className={styles.energyMetaLbl}>Logged</span>
          <span className={styles.energyMetaVal}>{energy.totalLogged.toFixed(1)}h</span>
        </div>
        <div className={styles.energyMetaItem}>
          <span className={styles.energyMetaLbl}>Estimated</span>
          <span className={styles.energyMetaVal}>{energy.totalEstimated.toFixed(1)}h</span>
        </div>
        {energy.overrunCount > 0 && (
          <div className={styles.energyMetaItem}>
            <span className={styles.energyMetaLbl}>Overruns</span>
            <span className={styles.energyMetaVal} style={{ color: "var(--amber)" }}>
              {energy.overrunCount}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
