import { useState, useRef, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
  RiSparklingLine, RiSendPlaneLine, RiFileCopyLine, RiCheckLine,
  RiAlertLine, RiFlashlightLine, RiTaskLine, RiBarChartLine,
  RiTeamLine, RiFileTextLine, RiLightbulbLine, RiShieldLine,
  RiRocketLine, RiEyeLine, RiArrowRightLine, RiCloseLine,
  RiUserLine,
} from "react-icons/ri";
import {
  generateSprintRetro,
  generateReleaseNotes,
  novaQuery,
  sendSprintChat,
  fetchSprintForecast,
  fetchSprintDrift,
  fetchSprintTeam,
  detectKnowledgeGaps,
} from "@/services/api";
import type { SprintForecast, KnowledgeGap } from "@/types";
import type { Project, ProjectSprint } from "../spacesData";
import styles from "./EOSTab.module.css";

// ─── Types ─────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "eos";
  text: string;
}

interface RetroSection {
  title: string;
  items: string[];
}

interface RiskItem {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  confidence: number;
  mitigation: string;
}

type DrawerType =
  | "chat"
  | "retro"
  | "release"
  | "risk"
  | "debt"
  | "teamperf"
  | "client"
  | "forecast"
  | "anomaly"
  | "gaps";

interface DrawerState {
  type: DrawerType;
  title: string;
  loading: boolean;
  data: any;
}

// ─── Parsers ────────────────────────────────────────────────────────────────

function parseRetroSections(text: string): RetroSection[] {
  const lines = text.split(/\r?\n/);
  const sections: RetroSection[] = [];
  let current: RetroSection | null = null;
  const HEADERS: { pattern: RegExp; title: string }[] = [
    { pattern: /went well|positives?|strengths?|wins?|highlights?/i, title: "What went well" },
    { pattern: /didn.?t|negatives?|challenges?|delta|not well/i, title: "What didn't go well" },
    { pattern: /action items?|next steps?|actions?|todo/i, title: "Action items" },
  ];
  for (const line of lines) {
    const clean = line.replace(/^#+\s*/, "").replace(/^\*{1,3}\s*/, "").trim();
    if (!clean) continue;
    const hdr = HEADERS.find(({ pattern }) => pattern.test(clean));
    if (hdr) { current = { title: hdr.title, items: [] }; sections.push(current); continue; }
    if (/^[-•*]\s+|^\d+\.\s+/.test(line)) {
      const item = line.replace(/^[-•*]\s+/, "").replace(/^\d+\.\s+/, "").trim();
      if (item && current) current.items.push(item);
    }
  }
  return sections.filter((s) => s.items.length > 0);
}

function parseReleaseNoteSections(text: string): { type: string; items: string[] }[] {
  const lines = text.split(/\r?\n/);
  const sections: { type: string; items: string[] }[] = [];
  let current: { type: string; items: string[] } | null = null;
  const TYPES: { pattern: RegExp; label: string }[] = [
    { pattern: /^features?$|new features?|enhancements?/i, label: "Features" },
    { pattern: /bug fixes?|fixes?|resolved|defects?/i, label: "Bug Fixes" },
    { pattern: /improvements?|chores?|maintenance|internal|tasks?/i, label: "Improvements" },
  ];
  for (const line of lines) {
    const clean = line.replace(/^#+\s*/, "").replace(/^\*{1,3}\s*/, "").trim();
    if (!clean) continue;
    const t = TYPES.find(({ pattern }) => pattern.test(clean));
    if (t) { current = { type: t.label, items: [] }; sections.push(current); continue; }
    if (/^[-•*]\s+|^\d+\.\s+/.test(line)) {
      const item = line.replace(/^[-•*]\s+/, "").replace(/^\d+\.\s+/, "").trim();
      if (item && current) current.items.push(item);
    }
  }
  return sections.filter((s) => s.items.length > 0);
}

function tryParseJsonArray<T>(text: string): T[] | null {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]) as T[];
    return null;
  } catch { return null; }
}

// ─── Shared UI ──────────────────────────────────────────────────────────────

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button className={styles.copyBtn} onClick={copy}>
      {copied ? <RiCheckLine size={11} /> : <RiFileCopyLine size={11} />}
      {copied ? "Copied" : label}
    </button>
  );
}

