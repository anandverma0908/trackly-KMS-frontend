import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  RiBrainLine, RiSendPlaneLine, RiMicLine, RiCloseLine,
  RiSparklingLine, RiAlertLine, RiBarChartLine,
  RiFileTextLine, RiArrowRightLine, RiLightbulbLine,
  RiRobot2Line, RiHistoryLine, RiImageLine, RiRefreshLine,
  RiFlashlightLine, RiCheckLine, RiErrorWarningLine, RiLoader4Line,
  RiAttachmentLine, RiVideoLine, RiMusicLine,
} from "react-icons/ri";
import { runAgentLoop } from "./agent/agentController";
import type { AgentStep } from "./agent/agentTypes";
import {
  novaQuery,
  novaGenerate,
  fetchAnomalies,
  fetchKnowledgeGaps,
  fetchNovaStatus,
  fetchDecisions,
  fetchTeamStandups,
  extractMeetingActions,
  createTicket,
  triggerReindex,
  analyzeScreenshot,
  transcribeMedia,
  type SpaceAnomaly,
} from "@/services/api";
import type { KnowledgeGap, Decision, Standup } from "@/types";
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
  pod?: string;
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
  agentSteps?: AgentStep[];
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
   HELPERS
══════════════════════════════════════════════════════════ */
function formatAge(dateStr?: string): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return m <= 1 ? "1m" : `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  return `${mo}mo`;
}

const SEVERITY_TO_TYPE: Record<string, PulseType> = {
  high: "risk", medium: "pattern", low: "signal",
};

function anomalyToPulse(a: SpaceAnomaly, idx: number): PulseItem {
  return {
    id: `anomaly-${idx}`,
    type: SEVERITY_TO_TYPE[a.severity] ?? "signal",
    title: a.description.length > 80 ? a.description.slice(0, 80) + "…" : a.description,
    detail: `Detected in ${a.pod} — ${a.description}`,
    confidence: a.severity === "high" ? 90 : a.severity === "medium" ? 75 : 60,
    source: `Pod health monitor · ${a.pod}`,
    actions: ["View space"],
    age: formatAge(a.detected_at),
    pod: a.pod,
  };
}

function gapToPulse(g: KnowledgeGap, idx: number): PulseItem {
  return {
    id: `gap-${idx}`,
    type: "signal",
    title: `Wiki gap: "${g.topic}" — ${g.ticket_count} ticket${g.ticket_count !== 1 ? "s" : ""} reference it`,
    detail: g.suggestion ?? `${g.ticket_count} tickets reference "${g.topic}" but no wiki coverage exists (${g.wiki_coverage}% covered).`,
    confidence: 83,
    source: "Wiki coverage analysis",
    actions: ["Generate article"],
    age: "live",
  };
}

function decisionToMemory(d: Decision): MemoryClip {
  return {
    id: d.id,
    type: "decision",
    title: `DEC-${d.number ?? "?"} · ${d.title}`,
    snippet: d.decision.slice(0, 100),
    age: formatAge(d.created_at ?? d.date),
  };
}

function standupToMemory(s: Standup): MemoryClip {
  const snippet = s.blockers?.trim()
    ? `Blocked: ${s.blockers.slice(0, 80)}`
    : s.yesterday.slice(0, 80);
  return {
    id: String(s.id),
    type: "standup",
    title: `${s.engineer}'s standup · ${s.date}`,
    snippet,
    age: formatAge(s.created_at),
  };
}

/* ══════════════════════════════════════════════════════════
   INTENT DETECTION
══════════════════════════════════════════════════════════ */
function detectIntent(text: string, hasImage: boolean): Intent {
  if (hasImage) return "screenshot";
  const t = text.trim();
  if (!t) return "ask";
  const lines = t.split("\n").filter(Boolean);
  if (lines.length > 6 && t.length > 400) return "meeting";
  if (/^(create ticket:|log bug:|new ticket:|capture:|ticket:)/i.test(t)) return "thought";
  return "ask";
}

