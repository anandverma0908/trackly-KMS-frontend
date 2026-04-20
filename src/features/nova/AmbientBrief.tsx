import { useState } from "react";
import { RiSparklingLine, RiCheckLine, RiTimeLine } from "react-icons/ri";
import toast from "react-hot-toast";
import panelStyles from "./Gen2.module.css";
import styles from "./Gen3.module.css";

interface BriefOption {
  label: string;
  text: string;
  recommended: boolean;
  tradeoff: string;
}

interface Brief {
  id: string;
  urgency: "urgent" | "high" | "normal";
  agent: string;
  time: string;
  title: string;
  desc: string;
  options: BriefOption[];
  handled: boolean;
  chosenOption: string | null;
}

const INITIAL_BRIEFS: Brief[] = [
  {
    id: "b1",
    urgency: "urgent",
    agent: "Sprint Agent",
    time: "2 min ago",
    title: "API versioning approach needs a decision",
    desc: "TRK-208 (API versioning) is blocking 3 downstream tickets. The team has proposed 3 approaches. EOS has analyzed historical patterns and team velocity impact for each.",
    options: [
      { label: "A", text: "URI versioning (/v1/, /v2/) — simple, widely understood, easy to deprecate. Adds URL churn.", recommended: false, tradeoff: "Lowest dev friction, highest URL sprawl" },
      { label: "B", text: "Header versioning (Accept: application/vnd.api+json;version=2) — clean URLs, harder to debug.", recommended: false, tradeoff: "Cleaner URLs, harder to test and share" },
      { label: "C", text: "Query parameter versioning (?version=2) — flexible, backwards-compatible, industry standard for your API profile.", recommended: true, tradeoff: "EOS recommends: matches your current client SDK patterns" },
    ],
    handled: false,
    chosenOption: null,
  },
  {
    id: "b2",
    urgency: "high",
    agent: "Health Agent",
    time: "14 min ago",
    title: "3 engineers showing stress signals in Sprint 9 comments",
    desc: "Linguistic patterns in Priya S., Rahul D., and Karan M.'s comments over the last 72 hours correlate with frustration and overload signals. Sprint workload may be contributing.",
    options: [
      { label: "A", text: "Schedule a 15-min check-in with the 3 flagged engineers today.", recommended: true, tradeoff: "EOS recommends: lowest overhead, highest signal value" },
      { label: "B", text: "Reduce sprint scope by 10% — move 2 lowest-priority tickets to backlog.", recommended: false, tradeoff: "Addresses workload cause, delays sprint goal slightly" },
      { label: "C", text: "Monitor for 48 more hours before acting.", recommended: false, tradeoff: "Risk of escalation if signals are genuine stress" },
    ],
    handled: false,
    chosenOption: null,
  },
  {
    id: "b3",
    urgency: "normal",
    agent: "Documentation Agent",
    time: "1 hr ago",
    title: "DB failover runbook is 180+ days stale",
    desc: "The 'Database Failover Procedure' wiki page hasn't been updated since the migration to PostgreSQL replicas. It references the old single-node setup. 4 on-call engineers rely on it.",
    options: [
      { label: "A", text: "EOS drafts an updated runbook from the ADR and migration tickets — you review.", recommended: true, tradeoff: "EOS recommends: 10 min review vs 2h manual rewrite" },
      { label: "B", text: "Assign runbook update to Rahul D. as a backlog ticket.", recommended: false, tradeoff: "Higher quality, adds to sprint backlog" },
      { label: "C", text: "Archive the stale page and leave a stub.", recommended: false, tradeoff: "Unblocks on-call confusion but leaves a gap" },
    ],
    handled: false,
    chosenOption: null,
  },
];

