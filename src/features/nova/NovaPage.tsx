import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  RiBrainLine,
  RiSendPlaneLine,
  RiMicLine,
  RiCloseLine,
  RiSparklingLine,
  RiAlertLine,
  RiBarChartLine,
  RiFileTextLine,
  RiArrowRightLine,
  RiLightbulbLine,
  RiImageLine,
  RiRefreshLine,
  RiFlashlightLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiAttachmentLine,
  RiVideoLine,
  RiMusicLine,
  RiLayoutGridLine,
  RiHistoryLine,
  RiTerminalBoxLine,
  RiSearchLine,
  RiBugLine,
  RiTimeLine,
  RiRocketLine,
  RiCodeSSlashLine,
  RiDatabase2Line,
  RiQuestionLine,
  RiVolumeUpLine,
  RiVolumeMuteLine,
} from "react-icons/ri";
import SideDrawer from "@/components/ui/SideDrawer";
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
  addTicketToSprint,
  fetchSprints,
  fetchOrgUsers,
  fetchSpacesList,
  triggerReindex,
  analyzeScreenshot,
  transcribeMedia,
  type SpaceAnomaly,
} from "@/services/api";
import type { KnowledgeGap, Decision, Standup, Sprint } from "@/types";
import styles from "./NovaPage.module.css";

/* ══════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════ */
type PulseType = "risk" | "pattern" | "suggestion" | "signal";
type Intent = "ask" | "thought" | "meeting" | "screenshot" | "voice" | "command";
type CreatedType = "ticket" | "doc" | "bug";
type Mode = "assistant" | "engineer" | "execution" | "knowledge" | "debug" | "admin";
type AgentStatus = "running" | "done" | "waiting";

interface PendingTicket {
  title: string;
  description: string;
  priority: string;
  issue_type: string;
  assignee?: string;
  story_points?: number;
  labels?: string[];
  due_date?: string;
  sprint_id?: string;
  pod?: string;
}

interface AIOption {
  label: string;
  value: string;
  meta?: string;
}

interface PulseItem {
  id: string;
  type: PulseType;
  title: string;
  detail: string;
  confidence: number;
  source: string;
  actions: string[];
  age: string;
  pod?: string;
}

interface Citation {
  key: string;
  title: string;
  type: "ticket" | "decision" | "wiki" | "standup";
  quote?: string;
}

interface CreatedItem {
  type: CreatedType;
  id: string;
  title: string;
  meta: string;
}

interface Message {
  id: string;
  role: "user" | "nova";
  text: string;
  intent?: Intent;
  citations?: Citation[];
  created?: CreatedItem;
  agentSteps?: AgentStep[];
  options?: AIOption[];
  pendingTicket?: PendingTicket & { pod?: string };
  imagePreview?: string;
  ts: Date;
}

interface WizardState {
  ticket: PendingTicket & { pod?: string };
  stage: 'space' | 'sprint' | 'assignee' | 'points' | 'confirm';
  pod?: string;
  sprintId?: string;
  sprintName?: string;
  assignee?: string;
}

interface ConversationRecord {
  id: string;
  startedAt: string;
  preview: string;
  messages: Array<Message & { ts: string }>;
}

interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  progress: number;
  task: string;
}

interface MemoryClip {
  id: string;
  type: "decision" | "standup" | "ticket" | "wiki";
  title: string;
  snippet: string;
  age: string;
}

/* ══════════════════════════════════════════════════════════
   WIZARD CONSTANTS & HELPERS
══════════════════════════════════════════════════════════ */
const STORY_POINT_OPTIONS: AIOption[] = [1, 2, 3, 5, 8, 13].map(n => ({
  label: `${n} pt${n === 1 ? '' : 's'}`,
  value: `points:${n}`,
}));
STORY_POINT_OPTIONS.push({ label: '? / Skip', value: 'points:0' });

function buildSpaceOptions(pods: string[], sprints: Sprint[]): AIOption[] {
  // Prefer pods from the filters API; fall back to unique pods from sprints
  const sources = pods.length
    ? pods
    : ([...new Set(sprints.map(s => s.pod).filter(Boolean))] as string[]);
  if (sources.length === 0) return [{ label: 'Default Project', value: 'space:NOVA' }];
  return sources.map(pod => ({ label: pod, value: `space:${pod}` }));
}

function buildSprintOptions(sprints: Sprint[], pod: string): AIOption[] {
  const podSprints = sprints
    .filter(s => s.pod === pod)
    .sort((a, _b) => (a.status === 'active' ? -1 : 1));
  const opts: AIOption[] = podSprints.map(s => ({
    label: s.name,
    value: `sprint:${s.id}`,
    meta: s.status === 'active' ? 'Active' : s.status,
  }));
  opts.push({ label: 'Backlog', value: 'sprint:backlog', meta: 'No sprint' });
  return opts;
}

function buildAssigneeOptions(
  orgUsers: { name: string }[],
  standups: Standup[],
): AIOption[] {
  const names = orgUsers.length
    ? orgUsers.map(u => u.name)
    : [...new Set(standups.map(s => s.engineer).filter(Boolean))];
  const opts: AIOption[] = names.slice(0, 8).map(name => ({
    label: name,
    value: `assignee:${name}`,
  }));
  opts.push({ label: 'Unassigned', value: 'assignee:unassigned' });
  return opts;
}

const CHAT_HISTORY_KEY = 'eos-chat-history';

function loadChatHistory(): ConversationRecord[] {
  try {
    return JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || '[]');
  } catch { return []; }
}

function saveConversation(messages: Message[]) {
  if (messages.length < 2) return;
  const record: ConversationRecord = {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    preview: messages.find(m => m.role === 'user')?.text?.slice(0, 80) || 'Conversation',
    // Strip large fields (base64 images, agent step traces) so we don't blow the ~5MB localStorage limit
    messages: messages.map(m => ({
      ...m,
      imagePreview: undefined,
      agentSteps: undefined,
      ts: m.ts instanceof Date ? m.ts.toISOString() : String(m.ts),
    })) as Array<Message & { ts: string }>,
  };
  try {
    const existing: ConversationRecord[] = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || '[]');
    const updated = [record, ...existing].slice(0, 20);
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('[EOS] Failed to save conversation to localStorage:', e);
  }
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
  high: "risk",
  medium: "pattern",
  low: "signal",
};

