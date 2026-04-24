import { useRef } from "react";
import type { PersonRole } from "./types";
import styles from "./ManualEntryPage.module.css";
import { PiStarFourFill } from "react-icons/pi";
import { RiTimeLine, RiCalendarLine, RiPriceTag3Line } from "react-icons/ri";

const SUGGESTIONS = [
  "Sprint planning 2h DPAI Colgate, then 4x 30min 1:1s with engineers",
  "Monday: stakeholder call Jockey 1.5h, PR reviews DevOps 1h, standup 15min",
  "This week: 8h sprint ceremonies, 6h 1:1s DPAI, 3h interviews, 2h roadmap",
];

const PLACEHOLDER = `Describe your day or week naturally…

"Monday had sprint planning 2h for DPAI Colgate, then 1:1s with 4 engineers 30min each, standup 15min. Tuesday stakeholder call Jockey 1.5h and reviewed PRs 1h DevOps."`;

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
  selectedRole: _selectedRole,
  setRole: _setRole,
  personName: _personName,
  onParse,
}: StepInputProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onParse();
  }

  return (
    <div className={styles.aiEntry}>
      {/* ── Header ── */}
      <div className={styles.aiEntryHeader}>
        <div className={styles.aiEntryIcon}>
          <PiStarFourFill size={16} />
        </div>
        <div className={styles.aiEntryHeaderText}>
          <span className={styles.aiEntryTitle}>AI Time Parser</span>
          <span className={styles.aiEntrySub}>
            Describe your work — I'll extract every time entry
          </span>
        </div>
        <div className={styles.aiEntryStatusRow}>
          <span className={styles.aiEntryLiveDot} />
          <span className={styles.aiEntryLiveLabel}>Ready</span>
        </div>
      </div>

      {/* ── Textarea ── */}
      <div className={styles.aiEntryBody}>
        <div className={styles.aiEntryTextareaWrap}>
          <textarea
            ref={taRef}
            className={styles.aiEntryTextarea}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDER}
            rows={7}
            spellCheck={false}
          />
        </div>

        {/* ── Suggestions ── */}
        <div className={styles.aiEntrySugs}>
          <span className={styles.aiEntrySugsLabel}>Try:</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className={styles.aiEntrySug}
              onClick={() => {
                setInputText(s);
                taRef.current?.focus();
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className={styles.aiEntryFooter}>
        <div className={styles.aiEntryTips}>
          <span className={styles.aiEntryTip}>
            <RiTimeLine size={12} />
            "2h", "30min", "1.5 hours"
          </span>
          <span className={styles.aiEntryTipDot} />
          <span className={styles.aiEntryTip}>
            <RiCalendarLine size={12} />
            "Monday", "yesterday"
          </span>
          <span className={styles.aiEntryTipDot} />
          <span className={styles.aiEntryTip}>
            <RiPriceTag3Line size={12} />
            Mention PODs &amp; clients naturally
          </span>
        </div>
        <div className={styles.aiEntryActions}>
          <kbd className={styles.aiEntryKbd}>⌘ ↵</kbd>
          <button
            className={styles.aiEntryParseBtn}
            onClick={onParse}
            disabled={!inputText.trim()}
          >
            <PiStarFourFill size={13} />
            Parse with AI
          </button>
        </div>
      </div>
    </div>
  );
}
