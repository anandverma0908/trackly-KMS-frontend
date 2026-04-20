import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RiBrainLine,
  RiSendPlaneLine,
  RiLightbulbLine,
  RiAlertLine,
  RiArrowRightLine,
  RiFileTextLine,
  RiBarChartLine,
  RiTimeLine,
  RiTeamLine,
  RiSparklingLine,
  RiCloseLine,
} from "react-icons/ri";
import styles from "./NovaPage.module.css";

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Insight {
  id: string;
  type: "risk" | "anomaly" | "suggestion" | "pattern";
  title: string;
  detail: string;
  action?: string;
  confidence: number;
  source?: string;
  icon: React.ReactNode;
}

interface Message {
  id: string;
  role: "user" | "nova";
  text: string;
  citations?: { key: string; title: string; type: string }[];
  timestamp: Date;
}

/* ── Mock data ─────────────────────────────────────────────────────────────── */
const INSIGHTS: Insight[] = [
  {
    id: "i1",
    type: "risk",
    title: "Sprint 9 at risk — 73% completion probability",
    detail:
      "3 unplanned tickets were added mid-sprint, reducing available capacity by ~18%. 2 tickets on the critical path are blocked by TRK-142.",
    action: "View sprint · Move at-risk tickets",
    confidence: 91,
    source: "Sprint velocity + ticket dependencies",
    icon: <RiAlertLine size={16} />,
  },
  {
    id: "i2",
    type: "anomaly",
    title: "Velocity dropped 38% sprint-over-sprint",
    detail:
      "Pattern detected in Sprint 4 and Sprint 7 as well — each coincided with mid-sprint scope additions. Consider a sprint scope freeze policy.",
    action: "View analytics",
    confidence: 87,
    source: "Historical sprint data (12 sprints)",
    icon: <RiBarChartLine size={16} />,
  },
  {
    id: "i3",
    type: "suggestion",
    title: "TRK-142 has been blocked 48 hours",
    detail:
      "This is blocking TRK-145 and TRK-147. Priya S. resolved a similar auth issue in Sprint 7 (TRK-89). Consider reassigning or pairing.",
    action: "View ticket · Ask Priya",
    confidence: 95,
    source: "Ticket history + team expertise graph",
    icon: <RiTimeLine size={16} />,
  },
  {
    id: "i4",
    type: "pattern",
    title: "Priya consistently resolves auth tickets fastest",
    detail:
      "8 auth-related tickets in the last 6 months — avg resolution time 1.2 days vs team avg 3.4 days. Consider routing similar tickets her way.",
    action: "View team insights",
    confidence: 88,
    source: "Team performance analytics",
    icon: <RiTeamLine size={16} />,
  },
  {
    id: "i5",
    type: "suggestion",
    title: "3 knowledge gaps detected in recent tickets",
    detail:
      "Auth token refresh, rate limiting, and DB failover are referenced in 7 tickets this sprint but have no corresponding wiki pages. Nova can draft these.",
    action: "Generate articles",
    confidence: 83,
    source: "Wiki coverage analysis",
    icon: <RiFileTextLine size={16} />,
  },
];

const SUGGESTIONS = [
  "What tickets are currently blocked?",
  "What did we decide about authentication?",
  "Who should I assign this auth ticket to?",
  "Summarise Sprint 9 goals",
  "What's our DB failover process?",
  "Show velocity trend last 6 sprints",
];

const MOCK_RESPONSES: Record<string, { text: string; citations?: { key: string; title: string; type: string }[] }> = {
  default: {
    text: "I found several relevant items in your team's knowledge base. Based on ticket history, wiki pages, and decision records, here's what I can tell you...",
    citations: [
      { key: "TRK-89", title: "Fix auth token expiry edge case", type: "ticket" },
      { key: "DEC-12", title: "Auth Architecture Decision", type: "decision" },
    ],
  },
};

/* ── Streaming text hook ───────────────────────────────────────────────────── */
function useStreamingText(text: string, active: boolean, speed = 15) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) return;
    setDisplayed("");
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, active, speed]);

  return { displayed, done };
}

