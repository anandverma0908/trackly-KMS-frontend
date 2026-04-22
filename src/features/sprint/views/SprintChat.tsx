import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { sendSprintChat } from "@/services/api";
import type { SprintChatMessage } from "@/types";
import {
  RiSparklingLine, RiSendPlaneLine, RiUserLine,
  RiRobot2Line, RiLightbulbLine,
} from "react-icons/ri";
import styles from "./SprintChat.module.css";

const SUGGESTIONS = [
  "What's blocking this sprint?",
  "Which tickets are at risk?",
  "How can we improve velocity?",
  "Suggest tickets to de-scope",
  "Who's overloaded this sprint?",
  "Compare this sprint to the last one",
];

export default function SprintChat({ sprintId, sprintName }: { sprintId: string; sprintName: string }) {
  const [messages, setMessages] = useState<SprintChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMut = useMutation({
    mutationFn: () => sendSprintChat(
      sprintId,
      input,
      messages.map((m) => ({ role: m.role, text: m.text }))
    ),
    onSuccess: (msg) => {
      setMessages((prev) => [...prev, msg]);
      setInput("");
    },
  });

  function handleSend() {
    if (!input.trim()) return;
    const userMsg: SprintChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      text: input.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    sendMut.mutate();
  }

  function handleSuggestion(s: string) {
    setInput(s);
  }

  return (
    <div className={styles.chatPage}>
      <div className={styles.chatHeader}>
        <div className={styles.chatHeaderLeft}>
          <div className={styles.chatAvatar}>
            <RiSparklingLine size={18} />
          </div>
          <div>
            <div className={styles.chatTitle}>Sprint Assistant</div>
            <div className={styles.chatSubtitle}>AI-powered sprint intelligence for {sprintName}</div>
          </div>
        </div>
      </div>

      <div className={styles.chatBody} ref={scrollRef}>
        {messages.length === 0 ? (
          <div className={styles.chatEmpty}>
            <RiRobot2Line size={40} className={styles.chatEmptyIcon} />
            <h4>Ask anything about this sprint</h4>
            <p>I can analyze blockers, predict outcomes, compare velocity, suggest de-scoping, and more.</p>
            <div className={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <button key={s} className={styles.suggestionChip} onClick={() => handleSuggestion(s)}>
                  <RiLightbulbLine size={11} />
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.messages}>
            {messages.map((msg) => (
              <div key={msg.id} className={`${styles.message} ${styles[`message_${msg.role}`]}`}>
                <div className={styles.messageAvatar}>
                  {msg.role === "assistant" ? <RiSparklingLine size={14} /> : <RiUserLine size={14} />}
                </div>
                <div className={styles.messageContent}>
                  <div className={styles.messageText}>{msg.text}</div>
                  {msg.citations && msg.citations.length > 0 && (
                    <div className={styles.messageCitations}>
                      {msg.citations.map((c, i) => (
                        <div key={i} className={styles.citation}>
                          <span className={styles.citationKey}>{c.key}</span>
                          <span className={styles.citationTitle}>{c.title}</span>
                          <span className={styles.citationQuote}>"{c.quote}"</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sendMut.isPending && (
              <div className={`${styles.message} ${styles.message_assistant}`}>
                <div className={styles.messageAvatar}>
                  <RiSparklingLine size={14} />
                </div>
                <div className={styles.messageContent}>
                  <div className={styles.typingIndicator}>
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.chatInputBar}>
        <input
          className={styles.chatInput}
          placeholder="Ask about this sprint…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !sendMut.isPending && handleSend()}
          disabled={sendMut.isPending}
        />
        <button
          className={styles.chatSendBtn}
          onClick={handleSend}
          disabled={!input.trim() || sendMut.isPending}
        >
          <RiSendPlaneLine size={16} />
        </button>
      </div>
    </div>
  );
}
