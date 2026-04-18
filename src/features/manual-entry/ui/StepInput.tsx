import { useRef } from "react";
import type { PersonRole } from "../model/types";
import styles from "../ManualEntryPage.module.scss";
import { PiStarFourFill } from "react-icons/pi";
import { RiArrowRightFill } from "react-icons/ri";
import { TbKeyFilled } from "react-icons/tb";
import { BsFillCalendar2EventFill } from "react-icons/bs";
import { RiPriceTag3Fill } from "react-icons/ri";

const SUGGESTIONS = [
  "Sprint planning 2h DPAI Colgate, then 4x 30min 1:1s with engineers",
  "Monday: stakeholder call Jockey 1.5h, PR reviews DevOps 1h, standup 15min",
  "This week: 8h sprint ceremonies, 6h 1:1s DPAI, 3h interviews, 2h roadmap planning SAAS",
];

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
    <div className={styles.inputStep}>
      {/* Role selector */}
      {/* <div className={styles.roleBar}>
        <span className={styles.roleLabel}>Logging as:</span>
        {ROLES.map((r) => (
          <button
            key={r}
            className={`${styles.rolePill} ${selectedRole === r ? styles.rolePillActive : ""}`}
            onClick={() => setRole(r)}
          >
            {r}
          </button>
        ))}
        <div className={styles.whoPill}>
          <div className={styles.whoAvatar}>
            {personName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </div>
          <span className={styles.whoName}>{personName}</span>
        </div>
      </div> */}

      {/* AI input box */}
      <div className={styles.aiBox}>
        <div className={styles.aiBoxTop}>
          <div className={styles.aiBadge}>
            <div className={styles.aiDot} />
            AI Parse
          </div>
          <textarea
            ref={taRef}
            className={styles.aiTextarea}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Describe your day or week naturally…\n\nE.g. "Monday had sprint planning 2h for DPAI Colgate, then 1:1s with 4 engineers 30min each, standup 15min. Tuesday stakeholder call Jockey 1.5h and reviewed PRs 1h DevOps."`}
            rows={5}
          />
        </div>

        <div className={styles.aiBoxBottom}>
          <span className={styles.aiEg}>Try:</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className={styles.aiSug}
              onClick={() => {
                setInputText(s);
                taRef.current?.focus();
              }}
            >
              {s.length > 50 ? s.slice(0, 50) + "…" : s}
            </button>
          ))}
          <div className={styles.aiBottomRight}>
            <span className={styles.aiHint}>⌘↵ to parse</span>
            <button
              className={styles.parseBtn}
              onClick={onParse}
              disabled={!inputText.trim()}
            >
              <PiStarFourFill />
              Parse with AI
              <RiArrowRightFill />
            </button>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className={styles.tips}>
        <div className={styles.tip}>
          <TbKeyFilled fontSize={14} />
          Mention hours like "2h", "30min", "1.5 hours"
        </div>
        <div className={styles.tip}>
          <BsFillCalendar2EventFill fontSize={14} />
          Include dates like "Monday", "Mar 14", "yesterday"
        </div>
        <div className={styles.tip}>
          <RiPriceTag3Fill fontSize={14} />
          Name PODs and clients as you normally would, AI will match them
        </div>
      </div>
    </div>
  );
}