function ImpactBadge({ impact }: { impact: "high" | "medium" | "low" }) {
  const map = {
    high: { label: "High", color: "var(--red)" },
    medium: { label: "Medium", color: "var(--amber)" },
    low: { label: "Low", color: "var(--green)" },
  };
  const { label, color } = map[impact];
  return (
    <span className={styles.impactBadge} style={{ color, background: `${color}15`, borderColor: `${color}30` }}>
      {label}
    </span>
  );
}

function ConfBar({ value }: { value: number }) {
  const color = value >= 80 ? "var(--green)" : value >= 60 ? "var(--amber)" : "var(--red)";
  return (
    <div className={styles.confRow}>
      <span className={styles.confLabel}>Confidence</span>
      <div className={styles.confBarWrap}>
        <div className={styles.confBarFill} style={{ width: `${value}%`, background: color }} />
      </div>
      <span className={styles.confValue} style={{ color }}>{value}%</span>
    </div>
  );
}

function DrawerSpinner() {
  return (
    <div className={styles.drawerLoading}>
      <span className={styles.drawerSpinner} />
      <span className={styles.drawerLoadingText}>EOS is analysing…</span>
    </div>
  );
}

// ─── Drawer content renderers ──────────────────────────────────────────────

function RetroContent({ data }: { data: RetroSection[] }) {
  return (
    <div className={styles.drawerContent}>
      {data.map((section) => (
        <div key={section.title} className={styles.drawerSection}>
          <div className={styles.drawerSectionHeader}>
            <span className={styles.drawerSectionTitle}>{section.title}</span>
            <CopyBtn text={section.items.join("\n")} />
          </div>
          <ul className={styles.bulletList}>
            {section.items.map((item, i) => (
              <li key={i} className={styles.bulletItem}>
                <span className={styles.bullet} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className={styles.drawerFooter}>
        <CopyBtn
          text={data.map((s) => `${s.title}\n${s.items.map((i) => `• ${i}`).join("\n")}`).join("\n\n")}
          label="Copy all"
        />
      </div>
    </div>
  );
}

function ReleaseContent({ data }: { data: { version: string; sections: { type: string; items: string[] }[] } }) {
  const markdown = data.sections
    .map((s) => `## ${s.type}\n${s.items.map((i) => `- ${i}`).join("\n")}`)
    .join("\n\n");
  return (
    <div className={styles.drawerContent}>
      <div className={styles.releaseVersionRow}>
        <span className={styles.releaseVersion}>{data.version}</span>
        <CopyBtn text={markdown} label="Copy markdown" />
      </div>
      {data.sections.map((section) => (
        <div key={section.type} className={styles.drawerSection}>
          <span className={styles.drawerSectionTitle}>{section.type}</span>
          <ul className={styles.releaseList}>
            {section.items.map((item, i) => (
              <li key={i} className={styles.releaseItem}>
                <RiArrowRightLine size={10} color="var(--text-3)" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function RiskContent({ data }: { data: RiskItem[] }) {
  return (
    <div className={styles.drawerContent}>
      {data.map((risk, i) => (
        <div key={i} className={styles.riskCard}>
          <div className={styles.riskCardHeader}>
            <span className={styles.riskNum}>0{i + 1}</span>
            <span className={styles.riskTitle}>{risk.title}</span>
            <ImpactBadge impact={risk.impact} />
          </div>
          <p className={styles.riskDesc}>{risk.description}</p>
          <ConfBar value={risk.confidence} />
          <div className={styles.mitBox}>
            <RiLightbulbLine size={11} color="var(--accent)" />
            <span>{risk.mitigation}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DebtContent({ data }: { data: { percentage: number; threshold: number; insight: string; recommendation: string } }) {
  const over = data.percentage > data.threshold;
  const color = over ? "var(--red)" : "var(--green)";
  return (
    <div className={styles.drawerContent}>
      <div className={styles.debtGaugeRow}>
        <div className={styles.debtGauge}>
          <div className={styles.debtGaugeFill} style={{ width: `${Math.min(100, (data.percentage / 40) * 100)}%`, background: color }} />
          <div className={styles.debtThresholdLine} style={{ left: `${(data.threshold / 40) * 100}%` }} />
        </div>
        <span className={styles.debtPct} style={{ color }}>{data.percentage}%</span>
      </div>
      <div className={styles.debtMeta}>
        <span className={styles.debtLabel} style={{ color }}>
          {over ? `${data.percentage - data.threshold}pp above safe threshold` : "Within safe threshold"}
        </span>
        <span className={styles.debtThreshLabel}>Safe limit: {data.threshold}%</span>
      </div>
      <p className={styles.bodyText}>{data.insight}</p>
      <div className={styles.mitBox}>
        <RiLightbulbLine size={11} color="var(--accent)" />
        <span>{data.recommendation}</span>
      </div>
    </div>
  );
}

function TeamPerfContent({ data }: {
  data: {
    members: { name: string; role: string; utilization: number; overloaded: boolean; ticketCount: number; assignedPoints: number }[];
    pattern: string;
  };
}) {
  return (
    <div className={styles.drawerContent}>
      {data.members.map((m) => (
        <div key={m.name} className={styles.memberCard}>
          <div className={styles.memberCardLeft}>
            <div className={styles.memberInitials}>
              {m.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
          </div>
          <div className={styles.memberCardBody}>
            <div className={styles.memberNameRow}>
              <span className={styles.memberName}>{m.name}</span>
              <span className={styles.memberRole}>{m.role}</span>
              {m.overloaded && <span className={styles.overloadBadge}>Overloaded</span>}
            </div>
            <div className={styles.memberStats}>
              <span>{m.ticketCount} tickets</span>
              <span>·</span>
              <span>{m.assignedPoints} pts assigned</span>
            </div>
            <div className={styles.utilRow}>
              <div className={styles.utilBar}>
                <div
                  className={styles.utilFill}
                  style={{
                    width: `${Math.min(100, m.utilization)}%`,
                    background: m.overloaded ? "var(--red)" : "var(--green)",
                  }}
                />
              </div>
              <span className={styles.utilPct} style={{ color: m.overloaded ? "var(--red)" : "var(--text-3)" }}>
                {m.utilization}%
              </span>
            </div>
          </div>
        </div>
      ))}
      {data.pattern && (
        <div className={styles.mitBox} style={{ marginTop: 8 }}>
          <RiSparklingLine size={11} color="var(--accent)" />
          <span>{data.pattern}</span>
        </div>
      )}
    </div>
  );
}

function ClientContent({ data }: { data: string }) {
  return (
    <div className={styles.drawerContent}>
      <div className={styles.clientHeader}>
        <span className={styles.clientReadyBadge}>Ready to send</span>
        <CopyBtn text={data} label="Copy text" />
      </div>
      <div className={styles.clientBody}>{data}</div>
    </div>
  );
}

function ForecastContent({ data }: { data: SprintForecast }) {
  const prob = Math.round(data.current_probability);
  const color = prob >= 80 ? "var(--green)" : prob >= 60 ? "var(--amber)" : "var(--red)";
  const r = 26;
  const circ = 2 * Math.PI * r;
  return (
    <div className={styles.drawerContent}>
      <div className={styles.forecastProbRow}>
        <div className={styles.forecastRing}>
          <svg width={72} height={72} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={36} cy={36} r={r} fill="none" stroke="var(--border-2)" strokeWidth={6} />
            <circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={6}
              strokeDasharray={circ} strokeDashoffset={circ * (1 - prob / 100)} strokeLinecap="round" />
          </svg>
          <span className={styles.forecastPct} style={{ color }}>{prob}%</span>
        </div>
        <div className={styles.forecastMeta}>
          <span className={styles.forecastLabel}>Completion probability</span>
          {data.predicted_completion_date && (
            <p className={styles.forecastNote}>Predicted: {data.predicted_completion_date}</p>
          )}
          <p className={styles.forecastNote}>Historical accuracy: {Math.round(data.historical_accuracy)}%</p>
          <p className={styles.forecastNote}>
            Range: {Math.round(data.confidence_interval.lower)}% – {Math.round(data.confidence_interval.upper)}%
          </p>
        </div>
      </div>
      {data.nova_summary && <p className={styles.bodyText}>{data.nova_summary}</p>}
      {data.risk_factors?.length > 0 && (
        <div className={styles.drawerSection}>
          <span className={styles.drawerSectionTitle}>Risk factors</span>
          {data.risk_factors.map((r, i) => (
            <div key={i} className={styles.factorRow}>
              <RiAlertLine size={11} color={r.severity === "high" ? "var(--red)" : r.severity === "medium" ? "var(--amber)" : "var(--text-3)"} />
              <span>{r.factor}</span>
              <span className={styles.factorImpact}>−{Math.round(r.impact * 100)}pp</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnomalyContent({ data, summary }: { data: { type: string; severity: "high" | "medium" | "low"; description: string; date: string }[]; summary?: string }) {
  if (data.length === 0) {
    return (
      <div className={styles.drawerContent}>
        <div className={styles.emptyDrawer}>
          <RiEyeLine size={28} color="var(--text-3)" />
          <p>No anomalies detected — sprint is on a normal trajectory.</p>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.drawerContent}>
      {summary && <p className={styles.bodyText}>{summary}</p>}
      {data.map((a, i) => {
        const color = a.severity === "high" ? "var(--red)" : a.severity === "medium" ? "var(--amber)" : "var(--accent)";
        return (
          <div key={i} className={styles.anomalyCard}>
            <div className={styles.anomalyCardHeader}>
              <span className={styles.anomalySev} style={{ color, background: `${color}12`, borderColor: `${color}28` }}>
                {a.severity}
              </span>
              <span className={styles.anomalyDate}>{a.date}</span>
            </div>
            <span className={styles.anomalyType}>{a.type}</span>
            <p className={styles.anomalyDesc}>{a.description}</p>
          </div>
        );
      })}
    </div>
  );
}

function GapsContent({ data }: { data: KnowledgeGap[] }) {
  if (data.length === 0) {
    return (
      <div className={styles.drawerContent}>
        <div className={styles.emptyDrawer}>
          <RiSparklingLine size={28} color="var(--text-3)" />
          <p>No knowledge gaps detected — wiki coverage looks good.</p>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.drawerContent}>
      {data.slice(0, 6).map((gap) => (
        <div key={gap.id} className={styles.gapCard}>
          <div className={styles.gapCardHeader}>
            <span className={styles.gapTopic}>{gap.topic}</span>
            <span
              className={styles.gapPriority}
              style={{
                color: gap.wiki_coverage < 30 ? "var(--red)" : "var(--amber)",
                background: gap.wiki_coverage < 30 ? "#ff000015" : "#f5a62315",
                borderColor: gap.wiki_coverage < 30 ? "#ff000025" : "#f5a62325",
              }}
            >
              {gap.wiki_coverage < 30 ? "High" : "Medium"}
            </span>
          </div>
          <div className={styles.gapMeta}>
            <span>{gap.ticket_count} related tickets</span>
            <span>·</span>
            <span>{gap.wiki_coverage}% wiki coverage</span>
          </div>
          {gap.suggestion && (
            <div className={styles.mitBox}>
              <RiLightbulbLine size={10} color="var(--accent)" />
              <span>{gap.suggestion}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ChatDrawer({
  project,
  activeSprint,
  pod,
}: {
  project: Project;
  activeSprint: ProjectSprint | undefined;
  pod: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "eos",
      text: `I'm loaded with full context for **${project.name}**. ${
        activeSprint
          ? `Active sprint: **${activeSprint.name}** — ${activeSprint.donePoints}/${activeSprint.totalPoints} pts done.`
          : "No active sprint."
      } Ask me anything.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text }]);
    setLoading(true);
    try {
      const history = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role === "eos" ? "assistant" : "user", text: m.text }));
      let answer: string;
      if (activeSprint) {
        const res = await sendSprintChat(activeSprint.id, text, history);
        answer = res.text;
      } else {
        const res = await novaQuery(`[Project: ${project.name}, Pod: ${pod}] ${text}`);
        answer = res.answer;
      }
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: "eos", text: answer }]);
    } catch (e: any) {
      toast.error(e?.message ?? "EOS chat failed");
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, activeSprint, project, pod]);

  return (
    <div className={styles.chatDrawerBody}>
      <div className={styles.chatMessages}>
        {messages.map((msg) => (
          <div key={msg.id} className={`${styles.chatMsg} ${msg.role === "user" ? styles.chatMsgUser : styles.chatMsgEOS}`}>
            {msg.role === "eos" && (
              <div className={styles.chatAvatar}>
                <RiSparklingLine size={10} color="var(--accent)" />
              </div>
            )}
            <div className={styles.chatBubble}>
              {msg.text.split("**").map((part, i) =>
                i % 2 === 1 ? <strong key={i}>{part}</strong> : part
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className={`${styles.chatMsg} ${styles.chatMsgEOS}`}>
            <div className={styles.chatAvatar}><RiSparklingLine size={10} color="var(--accent)" /></div>
            <div className={`${styles.chatBubble} ${styles.chatTyping}`}>
              <span className={styles.dot} /><span className={styles.dot} /><span className={styles.dot} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className={styles.chatInputRow}>
        <input
          className={styles.chatField}
          placeholder={`Ask about ${project.name}…`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={loading}
        />
        <button className={styles.chatSend} onClick={send} disabled={!input.trim() || loading}>
          <RiSendPlaneLine size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Drawer shell ───────────────────────────────────────────────────────────

function Drawer({
  drawer,
  onClose,
  project,
  activeSprint,
  pod,
}: {
  drawer: DrawerState;
  onClose: () => void;
  project: Project;
  activeSprint: ProjectSprint | undefined;
  pod: string;
}) {
  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawerPanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <RiSparklingLine size={14} color="var(--accent)" />
          <span className={styles.drawerTitle}>{drawer.title}</span>
          <span className={styles.eosBadge} style={{ marginRight: "auto" }}>
            <RiSparklingLine size={8} />EOS
          </span>
          <button className={styles.drawerClose} onClick={onClose}>
            <RiCloseLine size={16} />
          </button>
        </div>

        <div className={styles.drawerBody}>
          {drawer.type === "chat" ? (
            <ChatDrawer project={project} activeSprint={activeSprint} pod={pod} />
          ) : drawer.loading ? (
            <DrawerSpinner />
          ) : !drawer.data ? (
            <div className={styles.emptyDrawer}>
              <p>No data yet. Try regenerating.</p>
            </div>
          ) : drawer.type === "retro" ? (
            <RetroContent data={drawer.data} />
          ) : drawer.type === "release" ? (
            <ReleaseContent data={drawer.data} />
          ) : drawer.type === "risk" ? (
            <RiskContent data={drawer.data} />
          ) : drawer.type === "debt" ? (
            <DebtContent data={drawer.data} />
          ) : drawer.type === "teamperf" ? (
            <TeamPerfContent data={drawer.data} />
          ) : drawer.type === "client" ? (
            <ClientContent data={drawer.data} />
          ) : drawer.type === "forecast" ? (
            <ForecastContent data={drawer.data} />
          ) : drawer.type === "anomaly" ? (
            <AnomalyContent data={drawer.data.anomalies} summary={drawer.data.summary} />
          ) : drawer.type === "gaps" ? (
            <GapsContent data={drawer.data} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Capability card ────────────────────────────────────────────────────────

function CapCard({
  icon,
  title,
  description,
  onActivate,
  loading,
  ctaLabel,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onActivate: () => void;
  loading: boolean;
  ctaLabel: string;
}) {
  return (
    <button className={styles.capCard} onClick={onActivate} disabled={loading}>
      <div className={styles.capCardIcon}>{icon}</div>
      <div className={styles.capCardBody}>
        <span className={styles.capCardTitle}>{title}</span>
        <p className={styles.capCardDesc}>{description}</p>
      </div>
      <div className={styles.capCardFooter}>
        {loading ? (
          <span className={styles.capCardLoading}>
            <span className={styles.spinner} /> Analysing…
          </span>
        ) : (
          <span className={styles.capCardCta}>
            <RiSparklingLine size={11} />
            {ctaLabel}
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

interface EOSTabProps {
  project: Project;
  activeSprint: ProjectSprint | undefined;
  pod: string;
}

export default function EOSTab({ project, activeSprint, pod }: EOSTabProps) {
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [activeLoading, setActiveLoading] = useState<DrawerType | null>(null);

  function openDrawer(type: DrawerType, title: string) {
    setDrawer({ type, title, loading: true, data: null });
  }
  function updateDrawer(data: any) {
    setDrawer((prev) => prev ? { ...prev, loading: false, data } : null);
  }
  function closeDrawer() {
    setDrawer(null);
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  function handleChat() {
    openDrawer("chat", "Ask EOS Anything");
    setDrawer({ type: "chat", title: "Ask EOS Anything", loading: false, data: true });
  }

  // ── Sprint Retro ──────────────────────────────────────────────────────────
  async function handleRetro() {
    if (!activeSprint) return;
    setActiveLoading("retro");
    openDrawer("retro", "Sprint Retrospective");
    try {
      const raw = await generateSprintRetro(activeSprint.id);
      const text: string = raw?.retro ?? raw?.content ?? raw?.result ?? JSON.stringify(raw);
      const sections = parseRetroSections(text);
      updateDrawer(sections.length > 0 ? sections : [{ title: "Retrospective", items: text.split("\n").filter(Boolean) }]);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate retro");
      closeDrawer();
    } finally {
      setActiveLoading(null);
    }
  }

  // ── Release Notes ─────────────────────────────────────────────────────────
  async function handleRelease() {
    if (!activeSprint) return;
    setActiveLoading("release");
    openDrawer("release", "Release Notes");
    try {
      const raw = await generateReleaseNotes(activeSprint.id);
      const text: string = raw?.release_notes ?? raw?.content ?? raw?.result ?? JSON.stringify(raw);
      const sections = parseReleaseNoteSections(text);
      const today = new Date().toISOString().slice(0, 10);
      updateDrawer({
        version: `v${today}`,
        sections: sections.length > 0 ? sections : [{ type: "Release Notes", items: text.split("\n").filter(Boolean) }],
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate release notes");
      closeDrawer();
    } finally {
      setActiveLoading(null);
    }
  }

  // ── Risk Assessment ───────────────────────────────────────────────────────
  async function handleRisk() {
    setActiveLoading("risk");
    openDrawer("risk", "Risk Assessment");
    try {
      const blockedCount = activeSprint?.tasks.filter((t) => t.status === "Blocked").length ?? 0;
      const pct = activeSprint ? Math.round((activeSprint.donePoints / activeSprint.totalPoints) * 100) : project.progress;
      const res = await novaQuery(
        `You are EOS, an AI for engineering risk analysis. Analyse the top 3 risks for project "${project.name}" (pod: ${pod}).
Sprint: ${activeSprint?.name ?? "none"}, ${pct}% done. Blocked tickets: ${blockedCount}. Team: ${project.members.length} members.
Return a JSON array of exactly 3 risks, each with: title, description, impact ("high"|"medium"|"low"), confidence (0-100), mitigation.
Return ONLY the JSON array.`
      );
      const parsed = tryParseJsonArray<RiskItem>(res.answer);
      if (parsed && parsed.length > 0) {
        updateDrawer(parsed);
      } else {
        const lines = res.answer.split("\n").filter((l) => l.trim());
        updateDrawer(lines.slice(0, 3).map((l, i) => ({
          title: `Risk ${i + 1}`,
          description: l.trim(),
          impact: (["high", "medium", "low"][i] as "high" | "medium" | "low"),
          confidence: 75 - i * 5,
          mitigation: "Review with the team and escalate if needed.",
        })));
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Risk assessment failed");
      closeDrawer();
    } finally {
      setActiveLoading(null);
    }
  }

  // ── Tech Debt ─────────────────────────────────────────────────────────────
  async function handleDebt() {
    setActiveLoading("debt");
    openDrawer("debt", "Technical Debt Analysis");
    try {
      const bugCount = activeSprint?.tasks.filter((t) => t.type === "Bug").length ?? 0;
      const total = Math.max(1, activeSprint?.tasks.length ?? 10);
      const bugPct = Math.round((bugCount / total) * 100);
      const res = await novaQuery(
        `You are EOS. Analyse technical debt for project "${project.name}" (pod: ${pod}).
Current sprint has ${bugCount} bug tickets out of ${total} total (${bugPct}% bug rate). Safe threshold: 15%.
Provide: overall debt percentage estimate, key insight (1-2 sentences), top recommendation (1 sentence).
Keep it concise.`
      );
      const pctMatch = res.answer.match(/\b(\d{1,3})\s*%/);
      const debtPct = pctMatch ? parseInt(pctMatch[1]) : bugPct + 8;
      const sentences = res.answer.replace(/\n/g, " ").split(/(?<=[.!?])\s+/);
      updateDrawer({
        percentage: Math.min(40, debtPct),
        threshold: 15,
        insight: sentences.slice(0, 2).join(" ").trim() || res.answer,
        recommendation: sentences.slice(2).join(" ").trim() || "Allocate 20% of next sprint to debt reduction.",
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Tech debt analysis failed");
      closeDrawer();
    } finally {
      setActiveLoading(null);
    }
  }

  // ── Team Performance ──────────────────────────────────────────────────────
  async function handleTeamPerf() {
    if (!activeSprint) return;
    setActiveLoading("teamperf");
    openDrawer("teamperf", "Team Performance");
    try {
      const teamData = await fetchSprintTeam(activeSprint.id);
      const roster = teamData.roster ?? [];
      const members = roster.map((m) => ({
        name: m.name,
        role: m.role,
        utilization: m.capacity_hours > 0 ? Math.round((m.assigned_points / m.capacity_hours) * 100) : 0,
        overloaded: (m.assigned_points / Math.max(1, m.capacity_hours)) > 1,
        ticketCount: m.ticket_count,
        assignedPoints: m.assigned_points,
      }));
      const patternRes = await novaQuery(
        `Sprint "${activeSprint.name}" for "${project.name}". Team: ${roster.map((m) => `${m.name}: ${m.ticket_count} tickets, ${m.assigned_points} pts`).join("; ")}.
In one sentence, identify the most important workload pattern or imbalance.`
      );
      updateDrawer({ members, pattern: patternRes.answer });
    } catch (e: any) {
      toast.error(e?.message ?? "Team analysis failed");
      closeDrawer();
    } finally {
      setActiveLoading(null);
    }
  }

  // ── Client Update ─────────────────────────────────────────────────────────
  async function handleClient() {
    setActiveLoading("client");
    openDrawer("client", "Client Status Update");
    try {
      const pct = activeSprint ? Math.round((activeSprint.donePoints / activeSprint.totalPoints) * 100) : project.progress;
      const done = activeSprint?.tasks.filter((t) => t.status === "Done") ?? [];
      const res = await novaQuery(
        `Write a professional project status update for "${project.name}" to send directly to a client.
Sprint: ${activeSprint?.name ?? "current phase"}, ${pct}% complete.
Goal: "${activeSprint?.goal ?? "delivery milestone"}".
Completed: ${done.slice(0, 4).map((t) => t.title).join("; ") || "core sprint deliverables"}.
End date: ${activeSprint?.endDate ?? "TBD"}.
Write 3 short paragraphs: overall status, key achievements, next milestone. Professional and concise.`
      );
      updateDrawer(res.answer);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate client update");
      closeDrawer();
    } finally {
      setActiveLoading(null);
    }
  }

  // ── Sprint Forecast ───────────────────────────────────────────────────────
  async function handleForecast() {
    if (!activeSprint) return;
    setActiveLoading("forecast");
    openDrawer("forecast", "Sprint Health Forecast");
    try {
      const data = await fetchSprintForecast(activeSprint.id);
      updateDrawer(data);
    } catch (e: any) {
      toast.error(e?.message ?? "Forecast failed");
      closeDrawer();
    } finally {
      setActiveLoading(null);
    }
  }

  // ── Anomaly Detection ─────────────────────────────────────────────────────
  async function handleAnomaly() {
    if (!activeSprint) return;
    setActiveLoading("anomaly");
    openDrawer("anomaly", "Anomaly Detection");
    try {
      const data = await fetchSprintDrift(activeSprint.id);
      updateDrawer({ anomalies: data.anomalies ?? [], summary: data.nova_summary });
    } catch (e: any) {
      toast.error(e?.message ?? "Anomaly scan failed");
      closeDrawer();
    } finally {
      setActiveLoading(null);
    }
  }

  // ── Knowledge Gaps ────────────────────────────────────────────────────────
  async function handleGaps() {
    setActiveLoading("gaps");
    openDrawer("gaps", "Knowledge Gap Analysis");
    try {
      const raw = await detectKnowledgeGaps();
      updateDrawer(raw?.gaps ?? raw ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Knowledge gap analysis failed");
      closeDrawer();
    } finally {
      setActiveLoading(null);
    }
  }

  // ─── Cards definition ────────────────────────────────────────────────────
  const CARDS = [
    {
      type: "chat" as DrawerType,
      icon: <RiSparklingLine size={20} color="var(--accent)" />,
      title: "Ask EOS Anything",
      description: "Chat with EOS pre-loaded with this project's full context — sprint data, team, tickets, history.",
      cta: "Open Chat",
      handler: handleChat,
      requiresSprint: false,
    },
    {
      type: "retro" as DrawerType,
      icon: <RiFlashlightLine size={20} color="var(--accent)" />,
      title: "Sprint Retrospective",
      description: "Structured retro from Done tickets — What went well, What didn't, Action items.",
      cta: "Generate Retro",
      handler: handleRetro,
      requiresSprint: true,
    },
    {
      type: "release" as DrawerType,
      icon: <RiTaskLine size={20} color="var(--accent)" />,
      title: "Release Notes",
      description: "Changelog grouped by Features, Bug Fixes, and Improvements — ready to share.",
      cta: "Generate Notes",
      handler: handleRelease,
      requiresSprint: true,
    },
    {
      type: "risk" as DrawerType,
      icon: <RiShieldLine size={20} color="var(--accent)" />,
      title: "Risk Assessment",
      description: "Top risks with impact rating, confidence level, and mitigation strategies.",
      cta: "Analyse Risks",
      handler: handleRisk,
      requiresSprint: false,
    },
    {
      type: "debt" as DrawerType,
      icon: <RiBarChartLine size={20} color="var(--accent)" />,
      title: "Technical Debt",
      description: "Debt accumulation rate from ticket type analysis — gauged against a safe threshold.",
      cta: "Analyse Debt",
      handler: handleDebt,
      requiresSprint: false,
    },
    {
      type: "teamperf" as DrawerType,
      icon: <RiTeamLine size={20} color="var(--accent)" />,
      title: "Team Performance",
      description: "Workload distribution, utilisation, and EOS pattern insights from sprint team data.",
      cta: "Analyse Team",
      handler: handleTeamPerf,
      requiresSprint: true,
    },
    {
      type: "client" as DrawerType,
      icon: <RiFileTextLine size={20} color="var(--accent)" />,
      title: "Client Status Update",
      description: "A polished, professional project update written by EOS — ready to send to a client.",
      cta: "Generate Update",
      handler: handleClient,
      requiresSprint: false,
    },
    {
      type: "forecast" as DrawerType,
      icon: <RiRocketLine size={20} color="var(--accent)" />,
      title: "Sprint Forecast",
      description: "Predicts completion probability with risk factors and actionable suggestions.",
      cta: "Forecast Sprint",
      handler: handleForecast,
      requiresSprint: true,
    },
    {
      type: "anomaly" as DrawerType,
      icon: <RiEyeLine size={20} color="var(--accent)" />,
      title: "Anomaly Detection",
      description: "Statistical anomalies in velocity, bug rates, and PR review times — before they become incidents.",
      cta: "Run Scan",
      handler: handleAnomaly,
      requiresSprint: true,
    },
    {
      type: "gaps" as DrawerType,
      icon: <RiUserLine size={20} color="var(--accent)" />,
      title: "Knowledge Gaps",
      description: "Wiki coverage gaps from ticket topics — with EOS training recommendations.",
      cta: "Identify Gaps",
      handler: handleGaps,
      requiresSprint: false,
    },
  ].filter((c) => !c.requiresSprint || !!activeSprint);

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.tabHeader}>
        <RiSparklingLine size={15} color="var(--accent)" />
        <span className={styles.tabHeaderTitle}>EOS Intelligence</span>
        <span className={styles.eosBadge}>
          <RiSparklingLine size={8} />EOS
        </span>
        {activeSprint ? (
          <span className={styles.sprintChip}>
            {activeSprint.name} · {activeSprint.donePoints}/{activeSprint.totalPoints} pts
          </span>
        ) : (
          <span className={styles.noSprintChip}>No active sprint — some features unavailable</span>
        )}
      </div>

      {/* Cards grid */}
      <div className={styles.capGrid}>
        {CARDS.map((card) => (
          <CapCard
            key={card.type}
            icon={card.icon}
            title={card.title}
            description={card.description}
            onActivate={card.handler}
            loading={activeLoading === card.type}
            ctaLabel={card.cta}
          />
        ))}
      </div>

      {/* Drawer */}
      {drawer && (
        <Drawer
          drawer={drawer}
          onClose={closeDrawer}
          project={project}
          activeSprint={activeSprint}
          pod={pod}
        />
      )}
    </div>
  );
}
