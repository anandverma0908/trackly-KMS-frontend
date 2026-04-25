import { RiShieldLine, RiLineChartLine, RiAlertLine, RiArrowRightLine, RiSendPlaneLine, RiTimerLine } from "react-icons/ri";
import styles from "../MyWorkPage.module.css";
import type { AITicket, MyWorkFlowAnalysis, MyWorkBlockerPrediction, VelocityPattern } from "../useMyWork";

interface BlockerPred {
  key: string;
  reason: string;
  hoursUntilBlock: number;
}

/* ── Flow State Card ── */
function FlowStateCard({
  contextSwitches,
  weeklyAvg,
  flowState,
  recommendation,
  topTickets,
  onTicketClick,
  loading,
}: {
  contextSwitches: number;
  weeklyAvg: number;
  flowState: "focused" | "disrupted" | "scattered";
  recommendation: string;
  topTickets: AITicket[];
  onTicketClick: (key: string) => void;
  loading: boolean;
}) {
  const isHigh = flowState !== "focused";
  const ratio = weeklyAvg > 0 ? (contextSwitches / weeklyAvg).toFixed(1) : "1.0";

  return (
    <div className={`${styles.proactiveCard} ${isHigh ? styles.proactiveCardAlert : ""}`}>
      <div className={styles.proactiveHeader}>
        <RiShieldLine size={14} color={isHigh ? "var(--amber)" : "var(--accent)"} />
        <span>Flow State Protection</span>
      </div>
      {loading ? (
        <div className={styles.proactiveSkeleton} />
      ) : (
        <>
          <p className={styles.proactiveMessage}>
            You've had{" "}
            <strong style={{ color: isHigh ? "var(--amber)" : "var(--text)" }}>
              {contextSwitches} context switches
            </strong>{" "}
            today — that's{" "}
            <strong style={{ color: isHigh ? "var(--amber)" : "var(--text)" }}>
              {ratio}×
            </strong>{" "}
            your weekly average.
          </p>
          {isHigh && topTickets.length > 0 ? (
            <div className={styles.proactiveFocusList}>
              <span className={styles.proactiveFocusLabel}>{recommendation}</span>
              {topTickets.slice(0, 2).map((t) => (
                <button
                  key={t.key}
                  className={styles.proactiveFocusItem}
                  onClick={() => onTicketClick(t.key)}
                >
                  <span className={styles.proactiveFocusKey}>{t.key}</span>
                  <span className={styles.proactiveFocusSummary}>{t.summary}</span>
                  <RiArrowRightLine size={12} />
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.proactiveGood}>{recommendation}</p>
          )}
        </>
      )}
    </div>
  );
}

/* ── Velocity Pattern Card ── */
function VelocityPatternCard({ velocityPatterns }: { velocityPatterns: VelocityPattern[] }) {
  const hasData = velocityPatterns.some((v) => v.completed > 0);
  const maxVal = Math.max(...velocityPatterns.map((v) => v.completed), 1);

  return (
    <div className={styles.proactiveCard}>
      <div className={styles.proactiveHeader}>
        <RiLineChartLine size={14} color="var(--accent)" />
        <span>Velocity Patterns</span>
      </div>
      {!hasData ? (
        <div className={styles.proactiveEmpty}>
          <RiLineChartLine size={24} color="var(--text-3)" />
          <p>No worklog data yet — log time on tickets to see your velocity patterns.</p>
        </div>
      ) : (
        <>
          <p className={styles.proactiveMessage}>Hours logged over the last 5 business days.</p>
          <div className={styles.velocityBars}>
            {velocityPatterns.map((v) => (
              <div key={v.day} className={styles.velocityBarCol}>
                <div className={styles.velocityBarWrap}>
                  <div
                    className={styles.velocityBarFill}
                    style={{
                      height: `${(v.completed / maxVal) * 100}%`,
                      background:
                        v.completed >= 6 ? "var(--green)"
                        : v.completed >= 3 ? "var(--accent)"
                        : "var(--amber)",
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

/* ── Blocker Prediction Card ── */
function BlockerPredictionCard({
  predictions,
  onTicketClick,
  loading,
}: {
  predictions: BlockerPred[];
  onTicketClick: (key: string) => void;
  loading: boolean;
}) {
  return (
    <div className={styles.proactiveCard}>
      <div className={styles.proactiveHeader}>
        <RiAlertLine size={14} color="var(--amber)" />
        <span>Blocker Prediction</span>
      </div>
      {loading ? (
        <div className={styles.proactiveSkeleton} />
      ) : predictions.length === 0 ? (
        <p className={styles.proactiveGood}>No blocker risks detected in your queue.</p>
      ) : (
        <div className={styles.predictionList}>
          {predictions.map((p) => {
            const urgencyColor =
              p.hoursUntilBlock <= 12 ? "var(--red)"
              : p.hoursUntilBlock <= 24 ? "var(--amber)"
              : "var(--text-3)";
            return (
              <div key={p.key} className={styles.predictionItem}>
                <div className={styles.predictionTop}>
                  <span className={styles.predictionKey}>{p.key}</span>
                  <span className={styles.predictionHours} style={{ color: urgencyColor }}>
                    ~{p.hoursUntilBlock}h until blocked
                  </span>
                </div>
                <p className={styles.predictionReason}>{p.reason}</p>
                <button className={styles.predictionCta} onClick={() => onTicketClick(p.key)}>
                  <RiSendPlaneLine size={11} />
                  Follow up now
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Context Switch Tax Card ── */
function ContextSwitchTaxCard({
  contextSwitches,
  flowState,
}: {
  contextSwitches: number;
  flowState: "focused" | "disrupted" | "scattered";
}) {
  const SWITCH_COST_MIN = 23;
  const HOURLY_RATE = 75;
  const totalMinutes = contextSwitches * SWITCH_COST_MIN;
  const taxHours = parseFloat((totalMinutes / 60).toFixed(1));
  const taxCost = Math.round(taxHours * HOURLY_RATE);
  const isHigh = flowState !== "focused";

  return (
    <div className={`${styles.proactiveCard} ${isHigh ? styles.proactiveCardAlert : ""}`}>
      <div className={styles.proactiveHeader}>
        <RiTimerLine size={14} color={isHigh ? "var(--amber)" : "var(--accent)"} />
        <span>Context Switch Tax</span>
      </div>
      <p className={styles.proactiveMessage}>
        <strong style={{ color: isHigh ? "var(--amber)" : "var(--text)" }}>{contextSwitches} context switches</strong> today
        cost an estimated{" "}
        <strong style={{ color: isHigh ? "var(--amber)" : "var(--text)" }}>{taxHours}h</strong> of deep-work time
        ({SWITCH_COST_MIN} min recovery each).
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <div style={{ flex: 1, textAlign: "center", padding: "8px 6px", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: isHigh ? "var(--amber)" : "var(--text)" }}>{taxHours}h</div>
          <div style={{ fontSize: "0.68rem", color: "var(--text-3)" }}>Focus Lost</div>
        </div>
        <div style={{ flex: 1, textAlign: "center", padding: "8px 6px", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: isHigh ? "var(--red)" : "var(--text)" }}>${taxCost}</div>
          <div style={{ fontSize: "0.68rem", color: "var(--text-3)" }}>Est. Cost</div>
        </div>
        <div style={{ flex: 1, textAlign: "center", padding: "8px 6px", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text)" }}>{contextSwitches}</div>
          <div style={{ fontSize: "0.68rem", color: "var(--text-3)" }}>Switches</div>
        </div>
      </div>
      {isHigh && (
        <p className={styles.proactiveMessage} style={{ marginTop: 8, fontSize: "0.76rem" }}>
          Block 2h of uninterrupted focus time to recover ~${Math.round(taxCost * 0.6)} of lost output.
        </p>
      )}
    </div>
  );
}

/* ── Gen2 Section ── */
interface Props {
  aiTickets: AITicket[];
  flowAnalysis: MyWorkFlowAnalysis;
  blockerPredictions: MyWorkBlockerPrediction[];
  velocityPatterns: VelocityPattern[];
  loading: boolean;
  onTicketClick: (key: string) => void;
}

export default function Gen2ProactiveSection({
  aiTickets,
  flowAnalysis,
  blockerPredictions,
  velocityPatterns,
  loading,
  onTicketClick,
}: Props) {
  const predictions: BlockerPred[] =
    blockerPredictions.length > 0
      ? blockerPredictions.map((p) => ({
          key: p.key,
          reason: p.reason,
          hoursUntilBlock: p.hours_until_block,
        }))
      : aiTickets
          .filter((t) => !t.status.toLowerCase().includes("block") && t.daysInStatus > 1)
          .slice(0, 2)
          .map((t, i) => ({
            key: t.key,
            reason:
              t.daysInStatus > 3
                ? `No update for ${t.daysInStatus} days — external dependency at risk`
                : i === 0
                  ? "Awaiting review — comment unanswered for 2d"
                  : "Dependency stalled",
            hoursUntilBlock: i === 0 ? 48 : 16,
          }));

  const focusKeys = flowAnalysis.focus_on.length > 0 ? flowAnalysis.focus_on : [];
  const topTickets =
    focusKeys.length > 0
      ? (focusKeys.map((k) => aiTickets.find((t) => t.key === k)).filter(Boolean) as AITicket[])
      : aiTickets.slice(0, 2);

  return (
    <div className={`${styles.genSection} fade-up-2`}>
      <div className={styles.gen2Grid}>
        <FlowStateCard
          contextSwitches={flowAnalysis.context_switches}
          weeklyAvg={Math.max(1, Math.floor(flowAnalysis.context_switches / 2))}
          flowState={flowAnalysis.flow_state}
          recommendation={flowAnalysis.recommendation}
          topTickets={topTickets}
          onTicketClick={onTicketClick}
          loading={loading}
        />
        <ContextSwitchTaxCard
          contextSwitches={flowAnalysis.context_switches}
          flowState={flowAnalysis.flow_state}
        />
        <VelocityPatternCard velocityPatterns={velocityPatterns} />
        <BlockerPredictionCard
          predictions={predictions}
          onTicketClick={onTicketClick}
          loading={loading}
        />
      </div>
    </div>
  );
}
