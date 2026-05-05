import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { novaAgent, fetchNovaStatus } from "@/services/api";
import { GoNorthStar } from "react-icons/go";
import {
  RiSendPlaneLine,
  RiDeleteBin6Line,
  RiExternalLinkLine,
  RiTicketLine,
  RiArticleLine,
  RiCheckboxCircleLine,
  RiToolsLine,
} from "react-icons/ri";
import styles from "./EosPanel.module.css";

interface Citation {
  key?: string;
  title?: string;
  type?: string;
  url?: string;
  id?: string;
}

interface CreatedTicket {
  id: string;
  title: string;
  priority: string;
  issue_type: string;
}

interface Message {
  role: "user" | "eos";
  content: string;
  citations?: Citation[];
  toolsUsed?: string[];
  createdTicket?: CreatedTicket | null;
}

const SUGGESTIONS = [
  "Hi, how are you?",
  "How's my day looking?",
  "Show me my timesheet for this week",
  "What tickets are blocked right now?",
  "Create a bug: Login page crashes on mobile",
];

const TOOL_LABELS: Record<string, string> = {
  search:               "Searched tickets & wiki",
  list_tickets:         "Listed tickets",
  get_ticket:           "Fetched ticket",
  update_ticket_status: "Updated ticket status",
  create_ticket:        "Created ticket",
  get_timesheet:        "Fetched timesheet",
  log_time:             "Logged time",
  get_sprint:           "Checked sprint",
  get_analytics:        "Pulled analytics",
  get_team:             "Checked team",
  get_my_standup:       "Fetched standup",
  get_team_standup:     "Fetched team standup",
  generate_standup:     "Generated standup",
  rag_query:            "Searched knowledge base",
  get_decisions:        "Fetched decisions",
  get_goals:            "Fetched goals",
  get_wiki:             "Searched wiki",
  create_wiki_page:     "Created wiki page",
  get_knowledge_gaps:   "Checked knowledge gaps",
  update_settings:      "Updated settings",
};

function ToolBadges({ tools }: { tools: string[] }) {
  if (!tools.length) return null;
  return (
    <div className={styles.toolBadges}>
      {tools.slice(0, 4).map((t) => (
        <span key={t} className={styles.toolBadge}>
          <RiToolsLine size={9} />
          {TOOL_LABELS[t] ?? t}
        </span>
      ))}
    </div>
  );
}

function TicketCard({ ticket, onOpen }: { ticket: CreatedTicket; onOpen: () => void }) {
  return (
    <button className={styles.ticketCard} onClick={onOpen}>
      <span className={styles.ticketCardIcon}>
        <RiCheckboxCircleLine size={14} color="var(--green)" />
      </span>
      <div className={styles.ticketCardBody}>
        <span className={styles.ticketCardKey}>{ticket.id}</span>
        <span className={styles.ticketCardTitle}>{ticket.title}</span>
        <span className={styles.ticketCardMeta}>
          {ticket.issue_type} · {ticket.priority}
        </span>
      </div>
      <RiExternalLinkLine size={12} className={styles.ticketCardArrow} />
    </button>
  );
}

