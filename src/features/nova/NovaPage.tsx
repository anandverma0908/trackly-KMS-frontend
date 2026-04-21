import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RiBrainLine, RiSendPlaneLine, RiMicLine, RiCloseLine,
  RiSparklingLine, RiAlertLine, RiBarChartLine,
  RiFileTextLine, RiArrowRightLine, RiLightbulbLine,
  RiRobot2Line, RiHistoryLine, RiImageLine,
} from "react-icons/ri";
import styles from "./NovaPage.module.css";

/* ══════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════ */
type PulseType   = "risk" | "pattern" | "suggestion" | "signal";
type Intent      = "ask" | "thought" | "meeting" | "screenshot" | "voice";
type CreatedType = "ticket" | "doc" | "bug";
type AgentStatus = "running" | "done" | "waiting";

interface PulseItem {
  id: string; type: PulseType;
  title: string; detail: string;
  confidence: number; source: string;
  actions: string[]; age: string;
}

interface Citation {
  key: string; title: string;
  type: "ticket" | "decision" | "wiki" | "standup";
  quote?: string;
}

interface CreatedItem {
  type: CreatedType; id: string; title: string; meta: string;
}

interface Message {
  id: string; role: "user" | "nova";
  text: string; intent?: Intent;
  citations?: Citation[]; created?: CreatedItem;
  ts: Date;
}

interface Agent {
  id: string; name: string;
  status: AgentStatus; progress: number; task: string;
}

interface MemoryClip {
  id: string; type: "decision" | "standup" | "ticket" | "wiki";
  title: string; snippet: string; age: string;
}

/* ══════════════════════════════════════════════════════════
   MOCK DATA
══════════════════════════════════════════════════════════ */
const PULSE: PulseItem[] = [
  {
    id: "p1", type: "risk",
    title: "Sprint 9 at risk — 73% completion",
    detail: "3 unplanned tickets reduced capacity 18%. TRK-142 is blocking 2 critical path items and has been stalled for 48h.",
    confidence: 91, source: "Sprint velocity + ticket dependencies",
    actions: ["View sprint", "Move tickets"], age: "2m",
  },
  {
    id: "p2", type: "pattern",
    title: "Velocity dropped 38% sprint-over-sprint",
    detail: "Same pattern detected in Sprint 4 and Sprint 7 — each coincided with mid-sprint scope additions. Consider a scope freeze policy.",
    confidence: 87, source: "12 sprints of historical data",
    actions: ["View analytics"], age: "8m",
  },
  {
    id: "p3", type: "suggestion",
    title: "TRK-142 blocked 48+ hours",
    detail: "Blocking TRK-145 and TRK-147. Priya resolved a similar auth issue in Sprint 7 (TRK-89). Consider pairing or reassigning.",
    confidence: 95, source: "Ticket history + expertise graph",
    actions: ["View ticket", "Ping Priya"], age: "15m",
  },
  {
    id: "p4", type: "signal",
    title: "3 wiki gaps detected from sprint tickets",
    detail: "Auth token refresh, rate limiting, and DB failover referenced in 7 tickets this sprint — no wiki pages exist for any of them.",
    confidence: 83, source: "Wiki coverage analysis",
    actions: ["Generate articles"], age: "1h",
  },
  {
    id: "p5", type: "pattern",
    title: "Priya resolves auth tickets 2.8× faster",
    detail: "8 auth tickets over 6 months — avg resolution 1.2d vs team avg 3.4d. Route similar tickets her way for higher throughput.",
    confidence: 88, source: "Team performance analytics",
    actions: ["View insights"], age: "2h",
  },
];

const AGENTS: Agent[] = [
  { id: "a1", name: "Sprint health monitor",  status: "running", progress: 100, task: "Watching 47 tickets across 2 active sprints" },
  { id: "a2", name: "Wiki gap scanner",        status: "running", progress: 62,  task: "Scanning for undocumented knowledge patterns" },
  { id: "a3", name: "Dependency resolver",     status: "waiting", progress: 0,   task: "Queued — waiting for TRK-142 to unblock" },
];

