import { useState, useRef, useEffect } from "react";
import { novaQuery } from "@/services/api";
import type { NovaQueryResponse } from "@/types";
import styles from "./NovaChatWidget.module.scss";

import { GoNorthStar } from "react-icons/go";

interface Message {
  role: "user" | "nova";
  content: string;
  citations?: { title: string; key?: string }[];
}

export default function NovaChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function handleSend() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const res: NovaQueryResponse = await novaQuery(userMsg, "wiki");
      setMessages((prev) => [
        ...prev,
        {
          role: "nova",
          content: res.answer,
          citations: res.citations?.map((c) => ({
            title: c.title,
            key: c.key,
          })),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "nova",
          content: "Sorry, I couldn't process that. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Toggle button */}
      <button
        className={styles.toggleBtn}
        onClick={() => setOpen((v) => !v)}
        title="EOS Assistant"
      >
        {/* <span className={styles.toggleGlow} /> */}
        <span className={styles.toggleIcon}>
          {open ? "✕" : <GoNorthStar />}
        </span>
        {!open && <span className={styles.toggleLabel}>EOS</span>}
      </button>

      {/* Chat panel */}
      {open && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              {/* <span className={styles.headerGlow} /> */}
              <GoNorthStar className={styles.headerGlow} />
              <div>
                <div className={styles.headerTitle}>EOS Assistant</div>
                <div className={styles.headerSub}>
                  Powered by Llama 3.1 · 100% Local
                </div>
              </div>
            </div>
            <button
              className={styles.clearBtn}
              onClick={() => setMessages([])}
              title="Clear history"
            >
              ⟳
            </button>
          </div>

          <div className={styles.messages}>
            {messages.length === 0 && (
              <div className={styles.welcome}>
                <span className={styles.welcomeIcon}>
                  <GoNorthStar />
                </span>
                <p>
                  Ask me anything about your processes, tickets, or team docs.
                </p>
                <div className={styles.suggestions}>
                  {[
                    "How do I create a ticket?",
                    "What's our on-call process?",
                    "Show me sprint best practices",
                  ].map((s) => (
                    <button
                      key={s}
                      className={styles.suggestion}
                      onClick={() => {
                        setInput(s);
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`${styles.message} ${m.role === "user" ? styles.userMsg : styles.novaMsg}`}
              >
                {m.role === "nova" && (
                  <div className={styles.msgBadge}>
                    {" "}
                    <GoNorthStar /> EOS
                  </div>
                )}
                <p className={styles.msgText}>{m.content}</p>
                {m.citations && m.citations.length > 0 && (
                  <div className={styles.citations}>
                    <div className={styles.citLabel}>Sources:</div>
                    {m.citations.slice(0, 3).map((c, j) => (
                      <span key={j} className={styles.citation}>
                        {c.key && (
                          <span className={styles.citKey}>{c.key}</span>
                        )}
                        {c.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className={`${styles.message} ${styles.novaMsg}`}>
                <div className={styles.msgBadge}>
                  <GoNorthStar /> EOS
                </div>
                <div className={styles.typingDots}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className={styles.inputRow}>
            <input
              className={styles.input}
              placeholder="Ask EOS…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && handleSend()
              }
              disabled={loading}
            />
            <button
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={!input.trim() || loading}
            >
              ↵
            </button>
          </div>
        </div>
      )}
    </>
  );
}
