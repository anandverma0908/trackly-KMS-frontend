import { useRef } from "react";
import type { PersonRole } from "./types";
import styles from "./ManualEntryPage.module.css";
import { PiStarFourFill } from "react-icons/pi";

const SUGGESTIONS = [
  "Sprint planning 2h DPAI Colgate, then 4× 30min 1:1s with engineers",
  "Monday: stakeholder call Jockey 1.5h, PR reviews DevOps 1h, standup 15min",
  "This week: 8h sprint ceremonies, 6h 1:1s DPAI, 3h interviews, 2h roadmap",
  "Tuesday: design sync 1h, code review 45min TBS, bug triage 30min",
];

const PLACEHOLDER = `Describe your day or week naturally…`;

interface StepInputProps {
  inputText: string;
  setInputText: (v: string) => void;
  selectedRole: PersonRole;
  setRole: (r: PersonRole) => void;
  personName: string;
  onParse: () => void;
}

export default function StepInput({
  inputText,
  setInputText,
  onParse,
}: StepInputProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onParse();
  }

  return (
    <div className={styles.eosPanel}>
      {/* ── EOS Center ── */}
      <div className={styles.eosCenter}>
        <h2 className={styles.eosTitle}>Tell me about your day.</h2>
        <p className={styles.eosDesc}>
          Describe your work naturally. I'll extract every time entry.
        </p>

        {!inputText && (
          <div className={styles.eosSugs}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                className={styles.eosSug}
                onClick={() => {
                  setInputText(s);
                  taRef.current?.focus();
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Input bar ── */}
      <div className={styles.eosInputWrap}>
        <div className={styles.eosInputBar}>
          <textarea
            ref={taRef}
            className={styles.eosTextarea}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDER}
            rows={3}
            spellCheck={false}
          />
          <button
            className={`${styles.eosSendBtn} ${inputText.trim() ? styles.eosSendBtnOn : ""}`}
            onClick={onParse}
            disabled={!inputText.trim()}
            title="Parse with AI (⌘↵)"
          >
            <PiStarFourFill size={15} />
          </button>
        </div>
        <div className={styles.eosHints}>
          <span>"2h", "30min", "1.5 hours"</span>
          <span className={styles.eosHintDot}>·</span>
          <span>"Monday", "yesterday"</span>
          <span className={styles.eosHintDot}>·</span>
          <span>Mention PODs &amp; clients naturally</span>
          <kbd className={styles.eosKbd}>⌘ ↵</kbd>
        </div>
      </div>
    </div>
  );
}
