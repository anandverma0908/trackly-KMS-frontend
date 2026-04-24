import { useState } from "react";
import { RiMessage2Line, RiCloseLine } from "react-icons/ri";
import styles from "../MyWorkPage.module.css";
import type { AITicket } from "../useMyWork";

interface Props {
  ticket: AITicket;
  onClose: () => void;
  onSend: (text: string) => Promise<void>;
}

export default function QuickCommentModal({ ticket, onClose, onSend }: Props) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSend() {
    if (!text.trim()) return;
    setSaving(true);
    await onSend(text.trim());
    setSaving(false);
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <RiMessage2Line size={15} color="var(--accent)" />
          <span>Comment on {ticket.key}</span>
          <button className={styles.modalClose} onClick={onClose}>
            <RiCloseLine size={16} />
          </button>
        </div>
        <p className={styles.modalSub}>{ticket.summary}</p>
        <div className={styles.modalField}>
          <label className={styles.modalLabel}>Message</label>
          <textarea
            className={styles.modalTextarea}
            placeholder="Describe the blocker or what's needed to unblock…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            autoFocus
          />
        </div>
        <div className={styles.modalActions}>
          <button className={styles.modalCancel} onClick={onClose}>Cancel</button>
          <button
            className={styles.modalSave}
            onClick={handleSend}
            disabled={saving || !text.trim()}
          >
            {saving ? "Sending…" : "Post Comment"}
          </button>
        </div>
      </div>
    </div>
  );
}