/* ── Insight card ──────────────────────────────────────────────────────────── */
function InsightCard({ insight, delay }: { insight: Insight; delay: number }) {
  const [dismissed, setDismissed] = useState(false);

  const typeStyle: Record<string, string> = {
    risk: styles.insightRisk,
    anomaly: styles.insightAnomaly,
    suggestion: styles.insightSuggestion,
    pattern: styles.insightPattern,
  };

  if (dismissed) return null;

  return (
    <motion.div
      className={`${styles.insightCard} ${typeStyle[insight.type]}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      layout
    >
      <div className={styles.insightHeader}>
        <div className={styles.insightIconWrap}>{insight.icon}</div>
        <div className={styles.insightTitleRow}>
          <span className={styles.insightTitle}>{insight.title}</span>
          <span className={styles.insightConf}>
            {insight.confidence}% confidence
          </span>
        </div>
        <button
          className={styles.dismissBtn}
          onClick={() => setDismissed(true)}
        >
          <RiCloseLine size={13} />
        </button>
      </div>
      <p className={styles.insightDetail}>{insight.detail}</p>
      {insight.source && (
        <div className={styles.insightSource}>
          <RiSparklingLine size={11} />
          <span>Based on: {insight.source}</span>
        </div>
      )}
      {insight.action && (
        <div className={styles.insightActions}>
          {insight.action.split(" · ").map((a) => (
            <button key={a} className={styles.insightAction}>
              {a} <RiArrowRightLine size={11} />
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ── Message bubble ───────────────────────────────────────────────────────── */
function MessageBubble({ msg, isLatestNova }: { msg: Message; isLatestNova: boolean }) {
  const { displayed, done } = useStreamingText(
    msg.text,
    msg.role === "nova" && isLatestNova,
    12
  );

  const textToShow = (msg.role === "nova" && isLatestNova) ? displayed : msg.text;

  return (
    <motion.div
      className={`${styles.message} ${msg.role === "user" ? styles.messageUser : styles.messageNova}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {msg.role === "nova" && (
        <div className={styles.novaAvatar}>
          <RiBrainLine size={14} />
        </div>
      )}
      <div className={styles.messageBubble}>
        <p className={styles.messageText}>
          {textToShow}
          {msg.role === "nova" && isLatestNova && !done && (
            <span className={styles.streamCursor}>▋</span>
          )}
        </p>
        {msg.citations && done && (
          <div className={styles.citations}>
            <span className={styles.citationsLabel}>Sources</span>
            {msg.citations.map((c) => (
              <button key={c.key} className={styles.citation}>
                <span className={styles.citationKey}>{c.key}</span>
                <span className={styles.citationTitle}>{c.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────────── */
export default function NovaPage() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"insights" | "chat">("insights");
  const inputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(text?: string) {
    const q = (text ?? query).trim();
    if (!q || loading) return;

    setQuery("");
    setActiveTab("chat");

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text: q,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    // Simulate API delay
    await new Promise((r) => setTimeout(r, 900));

    const resp = MOCK_RESPONSES.default;
    const novaMsg: Message = {
      id: crypto.randomUUID(),
      role: "nova",
      text: `${resp.text}\n\nFor your query about "${q}", I analyzed your team's tickets, wiki pages, and decision records from the last 6 months. I found 3 closely related items that may be directly relevant.`,
      citations: resp.citations,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, novaMsg]);
    setLoading(false);
  }

  const latestNovaId = [...messages].reverse().find((m) => m.role === "nova")?.id;

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.novaIcon}>
            <RiBrainLine size={22} />
          </div>
          <div>
            <h1 className={styles.title}>Nova</h1>
            <p className={styles.subtitle}>
              AI intelligence hub · Proactive insights · Team knowledge search
            </p>
          </div>
        </div>
        <div className={styles.headerStats}>
          <div className={styles.stat}>
            <span className={styles.statNum}>5</span>
            <span className={styles.statLabel}>active insights</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>1.2k</span>
            <span className={styles.statLabel}>knowledge items indexed</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>94%</span>
            <span className={styles.statLabel}>avg accuracy</span>
          </div>
        </div>
      </div>

      {/* ── Search bar (always visible) ── */}
      <div className={styles.searchWrap}>
        <div className={styles.searchBar}>
          <RiBrainLine size={16} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.searchInput}
            placeholder="Ask Nova anything about your team, tickets, decisions, processes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button
            className={`${styles.sendBtn} ${query.trim() ? styles.sendBtnActive : ""}`}
            onClick={() => handleSend()}
            disabled={!query.trim() || loading}
          >
            <RiSendPlaneLine size={16} />
          </button>
        </div>
        <div className={styles.suggestions}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className={styles.suggestion}
              onClick={() => handleSend(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "insights" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("insights")}
        >
          <RiLightbulbLine size={14} />
          Proactive Insights
          <span className={styles.tabBadge}>{INSIGHTS.length}</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === "chat" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          <RiBrainLine size={14} />
          Chat with Nova
          {messages.length > 0 && (
            <span className={styles.tabBadge}>{messages.length}</span>
          )}
        </button>
      </div>

      {/* ── Content ── */}
      <AnimatePresence mode="wait">
        {activeTab === "insights" ? (
          <motion.div
            key="insights"
            className={styles.insightsGrid}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {INSIGHTS.map((insight, i) => (
              <InsightCard key={insight.id} insight={insight} delay={i * 0.08} />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            className={styles.chatPane}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {messages.length === 0 ? (
              <div className={styles.emptyChat}>
                <RiBrainLine size={40} className={styles.emptyChatIcon} />
                <p>Ask Nova about tickets, decisions, processes, or team performance.</p>
                <p className={styles.emptyChatSub}>
                  Nova searches across your entire team's knowledge — tickets, wiki, ADRs, and standups.
                </p>
              </div>
            ) : (
              <div className={styles.messageList}>
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isLatestNova={msg.id === latestNovaId}
                  />
                ))}
                {loading && (
                  <div className={styles.thinkingRow}>
                    <div className={styles.novaAvatar}>
                      <RiBrainLine size={14} />
                    </div>
                    <div className={styles.thinkingDots}>
                      <span /><span /><span />
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
