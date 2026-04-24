import { RiFocus3Line, RiFlashlightLine } from "react-icons/ri";
import styles from "../MyWorkPage.module.css";
import type { FocusBlock } from "../useMyWork";

interface Props {
  block: FocusBlock | null;
  onTicketClick: (key: string) => void;
}

export default function SmartFocusBlock({ block, onTicketClick }: Props) {
  const t = block?.recommendedTicket ?? null;

  return (
    <div className={`${styles.focusCard} fade-up-1`}>
      <div className={styles.focusLeft}>
        <div className={styles.focusHeader}>
          <RiFocus3Line size={16} color="var(--accent)" />
          <span>Smart Focus Block</span>
        </div>
        {t && (
          <>
            <p className={styles.focusMessage}>Your top priority right now.</p>
            <p className={styles.focusSub}>
              {t.key} needs ~
              {t.remaining_estimate_hours || t.original_estimate_hours || 2}h —
              start here.
            </p>
          </>
        )}
      </div>
      {t ? (
        <div className={styles.focusRight}>
          <div className={styles.focusTicket}>
            <span className={styles.focusKey}>{t.key}</span>
            <span className={styles.focusSummary}>{t.summary}</span>
          </div>
          <div className={styles.focusActions}>
            <button
              className={styles.focusBtnPrimary}
              onClick={() => onTicketClick(t.key)}
            >
              <RiFlashlightLine size={14} />
              Start Focus
            </button>
          </div>
        </div>
      ) : (
        <p className={styles.focusNoData}>No record found</p>
      )}
    </div>
  );
}