const MEMORY: MemoryClip[] = [
  { id: "m1", type: "decision", title: "DEC-12 · JWT short-lived tokens",  snippet: "All tokens expire in 15 min, silent refresh is mandatory.", age: "3mo" },
  { id: "m2", type: "standup",  title: "Yesterday's standup",               snippet: "Auth team blocked on DB migration. Will unblock Thursday.", age: "1d"  },
  { id: "m3", type: "ticket",   title: "TRK-89 · Auth expiry fix",          snippet: "Refresh 60s before expiry, not on failure.",               age: "2mo" },
  { id: "m4", type: "wiki",     title: "OAuth Runbook",                     snippet: "Step-by-step token rotation — last updated 94 days ago.",  age: "94d" },
];

const CREATED_INIT: (CreatedItem & { age: string })[] = [
  { type: "ticket", id: "TRK-198", title: "Fix token refresh race condition",   meta: "Sprint 9 · High",      age: "3h" },
  { type: "doc",    id: "DOC-042", title: "Sprint 8 Retrospective",             meta: "4 sections · Wiki",    age: "1d" },
  { type: "bug",    id: "BUG-091", title: "Mobile nav collapses on scroll",     meta: "Severity: Medium",     age: "2d" },
];

const EMPTY_SUGGESTIONS = [
  "What's blocking Sprint 9?",
  "Who should own TRK-142?",
  "Summarise last sprint velocity",
  "What did we decide about auth tokens?",
  "Show wiki coverage gaps",
];

