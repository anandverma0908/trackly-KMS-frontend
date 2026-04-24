import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { novaQuery, fetchNovaStatus } from "@/services/api";
import type { SearchResult } from "@/types";
import { GoNorthStar } from "react-icons/go";
import {
  RiSendPlaneLine,
  RiDeleteBin6Line,
  RiExternalLinkLine,
  RiTicketLine,
  RiArticleLine,
} from "react-icons/ri";
import styles from "./EosPanel.module.css";

interface Message {
  role: "user" | "eos";
  content: string;
  citations?: SearchResult[];
}

interface Props {
  onClose: () => void;
}

const SUGGESTIONS = [
  "What tickets are currently blocked?",
  "Summarise our sprint goals",
  "What's our on-call process?",
];

export default function EosPanel({ onClose }: Props) {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: novaStatus } = useQuery({
    queryKey: ["nova-status"],
    queryFn: fetchNovaStatus,
    staleTime: 60 * 1000,
  });
  const provider = (novaStatus as any)?.provider ?? "AI";
  const model    = (novaStatus as any)?.model ?? "";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, []);

  async function handleSend() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const res = await novaQuery(userMsg, "all");
      setMessages((prev) => [
        ...prev,
        {
          role: "eos",
          content: res.answer,
          citations: res.citations ?? [],
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "eos",
          content: "Sorry, I couldn't process that request. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleCitationClick(c: SearchResult) {
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
            <div className={styles.headerSub}>{model || provider}</div>
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
                Ask anything about your tickets, wiki, or processes.
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
                          <RiExternalLinkLine
                            size={10}
                            className={styles.citArrow}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}

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
                <div className={styles.typingDots}>
                  <span />
                  <span />
                  <span />
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
        <div className={styles.inputHint}>Powered by {model || provider}</div>
      </div>
    </div>
  );
}
