import { useState, useEffect, useRef } from "react";
import { RiSparklingLine } from "react-icons/ri";
import styles from "../MyWorkPage.module.css";

type BriefChip = {
  label: string;
  type: "critical" | "warning" | "info" | "action";
};

interface Props {
  text: string;
  chips: BriefChip[];
  loading: boolean;
}

export default function EosAgentBrief({ text, chips: _chips, loading }: Props) {
  const [displayed, setDisplayed] = useState("");
  const idxRef = useRef(0);

  useEffect(() => {
    if (!text || loading) return;
    idxRef.current = 0;
    setDisplayed("");
    const interval = setInterval(() => {
      idxRef.current += 1;
      setDisplayed(text.slice(0, idxRef.current));
      if (idxRef.current >= text.length) clearInterval(interval);
    }, 16);
    return () => clearInterval(interval);
  }, [text, loading]);

  if (loading) {
    return (
      <div className={`${styles.agentCard} ${styles.agentCardLoading} fade-up`}>
        <div className={styles.agentAvatarWrap}>
          <div className={styles.agentAvatar}>
            <RiSparklingLine size={14} />
          </div>
        </div>
        <div className={styles.agentContent}>
          <div className={styles.agentBubble}>
            <span className={styles.agentLoadingText}>EOS is analysing…</span>
            <span className={styles.briefCursor}>|</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.agentCard} fade-up`}>
      <div className={styles.agentAvatarWrap}>
        <div className={styles.agentAvatar}>
          <RiSparklingLine size={14} />
        </div>
        <div className={styles.agentPulse} />
      </div>
      <div className={styles.agentContent}>
        <div className={styles.agentBubble}>
          <span className={styles.agentName}>EOS</span>
          <p className={styles.agentText}>
            {displayed}
            {displayed.length < text.length && (
              <span className={styles.briefCursor}>|</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