/* ══════════════════════════════════════════════════════════
   MOCK RESPONSE ENGINE
══════════════════════════════════════════════════════════ */
function mockResponse(intent: Intent, input: string): Omit<Message, "id" | "role" | "ts"> {
  switch (intent) {
    case "thought":
    case "voice":
      return {
        text: "I've structured this as a ticket. Does this look right?",
        created: {
          type: "ticket",
          id: `TRK-${201 + (input.length % 48)}`,
          title: (input.slice(0, 72) + (input.length > 72 ? "…" : "")).trim(),
          meta: "Priority: Medium · Unassigned · Sprint 9",
        },
      };
    case "meeting":
      return {
        text: "Detected a meeting transcript. I've structured it into a doc — here's the preview:",
        created: {
          type: "doc",
          id: `DOC-${Math.floor(Math.random() * 90) + 10}`,
          title: `Meeting Notes — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          meta: "Summary · Key Decisions · Action Items · Follow-ups",
        },
      };
    case "screenshot":
      return {
        text: "Screenshot analysed. I've filed a bug report — here's the preview:",
        created: {
          type: "bug",
          id: `BUG-${Math.floor(Math.random() * 50) + 100}`,
          title: "Visual regression detected from screenshot",
          meta: "Severity: High · Steps to reproduce attached",
        },
      };
    default:
      return {
        text: "Based on your team's ticket history and decision records, here's what I found.\n\nPriya S. resolved a nearly identical auth token expiry issue in Sprint 7 — her fix involved refreshing tokens 60 seconds before expiry rather than on failure. The architecture decision DEC-12 mandates short-lived JWTs with silent refresh, which is the root cause of recurring TRK-89 class issues.",
        citations: [
          {
            key: "TRK-89", title: "Fix auth token expiry", type: "ticket",
            quote: "Priya S. resolved a nearly identical auth token expiry issue in Sprint 7 — her fix involved refreshing tokens 60 seconds before expiry rather than on failure.",
          },
          {
            key: "DEC-12", title: "Auth Architecture Decision", type: "decision",
            quote: "The architecture decision DEC-12 mandates short-lived JWTs with silent refresh, which is the root cause of recurring TRK-89 class issues.",
          },
        ],
      };
  }
}

/* ══════════════════════════════════════════════════════════
   UTILS
══════════════════════════════════════════════════════════ */
function detectIntent(text: string, hasImage: boolean): Intent {
  if (hasImage) return "screenshot";
  const t = text.trim();
  if (!t) return "ask";
  const lines = t.split("\n").filter(Boolean);
  if (lines.length > 6 && t.length > 400) return "meeting";
  const lower = t.toLowerCase();
  if (/^(what|who|how|when|why|show|find|where|which|can you|tell me|explain|summarise|summarize|list|give me)/.test(lower) || t.endsWith("?")) return "ask";
  if (t.split(/\s+/).length <= 20) return "thought";
  return "ask";
}

function intentLabel(intent: Intent, wordCount: number): string {
  switch (intent) {
    case "thought":    return "→ creating ticket";
    case "meeting":    return `→ structuring doc · ${wordCount} words`;
    case "screenshot": return "→ filing bug report";
    case "voice":      return "◉ voice captured";
    case "ask":        return "→ asking Nova";
  }
}

const CREATED_COLOR: Record<CreatedType, string> = {
  ticket: "var(--accent)",
  doc:    "var(--green)",
  bug:    "var(--red)",
};

const CREATED_LABEL: Record<CreatedType, string> = {
  ticket: "Ticket created",
  doc:    "Doc created",
  bug:    "Bug filed",
};

const CITATION_COLOR: Record<string, string> = {
  ticket: "var(--accent)", decision: "#a78bfa", wiki: "var(--green)", standup: "var(--amber)",
};

const PULSE_ICON: Record<PulseType, React.ReactNode> = {
  risk:       <RiAlertLine size={11} />,
  pattern:    <RiBarChartLine size={11} />,
  suggestion: <RiLightbulbLine size={11} />,
  signal:     <RiSparklingLine size={11} />,
};

const PULSE_LABEL: Record<PulseType, string> = {
  risk: "Risk", pattern: "Pattern", suggestion: "Suggestion", signal: "Signal",
};

/* ══════════════════════════════════════════════════════════
   STREAMING TEXT HOOK
══════════════════════════════════════════════════════════ */
function useStreamingText(text: string, active: boolean, speed = 11) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) { setDisplayed(text); setDone(true); return; }
    setDisplayed(""); setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(id); setDone(true); }
    }, speed);
    return () => clearInterval(id);
  }, [text, active, speed]);

  return { displayed, done };
}

/* ══════════════════════════════════════════════════════════
   PULSE CARD
══════════════════════════════════════════════════════════ */
function PulseCard({ item, onDismiss }: { item: PulseItem; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      className={`${styles.pulseCard} ${styles[`pulse_${item.type}`]}`}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <div className={styles.pulseCardHead}>
        <span className={`${styles.pulseBadge} ${styles[`badge_${item.type}`]}`}>
          {PULSE_ICON[item.type]}{PULSE_LABEL[item.type]}
        </span>
        <span className={styles.pulseAge}>{item.age}</span>
        <button className={styles.pulseClose} onClick={onDismiss} aria-label="Dismiss signal">
          <RiCloseLine size={11} />
        </button>
      </div>

      <button className={styles.pulseTitle} onClick={() => setExpanded(e => !e)}>
        {item.title}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <p className={styles.pulseDetail}>{item.detail}</p>
            <div className={styles.pulseSource}><RiSparklingLine size={9} />{item.source}</div>
            <div className={styles.pulseConfRow}>
              <div className={styles.pulseConfTrack}>
                <div className={styles.pulseConfFill} style={{ width: `${item.confidence}%` }} />
              </div>
              <span className={styles.pulseConfNum}>{item.confidence}% confidence</span>
            </div>
            <div className={styles.pulseActions}>
              {item.actions.map(a => (
                <button key={a} className={styles.pulseAction}>
                  {a}<RiArrowRightLine size={9} />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   CREATED ITEM CARD  (inline in thread)
══════════════════════════════════════════════════════════ */
function CreatedItemCard({ item }: { item: CreatedItem }) {
  return (
    <div className={styles.createdCard} style={{ borderLeftColor: CREATED_COLOR[item.type] }}>
      <div className={styles.createdCardHead}>
        <span className={styles.createdCardLabel} style={{ color: CREATED_COLOR[item.type] }}>
          {CREATED_LABEL[item.type]}
        </span>
        <span className={styles.createdCardId} style={{ color: CREATED_COLOR[item.type] }}>{item.id}</span>
      </div>
      <div className={styles.createdCardTitle}>{item.title}</div>
      <div className={styles.createdCardMeta}>{item.meta}</div>
      <div className={styles.createdCardActions}>
        <button className={styles.createdCardOpen}>Open <RiArrowRightLine size={10} /></button>
        <button className={styles.createdCardGhost}>Edit</button>
        <button className={styles.createdCardGhost}>Undo</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   HIGHLIGHTED TEXT  (citation hover)
══════════════════════════════════════════════════════════ */
function HighlightedText({ text, citations, hoveredKey, streaming, done }: {
  text: string; citations?: Citation[];
  hoveredKey: string | null; streaming: boolean; done: boolean;
}) {
  const quote = hoveredKey ? citations?.find(c => c.key === hoveredKey)?.quote : undefined;
  const cursor = streaming && !done ? <span className={styles.streamCursor}>▋</span> : null;

  if (!quote) return <>{text}{cursor}</>;

  const idx = text.indexOf(quote);
  if (idx === -1) return <>{text}{cursor}</>;

  return (
    <>
      {text.slice(0, idx)}
      <mark className={styles.citedMark}>{text.slice(idx, idx + quote.length)}</mark>
      {text.slice(idx + quote.length)}
      {cursor}
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   MESSAGE BUBBLE
══════════════════════════════════════════════════════════ */
function MessageBubble({ msg, isLatestNova }: { msg: Message; isLatestNova: boolean }) {
  const [hoveredCitation, setHoveredCitation] = useState<string | null>(null);
  const streaming = msg.role === "nova" && isLatestNova;
  const { displayed, done } = useStreamingText(msg.text, streaming, 11);
  const text = streaming ? displayed : msg.text;

  if (msg.role === "user") {
    return (
      <motion.div className={styles.userMsg} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        {msg.intent && (
          <span className={styles.userIntent}>
            <RiSparklingLine size={9} />{intentLabel(msg.intent, msg.text.split(/\s+/).length)}
          </span>
        )}
        <div className={styles.userBubble}>{msg.text}</div>
      </motion.div>
    );
  }

  return (
    <motion.div className={styles.novaMsg} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <div className={styles.novaAvatar}><RiBrainLine size={13} /></div>
      <div className={styles.novaContent}>
        <p className={styles.novaText}>
          <HighlightedText
            text={text} citations={msg.citations}
            hoveredKey={hoveredCitation} streaming={streaming} done={done}
          />
        </p>

        {msg.citations && (streaming ? done : true) && (
          <div className={styles.citations}>
            {msg.citations.map(c => (
              <button
                key={c.key}
                className={`${styles.citation} ${hoveredCitation === c.key ? styles.citationActive : ""}`}
                style={{
                  borderColor: CITATION_COLOR[c.type] ?? "var(--border-2)",
                  color: CITATION_COLOR[c.type] ?? "var(--text-3)",
                }}
                onMouseEnter={() => setHoveredCitation(c.key)}
                onMouseLeave={() => setHoveredCitation(null)}
              >
                <span className={styles.citationKey}>{c.key}</span>
                <span className={styles.citationTitle}>{c.title}</span>
              </button>
            ))}
          </div>
        )}

        {msg.created && (streaming ? done : true) && (
          <CreatedItemCard item={msg.created} />
        )}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   NOVA PAGE
══════════════════════════════════════════════════════════ */
export default function NovaPage() {
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [pulse,        setPulse]        = useState<PulseItem[]>(PULSE);
  const [input,        setInput]        = useState("");
  const [recording,    setRecording]    = useState(false);
  const [dragOver,     setDragOver]     = useState(false);
  const [attachedImg,  setAttachedImg]  = useState<string | null>(null);
  const [recentItems,  setRecentItems]  = useState<(CreatedItem & { age: string })[]>(CREATED_INIT);

  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const threadRef    = useRef<HTMLDivElement>(null);
  const voiceTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const intent    = detectIntent(input, !!attachedImg);
  const wordCount = input.trim().split(/\s+/).filter(Boolean).length;

  // Scroll thread to bottom on new messages
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [input]);

  const send = useCallback(async (overrideText?: string, overrideIntent?: Intent) => {
    const text         = (overrideText ?? input).trim();
    const finalIntent  = overrideIntent ?? (attachedImg ? "screenshot" : detectIntent(text, false));
    if ((!text && !attachedImg) || loading) return;

    setInput("");
    setAttachedImg(null);

    const userMsg: Message = {
      id: crypto.randomUUID(), role: "user",
      text: text || "[screenshot attached]",
      intent: finalIntent, ts: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    await new Promise(r => setTimeout(r, 860));

    const resp = mockResponse(finalIntent, text);
    const novaMsg: Message = { id: crypto.randomUUID(), role: "nova", ...resp, ts: new Date() };
    setMessages(prev => [...prev, novaMsg]);
    setLoading(false);

    if (resp.created) {
      setRecentItems(prev => [{ ...resp.created!, age: "just now" }, ...prev].slice(0, 6));
    }
  }, [input, attachedImg, loading]);

  function toggleRecording() {
    if (recording) {
      if (voiceTimer.current) clearTimeout(voiceTimer.current);
      setRecording(false);
      return;
    }
    setRecording(true);
    voiceTimer.current = setTimeout(() => {
      setRecording(false);
      send("Need to fix the token refresh — it's failing when the session expires after an idle timeout", "voice");
    }, 2600);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) setAttachedImg(file.name);
  }

  const latestNovaId = [...messages].reverse().find(m => m.role === "nova")?.id;

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.novaOrb}>
            <RiBrainLine size={18} />
            <span className={styles.novaOrbRing} />
          </div>
          <div className={styles.headerText}>
            <span className={styles.novaName}>Nova</span>
            <span className={styles.novaSub}>AI intelligence layer · always on</span>
          </div>
        </div>
        <div className={styles.headerStats}>
          <div className={styles.stat}>
            <span className={styles.statVal}>{pulse.length}</span>
            <span className={styles.statLbl}>active signals</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statVal}>1.2k</span>
            <span className={styles.statLbl}>items indexed</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statVal} style={{ color: "var(--green)" }}>94%</span>
            <span className={styles.statLbl}>accuracy</span>
          </div>
        </div>
      </header>

      {/* ── 3-column body ── */}
      <div className={styles.body}>

        {/* ══ LEFT — Pulse ══ */}
        <aside className={styles.pulsePanel}>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>
              <span className={styles.liveDot} />Pulse
            </span>
            <span className={styles.panelSub}>Nova is watching</span>
          </div>
          <div className={styles.pulseFeed}>
            <AnimatePresence mode="popLayout">
              {pulse.map(item => (
                <PulseCard
                  key={item.id} item={item}
                  onDismiss={() => setPulse(p => p.filter(x => x.id !== item.id))}
                />
              ))}
            </AnimatePresence>
            {pulse.length === 0 && (
              <div className={styles.pulseEmpty}>
                <RiSparklingLine size={24} />
                <span>All clear — nothing unusual detected</span>
              </div>
            )}
          </div>
        </aside>

        {/* ══ CENTER — Nova ══ */}
        <main
          className={styles.center}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
          onDrop={handleDrop}
        >
          {/* Drop overlay */}
          <AnimatePresence>
            {dragOver && (
              <motion.div className={styles.dropOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <RiImageLine size={34} />
                <span>Drop screenshot — Nova will file a bug report</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Thread */}
          <div className={styles.thread} ref={threadRef}>
            {messages.length === 0 ? (
              <div className={styles.emptyThread}>
                <div className={styles.emptyOrb}>
                  <span className={styles.emptyRing} />
                  <span className={styles.emptyRing2} />
                  <RiBrainLine size={28} className={styles.emptyOrbIcon} />
                </div>
                <h2 className={styles.emptyTitle}>Ask, create, or drop anything</h2>
                <p className={styles.emptyDesc}>
                  Type a question, describe a thought, paste a meeting transcript, or drop a screenshot — Nova figures out the rest.
                </p>
                <div className={styles.emptySuggestions}>
                  {EMPTY_SUGGESTIONS.map(s => (
                    <button key={s} className={styles.emptySuggestion} onClick={() => send(s, "ask")}>{s}</button>
                  ))}
                </div>
                <div className={styles.emptyModes}>
                  <div className={styles.emptyMode}><RiBrainLine size={12} /><span>Ask anything</span></div>
                  <div className={styles.emptyMode}><RiFileTextLine size={12} /><span>Paste transcript → doc</span></div>
                  <div className={styles.emptyMode}><RiImageLine size={12} /><span>Drop screenshot → bug</span></div>
                  <div className={styles.emptyMode}><RiMicLine size={12} /><span>Speak → ticket</span></div>
                </div>
              </div>
            ) : (
              <div className={styles.messageList}>
                {messages.map(msg => (
                  <MessageBubble key={msg.id} msg={msg} isLatestNova={msg.id === latestNovaId} />
                ))}
                {loading && (
                  <div className={styles.novaMsg}>
                    <div className={styles.novaAvatar}><RiBrainLine size={13} /></div>
                    <div className={styles.thinkingDots}>
                      <span /><span /><span />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className={styles.inputWrap}>
            {attachedImg && (
              <div className={styles.attachedBadge}>
                <RiImageLine size={11} />
                <span>{attachedImg}</span>
                <button onClick={() => setAttachedImg(null)} aria-label="Remove attachment">
                  <RiCloseLine size={10} />
                </button>
              </div>
            )}

            <div className={`${styles.inputBar} ${recording ? styles.inputBarRecording : ""} ${dragOver ? styles.inputBarDrag : ""}`}>
              <button
                className={`${styles.micBtn} ${recording ? styles.micBtnOn : ""}`}
                onClick={toggleRecording}
                aria-label={recording ? "Stop recording" : "Start voice input"}
              >
                <RiMicLine size={16} />
                {recording && <span className={styles.micPulse} />}
              </button>

              {recording ? (
                <div className={styles.waveform}>
                  {Array.from({ length: 22 }).map((_, i) => (
                    <span key={i} className={styles.waveBar} style={{ animationDelay: `${i * 0.065}s` }} />
                  ))}
                  <span className={styles.recordingLabel}>Recording…</span>
                </div>
              ) : (
                <textarea
                  ref={textareaRef}
                  className={styles.inputTextarea}
                  placeholder="Ask anything, describe a thought, paste a meeting transcript, or drop a screenshot…"
                  value={input}
                  rows={1}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                />
              )}

              <button
                className={`${styles.sendBtn} ${(input.trim() || attachedImg) && !recording ? styles.sendBtnOn : ""}`}
                onClick={() => send()}
                disabled={(!input.trim() && !attachedImg) || loading || recording}
                aria-label="Send"
              >
                <RiSendPlaneLine size={16} />
              </button>
            </div>

            <AnimatePresence>
              {(input.trim() || attachedImg) && (
                <motion.div
                  className={styles.intentHint}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                >
                  <RiSparklingLine size={10} />
                  <span>{intentLabel(intent, wordCount)}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* ══ RIGHT — Nova's Desk ══ */}
        <aside className={styles.desk}>

          {/* Running agents */}
          <div className={styles.deskSection}>
            <div className={styles.deskSectionHead}>
              <RiRobot2Line size={12} /><span>Running</span>
              <span className={styles.deskSectionCount}>{AGENTS.filter(a => a.status === "running").length}</span>
            </div>
            <div className={styles.agentList}>
              {AGENTS.map(a => (
                <div key={a.id} className={styles.agentItem}>
                  <div className={styles.agentRow}>
                    <span className={`${styles.agentDot} ${styles[`agentDot_${a.status}`]}`} />
                    <span className={styles.agentName}>{a.name}</span>
                  </div>
                  <div className={styles.agentTask}>{a.task}</div>
                  {a.status === "running" && a.progress < 100 && (
                    <div className={styles.agentTrack}>
                      <div className={styles.agentFill} style={{ width: `${a.progress}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Memory */}
          <div className={styles.deskSection}>
            <div className={styles.deskSectionHead}>
              <RiHistoryLine size={12} /><span>Memory</span>
              <span className={styles.deskSectionSub}>click to surface</span>
            </div>
            <div className={styles.memoryList}>
              {MEMORY.map(m => (
                <button
                  key={m.id}
                  className={styles.memoryClip}
                  onClick={() => send(`Tell me more about ${m.title}`, "ask")}
                >
                  <div className={styles.memoryClipHead}>
                    <span className={`${styles.memoryType} ${styles[`memType_${m.type}`]}`}>{m.type}</span>
                    <span className={styles.memoryAge}>{m.age}</span>
                  </div>
                  <div className={styles.memoryTitle}>{m.title}</div>
                  <div className={styles.memorySnippet}>{m.snippet}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Created */}
          <div className={styles.deskSection}>
            <div className={styles.deskSectionHead}>
              <RiSparklingLine size={12} /><span>Created by Nova</span>
            </div>
            <div className={styles.createdList}>
              {recentItems.map((item, i) => (
                <div key={i} className={styles.createdListItem} style={{ borderLeftColor: CREATED_COLOR[item.type] }}>
                  <div className={styles.createdListHead}>
                    <span className={styles.createdListId} style={{ color: CREATED_COLOR[item.type] }}>{item.id}</span>
                    <span className={styles.createdListAge}>{item.age}</span>
                  </div>
                  <div className={styles.createdListTitle}>{item.title}</div>
                  <div className={styles.createdListMeta}>{item.meta}</div>
                </div>
              ))}
            </div>
          </div>

        </aside>
      </div>
    </div>
  );
}