function intentLabel(intent: Intent, wordCount: number): string {
  switch (intent) {
    case "thought":    return "→ will create ticket";
    case "meeting":    return `→ structuring meeting doc · ${wordCount} words`;
    case "screenshot": return "→ analyze screenshot";
    case "voice":      return "◉ voice captured";
    case "ask":        return "";
  }
}

/* ══════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════ */
const CREATED_COLOR: Record<CreatedType, string> = {
  ticket: "var(--accent)", doc: "var(--green)", bug: "var(--red)",
};
const CREATED_LABEL: Record<CreatedType, string> = {
  ticket: "Ticket created", doc: "Doc created", bug: "Bug filed",
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

const GLOBAL_SUGGESTIONS = [
  "What bugs are open right now?",
  "What's blocking the current sprint?",
  "Which tickets are high priority?",
  "Which pods are at risk?",
  "What did we decide about auth?",
  "Summarise what's been done this week",
];

function podSuggestions(pod: string) {
  return [
    `What's blocking the ${pod} team?`,
    `Show me open bugs in ${pod}`,
    `What's the sprint status for ${pod}?`,
    `Which ${pod} tickets are overdue?`,
    `Summarise ${pod}'s progress this week`,
    `Who is working on what in ${pod}?`,
  ];
}

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
  const navigate = useNavigate();

  function handleAction(action: string) {
    if (action === "View space" && item.pod) {
      navigate(`/spaces/${encodeURIComponent(item.pod)}`);
    }
  }

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
                <button key={a} className={styles.pulseAction} onClick={() => handleAction(a)}>{a}<RiArrowRightLine size={9} /></button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   CREATED ITEM CARD
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
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   AGENT STEP TRACE
══════════════════════════════════════════════════════════ */
function AgentStepTrace({ steps }: { steps: AgentStep[] }) {
  const [open, setOpen] = useState(false);
  const toolSteps = steps.filter((s) => s.toolCall);
  if (toolSteps.length === 0) return null;

  return (
    <div className={styles.agentTrace}>
      <button className={styles.agentTraceToggle} onClick={() => setOpen((o) => !o)}>
        <RiFlashlightLine size={10} />
        <span>{toolSteps.length} tool call{toolSteps.length !== 1 ? "s" : ""}</span>
        <RiArrowRightLine size={9} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.agentTraceBody}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
          >
            {toolSteps.map((s, i) => (
              <div key={i} className={styles.agentTraceStep}>
                <div className={styles.agentTraceStepHead}>
                  {s.toolResult?.success
                    ? <RiCheckLine size={10} style={{ color: "var(--green)" }} />
                    : <RiErrorWarningLine size={10} style={{ color: "var(--red, #f87171)" }} />
                  }
                  <span className={styles.agentTraceToolName}>{s.toolCall!.action}</span>
                  {s.toolCall!.reasoning && (
                    <span className={styles.agentTraceReason}>— {s.toolCall!.reasoning}</span>
                  )}
                </div>
                {s.toolResult && !s.toolResult.success && (
                  <div className={styles.agentTraceError}>{s.toolResult.error}</div>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   HIGHLIGHTED TEXT
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
        {msg.citations && msg.citations.length > 0 && (streaming ? done : true) && (
          <div className={styles.citations}>
            {msg.citations.map(c => (
              <button
                key={c.key}
                className={`${styles.citation} ${hoveredCitation === c.key ? styles.citationActive : ""}`}
                style={{ borderColor: CITATION_COLOR[c.type] ?? "var(--border-2)", color: CITATION_COLOR[c.type] ?? "var(--text-3)" }}
                onMouseEnter={() => setHoveredCitation(c.key)}
                onMouseLeave={() => setHoveredCitation(null)}
              >
                <span className={styles.citationKey}>{c.key}</span>
                <span className={styles.citationTitle}>{c.title}</span>
              </button>
            ))}
          </div>
        )}
        {msg.created && (streaming ? done : true) && <CreatedItemCard item={msg.created} />}
        {msg.agentSteps && msg.agentSteps.length > 0 && (streaming ? done : true) && (
          <AgentStepTrace steps={msg.agentSteps} />
        )}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   EOS PAGE
══════════════════════════════════════════════════════════ */
export default function NovaPage() {
  const [searchParams] = useSearchParams();
  const podContext = searchParams.get("pod") ?? undefined;
  const qc = useQueryClient();

  const [messages,      setMessages]      = useState<Message[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [indexing,      setIndexing]      = useState(false);
  const [pulse,         setPulse]         = useState<PulseItem[]>([]);
  const [input,         setInput]         = useState("");
  const [recording,     setRecording]     = useState(false);
  const [dragOver,      setDragOver]      = useState(false);
  const [attachedMedia, setAttachedMedia] = useState<{
    name: string;
    mediaType: "image" | "audio" | "video";
    base64?: string;
    file?: File;
  } | null>(null);
  const [recentItems,   setRecentItems]   = useState<(CreatedItem & { age: string })[]>([]);
  const [agentMode,     setAgentMode]     = useState(true);
  const [liveSteps,     setLiveSteps]     = useState<AgentStep[]>([]);
  const [pulseOpen,     setPulseOpen]     = useState(false);

  const suggestions = podContext ? podSuggestions(podContext) : GLOBAL_SUGGESTIONS;

  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const threadRef      = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  const intent    = detectIntent(input, !!attachedMedia);
  const wordCount = input.trim().split(/\s+/).filter(Boolean).length;

  /* ── Data queries ── */
  const { data: anomalies = [] } = useQuery({
    queryKey: ["nova-anomalies", podContext],
    queryFn: () => fetchAnomalies(podContext),
    staleTime: 2 * 60 * 1000,
  });

  const { data: gaps = [] } = useQuery({
    queryKey: ["knowledge-gaps"],
    queryFn: fetchKnowledgeGaps,
    staleTime: 5 * 60 * 1000,
  });

  const { data: novaStatus } = useQuery({
    queryKey: ["nova-status"],
    queryFn: fetchNovaStatus,
    staleTime: 60 * 1000,
  });

  const { data: decisionsResp } = useQuery({
    queryKey: ["decisions", podContext],
    queryFn: () => fetchDecisions(podContext ? { space_id: podContext } : undefined),
    staleTime: 5 * 60 * 1000,
  });

  const { data: standups = [] } = useQuery({
    queryKey: ["team-standups", podContext],
    queryFn: () => fetchTeamStandups(undefined, podContext),
    staleTime: 5 * 60 * 1000,
  });

  /* Auto-index on mount — silent, best-effort */
  useEffect(() => {
    triggerReindex().catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Build pulse from real data */
  useEffect(() => {
    const items: PulseItem[] = [
      ...anomalies.map(anomalyToPulse),
      ...gaps.slice(0, 3).map(gapToPulse),
    ];
    setPulse(items);
  }, [anomalies, gaps]);

  const decisions: Decision[] = decisionsResp?.decisions ?? [];
  const memoryClips: MemoryClip[] = [
    ...decisions.slice(0, 2).map(decisionToMemory),
    ...standups.slice(0, 2).map(standupToMemory),
  ];

  const agents: Agent[] = [
    ...(anomalies.length > 0 || (novaStatus as any)?.available ? [{
      id: "a1", name: "Anomaly detector",
      status: (anomalies.length > 0 ? "done" : "running") as AgentStatus,
      progress: anomalies.length > 0 ? 100 : 50,
      task: anomalies.length > 0
        ? `${anomalies.length} anomal${anomalies.length !== 1 ? "ies" : "y"} found`
        : "Scanning pod health signals…",
    }] : []),
    ...(gaps.length > 0 ? [{
      id: "a2", name: "Wiki gap scanner",
      status: "done" as AgentStatus,
      progress: 100,
      task: `${gaps.length} knowledge gap${gaps.length !== 1 ? "s" : ""} detected`,
    }] : []),
  ];

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [input]);

  async function handleReindex() {
    setIndexing(true);
    try {
      await triggerReindex();
      toast.success("Project data indexed — EOS now has full context.");
      qc.invalidateQueries({ queryKey: ["nova-anomalies"] });
      qc.invalidateQueries({ queryKey: ["knowledge-gaps"] });
    } catch {
      toast.error("Indexing failed. Check that EOS is online.");
    } finally {
      setIndexing(false);
    }
  }

  const send = useCallback(async (overrideText?: string, overrideIntent?: Intent) => {
    const text        = (overrideText ?? input).trim();
    const finalIntent = overrideIntent ?? (attachedMedia ? "screenshot" : detectIntent(text, false));
    if ((!text && !attachedMedia) || loading) return;

    const capturedMedia = attachedMedia;
    setInput("");
    setAttachedMedia(null);

    const userMsg: Message = {
      id: crypto.randomUUID(), role: "user",
      text: text || "[screenshot attached]",
      intent: finalIntent, ts: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      let novaMsg: Message;

      if (finalIntent === "meeting") {
        const result = await extractMeetingActions(text);
        const structured = typeof result === "string"
          ? result
          : (result?.structured_md ?? result?.content ?? "");
        const title = `Meeting Notes — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
        novaMsg = {
          id: crypto.randomUUID(), role: "nova",
          text: "Detected a meeting transcript. I've structured it into a doc — here's the preview:",
          created: {
            type: "doc",
            id: `DOC-${Date.now().toString().slice(-4)}`,
            title,
            meta: (structured as string).slice(0, 120) + "…",
          },
          ts: new Date(),
        };

      } else if (finalIntent === "thought" || finalIntent === "voice") {
        const raw = await novaGenerate(
          `Structure this engineering thought as a ticket. Return ONLY valid JSON, no prose or markdown:
{"title": "concise action-oriented title", "description": "full description with context", "priority": "Medium", "issue_type": "Task"}
Input: "${text}"`,
          "You are EOS, an engineering assistant. Return ONLY a valid JSON object with keys: title, description, priority (High/Medium/Low), issue_type (Bug/Task/Story). No prose, no markdown fences.",
          0.2,
        );
        let title       = text.slice(0, 72);
        let description = text;
        let priority    = "Medium";
        let issue_type  = "Task";
        try {
          const m = raw.match(/\{[\s\S]*?\}/);
          if (m) {
            const parsed = JSON.parse(m[0]);
            if (parsed.title)       title       = parsed.title;
            if (parsed.description) description = parsed.description;
            if (parsed.priority)    priority    = parsed.priority;
            if (parsed.issue_type)  issue_type  = parsed.issue_type;
          }
        } catch { /* use defaults */ }

        novaMsg = {
          id: crypto.randomUUID(), role: "nova",
          text: `I'd structure this as a ticket:\n\n**${title}**\n${description.slice(0, 200)}${description.length > 200 ? "…" : ""}\n\n_Priority: ${priority} · ${issue_type}_\n\nShall I create it? Reply "yes" or "create it" to confirm.`,
          ts: new Date(),
          _pendingTicket: { title, description, priority, issue_type } as any,
        } as any;

      } else if (finalIntent === "screenshot") {
        let analysisResult: { title: string; description: string; repro_steps?: string[]; severity?: string; issue_type?: string } | null = null;
        let mediaLabel = "screenshot";

        if (capturedMedia?.mediaType === "image" && capturedMedia.base64) {
          analysisResult = await analyzeScreenshot(capturedMedia.base64, text);
          mediaLabel = "screenshot";
        } else if (capturedMedia?.mediaType === "audio" || capturedMedia?.mediaType === "video") {
          mediaLabel = capturedMedia.mediaType;
          const result = await transcribeMedia(capturedMedia.file!);
          const f = result.fields ?? {};
          analysisResult = {
            title:       f.title ?? "Issue from " + mediaLabel,
            description: f.description ?? result.transcript,
            issue_type:  f.issue_type ?? "Bug",
            severity:    (f.priority ?? "medium").toLowerCase(),
            repro_steps: [],
          };
        } else {
          const raw = await novaGenerate(
            `A ${mediaLabel} was shared showing a potential bug. Description: "${text || "No description"}". Describe the likely issue and reproduction steps.`,
            "You are NOVA, a bug triage assistant. Be concise and factual.",
            0.3,
          );
          analysisResult = { title: text.slice(0, 72) || "Bug from " + mediaLabel, description: raw || text, severity: "medium", issue_type: "Bug" };
        }

        const steps = analysisResult.repro_steps?.length
          ? "\n\n**Steps to reproduce:**\n" + analysisResult.repro_steps.map((s, i) => `${i + 1}. ${s}`).join("\n")
          : "";

        novaMsg = {
          id: crypto.randomUUID(), role: "nova",
          text: `Analysed ${mediaLabel}:\n\n**${analysisResult.title}**\n${analysisResult.description}${steps}\n\n_Severity: ${analysisResult.severity ?? "medium"} · ${analysisResult.issue_type ?? "Bug"}_\n\nShall I file this as a bug? Reply "file it" to confirm.`,
          ts: new Date(),
          _pendingTicket: {
            title:       analysisResult.title,
            description: analysisResult.description + (steps ? "\n" + steps : ""),
            priority:    analysisResult.severity === "critical" ? "Highest" : analysisResult.severity === "high" ? "High" : "Medium",
            issue_type:  analysisResult.issue_type ?? "Bug",
          },
        } as any;
      } else {
        const lastNovaMsg = [...messages].reverse().find(m => m.role === "nova");
        const pendingTicket = (lastNovaMsg as any)?._pendingTicket;
        const isConfirm = /^(yes|create it|go ahead|confirm|do it|create|ok|sure|yep|yeah)/i.test(text.trim());
        if (isConfirm && pendingTicket) {
          const { title, description, priority, issue_type } = pendingTicket;
          const created = await createTicket({ title, description, priority, issue_type });
          qc.invalidateQueries({ queryKey: ["tickets"] });
          qc.invalidateQueries({ queryKey: ["kanban-tickets"] });
          novaMsg = {
            id: crypto.randomUUID(), role: "nova",
            text: "Ticket created.",
            created: { type: "ticket", id: created?.key ?? "TRK-???", title, meta: `Priority: ${priority} · ${issue_type} · Unassigned` },
            ts: new Date(),
          };
          setRecentItems(prev => [{
            type: "ticket" as CreatedType, id: created?.key ?? "TRK-???", title,
            meta: `Priority: ${priority}`, age: "just now",
          }, ...prev].slice(0, 6));
          setMessages(prev => [...prev, novaMsg!]);
          setLoading(false);
          return;
        }

        const filingConfirm = /^(file it|yes|create it|go ahead|file|create bug|create)/i.test(text.trim());
        if (filingConfirm && pendingTicket) {
          const { title, description, priority, issue_type } = pendingTicket;
          const created = await createTicket({ title, description, priority, issue_type });
          qc.invalidateQueries({ queryKey: ["tickets"] });
          qc.invalidateQueries({ queryKey: ["kanban-tickets"] });
          const createdType: CreatedType = (issue_type === "Bug" || issue_type === "UI Bug") ? "bug" : "ticket";
          novaMsg = {
            id: crypto.randomUUID(), role: "nova",
            text: createdType === "bug" ? "Bug filed." : "Ticket created.",
            created: { type: createdType, id: created?.key ?? "TRK-???", title, meta: `Priority: ${priority} · ${issue_type} · Unassigned` },
            ts: new Date(),
          };
          setRecentItems(prev => [{
            type: createdType, id: created?.key ?? "TRK-???", title,
            meta: `Priority: ${priority}`, age: "just now",
          }, ...prev].slice(0, 6));
          setMessages(prev => [...prev, novaMsg!]);
          setLoading(false);
          return;
        }

        const isShortOrConversational =
          text.split(/\s+/).filter(Boolean).length <= 3 ||
          /^(hi|hello|hey|thanks|thank you|ok|okay|cool|bye|yo|sup)\b/i.test(text.trim());

        if (agentMode && !isShortOrConversational) {
          setLiveSteps([]);
          const history = messages.slice(-10).map((m) => ({
            role:    (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
            content: m.text,
          }));
          const result = await runAgentLoop(text, history, (step) => {
            setLiveSteps((prev) => [...prev, step]);
          });
          novaMsg = {
            id: crypto.randomUUID(), role: "nova",
            text: result.answer || "Agent loop completed.",
            agentSteps: result.steps,
            ts: new Date(),
          };
          if (result.createdTicket) {
            const { id, title, priority, issue_type } = result.createdTicket;
            novaMsg.created = { type: "ticket", id, title, meta: `Priority: ${priority} · ${issue_type} · Unassigned` };
            qc.invalidateQueries({ queryKey: ["tickets"] });
            qc.invalidateQueries({ queryKey: ["kanban-tickets"] });
            setRecentItems(prev => [{ type: "ticket" as CreatedType, id, title, meta: `Priority: ${priority}`, age: "just now" }, ...prev].slice(0, 6));
          }
          setLiveSteps([]);
        } else {
          const res = await novaQuery(text, undefined, podContext);
          novaMsg = {
            id: crypto.randomUUID(), role: "nova",
            text: res.answer || "I couldn't find a relevant answer. Try rephrasing your question.",
            citations: res.citations
              .filter(c => c.title)
              .map(c => ({
                key: String(c.key ?? c.id),
                title: c.title,
                type: (["ticket", "decision", "wiki", "standup"].includes(c.type)
                  ? c.type
                  : "ticket") as Citation["type"],
                quote: c.snippet || undefined,
              })),
            ts: new Date(),
          };
        }
      }

      setMessages(prev => [...prev, novaMsg]);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "EOS is unavailable right now.";
      toast.error(errMsg);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: "nova",
        text: "I'm having trouble connecting right now. Please try again in a moment.",
        ts: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, attachedMedia, loading, agentMode, messages, qc]);

  function toggleRecording() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice input is not supported in this browser. Try Chrome.");
      return;
    }
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setRecording(false);
      if (transcript.trim()) send(transcript, "voice");
    };
    recognition.onerror = (e: any) => {
      setRecording(false);
      toast.error(`Voice input failed: ${e.error ?? "unknown error"}`);
    };
    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        setAttachedMedia({ name: file.name, mediaType: "image", base64 });
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith("audio/")) {
      setAttachedMedia({ name: file.name, mediaType: "audio", file });
    } else if (file.type.startsWith("video/")) {
      setAttachedMedia({ name: file.name, mediaType: "video", file });
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        setAttachedMedia({ name: file.name, mediaType: "image", base64 });
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith("audio/")) {
      setAttachedMedia({ name: file.name, mediaType: "audio", file });
    } else if (file.type.startsWith("video/")) {
      setAttachedMedia({ name: file.name, mediaType: "video", file });
    }
    e.target.value = "";
  }

  const latestNovaId = [...messages].reverse().find(m => m.role === "nova")?.id;

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <h1 className={styles.pageTitle}>EOS</h1>
          <span className={styles.aiBadge}><RiSparklingLine size={10} />AI Intelligence</span>
          {podContext && <span className={styles.podBadge}>{podContext}</span>}
        </div>
        <div className={styles.pageHeaderRight}>
          <button
            className={`${styles.agentToggle} ${agentMode ? styles.agentToggleOn : ""}`}
            onClick={() => setAgentMode(m => !m)}
            title={agentMode ? "Agent mode ON — click to switch to RAG mode" : "Enable agent mode — EOS reasons and uses tools"}
          >
            <RiFlashlightLine size={12} />
            {agentMode ? "Agent ON" : "Agent mode"}
          </button>
          <button
            className={`${styles.pulseToggleBtn} ${pulseOpen ? styles.pulseToggleBtnActive : ""}`}
            onClick={() => setPulseOpen(o => !o)}
          >
            <RiAlertLine size={13} />
            Pulse
            {pulse.length > 0 && <span className={styles.pulseBtnBadge}>{pulse.length}</span>}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>

        {/* ── Left: EOS Desk ── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHead}>
            <RiRobot2Line size={13} />
            <span>EOS Desk</span>
            <button
              className={styles.reindexIconBtn}
              onClick={handleReindex}
              disabled={indexing}
              title="Re-index project data"
              style={{ marginLeft: "auto" }}
            >
              <RiRefreshLine size={12} className={indexing ? styles.spinning : undefined} />
            </button>
          </div>

          <div className={styles.sidebarScroll}>

            {/* Monitors */}
            {agents.length > 0 && (
              <div className={styles.deskSection}>
                <div className={styles.deskSectionHead}>
                  <RiRobot2Line size={12} /><span>Monitors</span>
                  <span className={styles.deskSectionCount}>
                    {agents.filter(a => a.status === "running").length} active
                  </span>
                </div>
                <div className={styles.agentList}>
                  {agents.map(a => (
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
            )}

            {/* Memory */}
            <div className={styles.deskSection}>
              <div className={styles.deskSectionHead}>
                <RiHistoryLine size={12} /><span>Memory</span>
                <span className={styles.deskSectionSub}>click to surface</span>
              </div>
              <div className={styles.memoryList}>
                {memoryClips.length === 0 && (
                  <div className={styles.deskEmpty}>No decisions or standups found.</div>
                )}
                {memoryClips.map(m => (
                  <button
                    key={m.id}
                    className={styles.memoryClip}
                    onClick={() => send(`Tell me more about: ${m.title}`, "ask")}
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

            {/* Created by EOS */}
            <div className={styles.deskSection}>
              <div className={styles.deskSectionHead}>
                <RiSparklingLine size={12} /><span>Created by EOS</span>
              </div>
              <div className={styles.createdList}>
                {recentItems.length === 0 && (
                  <div className={styles.deskEmpty}>
                    Nothing created yet — describe a thought or paste a transcript.
                  </div>
                )}
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

          </div>
        </aside>

        {/* ── Right: EOS Chat ── */}
        <main
          className={styles.main}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
          onDrop={handleDrop}
        >
          <AnimatePresence>
            {dragOver && (
              <motion.div className={styles.dropOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <RiImageLine size={34} />
                <span>Drop screenshot, audio, or video — EOS will analyze and file a bug report</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Thread */}
          <div className={styles.thread} ref={threadRef}>
            {messages.length === 0 ? (
              <div className={styles.emptyThread}>
                <div className={styles.emptyOrb}>
                  <RiBrainLine size={28} className={styles.emptyOrbIcon} />
                </div>
                <h2 className={styles.emptyTitle}>Your project brain</h2>
                <p className={styles.emptyDesc}>
                  Ask anything about your tickets, team, decisions, or sprint — EOS knows your project.
                </p>
                <div className={styles.emptySuggestions}>
                  {suggestions.map(s => (
                    <button key={s} className={styles.emptySuggestion} onClick={() => send(s, "ask")}>{s}</button>
                  ))}
                </div>
                <div className={styles.emptyModes}>
                  <div className={styles.emptyMode}><RiBrainLine size={12} /><span>Tickets &amp; bugs</span></div>
                  <div className={styles.emptyMode}><RiFileTextLine size={12} /><span>Decisions &amp; wiki</span></div>
                  <div className={styles.emptyMode}><RiBarChartLine size={12} /><span>Sprint &amp; blockers</span></div>
                  <div className={styles.emptyMode}><RiMicLine size={12} /><span>Voice input</span></div>
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
                    {agentMode && liveSteps.length > 0 ? (
                      <div className={styles.agentLiveTrace}>
                        {liveSteps.filter((s) => s.toolCall).map((s, i) => (
                          <div key={i} className={styles.agentLiveStep}>
                            <RiLoader4Line size={10} className={styles.spinning} />
                            <span>{s.toolCall!.action}</span>
                            {s.toolResult && (
                              s.toolResult.success
                                ? <RiCheckLine size={10} style={{ color: "var(--green)", marginLeft: 4 }} />
                                : <RiErrorWarningLine size={10} style={{ color: "var(--red, #f87171)", marginLeft: 4 }} />
                            )}
                          </div>
                        ))}
                        <div className={styles.thinkingDots} style={{ marginTop: 4 }}><span /><span /><span /></div>
                      </div>
                    ) : (
                      <div className={styles.thinkingDots}><span /><span /><span /></div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className={styles.inputWrap}>
            {attachedMedia && (
              <div className={styles.attachedBadge}>
                {attachedMedia.mediaType === "image"
                  ? <RiImageLine size={11} />
                  : attachedMedia.mediaType === "audio"
                  ? <RiMusicLine size={11} />
                  : <RiVideoLine size={11} />}
                <span>{attachedMedia.name}</span>
                <button onClick={() => setAttachedMedia(null)} aria-label="Remove attachment">
                  <RiCloseLine size={10} />
                </button>
              </div>
            )}

            <div className={`${styles.inputBar} ${recording ? styles.inputBarRecording : ""} ${dragOver ? styles.inputBarDrag : ""}`}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,audio/*,video/*"
                style={{ display: "none" }}
                onChange={handleFileUpload}
              />
              <button
                className={styles.micBtn}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach image, audio, or video"
                title="Attach image, audio, or video"
              >
                <RiAttachmentLine size={15} />
              </button>
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
                  <span className={styles.recordingLabel}>Listening…</span>
                </div>
              ) : (
                <textarea
                  ref={textareaRef}
                  className={styles.inputTextarea}
                  placeholder="Ask EOS anything about your project… (prefix 'create ticket:' to log a task)"
                  value={input}
                  rows={1}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                />
              )}

              <button
                className={`${styles.sendBtn} ${(input.trim() || attachedMedia) && !recording ? styles.sendBtnOn : ""}`}
                onClick={() => send()}
                disabled={(!input.trim() && !attachedMedia) || loading || recording}
                aria-label="Send"
              >
                <RiSendPlaneLine size={16} />
              </button>
            </div>

            <AnimatePresence>
              {intentLabel(intent, wordCount) && (input.trim() || attachedMedia) && (
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

        {/* ── Pulse Side Drawer ── */}
        <AnimatePresence>
          {pulseOpen && (
            <>
              <motion.div
                className={styles.pulseOverlay}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setPulseOpen(false)}
              />
              <motion.aside
                className={styles.pulseDrawer}
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 22, stiffness: 220 }}
              >
                <div className={styles.pulseDrawerHead}>
                  <span className={styles.panelTitle}>
                    <span className={styles.liveDot} />Pulse
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className={styles.panelSub}>EOS is watching</span>
                    <button className={styles.drawerCloseBtn} onClick={() => setPulseOpen(false)}>
                      <RiCloseLine size={14} />
                    </button>
                  </div>
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
                      <span>All clear — no anomalies or gaps detected</span>
                    </div>
                  )}
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