export default function AmbientBrief() {
  const [briefs, setBriefs] = useState<Brief[]>(INITIAL_BRIEFS);

  function chooseOption(id: string, label: string) {
    setBriefs((prev) =>
      prev.map((b) => b.id === id ? { ...b, chosenOption: label } : b)
    );
  }

  function handleBrief(id: string) {
    const brief = briefs.find((b) => b.id === id);
    if (!brief?.chosenOption) return;
    setBriefs((prev) => prev.map((b) => b.id === id ? { ...b, handled: true } : b));
    toast.success(`Decision recorded — EOS will proceed with Option ${brief.chosenOption}`);
  }

  function deferBrief(id: string) {
    setBriefs((prev) => prev.map((b) => b.id === id ? { ...b, handled: true, chosenOption: "deferred" } : b));
    toast("Brief deferred — EOS will resurface in 24 hours", { icon: "🕐" });
  }

  const urgencyClass: Record<string, string> = {
    urgent: styles.ambientCardUrgent,
    high: styles.ambientCardHigh,
    normal: styles.ambientCardNormal,
  };
  const urgencyLabel: Record<string, string> = { urgent: "Urgent", high: "High", normal: "Decision" };
  const urgencyStyle: Record<string, string> = {
    urgent: styles.ambientUrgencyUrgent,
    high: styles.ambientUrgencyHigh,
    normal: styles.ambientUrgencyNormal,
  };

  return (
    <div className={panelStyles.panel}>
      <div className={panelStyles.panelHeader}>
        <h2 className={panelStyles.panelTitle}>Ambient Intelligence</h2>
        <p className={panelStyles.panelSub}>
          Nova proactively surfaces decisions that need a human. Everything else — agents handle. Each brief includes options, tradeoffs, and an EOS recommendation.
        </p>
      </div>

      <div className={styles.ambientIntro}>
        <RiSparklingLine size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
        <span>
          {briefs.filter((b) => !b.handled).length > 0
            ? `${briefs.filter((b) => !b.handled).length} decisions waiting for your input. EOS has prepared each brief with options and a recommendation — total review time: ~10 min.`
            : "You're all caught up. EOS is handling everything else autonomously — you'll be notified when the next decision needs you."}
        </span>
      </div>

      <div className={styles.ambientList}>
        {briefs.map((brief) => (
          <div key={brief.id} className={`${styles.ambientCard} ${urgencyClass[brief.urgency]}`}>
            <div className={styles.ambientHeader}>
              <span className={`${styles.ambientUrgency} ${urgencyStyle[brief.urgency]}`}>
                {urgencyLabel[brief.urgency]}
              </span>
              <span className={styles.ambientAgent}>{brief.agent}</span>
              <span className={styles.ambientTime}>
                <RiTimeLine size={11} style={{ verticalAlign: "middle" }} /> {brief.time}
              </span>
              {brief.handled && (
                <span className={styles.ambientHandled} style={{ marginLeft: "auto" }}>
                  <RiCheckLine size={12} /> {brief.chosenOption === "deferred" ? "Deferred" : `Option ${brief.chosenOption} chosen`}
                </span>
              )}
            </div>

            <div className={styles.ambientTitle}>{brief.title}</div>
            <div className={styles.ambientDesc}>{brief.desc}</div>

            {!brief.handled && (
              <>
                <div className={styles.ambientOptions}>
                  <div className={styles.ambientOptionsLabel}>Options — select one to proceed</div>
                  {brief.options.map((opt) => (
                    <button
                      key={opt.label}
                      className={`${styles.ambientOption} ${opt.recommended ? styles.ambientOptionRec : ""} ${brief.chosenOption === opt.label ? styles.ambientOptionRec : ""}`}
                      onClick={() => chooseOption(brief.id, opt.label)}
                      disabled={brief.handled}
                    >
                      <span className={styles.ambientOptionLabel}>{opt.label}</span>
                      <span className={styles.ambientOptionText}>
                        {opt.text}
                        <br />
                        <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>{opt.tradeoff}</span>
                      </span>
                      {opt.recommended && <span className={styles.ambientRecTag}>EOS</span>}
                    </button>
                  ))}
                </div>

                <div className={styles.ambientActions}>
                  <button
                    className={styles.ambientActBtn}
                    onClick={() => handleBrief(brief.id)}
                    disabled={!brief.chosenOption}
                  >
                    <RiCheckLine size={13} /> Confirm Decision
                  </button>
                  <button className={styles.ambientDeferBtn} onClick={() => deferBrief(brief.id)}>
                    Defer 24h
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
