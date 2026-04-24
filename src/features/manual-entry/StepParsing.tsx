import { PiStarFourFill } from "react-icons/pi";
import { RiCheckLine } from "react-icons/ri";
import styles from "./ManualEntryPage.module.css";

interface StepParsingProps {
  inputText: string;
  parsingStep: number;
  parsingSteps: string[];
}

export default function StepParsing({ inputText, parsingStep, parsingSteps }: StepParsingProps) {
  const progress = Math.round(((parsingStep + 1) / parsingSteps.length) * 100);

  return (
    <div className={styles.parseCard}>
      {/* ── Header ── */}
      <div className={styles.parseHead}>
        <div className={styles.parseIcon}>
          <PiStarFourFill size={16} />
        </div>
        <div className={styles.parseHeadText}>
          <span className={styles.parseTitle}>Reading your work…</span>
          <span className={styles.parseSub}>{parsingSteps[parsingStep] ?? "Processing…"}</span>
        </div>
        <div className={styles.parseLiveDot} />
      </div>

      {/* ── Body ── */}
      <div className={styles.parseBody}>
        {/* Left: input preview with scan beam */}
        <div className={styles.parseScanZone}>
          <div className={styles.parseScanBeam} />
          <p className={styles.parseScanText}>
            {inputText.slice(0, 320)}{inputText.length > 320 ? "…" : ""}
          </p>
        </div>

        {/* Right: steps + progress */}
        <div className={styles.parseRight}>
          {/* Progress bar */}
          <div className={styles.parseProgressWrap}>
            <div className={styles.parseProgressTrack}>
              <div className={styles.parseProgressFill} style={{ width: `${progress}%` }} />
            </div>
            <span className={styles.parseProgressPct}>{progress}%</span>
          </div>

          {/* Steps list */}
          <div className={styles.parseStepList}>
            {parsingSteps.map((label, i) => {
              const done   = i < parsingStep;
              const active = i === parsingStep;
              return (
                <div
                  key={label}
                  className={`${styles.parseStepRow} ${done ? styles.parseStepDone : ""} ${active ? styles.parseStepActive : ""}`}
                >
                  <div className={styles.parseStepBullet}>
                    {done   ? <RiCheckLine size={10} /> :
                     active ? <div className={styles.parseStepSpinner} /> :
                              <div className={styles.parseStepDotIdle} />}
                  </div>
                  <span>{label}</span>
                </div>
              );
            })}
          </div>

          {/* Shimmer placeholder cards */}
          <div className={styles.parseShimmers}>
            <div className={styles.parseShimmerLabel}>Entries found</div>
            {[40, 65, 30].map((w, i) => (
              <div key={i} className={styles.parseShimmerRow}>
                <div className={styles.parseShimmerBar} style={{ width: `${w}%` }} />
                <div className={styles.parseShimmerBadge} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
