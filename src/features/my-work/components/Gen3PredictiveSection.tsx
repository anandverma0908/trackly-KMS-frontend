import { RiBrainLine, RiCalendarLine, RiRocketLine, RiSparklingLine } from "react-icons/ri";
import styles from "../MyWorkPage.module.css";
import type { AITicket, CognitiveData, SprintRisk } from "../useMyWork";

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
        <RiBrainLine size={14} color="#a78bfa" />
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
        <RiCalendarLine size={14} color="#a78bfa" />
        <span>Focus Windows</span>
      </div>
      <div className={styles.proactiveEmpty}>
        <RiCalendarLine size={24} color="var(--text-3)" />
        <p>
          No calendar connected — focus windows need calendar integration to detect your deep
          work blocks.
        </p>
      </div>
    </div>
  );
}

/* ── Completion Prediction Card ── */
function CompletionPredictionCard({
  aiTickets,
  sprintRisk,
  loading,
}: {
  aiTickets: AITicket[];
  sprintRisk: SprintRisk | null;
  loading: boolean;
}) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const topTickets = aiTickets.slice(0, 3);
  const preds = topTickets.map((t) => {
    const est = t.remaining_estimate_hours || t.original_estimate_hours || 4;
    const daysAway = Math.ceil(est / 2.5);
    const future = new Date();
    future.setDate(future.getDate() + daysAway);
    return {
      key: t.key,
      predictedBy: days[future.getDay()],
      daysAway,
      sprintEnd: sprintRisk ? `${sprintRisk.daysLeft}d left` : "—",
      onTrack: daysAway <= (sprintRisk?.daysLeft ?? 5),
    };
  });

  return (
    <div className={styles.predictiveCard}>
      <div className={styles.predictiveHeader}>
        <RiRocketLine size={14} color="#a78bfa" />
        <span>Completion Prediction</span>
      </div>
      {loading ? (
        <div className={styles.proactiveSkeleton} />
      ) : preds.length === 0 ? (
        <div className={styles.proactiveEmpty}>
          <RiRocketLine size={24} color="var(--text-3)" />
          <p>No open tickets to predict — queue is clear.</p>
        </div>
      ) : (
        <div className={styles.completionList}>
          {preds.map((p) => (
            <div key={p.key} className={styles.completionItem}>
              <div className={styles.completionTop}>
                <span className={styles.completionKey}>{p.key}</span>
                <span
                  className={styles.completionStatus}
                  style={{ color: p.onTrack ? "var(--green)" : "var(--amber)" }}
                >
                  {p.onTrack ? "On track" : "At risk"}
                </span>
              </div>
              <div className={styles.completionRow}>
                <span className={styles.completionBy}>
                  Done by{" "}
                  <strong style={{ color: p.onTrack ? "var(--green)" : "var(--amber)" }}>
                    {p.predictedBy}
                  </strong>
                </span>
                <span className={styles.completionSprint}>Sprint: {p.sprintEnd}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Gen3 Section ── */
interface Props {
  aiTickets: AITicket[];
  sprintRisk: SprintRisk | null;
  cognitiveData: CognitiveData;
  loading: boolean;
}

export default function Gen3PredictiveSection({ aiTickets, sprintRisk, cognitiveData, loading }: Props) {
  return (
    <div className={`${styles.genSection} fade-up-3`}>
      <div className={styles.gen3Grid}>
        <CognitiveLoadCard cognitiveData={cognitiveData} loading={loading} />
        <FocusWindowCard />
        <CompletionPredictionCard aiTickets={aiTickets} sprintRisk={sprintRisk} loading={loading} />
      </div>
    </div>
  );
}