export default function EosPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHint, setLoadingHint] = useState("Thinking…");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: novaStatus } = useQuery({
    queryKey: ["nova-status"],
    queryFn: fetchNovaStatus,
    staleTime: 60 * 1000,
  });
  const model = (novaStatus as any)?.model ?? (novaStatus as any)?.provider ?? "AI";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, []);

  // Cycle loading hints so the user knows EOS is working
  useEffect(() => {
    if (!loading) return;
    const hints = ["Thinking…", "Checking data…", "Analysing…", "Almost there…"];
    let i = 0;
    const iv = setInterval(() => {
      i = (i + 1) % hints.length;
      setLoadingHint(hints[i]);
    }, 2200);
    return () => clearInterval(iv);
  }, [loading]);

  // Build history for the agent (last 10 turns, role mapped to "assistant")
  function buildHistory() {
    return messages.slice(-10).map((m) => ({
      role: m.role === "eos" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));
  }

  async function handleSend() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setLoadingHint("Thinking…");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const history = buildHistory();
      const res = await novaAgent(userMsg, history, 8);

      // Extract citations from tool steps (search / rag_query results)
      const citations: Citation[] = [];
      for (const step of res.steps ?? []) {
        const data = step?.tool_result?.data as Record<string, any> | undefined;
        if (!data) continue;
        if (Array.isArray(data.results)) {
          for (const r of data.results.slice(0, 4)) {
            citations.push({ key: r.key, title: r.title, type: r.type });
          }
        }
        if (Array.isArray(data.citations)) {
          for (const c of data.citations.slice(0, 3)) {
            citations.push({ key: c.key, title: c.title, type: c.type });
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "eos",
          content: res.answer,
          citations: citations.length ? citations : undefined,
          toolsUsed: res.tools_used ?? [],
          createdTicket: res.created_ticket ?? null,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "eos",
          content: "Sorry, I couldn't process that. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleCitationClick(c: Citation) {
    if (c.type === "ticket" && (c.id || c.key)) {
      navigate(`/tickets?key=${encodeURIComponent(String(c.key ?? c.id))}`);
    } else if (c.type === "wiki") {
      navigate(`/wiki?page=${encodeURIComponent(String(c.id))}`);
    } else if (c.url) {
      if (c.url.startsWith("/")) navigate(c.url);
      else window.open(c.url, "_blank");
    }
    onClose();
  }

  return (
    <div className={styles.panel}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerBrand}>
          <span className={styles.headerIcon}>
            <GoNorthStar />
          </span>
          <div>
            <div className={styles.headerTitle}>EOS</div>
            <div className={styles.headerSub}>{model}</div>
          </div>
        </div>
        <div className={styles.headerActions}>
          {messages.length > 0 && (
            <button
              className={styles.actionBtn}
              onClick={() => setMessages([])}
              title="Clear conversation"
            >
              <RiDeleteBin6Line size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div className={styles.messages}>
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <motion.div
              key="welcome"
              className={styles.welcome}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <span className={styles.welcomeIcon}>
                <GoNorthStar />
              </span>
              <p className={styles.welcomeTitle}>EOS Assistant</p>
              <p className={styles.welcomeSub}>
                Ask anything — tickets, sprints, timesheets, or ask me to take action.
              </p>
              <div className={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className={styles.suggestion}
                    onClick={() => {
                      setInput(s);
                      inputRef.current?.focus();
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            messages.map((m, i) => (
              <motion.div
                key={i}
                className={`${styles.messageWrap} ${
                  m.role === "user" ? styles.userWrap : styles.eosWrap
                }`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {m.role === "eos" && (
                  <span className={styles.eosAvatar}>
                    <GoNorthStar />
                  </span>
                )}
                <div
                  className={`${styles.bubble} ${
                    m.role === "user" ? styles.userBubble : styles.eosBubble
                  }`}
                >
                  <p className={styles.bubbleText}>{m.content}</p>

                  {/* Ticket created confirmation */}
                  {m.createdTicket && (
                    <TicketCard
                      ticket={m.createdTicket}
                      onOpen={() => {
                        navigate(`/tickets?key=${encodeURIComponent(m.createdTicket!.id)}`);
                        onClose();
                      }}
                    />
                  )}

                  {/* Citations */}
                  {m.citations && m.citations.length > 0 && (
                    <div className={styles.citations}>
                      <div className={styles.citLabel}>Sources</div>
                      {m.citations.slice(0, 4).map((c, j) => (
                        <button
                          key={j}
                          className={styles.citation}
                          onClick={() => handleCitationClick(c)}
                          title={`Open: ${c.title}`}
                        >
                          <span className={styles.citIcon}>
                            {c.type === "ticket" ? (
                              <RiTicketLine size={11} />
                            ) : (
                              <RiArticleLine size={11} />
                            )}
                          </span>
                          {c.key && (
                            <span className={styles.citKey}>{c.key}</span>
                          )}
                          <span className={styles.citTitle}>{c.title}</span>
                          <RiExternalLinkLine size={10} className={styles.citArrow} />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Tools used */}
                  {m.toolsUsed && m.toolsUsed.length > 0 && (
                    <ToolBadges tools={m.toolsUsed} />
                  )}
                </div>
              </motion.div>
            ))
          )}

          {/* Loading */}
          {loading && (
            <motion.div
              key="loading"
              className={`${styles.messageWrap} ${styles.eosWrap}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className={styles.eosAvatar}>
                <GoNorthStar />
              </span>
              <div className={`${styles.bubble} ${styles.eosBubble}`}>
                <div className={styles.loadingRow}>
                  <div className={styles.typingDots}>
                    <span /><span /><span />
                  </div>
                  <span className={styles.loadingHint}>{loadingHint}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className={styles.inputArea}>
        <div className={styles.inputRow}>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Ask EOS anything…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            disabled={loading}
          />
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={!input.trim() || loading}
          >
            <RiSendPlaneLine size={16} />
          </button>
        </div>
        <div className={styles.inputHint}>Powered by {model}</div>
      </div>
    </div>
  );
}
