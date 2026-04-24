import { useState } from "react";
import { RiTimeLine, RiCloseLine } from "react-icons/ri";
import styles from "../MyWorkPage.module.css";
import type { AITicket } from "../useMyWork";

interface Props {
  ticket: AITicket;
  onClose: () => void;
  onSave: (hours: number, comment: string) => Promise<void>;
}

export default function QuickLogTimeModal({ ticket, onClose, onSave }: Props) {
  const [hours, setHours] = useState("1");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const h = parseFloat(hours);
    if (!h || h <= 0) return;
    setSaving(true);
    await onSave(h, comment || `Work on ${ticket.key}`);
    setSaving(false);
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <RiTimeLine size={15} color="var(--accent)" />
          <span>Log Time — {ticket.key}</span>
          <button className={styles.modalClose} onClick={onClose}>
            <RiCloseLine size={16} />
          </button>
        </div>
        <p className={styles.modalSub}>{ticket.summary}</p>
        <div className={styles.modalField}>
          <label className={styles.modalLabel}>Hours spent</label>
          <input
            className={styles.modalInput}
            type="number"
            min="0.25"
            step="0.25"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            autoFocus
          />
        </div>
        <div className={styles.modalField}>
          <label className={styles.modalLabel}>Comment (optional)</label>
          <textarea
            className={styles.modalTextarea}
            placeholder="What did you work on?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
          />
        </div>
        <div className={styles.modalActions}>
          <button className={styles.modalCancel} onClick={onClose}>Cancel</button>
          <button className={styles.modalSave} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Log Time"}
          </button>
        </div>
      </div>
    </div>
  );
}