function anomalyToPulse(a: SpaceAnomaly, idx: number): PulseItem {
  return {
    id: `anomaly-${idx}`,
    type: SEVERITY_TO_TYPE[a.severity] ?? "signal",
    title:
      a.description.length > 80
        ? a.description.slice(0, 80) + "…"
        : a.description,
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
    detail:
      g.suggestion ??
      `${g.ticket_count} tickets reference "${g.topic}" but no wiki coverage exists (${g.wiki_coverage}% covered).`,
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
  if (/^(create ticket:|log bug:|new ticket:|capture:|ticket:)/i.test(t))
    return "thought";
  return "ask";
}

function intentLabel(intent: Intent, wordCount: number): string {
  switch (intent) {
    case "thought":
      return "→ will create ticket";
    case "meeting":
      return `→ structuring meeting doc · ${wordCount} words`;
    case "screenshot":
      return "→ analyze screenshot";
    case "voice":
      return "◉ voice captured";
    case "command":
      return "→ command mode";
    case "ask":
      return "";
  }
}

/* ══════════════════════════════════════════════════════════
   MODE ROUTING
══════════════════════════════════════════════════════════ */
function detectMode(text: string): Mode {
  const t = text.toLowerCase();
  if (/\b(deploy|production|prod|staging|infra|server|permission|environment|release|devops)\b/.test(t)) return "admin";
  if (/\b(bug|error|crash|exception|stack trace|fail|failure|undefined|null|traceback|lint)\b/.test(t)) return "debug";
  if (/\b(code|function|class|refactor|architecture|implement|review|pr|pull request|component|module)\b/.test(t)) return "engineer";
  if (/\b(do it|execute|run|create|update|delete|submit|handle|make|generate|write|build)\b/.test(t)) return "execution";
  if (/\b(doc|documentation|wiki|knowledge|explain|how|what is|guide|decision|policy)\b/.test(t)) return "knowledge";
  return "assistant";
}

const MODE_LABEL: Record<Mode, string> = {
  assistant: "Assistant",
  engineer:  "Engineer",
  execution: "Execution",
  knowledge: "Knowledge",
  debug:     "Debug",
  admin:     "Admin",
};

const MODE_STATUS_SEQUENCE: Record<Mode, string[]> = {
  assistant: ["Analyzing request...", "Generating response..."],
  engineer:  ["Analyzing code...", "Inspecting architecture...", "Generating response..."],
  execution: ["Preparing execution...", "Running action...", "Verifying result..."],
  knowledge: ["Searching knowledge base...", "Retrieving context...", "Synthesizing answer..."],
  debug:     ["Inspecting logs...", "Analyzing error...", "Identifying root cause..."],
  admin:     ["Validating environment...", "Checking permissions...", "Executing..."],
};

const TOOL_STATUS: Record<string, string> = {
  search:               "Searching knowledge base...",
  get_ticket:           "Fetching ticket data...",
  update_ticket_status: "Updating ticket...",
  create_ticket:        "Creating ticket...",
  rag_query:            "Querying knowledge index...",
  generate_standup:     "Generating standup report...",
  create_wiki_page:     "Creating wiki page...",
};

/* ══════════════════════════════════════════════════════════
   COMMAND PALETTE
══════════════════════════════════════════════════════════ */
interface CommandDef {
  cmd: string;
  desc: string;
  icon: React.ReactNode;
  toQuery: (args: string) => string | null;
}

const COMMANDS: CommandDef[] = [
  { cmd: "/tickets",   desc: "Fetch or manage tickets",     icon: <RiFileTextLine size={12} />,    toQuery: (a) => a ? `Show tickets: ${a}` : "What tickets are open right now?" },
  { cmd: "/search",    desc: "Search the knowledge base",   icon: <RiSearchLine size={12} />,      toQuery: (a) => a ? `Search: ${a}` : "Search the project knowledge base" },
  { cmd: "/analyze",   desc: "Analyze sprint or metrics",   icon: <RiBarChartLine size={12} />,    toQuery: (a) => a ? `Analyze ${a}` : "Analyze current sprint health and blockers" },
  { cmd: "/debug",     desc: "Debug workflow",              icon: <RiBugLine size={12} />,         toQuery: (a) => a ? `Debug ${a}` : "Show all open bugs and errors" },
  { cmd: "/logs",      desc: "Inspect system logs",         icon: <RiDatabase2Line size={12} />,   toQuery: (_a) => "What errors or issues are in the system logs?" },
  { cmd: "/timesheet", desc: "Manage timesheet",            icon: <RiTimeLine size={12} />,        toQuery: (a) => a || "Show my timesheet for this week" },
  { cmd: "/deploy",    desc: "Deployment workflow",         icon: <RiRocketLine size={12} />,      toQuery: (a) => a ? `Deploy to ${a}` : "Show deployment status and recent builds" },
  { cmd: "/db",        desc: "Query database",              icon: <RiCodeSSlashLine size={12} />,  toQuery: (a) => a ? `Query database: ${a}` : "Show database health and recent queries" },
  { cmd: "/help",      desc: "List all commands",           icon: <RiQuestionLine size={12} />,    toQuery: (_a) => null },
];

const HELP_TEXT = `**NOVA/EOS Command Palette**

**Slash Commands:**
\`/tickets [query]\` — Fetch or manage tickets
\`/search [query]\` — Search the knowledge base
\`/analyze [target]\` — Analyze sprint, code, or metrics
\`/debug [issue]\` — Enter debug workflow
\`/logs\` — Inspect system logs and errors
\`/timesheet\` — View or submit timesheet
\`/deploy [env]\` — Trigger deployment workflow
\`/db [query]\` — Query the database
\`/help\` — Show this help message

**Auto-detected Modes:**
• **Assistant** — general questions and conversation
• **Engineer** — code, architecture, refactoring
• **Execution** — "create", "run", "do it"
• **Knowledge** — docs, wiki, decisions
• **Debug** — bugs, errors, stack traces
• **Admin** — deployments, environments, permissions

**Operating Pattern:** Observe → Think → Route → Execute → Verify → Respond`;

function CommandPalette({
  input,
  onSelect,
  selectedIndex,
}: {
  input: string;
  onSelect: (cmd: CommandDef) => void;
  selectedIndex: number;
}) {
  const partial = input.slice(1).toLowerCase();
  const filtered = COMMANDS.filter((c) => c.cmd.slice(1).startsWith(partial));
  if (filtered.length === 0) return null;

  return (
    <motion.div
      className={styles.commandPalette}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
    >
      <div className={styles.commandPaletteHeader}>
        <RiTerminalBoxLine size={10} />
        <span>Commands</span>
      </div>
      {filtered.map((c, i) => (
        <button
          key={c.cmd}
          className={`${styles.commandItem} ${i === selectedIndex % filtered.length ? styles.commandItemActive : ""}`}
          onMouseDown={(e) => { e.preventDefault(); onSelect(c); }}
        >
          <span className={styles.commandItemIcon}>{c.icon}</span>
          <span className={styles.commandItemCmd}>{c.cmd}</span>
          <span className={styles.commandItemDesc}>{c.desc}</span>
        </button>
      ))}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════ */
const CREATED_COLOR: Record<CreatedType, string> = {
  ticket: "var(--accent)",
  doc: "var(--green)",
  bug: "var(--red)",
};
const CREATED_LABEL: Record<CreatedType, string> = {
  ticket: "Ticket created",
  doc: "Doc created",
  bug: "Bug filed",
};
const CITATION_COLOR: Record<string, string> = {
  ticket: "var(--accent)",
  decision: "#a78bfa",
  wiki: "var(--green)",
  standup: "var(--amber)",
};
const PULSE_ICON: Record<PulseType, React.ReactNode> = {
  risk: <RiAlertLine size={11} />,
  pattern: <RiBarChartLine size={11} />,
  suggestion: <RiLightbulbLine size={11} />,
  signal: <RiSparklingLine size={11} />,
};
const PULSE_LABEL: Record<PulseType, string> = {
  risk: "Risk",
  pattern: "Pattern",
  suggestion: "Suggestion",
  signal: "Signal",
};

const GLOBAL_SUGGESTIONS = [
  "What was my timesheet last week?",
  "Show me my standup for today",
  "What open bugs are assigned to me?",
  "Give me analytics for the current sprint",
  "Which tickets are blocking the team?",
  "Summarise what I've done this week",
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
    if (!active) {
      setDisplayed(text);
      setDone(true);
      return;
    }
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

/* ══════════════════════════════════════════════════════════
   SPEECH HOOK — female TTS via Web Speech API
══════════════════════════════════════════════════════════ */
const FEMALE_VOICE_NAMES = [
  "Samantha", "Karen", "Victoria", "Moira", "Tessa", "Fiona",
  "Google UK English Female", "Google US English", "Microsoft Zira",
  "Microsoft Aria", "Microsoft Jenny", "Nicky",
];

function pickFemaleVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  for (const name of FEMALE_VOICE_NAMES) {
    const v = voices.find((v) => v.name.includes(name));
    if (v) return v;
  }
  return (
    voices.find((v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("female")) ??
    voices.find((v) => v.lang.startsWith("en-")) ??
    null
  );
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[-*•›]\s/g, "")
    .replace(/\n+/g, " ")
    .trim();
}

function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const currentTextRef = useRef<string>("");

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const clean = stripMarkdown(text).slice(0, 600);
    if (!clean) return;
    currentTextRef.current = clean;

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.05;
    utterance.pitch = 1.1;
    utterance.volume = 1;

    const doSpeak = () => {
      const voice = pickFemaleVoice();
      if (voice) utterance.voice = voice;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      doSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = doSpeak;
    }
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speakIfEnabled = useCallback(
    (text: string) => {
      if (voiceEnabled) speak(text);
    },
    [voiceEnabled, speak],
  );

  return { speaking, voiceEnabled, setVoiceEnabled, speak, speakIfEnabled, stop };
}

/* ══════════════════════════════════════════════════════════
   FORMATTED TEXT — full markdown renderer (ChatGPT/Claude style)
══════════════════════════════════════════════════════════ */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={styles.codeCopyBtn}
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
    >
      {copied ? <RiCheckLine size={11} /> : <RiAttachmentLine size={11} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function FormattedText({ text, cursor }: { text: string; cursor?: boolean }) {
  const content = cursor ? text + " ▋" : text;
  return (
    <div className={styles.mdBody}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className={styles.mdH1}>{children}</h1>,
          h2: ({ children }) => <h2 className={styles.mdH2}>{children}</h2>,
          h3: ({ children }) => <h3 className={styles.mdH3}>{children}</h3>,
          h4: ({ children }) => <h4 className={styles.mdH4}>{children}</h4>,
          p:  ({ children }) => <p  className={styles.mdP}>{children}</p>,
          ul: ({ children }) => <ul className={styles.mdUl}>{children}</ul>,
          ol: ({ children }) => <ol className={styles.mdOl}>{children}</ol>,
          li: ({ children, node, ...props }) => {
            const isOrdered = node?.position && (props as any).ordered;
            const idx = (props as any).index ?? 0;
            return (
              <li className={styles.mdLi}>
                {isOrdered
                  ? <span className={styles.mdLiNum}>{idx + 1}.</span>
                  : <span className={styles.mdLiBullet}>›</span>
                }
                <span>{children}</span>
              </li>
            );
          },
          strong: ({ children }) => <strong className={styles.mdStrong}>{children}</strong>,
          em:     ({ children }) => <em className={styles.mdEm}>{children}</em>,
          blockquote: ({ children }) => <blockquote className={styles.mdBlockquote}>{children}</blockquote>,
          hr: () => <hr className={styles.mdHr} />,
          a:  ({ href, children }) => <a href={href} className={styles.mdLink} target="_blank" rel="noopener noreferrer">{children}</a>,
          table: ({ children }) => (
            <div className={styles.mdTableWrap}>
              <table className={styles.mdTable}>{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className={styles.mdThead}>{children}</thead>,
          th: ({ children }) => <th className={styles.mdTh}>{children}</th>,
          td: ({ children }) => <td className={styles.mdTd}>{children}</td>,
          tr: ({ children }) => <tr className={styles.mdTr}>{children}</tr>,
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const isBlock = !!match || String(children).includes("\n");
            const codeText = String(children).replace(/\n$/, "");
            if (isBlock) {
              return (
                <div className={styles.mdCodeBlock}>
                  <div className={styles.mdCodeHeader}>
                    <span className={styles.mdCodeLang}>{match?.[1] ?? "code"}</span>
                    <CopyButton text={codeText} />
                  </div>
                  <SyntaxHighlighter
                    style={oneDark as any}
                    language={match?.[1] ?? "text"}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      borderRadius: "0 0 8px 8px",
                      fontSize: "12px",
                      lineHeight: 1.6,
                      background: "var(--code-bg, #1a1b26)",
                    }}
                  >
                    {codeText}
                  </SyntaxHighlighter>
                </div>
              );
            }
            return <code className={styles.mdInlineCode} {...props}>{children}</code>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TICKET PREVIEW CARD
══════════════════════════════════════════════════════════ */
const PRIORITY_COLOR: Record<string, string> = {
  Highest: 'var(--red)',
  High: 'var(--red)',
  Medium: 'var(--amber)',
  Low: 'var(--green)',
  Lowest: 'var(--green)',
};

function TicketPreviewCard({ ticket }: { ticket: PendingTicket & { pod?: string; sprintName?: string } }) {
  const color = PRIORITY_COLOR[ticket.priority] ?? 'var(--accent)';
  return (
    <div className={styles.ticketPreviewCard} style={{ borderLeftColor: color }}>
      <div className={styles.tpcHeader}>
        <span className={styles.tpcType}>{ticket.issue_type}</span>
        <span className={styles.tpcPriority} style={{ color }}>{ticket.priority}</span>
        {ticket.story_points ? <span className={styles.tpcPoints}>{ticket.story_points} pts</span> : null}
      </div>
      <div className={styles.tpcTitle}>{ticket.title}</div>
      {ticket.description && (
        <p className={styles.tpcDesc}>{ticket.description.slice(0, 140)}{ticket.description.length > 140 ? '…' : ''}</p>
      )}
      <div className={styles.tpcMeta}>
        {ticket.pod && <span><strong>Space:</strong> {ticket.pod}</span>}
        {ticket.sprintName && <span><strong>Sprint:</strong> {ticket.sprintName}</span>}
        {ticket.assignee && <span><strong>Assignee:</strong> {ticket.assignee}</span>}
        {ticket.labels?.length ? <span><strong>Labels:</strong> {ticket.labels.join(', ')}</span> : null}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   CHAT HISTORY PANEL
══════════════════════════════════════════════════════════ */
function ChatHistoryPanel({
  open,
  history,
  onLoad,
  onClear,
  onClose,
}: {
  open: boolean;
  history: ConversationRecord[];
  onLoad: (messages: Message[]) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [confirmClear, setConfirmClear] = useState(false);

  // Reset confirm state when panel closes
  useEffect(() => {
    if (!open) setConfirmClear(false);
  }, [open]);

  return (
    <SideDrawer open={open} onClose={onClose} size="sm" title="Chat History" subtitle={`${history.length} conversation${history.length !== 1 ? 's' : ''}`}>
      <div style={{ padding: '8px 0' }}>
        {history.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.84rem' }}>
            No past conversations yet.
          </div>
        )}
        <AnimatePresence mode="popLayout">
          {history.map(conv => (
            <motion.button
              key={conv.id}
              className={styles.historyItem}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20, transition: { duration: 0.15 } }}
              onClick={() => {
                const msgs: Message[] = conv.messages.map(m => ({ ...m, ts: new Date(m.ts as string) }));
                onLoad(msgs);
                onClose();
              }}
            >
              <div className={styles.historyItemPreview}>{conv.preview}</div>
              <div className={styles.historyItemMeta}>{new Date(conv.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            </motion.button>
          ))}
        </AnimatePresence>
        {history.length > 0 && (
          <div style={{ padding: '12px 16px 4px', borderTop: '1px solid var(--border)' }}>
            {confirmClear ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={styles.historyClearConfirm}
                  onClick={() => {
                    onClear();
                    setConfirmClear(false);
                  }}
                >
                  Yes, clear all
                </button>
                <button
                  className={styles.historyClearCancel}
                  onClick={() => setConfirmClear(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button className={styles.historyClear} onClick={() => setConfirmClear(true)}>
                Clear all history
              </button>
            )}
          </div>
        )}
      </div>
    </SideDrawer>
  );
}

/* ══════════════════════════════════════════════════════════
   PULSE CARD
══════════════════════════════════════════════════════════ */
function PulseCard({
  item,
  onDismiss,
}: {
  item: PulseItem;
  onDismiss: () => void;
}) {
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
        <span
          className={`${styles.pulseBadge} ${styles[`badge_${item.type}`]}`}
        >
          {PULSE_ICON[item.type]}
          {PULSE_LABEL[item.type]}
        </span>
        <span className={styles.pulseAge}>{item.age}</span>
        <button
          className={styles.pulseClose}
          onClick={onDismiss}
          aria-label="Dismiss signal"
        >
          <RiCloseLine size={11} />
        </button>
      </div>
      <button
        className={styles.pulseTitle}
        onClick={() => setExpanded((e) => !e)}
      >
        {item.title}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <p className={styles.pulseDetail}>{item.detail}</p>
            <div className={styles.pulseSource}>
              <RiSparklingLine size={9} />
              {item.source}
            </div>
            <div className={styles.pulseConfRow}>
              <div className={styles.pulseConfTrack}>
                <div
                  className={styles.pulseConfFill}
                  style={{ width: `${item.confidence}%` }}
                />
              </div>
              <span className={styles.pulseConfNum}>
                {item.confidence}% confidence
              </span>
            </div>
            <div className={styles.pulseActions}>
              {item.actions.map((a) => (
                <button
                  key={a}
                  className={styles.pulseAction}
                  onClick={() => handleAction(a)}
                >
                  {a}
                  <RiArrowRightLine size={9} />
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
   CREATED ITEM CARD
══════════════════════════════════════════════════════════ */
function CreatedItemCard({ item }: { item: CreatedItem }) {
  const navigate = useNavigate();

  function openTicket() {
    navigate(`/tickets?key=${encodeURIComponent(item.id)}`);
  }

  function viewOnBoard() {
    navigate(`/tickets?key=${encodeURIComponent(item.id)}&view=board`);
  }

  return (
    <div
      className={styles.createdCard}
      style={{ borderLeftColor: CREATED_COLOR[item.type] }}
    >
      <div className={styles.createdCardHead}>
        <span
          className={styles.createdCardLabel}
          style={{ color: CREATED_COLOR[item.type] }}
        >
          {CREATED_LABEL[item.type]}
        </span>
        <span
          className={styles.createdCardId}
          style={{ color: CREATED_COLOR[item.type] }}
        >
          {item.id}
        </span>
      </div>
      <div className={styles.createdCardTitle}>{item.title}</div>
      <div className={styles.createdCardMeta}>{item.meta}</div>
      <div className={styles.createdCardActions}>
        <button className={styles.createdCardOpen} onClick={openTicket}>
          Open <RiArrowRightLine size={10} />
        </button>
        <button className={styles.createdCardGhost} onClick={viewOnBoard}>
          <RiLayoutGridLine size={10} /> Board
        </button>
        <button className={styles.createdCardGhost} onClick={openTicket}>
          Edit
        </button>
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
      <button
        className={styles.agentTraceToggle}
        onClick={() => setOpen((o) => !o)}
      >
        <RiFlashlightLine size={10} />
        <span>
          {toolSteps.length} tool call{toolSteps.length !== 1 ? "s" : ""}
        </span>
        <RiArrowRightLine
          size={9}
          style={{
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform 0.15s",
          }}
        />
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
                  {s.toolResult?.success ? (
                    <RiCheckLine size={10} style={{ color: "var(--green)" }} />
                  ) : (
                    <RiErrorWarningLine
                      size={10}
                      style={{ color: "var(--red, #f87171)" }}
                    />
                  )}
                  <span className={styles.agentTraceToolName}>
                    {s.toolCall!.action}
                  </span>
                  {s.toolCall!.reasoning && (
                    <span className={styles.agentTraceReason}>
                      — {s.toolCall!.reasoning}
                    </span>
                  )}
                </div>
                {s.toolResult && !s.toolResult.success && (
                  <div className={styles.agentTraceError}>
                    {s.toolResult.error}
                  </div>
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
   AI OPTION BLOCK — interactive follow-up choices
══════════════════════════════════════════════════════════ */
function AIOptionBlock({
  options,
  onSelect,
}: {
  options: AIOption[];
  onSelect: (value: string, label: string) => void;
}) {
  return (
    <div className={styles.aiOptions}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={styles.aiOptionBtn}
          onClick={() => onSelect(opt.value, opt.label)}
        >
          <span className={styles.aiOptionLabel}>{opt.label}</span>
          {opt.meta && <span className={styles.aiOptionMeta}>{opt.meta}</span>}
        </button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MESSAGE BUBBLE
══════════════════════════════════════════════════════════ */
function MessageBubble({
  msg,
  isLatestNova,
  isSpeaking,
  onOptionSelect,
  onSpeak,
}: {
  msg: Message;
  isLatestNova: boolean;
  isSpeaking?: boolean;
  onOptionSelect?: (value: string, label: string) => void;
  onSpeak?: (text: string) => void;
}) {
  const [hoveredCitation, setHoveredCitation] = useState<string | null>(null);
  const streaming = msg.role === "nova" && isLatestNova;
  const { displayed, done } = useStreamingText(msg.text, streaming, 11);
  const text = streaming ? displayed : msg.text;

  if (msg.role === "user") {
    return (
      <motion.div
        className={styles.userMsg}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {msg.intent && (
          <span className={styles.userIntent}>
            <RiSparklingLine size={9} />
            {intentLabel(msg.intent, msg.text.split(/\s+/).length)}
          </span>
        )}
        {msg.imagePreview && (
          <div className={styles.msgImageWrap}>
            <img src={msg.imagePreview} alt="uploaded screenshot" className={styles.msgImage} />
          </div>
        )}
        <div className={styles.userBubble}>{msg.text}</div>
      </motion.div>
    );
  }

  const showExtras = streaming ? done : true;
  const speaking = isSpeaking && isLatestNova;

  return (
    <motion.div
      className={styles.novaMsg}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className={`${styles.novaAvatar} ${speaking ? styles.novaAvatarSpeaking : ""}`}>
        {speaking ? (
          <div className={styles.speakingBars}>
            {[0,1,2,3,4].map((i) => (
              <span key={i} className={styles.speakBar} style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        ) : (
          <RiBrainLine size={13} />
        )}
      </div>
      <div className={styles.novaContent}>
        <div className={styles.novaText}>
          <FormattedText
            text={text}
            cursor={streaming && !done ? true : undefined}
          />
        </div>
        {msg.pendingTicket && showExtras && (
          <TicketPreviewCard ticket={msg.pendingTicket} />
        )}
        {msg.citations && msg.citations.length > 0 && showExtras && (
          <div className={styles.citations}>
            {msg.citations.map((c) => (
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
        {msg.options && msg.options.length > 0 && showExtras && onOptionSelect && (
          <AIOptionBlock options={msg.options} onSelect={onOptionSelect} />
        )}
        {msg.created && showExtras && (
          <CreatedItemCard item={msg.created} />
        )}
        {msg.agentSteps && msg.agentSteps.length > 0 && showExtras && (
          <AgentStepTrace steps={msg.agentSteps} />
        )}
        {showExtras && onSpeak && (
          <button
            className={`${styles.speakBtn} ${speaking ? styles.speakBtnActive : ""}`}
            onClick={() => onSpeak(msg.text)}
            title={speaking ? "Speaking…" : "Read aloud"}
          >
            <RiVolumeUpLine size={11} />
          </button>
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

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [dismissedPulseIds, setDismissedPulseIds] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [attachedMedia, setAttachedMedia] = useState<{
    name: string;
    mediaType: "image" | "audio" | "video";
    base64?: string;
    file?: File;
  } | null>(null);
  const [recentItems, setRecentItems] = useState<
    (CreatedItem & { age: string })[]
  >([]);
  const [agentMode, setAgentMode] = useState(true);
  const [liveSteps, setLiveSteps] = useState<AgentStep[]>([]);
  const [pulseOpen, setPulseOpen] = useState(false);
  const [wizardState, setWizardState] = useState<WizardState | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState<ConversationRecord[]>(() => loadChatHistory());
  const [detectedMode, setDetectedMode] = useState<Mode>("assistant");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [cmdPaletteIndex, setCmdPaletteIndex] = useState(0);

  const { speaking, voiceEnabled, setVoiceEnabled, speak, speakIfEnabled, stop } = useSpeech();

  // Auto-speak latest nova message when voice is enabled
  useEffect(() => {
    if (!voiceEnabled) return;
    const last = [...messages].reverse().find((m) => m.role === "nova");
    if (last) speakIfEnabled(last.text);
  // Only fire when a new nova message is appended (messages.length changes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const suggestions = podContext
    ? podSuggestions(podContext)
    : GLOBAL_SUGGESTIONS;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const intent = detectIntent(input, !!attachedMedia);
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
    queryFn: () =>
      fetchDecisions(podContext ? { space_id: podContext } : undefined),
    staleTime: 5 * 60 * 1000,
  });

  const { data: standups = [] } = useQuery({
    queryKey: ["team-standups", podContext],
    queryFn: () => fetchTeamStandups(undefined, podContext),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allSprints = [] } = useQuery({
    queryKey: ["sprints"],
    queryFn: fetchSprints,
    staleTime: 2 * 60 * 1000,
  });

  const { data: orgUsers = [] } = useQuery({
    queryKey: ['org-users'],
    queryFn: fetchOrgUsers,
    staleTime: 10 * 60 * 1000,
  });

  const activeSprint: Sprint | undefined = allSprints.find(
    (s: Sprint) => s.status === "active",
  );

  const { data: spacesList = [] } = useQuery({
    queryKey: ['spaces-list'],
    queryFn: fetchSpacesList,
    staleTime: 10 * 60 * 1000,
  });
  const availablePods: string[] = spacesList.map(s => s.pod).filter(Boolean);

  /* Auto-index on mount — silent, best-effort */
  useEffect(() => {
    triggerReindex().catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pulse = React.useMemo(
    () =>
      [...anomalies.map(anomalyToPulse), ...gaps.slice(0, 3).map(gapToPulse)]
        .filter(item => !dismissedPulseIds.has(item.id)),
    [anomalies, gaps, dismissedPulseIds],
  );

  const decisions: Decision[] = decisionsResp?.decisions ?? [];
  const memoryClips: MemoryClip[] = [
    ...decisions.slice(0, 2).map(decisionToMemory),
    ...standups.slice(0, 2).map(standupToMemory),
  ];

  const agents: Agent[] = [
    ...(anomalies.length > 0 || (novaStatus as any)?.available
      ? [
          {
            id: "a1",
            name: "Anomaly detector",
            status: (anomalies.length > 0 ? "done" : "running") as AgentStatus,
            progress: anomalies.length > 0 ? 100 : 50,
            task:
              anomalies.length > 0
                ? `${anomalies.length} anomal${anomalies.length !== 1 ? "ies" : "y"} found`
                : "Scanning pod health signals…",
          },
        ]
      : []),
    ...(gaps.length > 0
      ? [
          {
            id: "a2",
            name: "Wiki gap scanner",
            status: "done" as AgentStatus,
            progress: 100,
            task: `${gaps.length} knowledge gap${gaps.length !== 1 ? "s" : ""} detected`,
          },
        ]
      : []),
  ];

  useEffect(() => {
    if (threadRef.current)
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [input]);

  // Auto-save conversation when navigating away
  useEffect(() => {
    const handleUnload = () => {
      if (messages.length >= 2) saveConversation(messages);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [messages]);

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

  /* ── Shared ticket creation pipeline ── */
  const VALID_ISSUE_TYPES = new Set(['Bug', 'Task', 'Story', 'Epic', 'Subtask', 'Improvement']);
  const VALID_PRIORITIES  = new Set(['Highest', 'High', 'Medium', 'Low', 'Lowest']);

  const executeTicketCreate = useCallback(
    async (ticket: PendingTicket): Promise<{ key: string } | null> => {
      // Sanitize AI-generated values against backend's enum whitelist
      const safeIssueType = VALID_ISSUE_TYPES.has(ticket.issue_type) ? ticket.issue_type : 'Task';
      const safePriority  = VALID_PRIORITIES.has(ticket.priority)   ? ticket.priority  : 'Medium';

      console.log("[EOS] Creating ticket payload:", { ...ticket, issue_type: safeIssueType, priority: safePriority });

      const payload: Parameters<typeof createTicket>[0] = {
        title: ticket.title,
        description: ticket.description,
        priority: safePriority,
        issue_type: safeIssueType,
        ...(ticket.pod && { pod: ticket.pod }),
        ...(ticket.assignee && { assignee: ticket.assignee }),
        ...(ticket.story_points && { story_points: ticket.story_points }),
        ...(ticket.labels?.length && { labels: ticket.labels }),
        ...(ticket.due_date && { due_date: ticket.due_date }),
        ...(ticket.sprint_id && { sprint_id: ticket.sprint_id }),
      };

      const created = await createTicket(payload);
      console.log("[EOS] Ticket created:", created);

      const ticketKey = created?.key ?? null;

      // Auto-assign to active sprint if not already assigned
      if (ticketKey && activeSprint && !ticket.sprint_id) {
        try {
          console.log("[EOS] Assigning ticket to sprint:", activeSprint.id);
          await addTicketToSprint(activeSprint.id, ticketKey);
          console.log("[EOS] Sprint assignment successful");
        } catch (sprintErr) {
          console.warn("[EOS] Sprint assignment failed:", sprintErr);
        }
      }

      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["kanban-tickets"] });
      qc.invalidateQueries({ queryKey: ["sprints"] });

      return created ? { key: ticketKey! } : null;
    },
    [activeSprint, qc],
  );

  const send = useCallback(
    async (overrideText?: string, overrideIntent?: Intent) => {
      const rawText = (overrideText ?? input).trim();

      // ── Command palette routing ──
      if (rawText.startsWith("/") && !overrideIntent) {
        const [cmd, ...argParts] = rawText.split(" ");
        const args = argParts.join(" ").trim();
        setInput("");
        setShowCommandPalette(false);

        if (cmd === "/help") {
          setMessages((prev) => [...prev,
            { id: crypto.randomUUID(), role: "user" as const, text: rawText, ts: new Date() },
            { id: crypto.randomUUID(), role: "nova" as const, text: HELP_TEXT, ts: new Date() },
          ]);
          return;
        }
        const def = COMMANDS.find((c) => c.cmd === cmd);
        const routed = def?.toQuery(args) ?? rawText;
        return send(routed, "ask");
      }

      const text = rawText;
      const finalIntent =
        overrideIntent ??
        (attachedMedia ? "screenshot" : detectIntent(text, false));
      if ((!text && !attachedMedia) || loading) return;

      // Detect mode and set initial status
      const mode = detectMode(text);
      setDetectedMode(mode);
      const statusSeq = MODE_STATUS_SEQUENCE[mode];
      setStatusMessage(statusSeq[0]);

      const capturedMedia = attachedMedia;
      setInput("");
      setAttachedMedia(null);
      setShowCommandPalette(false);

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        text: text || "[media attached]",
        intent: finalIntent,
        imagePreview: capturedMedia?.mediaType === 'image' && capturedMedia.base64
          ? `data:image/png;base64,${capturedMedia.base64}`
          : undefined,
        ts: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        let novaMsg: Message;

        /* ── Meeting transcript ── */
        if (finalIntent === "meeting") {
          const result = await extractMeetingActions(text);
          const structured =
            typeof result === "string"
              ? result
              : (result?.structured_md ?? result?.content ?? "");
          const title = `Meeting Notes — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
          novaMsg = {
            id: crypto.randomUUID(),
            role: "nova",
            text: "Detected a meeting transcript. I've structured it into a doc — here's the preview:",
            created: {
              type: "doc",
              id: `DOC-${Date.now().toString().slice(-4)}`,
              title,
              meta: (structured as string).slice(0, 120) + "…",
            },
            ts: new Date(),
          };

        /* ── Thought / Voice → ticket suggestion ── */
        } else if (finalIntent === "thought" || finalIntent === "voice") {
          console.log(`[EOS] ${finalIntent} intent — extracting ticket fields`);
          const sprintCtx = activeSprint
            ? `Active sprint: "${activeSprint.name}" (id: ${activeSprint.id}).`
            : "No active sprint.";
          const raw = await novaGenerate(
            `Structure this engineering input as a ticket. ${sprintCtx}
Return ONLY valid JSON, no prose or markdown fences:
{
  "title": "concise action-oriented title",
  "description": "full description with context",
  "priority": "High|Medium|Low",
  "issue_type": "Bug|Task|Story|Improvement",
  "story_points": 3,
  "labels": [],
  "due_date": null
}
Input: "${text}"`,
            "You are NOVA/EOS, the AI operating system of Trackly. Return ONLY a valid JSON object. No prose, no markdown fences.",
            0.2,
          );

          let ticket: PendingTicket = {
            title: text.slice(0, 72),
            description: text,
            priority: "Medium",
            issue_type: "Task",
          };
          try {
            const m = raw.match(/\{[\s\S]*?\}/);
            if (m) {
              const parsed = JSON.parse(m[0]);
              ticket = {
                title: parsed.title || ticket.title,
                description: parsed.description || ticket.description,
                priority: parsed.priority || ticket.priority,
                issue_type: parsed.issue_type || ticket.issue_type,
                story_points: parsed.story_points || undefined,
                labels: parsed.labels?.length ? parsed.labels : undefined,
                due_date: parsed.due_date || undefined,
              };
            }
          } catch {
            console.warn("[EOS] Failed to parse ticket JSON, using defaults");
          }
          console.log("[EOS] Extracted ticket fields:", ticket);

          // Start wizard — ask which space first
          const spaceOptions = buildSpaceOptions(availablePods, allSprints);
          setWizardState({ ticket, stage: 'space' });
          novaMsg = {
            id: crypto.randomUUID(),
            role: "nova",
            text: 'Which **project** should this ticket go to?',
            pendingTicket: ticket,
            options: spaceOptions.length > 0
              ? spaceOptions
              : [{ label: 'Default Project', value: 'space:default' }],
            ts: new Date(),
          };

        /* ── Screenshot / Audio / Video ── */
        } else if (finalIntent === "screenshot") {
          let analysisResult: {
            title: string;
            description: string;
            repro_steps?: string[];
            severity?: string;
            issue_type?: string;
            story_points?: number;
          } | null = null;
          let mediaLabel = "media";

          if (capturedMedia?.mediaType === "image" && capturedMedia.base64) {
            mediaLabel = "screenshot";
            console.log("[EOS] Analyzing screenshot via vision model");
            try {
              analysisResult = await analyzeScreenshot(capturedMedia.base64, text);
              console.log("[EOS] Screenshot analysis result:", analysisResult);
            } catch (visionErr) {
              console.warn("[EOS] Vision model unavailable, falling back to text analysis:", visionErr);
              // Fallback: text-based analysis when LLaVA / vision model is offline
              const raw = await novaGenerate(
                `A screenshot was uploaded${text ? ` with context: "${text}"` : ""}. Based on the description, extract bug/issue details.
Return ONLY valid JSON:
{"title": string, "description": string, "repro_steps": [string], "severity": "critical|high|medium|low", "issue_type": "Bug|Task", "story_points": 2}`,
                "You are NOVA/EOS, the AI operating system of Trackly. Return ONLY valid JSON.",
                0.3,
              );
              try {
                const m = raw.match(/\{[\s\S]*?\}/);
                if (m) {
                  analysisResult = JSON.parse(m[0]);
                }
              } catch {
                /* ignore */
              }
              analysisResult = analysisResult ?? {
                title: text.slice(0, 72) || "Bug from screenshot",
                description: text || "Issue captured from screenshot",
                severity: "medium",
                issue_type: "Bug",
              };
            }
          } else if (
            capturedMedia?.mediaType === "audio" ||
            capturedMedia?.mediaType === "video"
          ) {
            mediaLabel = capturedMedia.mediaType;
            console.log(`[EOS] Transcribing ${mediaLabel} file:`, capturedMedia.name);
            const result = await transcribeMedia(capturedMedia.file!);
            console.log("[EOS] Transcription result:", result);
            const f = result.fields ?? {};
            analysisResult = {
              title: f.title ?? `Issue from ${mediaLabel}`,
              description: f.description ?? result.transcript,
              issue_type: f.issue_type ?? "Bug",
              severity: (f.priority ?? "medium").toLowerCase(),
              repro_steps: [],
            };
          } else {
            // No file attached but screenshot intent — use text context
            console.log("[EOS] No media file found, using text context");
            const raw = await novaGenerate(
              `A ${mediaLabel} was shared showing a potential issue. Description: "${text || "No description"}". Describe the likely bug and reproduction steps.
Return ONLY valid JSON:
{"title": string, "description": string, "repro_steps": [string], "severity": "medium", "issue_type": "Bug"}`,
              "You are NOVA/EOS, the AI operating system of Trackly. Return ONLY valid JSON.",
              0.3,
            );
            try {
              const m = raw.match(/\{[\s\S]*?\}/);
              analysisResult = m ? JSON.parse(m[0]) : null;
            } catch { /* ignore */ }
            analysisResult = analysisResult ?? {
              title: text.slice(0, 72) || "Bug from media",
              description: raw || text,
              severity: "medium",
              issue_type: "Bug",
            };
          }

          if (!analysisResult) {
            throw new Error("Could not extract issue details from the uploaded media. Please add a description and try again.");
          }

          const steps = analysisResult.repro_steps?.length
            ? "\n\n**Steps to reproduce:**\n" +
              analysisResult.repro_steps.map((s, i) => `${i + 1}. ${s}`).join("\n")
            : "";

          const priority =
            analysisResult.severity === "critical" ? "Highest"
            : analysisResult.severity === "high" ? "High"
            : "Medium";

          const ticket: PendingTicket = {
            title: analysisResult.title,
            description: analysisResult.description + (steps ? "\n" + steps : ""),
            priority,
            issue_type: analysisResult.issue_type ?? "Bug",
            story_points: analysisResult.story_points,
          };
          console.log("[EOS] Screenshot ticket payload ready:", ticket);

          // Start wizard — ask which space first
          const spaceOptions = buildSpaceOptions(availablePods, allSprints);
          setWizardState({ ticket, stage: 'space' });
          novaMsg = {
            id: crypto.randomUUID(),
            role: "nova",
            text: 'Which **project** should this ticket go to?',
            pendingTicket: ticket,
            options: spaceOptions.length > 0
              ? spaceOptions
              : [{ label: 'Default Project', value: 'space:default' }],
            ts: new Date(),
          };

        /* ── Conversational / Ask ── */
        } else {
          // Check if user is confirming a pending ticket from previous message
          const lastNovaMsg = [...messages].reverse().find((m) => m.role === "nova");
          const pendingTicket = lastNovaMsg?.pendingTicket;
          const isConfirm = /^(yes|create it|go ahead|confirm|do it|create|ok|sure|yep|yeah|file it|file)/i.test(text.trim());

          if (isConfirm && pendingTicket) {
            console.log("[EOS] User confirmed ticket creation:", pendingTicket);
            const created = await executeTicketCreate(pendingTicket);
            const ticketKey = created?.key ?? "TRK-???";
            const createdType: CreatedType =
              pendingTicket.issue_type === "Bug" || pendingTicket.issue_type === "UI Bug" ? "bug" : "ticket";

            toast.success(`${createdType === "bug" ? "Bug" : "Ticket"} ${ticketKey} created!`);

            novaMsg = {
              id: crypto.randomUUID(),
              role: "nova",
              text: `${createdType === "bug" ? "Bug" : "Ticket"} ${ticketKey} created successfully.${activeSprint ? ` Added to sprint: ${activeSprint.name}.` : ""}`,
              created: {
                type: createdType,
                id: ticketKey,
                title: pendingTicket.title,
                meta: `Priority: ${pendingTicket.priority} · ${pendingTicket.issue_type}${pendingTicket.assignee ? ` · ${pendingTicket.assignee}` : " · Unassigned"}`,
              },
              ts: new Date(),
            };
            setRecentItems((prev) =>
              [{ type: createdType, id: ticketKey, title: pendingTicket.title, meta: `Priority: ${pendingTicket.priority}`, age: "just now" }, ...prev].slice(0, 6),
            );
            setMessages((prev) => [...prev, novaMsg!]);
            setLoading(false);
            return;
          }

          const isShortOrConversational =
            text.split(/\s+/).filter(Boolean).length <= 3 ||
            /^(hi|hello|hey|thanks|thank you|ok|okay|cool|bye|yo|sup)\b/i.test(text.trim());

          if (agentMode && !isShortOrConversational) {
            setLiveSteps([]);
            const history = messages.slice(-10).map((m) => ({
              role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
              content: m.text,
            }));
            console.log("[EOS] Running agent loop for:", text);
            const result = await runAgentLoop(text, history, (step) => {
              setLiveSteps((prev) => [...prev, step]);
              if (step.toolCall?.action) {
                setStatusMessage(TOOL_STATUS[step.toolCall.action] ?? "Processing...");
              }
            });
            console.log("[EOS] Agent loop result:", result);
            novaMsg = {
              id: crypto.randomUUID(),
              role: "nova",
              text: result.answer || "Agent loop completed.",
              agentSteps: result.steps,
              ts: new Date(),
            };
            if (result.createdTicket) {
              const { id, title, priority, issue_type } = result.createdTicket;
              novaMsg.created = {
                type: "ticket",
                id,
                title,
                meta: `Priority: ${priority} · ${issue_type} · Unassigned`,
              };
              qc.invalidateQueries({ queryKey: ["tickets"] });
              qc.invalidateQueries({ queryKey: ["kanban-tickets"] });
              setRecentItems((prev) =>
                [{ type: "ticket" as CreatedType, id, title, meta: `Priority: ${priority}`, age: "just now" }, ...prev].slice(0, 6),
              );
            }
            // Auto-refresh timesheet/activity if timesheet tools were used
            const toolsUsed = result.steps
              .filter((s) => s.toolCall?.action)
              .map((s) => s.toolCall!.action);
            if (toolsUsed.some((t) => ["log_time", "update_worklog", "get_timesheet"].includes(t))) {
              qc.invalidateQueries({ queryKey: ["activity"] });
            }
            setLiveSteps([]);
          } else {
            const res = await novaQuery(text, undefined, podContext);
            novaMsg = {
              id: crypto.randomUUID(),
              role: "nova",
              text: res.answer || "I couldn't find a relevant answer. Try rephrasing your question.",
              citations: res.citations
                .filter((c) => c.title)
                .map((c) => ({
                  key: String(c.key ?? c.id),
                  title: c.title,
                  type: (["ticket", "decision", "wiki", "standup"].includes(c.type) ? c.type : "ticket") as Citation["type"],
                  quote: c.snippet || undefined,
                })),
              ts: new Date(),
            };
          }
        }

        setMessages((prev) => [...prev, novaMsg]);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "EOS is unavailable right now.";
        console.error("[EOS] send() error:", e);
        toast.error(errMsg);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "nova" as const,
            text: `I ran into an issue: ${errMsg}`,
            ts: new Date(),
          },
        ]);
      } finally {
        setLoading(false);
        setStatusMessage("");
      }
    },
    [input, attachedMedia, loading, agentMode, messages, qc, activeSprint, allSprints, availablePods, executeTicketCreate, podContext, setWizardState],
  );

  /* ── Handle interactive option selections from AIOptionBlock ── */
  const handleOptionSelect = useCallback(
    (value: string, _label: string) => {
      if (value === 'confirm') {
        const finalTicket = wizardState?.ticket ??
          [...messages].reverse().find(m => m.role === 'nova')?.pendingTicket;
        if (!finalTicket) return;
        (async () => {
          try {
            const created = await executeTicketCreate(finalTicket as PendingTicket);
            const ticketKey = created?.key ?? 'TRK-???';
            const createdType: CreatedType =
              (finalTicket.issue_type === 'Bug' || finalTicket.issue_type === 'UI Bug') ? 'bug' : 'ticket';
            const sprintName = wizardState?.sprintName ?? (activeSprint?.name ?? '');
            const pod = wizardState?.pod ?? finalTicket.pod ?? '';
            toast.success(`${createdType === 'bug' ? 'Bug' : 'Ticket'} ${ticketKey} created!`);
            const successMsg: Message = {
              id: crypto.randomUUID(),
              role: 'nova',
              text: `**${ticketKey}** created successfully.${sprintName ? ` → ${sprintName === 'Backlog' ? 'Added to Backlog' : `Sprint: ${sprintName}`}.` : ''}`,
              created: {
                type: createdType,
                id: ticketKey,
                title: finalTicket.title,
                meta: `${finalTicket.priority} · ${finalTicket.issue_type}${finalTicket.assignee ? ` · ${finalTicket.assignee}` : ' · Unassigned'}${finalTicket.story_points ? ` · ${finalTicket.story_points} pts` : ''}${pod ? ` · ${pod}` : ''}`,
              },
              ts: new Date(),
            };
            setRecentItems(prev =>
              [{ type: createdType, id: ticketKey, title: finalTicket.title, meta: `Priority: ${finalTicket.priority}`, age: 'just now' }, ...prev].slice(0, 6)
            );
            setMessages(prev => [...prev, successMsg]);
            setWizardState(null);
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Ticket creation failed.';
            console.error('[EOS] Ticket creation error:', err);
            toast.error(msg);
            setMessages(prev => [...prev, {
              id: crypto.randomUUID(), role: 'nova' as const,
              text: `Failed to create ticket: ${msg}`, ts: new Date(),
            }]);
            setWizardState(null);
          }
        })();
      } else if (value === 'cancel') {
        setWizardState(null);
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(), role: 'nova' as const,
          text: 'No problem — ticket creation cancelled. Let me know if you need anything else.', ts: new Date(),
        }]);
      } else if (value.startsWith('space:')) {
        const pod = value.replace('space:', '');
        if (!wizardState) return;
        const nextWizard: WizardState = { ...wizardState, stage: 'sprint', pod };
        setWizardState(nextWizard);
        const sprintOptions = buildSprintOptions(allSprints, pod);
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(), role: 'nova' as const,
          text: `Got it — **${pod}** project. Which sprint should this go into?`,
          options: sprintOptions,
          ts: new Date(),
        }]);
      } else if (value.startsWith('sprint:')) {
        const sprintId = value.replace('sprint:', '');
        if (!wizardState) return;
        const sprintName = sprintId === 'backlog'
          ? 'Backlog'
          : allSprints.find(s => s.id === sprintId)?.name ?? sprintId;
        const nextWizard: WizardState = { ...wizardState, stage: 'assignee', sprintId, sprintName };
        setWizardState(nextWizard);
        const assigneeOpts = buildAssigneeOptions(orgUsers, standups);
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(), role: 'nova' as const,
          text: `**${sprintName}** it is. Who should this be assigned to?`,
          options: assigneeOpts,
          ts: new Date(),
        }]);
      } else if (value.startsWith('assignee:')) {
        const assignee = value.replace('assignee:', '');
        if (!wizardState) return;
        const resolvedAssignee = assignee === 'unassigned' ? undefined : assignee;
        const nextWizard: WizardState = { ...wizardState, stage: 'points', assignee: resolvedAssignee };
        setWizardState(nextWizard);
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(), role: 'nova' as const,
          text: `Assigned to **${resolvedAssignee ?? 'no one'}**. How many story points?`,
          options: STORY_POINT_OPTIONS,
          ts: new Date(),
        }]);
      } else if (value.startsWith('points:')) {
        const pts = parseInt(value.replace('points:', ''), 10);
        if (!wizardState) return;
        const finalTicket: PendingTicket & { pod?: string; sprintName?: string } = {
          ...wizardState.ticket,
          pod: wizardState.pod,
          sprint_id: wizardState.sprintId === 'backlog' ? undefined : wizardState.sprintId,
          assignee: wizardState.assignee,
          story_points: pts > 0 ? pts : undefined,
          sprintName: wizardState.sprintName,
        };
        const nextWizard: WizardState = { ...wizardState, stage: 'confirm', ticket: finalTicket };
        setWizardState(nextWizard);
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(), role: 'nova' as const,
          text: 'Here is the complete ticket — ready to create:',
          pendingTicket: finalTicket,
          options: [
            { label: '✓ Create Ticket', value: 'confirm' },
            { label: '✕ Cancel', value: 'cancel' },
          ],
          ts: new Date(),
        }]);
      } else {
        send(value, 'ask');
      }
    },
    [wizardState, allSprints, orgUsers, standups, messages, activeSprint, executeTicketCreate, send],
  );

  function toggleRecording() {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
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

  const latestNovaId = [...messages]
    .reverse()
    .find((m) => m.role === "nova")?.id;

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <h1 className={styles.pageTitle}>EOS</h1>
          <span className={styles.aiBadge}>
            <RiSparklingLine size={10} />
            AI Intelligence
          </span>
          {podContext && <span className={styles.podBadge}>{podContext}</span>}
        </div>
      </div>

      <div className={styles.pageSubHeader}>
        <div className={styles.pageHeaderRight}>
          <button
            className={`${styles.agentToggle} ${agentMode ? styles.agentToggleOn : ""}`}
            onClick={() => setAgentMode((m) => !m)}
            title={
              agentMode
                ? "Agent mode ON — click to switch to RAG mode"
                : "Enable agent mode — EOS reasons and uses tools"
            }
          >
            <RiFlashlightLine size={12} />
            {agentMode ? "Agent ON" : "Agent mode"}
          </button>
          <button
            className={styles.historyBtn}
            onClick={() => setShowHistory(true)}
            title="View past conversations"
          >
            <RiHistoryLine size={12} />
            History
          </button>
          {messages.length > 0 && (
            <button
              className={styles.newChatBtn}
              onClick={() => {
                saveConversation(messages);
                setChatHistory(loadChatHistory());
                setMessages([]);
                setWizardState(null);
              }}
              title="Start a new conversation"
            >
              New chat
            </button>
          )}
          <button
            className={`${styles.agentToggle} ${voiceEnabled ? styles.agentToggleOn : ""}`}
            onClick={() => {
              if (voiceEnabled) stop();
              setVoiceEnabled((v) => !v);
            }}
            title={voiceEnabled ? "Voice ON — click to mute EOS" : "Enable EOS voice"}
          >
            {voiceEnabled ? <RiVolumeUpLine size={12} /> : <RiVolumeMuteLine size={12} />}
            {voiceEnabled ? "Voice ON" : "Voice"}
          </button>
          <button
            className={`${styles.pulseToggleBtn} ${pulseOpen ? styles.pulseToggleBtnActive : ""}`}
            onClick={() => setPulseOpen((o) => !o)}
          >
            Pulse
            {pulse.length > 0 && (
              <span className={styles.pulseBtnBadge}>{pulse.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>
        {/* ── Left: EOS Desk ── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHead}>
            <span>EOS Desk</span>
            <button
              className={styles.reindexIconBtn}
              onClick={handleReindex}
              disabled={indexing}
              title="Re-index project data"
              style={{ marginLeft: "auto" }}
            >
              <RiRefreshLine
                size={12}
                className={indexing ? styles.spinning : undefined}
              />
            </button>
          </div>

          <div className={styles.sidebarScroll}>
            {/* Monitors */}
            {agents.length > 0 && (
              <div className={styles.deskSection}>
                <div className={styles.deskSectionHead}>
                  <span>Monitors</span>
                  <span className={styles.deskSectionCount}>
                    {agents.filter((a) => a.status === "running").length} active
                  </span>
                </div>
                <div className={styles.agentList}>
                  {agents.map((a) => (
                    <div key={a.id} className={styles.agentItem}>
                      <div className={styles.agentRow}>
                        <span
                          className={`${styles.agentDot} ${styles[`agentDot_${a.status}`]}`}
                        />
                        <span className={styles.agentName}>{a.name}</span>
                      </div>
                      <div className={styles.agentTask}>{a.task}</div>
                      {a.status === "running" && a.progress < 100 && (
                        <div className={styles.agentTrack}>
                          <div
                            className={styles.agentFill}
                            style={{ width: `${a.progress}%` }}
                          />
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
                <span>Memory</span>
              </div>
              <div className={styles.memoryList}>
                {memoryClips.length === 0 && (
                  <div className={styles.deskEmpty}>
                    No decisions or standups found.
                  </div>
                )}
                {memoryClips.map((m) => (
                  <button
                    key={m.id}
                    className={styles.memoryClip}
                    onClick={() =>
                      send(`Tell me more about: ${m.title}`, "ask")
                    }
                  >
                    <div className={styles.memoryClipHead}>
                      <span
                        className={`${styles.memoryType} ${styles[`memType_${m.type}`]}`}
                      >
                        {m.type}
                      </span>
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
                <span>Created by EOS</span>
              </div>
              <div className={styles.createdList}>
                {recentItems.length === 0 && (
                  <div className={styles.deskEmpty}>
                    Nothing created yet — describe a thought or paste a
                    transcript.
                  </div>
                )}
                {recentItems.map((item, i) => (
                  <div
                    key={i}
                    className={styles.createdListItem}
                    style={{ borderLeftColor: CREATED_COLOR[item.type] }}
                  >
                    <div className={styles.createdListHead}>
                      <span
                        className={styles.createdListId}
                        style={{ color: CREATED_COLOR[item.type] }}
                      >
                        {item.id}
                      </span>
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
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node))
              setDragOver(false);
          }}
          onDrop={handleDrop}
        >
          <AnimatePresence>
            {dragOver && (
              <motion.div
                className={styles.dropOverlay}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <RiImageLine size={34} />
                <span>
                  Drop screenshot, audio, or video — EOS will analyze and file a
                  bug report
                </span>
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
                <h2 className={styles.emptyTitle}>Hi, I'm EOS</h2>
                <p className={styles.emptyDesc}>
                  I know your tickets, standups, timesheets, and sprint analytics.
                  Ask me anything — I'll answer like JARVIS, but better.
                </p>
                <div className={styles.emptySuggestions}>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      className={styles.emptySuggestion}
                      onClick={() => send(s, "ask")}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className={styles.emptyModes}>
                  <div className={styles.emptyMode}>
                    <RiTimeLine size={12} />
                    <span>Timesheets</span>
                  </div>
                  <div className={styles.emptyMode}>
                    <RiBugLine size={12} />
                    <span>Bugs &amp; tickets</span>
                  </div>
                  <div className={styles.emptyMode}>
                    <RiBarChartLine size={12} />
                    <span>Analytics</span>
                  </div>
                  <div className={styles.emptyMode}>
                    <RiFileTextLine size={12} />
                    <span>Standups</span>
                  </div>
                  <div className={styles.emptyMode}>
                    <RiMicLine size={12} />
                    <span>Voice</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.messageList}>
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isLatestNova={msg.id === latestNovaId}
                    isSpeaking={speaking && msg.id === latestNovaId}
                    onOptionSelect={handleOptionSelect}
                    onSpeak={msg.role === "nova" ? speak : undefined}
                  />
                ))}
                {loading && (
                  <div className={styles.novaMsg}>
                    <div className={styles.novaAvatar}>
                      <RiBrainLine size={13} />
                    </div>
                    <div className={styles.agentLiveTrace}>
                      {/* Mode badge */}
                      <span className={`${styles.modeBadge} ${styles[`mode_${detectedMode}`]}`}>
                        {MODE_LABEL[detectedMode]}
                      </span>
                      {/* Status message */}
                      {statusMessage && (
                        <div className={styles.statusLine}>
                          <RiLoader4Line size={10} className={styles.spinning} />
                          <span>{statusMessage}</span>
                        </div>
                      )}
                      {/* Live tool call steps */}
                      {agentMode && liveSteps.filter((s) => s.toolCall).map((s, i) => (
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
                      <div className={styles.thinkingDots} style={{ marginTop: 4 }}>
                        <span /><span /><span />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className={styles.inputWrap}>
            {/* Command palette */}
            <AnimatePresence>
              {showCommandPalette && (
                <CommandPalette
                  input={input}
                  selectedIndex={cmdPaletteIndex}
                  onSelect={(cmd) => {
                    setInput(cmd.cmd + " ");
                    setShowCommandPalette(false);
                    textareaRef.current?.focus();
                  }}
                />
              )}
            </AnimatePresence>

            {attachedMedia && (
              <div className={styles.attachedBadge}>
                {attachedMedia.mediaType === "image" ? (
                  <RiImageLine size={11} />
                ) : attachedMedia.mediaType === "audio" ? (
                  <RiMusicLine size={11} />
                ) : (
                  <RiVideoLine size={11} />
                )}
                <span>{attachedMedia.name}</span>
                <button
                  onClick={() => setAttachedMedia(null)}
                  aria-label="Remove attachment"
                >
                  <RiCloseLine size={10} />
                </button>
              </div>
            )}

            <div
              className={`${styles.inputBar} ${recording ? styles.inputBarRecording : ""} ${dragOver ? styles.inputBarDrag : ""}`}
            >
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
                    <span
                      key={i}
                      className={styles.waveBar}
                      style={{ animationDelay: `${i * 0.065}s` }}
                    />
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
                  onChange={(e) => {
                    const val = e.target.value;
                    setInput(val);
                    setShowCommandPalette(val.startsWith("/") && val.length >= 1 && !val.includes(" "));
                    setCmdPaletteIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (showCommandPalette) {
                      const partial = input.slice(1).toLowerCase();
                      const filtered = COMMANDS.filter((c) => c.cmd.slice(1).startsWith(partial));
                      if (e.key === "ArrowDown") { e.preventDefault(); setCmdPaletteIndex((i) => (i + 1) % Math.max(1, filtered.length)); return; }
                      if (e.key === "ArrowUp")   { e.preventDefault(); setCmdPaletteIndex((i) => (i - 1 + filtered.length) % Math.max(1, filtered.length)); return; }
                      if (e.key === "Tab" || (e.key === "Enter" && filtered.length > 0)) {
                        e.preventDefault();
                        const chosen = filtered[cmdPaletteIndex % filtered.length];
                        if (chosen) { setInput(chosen.cmd + " "); setShowCommandPalette(false); }
                        return;
                      }
                      if (e.key === "Escape") { setShowCommandPalette(false); return; }
                    }
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
              )}

              <button
                className={`${styles.sendBtn} ${(input.trim() || attachedMedia) && !recording ? styles.sendBtnOn : ""}`}
                onClick={() => send()}
                disabled={
                  (!input.trim() && !attachedMedia) || loading || recording
                }
                aria-label="Send"
              >
                <RiSendPlaneLine size={16} />
              </button>
            </div>

            <AnimatePresence>
              {(intentLabel(intent, wordCount) || input.trim().startsWith("/")) &&
                (input.trim() || attachedMedia) && (
                  <motion.div
                    className={styles.intentHint}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                  >
                    {input.trim().startsWith("/") ? (
                      <>
                        <RiTerminalBoxLine size={10} />
                        <span>Command mode — press ↑↓ to navigate, Tab to select</span>
                      </>
                    ) : (
                      <>
                        <RiSparklingLine size={10} />
                        <span>{intentLabel(intent, wordCount)}</span>
                      </>
                    )}
                  </motion.div>
                )}
            </AnimatePresence>
          </div>
        </main>

        {/* ── Pulse Side Drawer ── */}
        <SideDrawer
          open={pulseOpen}
          onClose={() => setPulseOpen(false)}
          size="xs"
          title="Pulse"
          subtitle="EOS is watching"
          avatar={<span className={styles.liveDot} />}
        >
          <div className={styles.pulseFeed}>
            <AnimatePresence mode="popLayout">
              {pulse.map((item) => (
                <PulseCard
                  key={item.id}
                  item={item}
                  onDismiss={() =>
                    setDismissedPulseIds(prev => new Set([...prev, item.id]))
                  }
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
        </SideDrawer>

        {/* ── Chat History Panel ── */}
        <ChatHistoryPanel
          open={showHistory}
          history={chatHistory}
          onLoad={(msgs) => {
            setMessages(msgs);
            setWizardState(null);
          }}
          onClear={() => {
            localStorage.removeItem(CHAT_HISTORY_KEY);
            setChatHistory([]);
            toast.success('Chat history cleared.');
          }}
          onClose={() => setShowHistory(false)}
        />
      </div>
    </div>
  );
}
