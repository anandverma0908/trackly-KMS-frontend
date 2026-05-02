import { RiSparklingLine } from "react-icons/ri";
import styles from "../MyWorkPage.module.css";
import type { CognitiveData, VelocityPattern } from "../useMyWork";

/* ── Cognitive Load Card ── */
function CognitiveLoadCard({
  cognitiveData,
  loading,
}: {
  cognitiveData: CognitiveData;
  loading: boolean;
}) {
  const { wipCount, blockedCount, staleCount, loadScore, recommendation } = cognitiveData;
  const scoreColor =
    loadScore >= 80 ? "var(--red)" : loadScore >= 50 ? "var(--amber)" : "var(--green)";
  const scoreLabel =
    loadScore >= 80 ? "Overloaded" : loadScore >= 50 ? "Elevated" : "Balanced";
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (loadScore / 100) * circumference;

  return (
    <div className={styles.predictiveCard}>
      <div className={styles.predictiveHeader}>
        {/* <RiBrainLine size={14} color="#a78bfa" /> */}
        <span>Cognitive Load</span>
      </div>
      {loading ? (
        <div className={styles.proactiveSkeleton} />
      ) : (
        <>
          <div className={styles.cogLoadBody}>
            <div className={styles.cogGaugeWrap}>
              <svg width="56" height="56" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" fill="none" stroke="var(--surface-3)" strokeWidth="4" />
                <circle
                  cx="28" cy="28" r="24" fill="none"
                  stroke={scoreColor} strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={circumference} strokeDashoffset={offset}
                  transform="rotate(-90 28 28)"
                  style={{ transition: "stroke-dashoffset 1s ease" }}
                />
              </svg>
              <span className={styles.cogScore} style={{ color: scoreColor }}>
                {loadScore}
              </span>
            </div>
            <div className={styles.cogMeta}>
              <span className={styles.cogLabel} style={{ color: scoreColor }}>
                {scoreLabel}
              </span>
              <div className={styles.cogBreakdown}>
                <div className={styles.cogItem}>
                  <span className={styles.cogItemLbl}>WIP</span>
                  <span className={styles.cogItemVal}>{wipCount}</span>
                </div>
                <div className={styles.cogItem}>
                  <span className={styles.cogItemLbl}>Blocked</span>
                  <span
                    className={styles.cogItemVal}
                    style={{ color: blockedCount > 0 ? "var(--red)" : undefined }}
                  >
                    {blockedCount}
                  </span>
                </div>
                <div className={styles.cogItem}>
                  <span className={styles.cogItemLbl}>Stale</span>
                  <span className={styles.cogItemVal}>{staleCount}</span>
                </div>
              </div>
            </div>
          </div>
          <p className={styles.predictiveRec}>
            <RiSparklingLine size={10} />
            {recommendation}
          </p>
        </>
      )}
    </div>
  );
}

/* ── Focus Window Card ── */
function FocusWindowCard() {
  return (
    <div className={styles.predictiveCard}>
      <div className={styles.predictiveHeader}>
        <span>Focus Windows</span>
      </div>
      <div className={styles.proactiveEmpty}>
        <p>
          No calendar connected — focus windows need calendar integration to detect your deep
          work blocks.
        </p>
      </div>
    </div>
  );
}

/* ── Velocity Pattern Card ── */
function VelocityPatternCard({ velocityPatterns }: { velocityPatterns: VelocityPattern[] }) {
  const hasData = velocityPatterns.some((v) => v.completed > 0);
  const maxVal = Math.max(...velocityPatterns.map((v) => v.completed), 1);

  return (
    <div className={styles.predictiveCard}>
      <div className={styles.predictiveHeader}>
        <span>Velocity Patterns</span>
      </div>
      {!hasData ? (
        <div className={styles.proactiveEmpty}>
          <p>No worklog data yet — log time on tickets to see your velocity patterns.</p>
        </div>
      ) : (
        <>
          <p className={styles.predictiveRec}>
            <RiSparklingLine size={10} />
            Hours logged over the last 5 business days.
          </p>
          <div className={styles.velocityBars}>
            {velocityPatterns.map((v) => (
              <div key={v.day} className={styles.velocityBarCol}>
                <div className={styles.velocityBarWrap}>
                  <div
                    className={styles.velocityBarFill}
                    style={{
                      height: `${(v.completed / maxVal) * 100}%`,
                      background: v.completed >= 6 ? "var(--green)" : v.completed >= 3 ? "var(--accent)" : "var(--amber)",
                    }}
                  />
                </div>
                <span className={styles.velocityBarLabel}>{v.day}</span>
                <span className={styles.velocityBarVal}>{v.completed}h</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Gen3 Section ── */
interface Props {
  cognitiveData: CognitiveData;
  velocityPatterns: VelocityPattern[];
  loading: boolean;
}

export default function Gen3PredictiveSection({ cognitiveData, velocityPatterns, loading }: Props) {
  return (
    <div className={`${styles.genSection} fade-up-3`}>
      <div className={styles.gen3Grid}>
        <CognitiveLoadCard cognitiveData={cognitiveData} loading={loading} />
        <FocusWindowCard />
        <VelocityPatternCard velocityPatterns={velocityPatterns} />
      </div>
    </div>
  );
}
